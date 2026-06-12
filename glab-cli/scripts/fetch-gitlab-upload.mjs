#!/usr/bin/env node

/**
 * Download a GitLab issue/MR upload (image, PDF, …) through the authenticated
 * API and validate it BEFORE Claude Code ever reads it.
 *
 * Why this exists: uploads referenced in a description/comment Markdown live at
 * `/uploads/<secret>/<filename>`. That web path is NOT served by the API token
 * on most instances — an unauthenticated/under-authenticated request returns a
 * 302 to /users/sign_in or a 200 with the HTML login page, NOT the image. If
 * such a response is saved as `foo.png` and Claude Code tries to read it as an
 * image, the malformed bytes crash the whole session.
 *
 * Token-authenticated routes (verified on GitLab CE 18.11), tried in order:
 *   1. GET /api/v4/projects/:id/uploads/:upload_id — used first when a numeric
 *      id is given (the most direct route).
 *   2. GET /api/v4/projects/:id/uploads/:secret/:filename — derived straight
 *      from the Markdown URL; the filename MUST use GitLab's stored Unicode
 *      normalization (NFD), so each encoding variant is attempted. This is the
 *      dependable path for issue/MR attachments.
 *   3. Fallback: list `GET /api/v4/projects/:id/uploads`, match on filename
 *      (newest wins on collisions), then download by id. Only finds uploads
 *      owned by the project; cross-scope uploads stay invisible here.
 * Each download 302-redirects to presigned object storage — see authedGet.
 *
 * The token is read from glab's own config (~/.config/glab-cli/config.yml) and
 * is never printed, logged, or passed on the command line.
 *
 * Contract with the caller (Claude Code):
 *   - exit 0  → a VALID media file was written; the printed path is safe to Read.
 *   - exit 3  → the download was NOT a valid image (HTML login / 404 / corrupt);
 *               a `*.invalid.txt` diagnostic file is written instead and MUST
 *               NOT be Read as an image.
 *   - exit 1/2 → usage or transport error (nothing dangerous written).
 *
 * Usage:
 *   node fetch-gitlab-upload.mjs --host <h> --project <path|id> --upload-id <n>
 *   node fetch-gitlab-upload.mjs --host <h> --project <path|id> \
 *        --secret <hash> --filename '<name>'
 *   node fetch-gitlab-upload.mjs --url 'https://host/group/proj/uploads/<secret>/<name>'
 *
 * Optional: --out-dir <dir> (default: ./gitlab-uploads), --token-env <VAR>
 *   (read the token from an env var instead of glab config — e.g. CI).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_TRANSPORT = 2;
const EXIT_NOT_IMAGE = 3;

/**
 * Known binary media signatures. Each entry validates the leading bytes of a
 * download. SVG is text-based, so it is matched separately on its content.
 *
 * @type {ReadonlyArray<{ ext: string, mime: string, bytes: ReadonlyArray<number> }>}
 */
const MAGIC = [
  { ext: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'gif', mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: 'webp', mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" (+ WEBP at offset 8, checked below)
  { ext: 'bmp', mime: 'image/bmp', bytes: [0x42, 0x4d] },
  { ext: 'pdf', mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

/**
 * Parse `--flag value` style arguments into a plain object.
 *
 * @param {string[]} argv - Raw process arguments (without node + script path).
 * @returns {Record<string, string>} Parsed flags keyed without the leading `--`.
 */
const parseArgs = argv => {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
};

/**
 * Read the GitLab API token for a host from glab's config, falling back to an
 * environment variable. The value is never returned to any logging path.
 *
 * @param {string} host - GitLab host (e.g. "gitlab.example.net").
 * @param {string} [tokenEnv] - Env var name to read the token from instead.
 * @returns {Promise<string>} The bearer/private token.
 */
const readToken = async (host, tokenEnv) => {
  if (tokenEnv) {
    const fromEnv = process.env[tokenEnv];
    if (!fromEnv) throw new Error(`Env var ${tokenEnv} is empty or unset`);
    return fromEnv.trim();
  }
  const configPath = path.join(homedir(), '.config', 'glab-cli', 'config.yml');
  const raw = await readFile(configPath, 'utf8');
  // Minimal scoped parse: find the host block, then its `token:` line. We avoid
  // pulling a YAML dependency for a single value and never echo the match.
  const lines = raw.split('\n');
  let inHosts = false;
  let inHost = false;
  let hostIndent = -1;
  for (const line of lines) {
    if (/^hosts:\s*$/.test(line)) { inHosts = true; continue; }
    if (!inHosts) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    if (!inHost && trimmed === `${host}:`) { inHost = true; hostIndent = indent; continue; }
    if (inHost) {
      // A line at or below the host's own indent ends the host block.
      if (trimmed && indent <= hostIndent) break;
      const match = trimmed.match(/^token:\s*(.+)$/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  throw new Error(`No token found for host "${host}" in ${configPath}`);
};

/**
 * Perform an authenticated GET against the GitLab API, following redirects
 * MANUALLY so the token is never leaked to a foreign host.
 *
 * This matters because the upload download endpoint (`/uploads/:id`) does not
 * return the bytes directly: it 302-redirects to a presigned object-storage URL
 * (e.g. S3/OVH) whose signature is self-authenticating. If `fetch`'s automatic
 * redirect re-sends the `PRIVATE-TOKEN` header to that storage host, the
 * storage rejects the request (401) for carrying a stray auth header. So we
 * send the token ONLY to the GitLab host and drop all auth on cross-host hops.
 *
 * Only `PRIVATE-TOKEN` is sent — sending both PRIVATE-TOKEN and Bearer at once
 * makes GitLab answer 401.
 *
 * @param {string} url - Absolute URL to fetch.
 * @param {string} token - GitLab token (never logged).
 * @returns {Promise<{ status: number, contentType: string, body: Buffer }>}
 */
const authedGet = async (url, token) => {
  const startHost = new URL(url).host;
  let current = url;
  let res;
  for (let hop = 0; hop < 5; hop += 1) {
    const sameHost = new URL(current).host === startHost;
    res = await fetch(current, {
      // Auth only on the originating GitLab host; never on a redirect target.
      headers: sameHost ? { 'PRIVATE-TOKEN': token } : {},
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    break;
  }
  const body = Buffer.from(await res.arrayBuffer());
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', body };
};

/**
 * Build the candidate percent-encodings of an upload filename. GitLab matches
 * the upload path against the EXACT Unicode normalization it stored, which is
 * NFD (decomposed: "é" → "e" + U+0301). A filename pulled from a URL or pasted
 * by a human is usually NFC (precomposed), which yields a spurious 404. We try
 * NFD first, then NFC, then the raw form.
 *
 * @param {string} filename - Raw filename (may contain spaces/accents).
 * @returns {string[]} Distinct percent-encoded filename variants to try in order.
 */
const filenameEncodings = filename => {
  const variants = [
    encodeURIComponent(filename.normalize('NFD')),
    encodeURIComponent(filename.normalize('NFC')),
    encodeURIComponent(filename),
  ];
  return [...new Set(variants)];
};

/**
 * Resolve a numeric upload id by listing the project's uploads and matching on
 * filename. When several uploads share a filename, the most recent is chosen.
 *
 * @param {object} ctx - Resolution context.
 * @param {string} ctx.apiBase - API base, e.g. "https://host/api/v4".
 * @param {string} ctx.projectId - URL-encoded project path or numeric id.
 * @param {string} ctx.filename - Filename to match (decoded).
 * @param {string} ctx.token - GitLab token.
 * @returns {Promise<number|null>} Matching upload id, or null if none found.
 */
const resolveUploadId = async ({ apiBase, projectId, filename, token }) => {
  const matches = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = `${apiBase}/projects/${projectId}/uploads?per_page=100&page=${page}`;
    const { status, body } = await authedGet(url, token);
    if (status !== 200) break;
    let list;
    try {
      list = JSON.parse(body.toString('utf8'));
    } catch {
      break;
    }
    if (!Array.isArray(list) || list.length === 0) break;
    for (const upload of list) {
      if (upload.filename === filename) matches.push(upload);
    }
    if (list.length < 100) break;
  }
  if (matches.length === 0) return null;
  const newest = matches.reduce((best, cur) =>
    (cur.created_at ?? '') > (best.created_at ?? '') ? cur : best,
  );
  if (matches.length > 1) {
    console.error(
      `Note: ${matches.length} uploads named "${filename}"; selected the most recent (id ${newest.id}, ${newest.created_at}).`,
    );
  }
  return newest.id;
};

/**
 * Validate a downloaded buffer against known media signatures.
 *
 * @param {Buffer} body - Downloaded bytes.
 * @param {string} contentType - Response Content-Type header.
 * @returns {{ ok: true, ext: string, mime: string } | { ok: false, reason: string }}
 */
const validateMedia = (body, contentType) => {
  if (body.length === 0) return { ok: false, reason: 'empty body' };

  const head = body.subarray(0, 16);
  const starts = bytes => bytes.every((b, i) => head[i] === b);

  for (const sig of MAGIC) {
    if (!starts(sig.bytes)) continue;
    if (sig.ext === 'webp') {
      // RIFF container: confirm the WEBP fourCC at offset 8.
      if (body.subarray(8, 12).toString('ascii') !== 'WEBP') continue;
    }
    return { ok: true, ext: sig.ext, mime: sig.mime };
  }

  // SVG is XML text; accept only when it actually looks like SVG, not any XML.
  const asText = body.subarray(0, 512).toString('utf8').trimStart();
  if (/^<\?xml[^>]*\?>\s*<svg[\s>]/i.test(asText) || /^<svg[\s>]/i.test(asText)) {
    return { ok: true, ext: 'svg', mime: 'image/svg+xml' };
  }

  // Everything else is unsafe to hand to Claude as an image. Name the most
  // common culprit so the user can act (re-auth, wrong URL, etc.).
  let reason = `unrecognized signature (content-type: ${contentType || 'unknown'})`;
  if (/<!doctype html|<html[\s>]/i.test(asText)) {
    reason = 'HTML page (likely a login/redirect — token lacks access or wrong URL)';
  } else if (asText.startsWith('{') && /"message"\s*:/.test(asText)) {
    reason = `API error JSON (${asText.slice(0, 80).replace(/\s+/g, ' ')})`;
  }
  return { ok: false, reason };
};

/**
 * Derive { apiBase, host, secret, filename } from an explicit upload URL.
 *
 * @param {string} rawUrl - Full upload URL.
 * @returns {{ host: string, apiBase: string, secret: string, filename: string, projectPath: string|null }}
 */
const parseUploadUrl = rawUrl => {
  const u = new URL(rawUrl);
  const apiBase = `${u.protocol}//${u.host}/api/v4`;
  // .../<group>/<project>/uploads/<secret>/<filename>  OR  .../uploads/<secret>/<filename>
  const m = u.pathname.match(/^\/?(.*?)\/?uploads\/([0-9a-f]{32})\/(.+)$/i);
  if (!m) throw new Error(`URL does not contain an /uploads/<secret>/<filename> path: ${rawUrl}`);
  const projectPath = m[1] ? m[1].replace(/^\/|\/$/g, '') || null : null;
  return {
    host: u.host,
    apiBase,
    secret: m[2],
    filename: decodeURIComponent(m[3]),
    projectPath,
  };
};

/** Print usage and exit. */
const usage = () => {
  console.error(
    [
      'Usage:',
      '  fetch-gitlab-upload.mjs --host <h> --project <path|id> --upload-id <n>',
      '  fetch-gitlab-upload.mjs --host <h> --project <path|id> --secret <hash> --filename <name>',
      "  fetch-gitlab-upload.mjs --url 'https://host/group/proj/uploads/<secret>/<name>'",
      '',
      'Options: --out-dir <dir> (default ./gitlab-uploads), --token-env <VAR>',
    ].join('\n'),
  );
  process.exit(EXIT_USAGE);
};

/** Main entry point. */
const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  let host = args.host;
  let project = args.project;
  let secret = args.secret;
  let filename = args.filename;

  if (args.url) {
    const parsed = parseUploadUrl(args.url);
    host = host ?? parsed.host;
    secret = secret ?? parsed.secret;
    filename = filename ?? parsed.filename;
    // The URL's project path is the safest project identifier when present.
    if (!project && parsed.projectPath) project = parsed.projectPath;
  }

  if (!host || !project) usage();
  if (!args['upload-id'] && (!secret || !filename)) usage();

  const apiBase = `https://${host}/api/v4`;
  const projectId = encodeURIComponent(project);
  const outDir = args['out-dir'] ?? path.join(process.cwd(), 'gitlab-uploads');

  let token;
  try {
    token = await readToken(host, args['token-env']);
  } catch (err) {
    console.error(`Token resolution failed: ${err.message}`);
    process.exit(EXIT_TRANSPORT);
  }

  // Build the ordered list of candidate download URLs.
  /** @type {string[]} */
  const candidates = [];
  if (args['upload-id']) {
    candidates.push(`${apiBase}/projects/${projectId}/uploads/${args['upload-id']}`);
  }
  if (secret && filename) {
    // Documented route. GitLab matches the stored Unicode normalization (NFD),
    // so try each encoding variant; a wrong normalization 404s silently.
    for (const enc of filenameEncodings(filename)) {
      candidates.push(`${apiBase}/projects/${projectId}/uploads/${secret}/${enc}`);
    }
  }

  let download = null;
  for (const url of candidates) {
    try {
      const res = await authedGet(url, token);
      if (res.status === 200) {
        download = res;
        break;
      }
    } catch (err) {
      console.error(`Request error for a candidate URL: ${err.message}`);
    }
  }

  // Fallback: resolve the numeric upload id from the project upload list.
  if (!download && filename) {
    const id = await resolveUploadId({ apiBase, projectId, filename, token }).catch(err => {
      console.error(`Upload-id resolution failed: ${err.message}`);
      return null;
    });
    if (id !== null) {
      const res = await authedGet(`${apiBase}/projects/${projectId}/uploads/${id}`, token);
      if (res.status === 200) download = res;
    }
  }

  if (!download) {
    console.error('Could not retrieve the upload through any authenticated route.');
    console.error('Check: project path/id correct, token has at least Guest access, upload still exists.');
    process.exit(EXIT_TRANSPORT);
  }

  await mkdir(outDir, { recursive: true });
  const baseName = (filename ?? `upload-${args['upload-id'] ?? 'unknown'}`).replace(/[/\\]/g, '_');

  const verdict = validateMedia(download.body, download.contentType);
  if (!verdict.ok) {
    const invalidPath = path.join(outDir, `${baseName}.invalid.txt`);
    const preview = download.body.subarray(0, 800).toString('utf8');
    await writeFile(
      invalidPath,
      `NOT A VALID IMAGE — do NOT read this as an image.\nReason: ${verdict.reason}\n\n--- first 800 bytes (text preview) ---\n${preview}\n`,
    );
    console.error(`⚠️  NON-IMAGE: ${verdict.reason}`);
    console.error(`    Wrote diagnostic (text, NOT an image): ${invalidPath}`);
    console.error('    DO NOT Read this file as an image. Likely cause: token lacks access or wrong URL.');
    process.exit(EXIT_NOT_IMAGE);
  }

  // Give the file the extension that matches its real signature, not the URL's.
  const finalName = baseName.toLowerCase().endsWith(`.${verdict.ext}`)
    ? baseName
    : `${baseName}.${verdict.ext}`;
  const outPath = path.join(outDir, finalName);
  await writeFile(outPath, download.body);
  console.log(`✅ Valid ${verdict.mime} (${download.body.length} bytes). Safe to Read: ${outPath}`);
  process.exit(EXIT_OK);
};

main().catch(err => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(EXIT_TRANSPORT);
});
