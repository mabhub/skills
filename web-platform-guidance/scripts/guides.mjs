#!/usr/bin/env node
/**
 * Local copy and search of the modern-web-guidance guides (Apache-2.0, Google).
 *
 * Commands:
 *   sync [--from <archive.tgz>] [--source npm|github]  fetch, verify, extract, rewrite links, index
 *   index                                              rebuild the index offline
 *   search <query…> [--top N] [--category <cat>]       BM25 search over the guides
 *   list [<category>]                                  categories, or guides of one
 *
 * Nothing from the upstream package is ever executed: only Markdown guides,
 * gen/guides.json, skill-version.txt and LICENSE are extracted, with a strict
 * path whitelist, and the guide set is checked against a pinned manifest digest.
 * Once verified, every cross-guide link of the form
 *   (via `npx -y modern-web-guidance@latest retrieve "<id>"`)
 * is rewritten to the guide's local path, so no guide ever suggests running the
 * upstream CLI. Any leftover npx reference aborts the sync.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';

const PINNED = {
  version: '1.0.1',
  npmUrl: 'https://registry.npmjs.org/modern-web-guidance/-/modern-web-guidance-1.0.1.tgz',
  npmIntegrity: 'sha512-5ztUh5F1p2PewnSkA6EhsGUXqomaZY9qe6iWJCU4JbIQxHTky7s5lMJcPE4EbD1uhbQZIhl0HROH0+s6fIiGzg==',
  githubCommit: '64a6d708f5a43f2cd3fde5d4d7db3905ba1bdf65',
  // sha256 of the sorted "<category>/<id>.md <git blob sha1>" lines, joined by "\n".
  // Same 210 guides in the npm archive 1.0.1 and at the GitHub commit above.
  guidesManifestSha256: '9e1e3cdbdf69df3c02b045d3d95f70610970eac61f545a524aed911017e83f97',
  guidesCount: 210,
};

const GITHUB_URL = `https://codeload.github.com/GoogleChrome/modern-web-guidance/tar.gz/${PINNED.githubCommit}`;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const SKILL_PREFIX = 'skills/modern-web-guidance/';

const FIELD_WEIGHTS = {
  id: 4,
  title: 3,
  features: 2.5,
  description: 2,
  headings: 1.5,
  code: 1,
  body: 0.3,
};

const BM25 = { k1: 1.2, b: 0.75 };

const STOPWORDS = new Set(`a an and are as at be by can do does for from has have how i if in into is it its
of on or so that the their them then there these this to use used using via was what when where which
while who why will with without you your yes no not all any each more most other some such than too very
should would could may might must just also only own same both few further once here over under again`.split(/\s+/));

/**
 * Resolve the cache root directory
 * @returns {string} Absolute cache root
 */
const cacheRoot = () => process.env.WEB_PLATFORM_GUIDANCE_CACHE
  ?? path.join(process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache'), 'web-platform-guidance');

const versionDir = () => path.join(cacheRoot(), PINNED.version);
const guidesDir = () => path.join(versionDir(), 'guides');
const indexFile = () => path.join(versionDir(), 'index.json');
const metaFile = () => path.join(versionDir(), 'meta.json');
const cachedNpmArchive = () => path.join(cacheRoot(), 'archives', `modern-web-guidance-${PINNED.version}.tgz`);

/**
 * Print a message on stderr and exit
 * @param {string} message - Message for the user
 * @param {number} [code=1] - Exit code
 */
const fail = (message, code = 1) => {
  process.stderr.write(`${message}\n`);
  process.exit(code);
};

const sha512Integrity = buffer => `sha512-${createHash('sha512').update(buffer).digest('base64')}`;

const gitBlobSha1 = buffer => createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');

/**
 * Download a URL into memory, with timeout and size cap
 * @param {string} url - URL to fetch
 * @returns {Promise<Buffer>} Response body
 */
const download = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_ARCHIVE_BYTES) {
    throw new Error(`archive too large (${declared} bytes): ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`archive too large (${buffer.length} bytes): ${url}`);
  }
  return buffer;
};

/**
 * Parse a NUL-terminated or space-padded octal tar field
 * @param {Buffer} block - Header block
 * @param {number} start - Field offset
 * @param {number} length - Field length
 * @returns {number} Parsed value
 */
const readOctal = (block, start, length) => {
  const text = block.subarray(start, start + length).toString('ascii').replace(/\0.*$/s, '').trim();
  return text === '' ? 0 : Number.parseInt(text, 8);
};

const readString = (block, start, length) => block.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');

/**
 * Read the "path" record of a pax extended header
 * @param {Buffer} data - Pax header payload
 * @returns {string|undefined} Path, if present
 */
const paxPath = data => data.toString('utf8').split('\n')
  .map(record => record.replace(/^\d+ /, ''))
  .find(record => record.startsWith('path='))
  ?.slice('path='.length);

/**
 * Iterate over the regular files of an uncompressed tar archive
 * @param {Buffer} tar - Uncompressed tar bytes
 * @yields {{name: string, data: Buffer}} Regular file entries
 */
function* tarEntries(tar) {
  let offset = 0;
  let longName;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      return;
    }
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const data = tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (type === 'x') {
      longName = paxPath(data) ?? longName;
      continue;
    }
    if (type === 'L') {
      longName = data.toString('utf8').replace(/\0.*$/s, '');
      continue;
    }
    const prefix = readString(header, 345, 155);
    const name = longName ?? (prefix ? `${prefix}/${readString(header, 0, 100)}` : readString(header, 0, 100));
    longName = undefined;
    if (type === '0') {
      yield { name, data };
    }
  }
}

/**
 * Map an archive member to its destination inside the version dir, or reject it
 * @param {string} member - Path inside the archive
 * @returns {string|null} Relative destination, or null when not whitelisted
 */
const destinationFor = member => {
  const relative = member.split('/').slice(1).join('/');
  if (relative === 'LICENSE') {
    return 'LICENSE';
  }
  if (!relative.startsWith(SKILL_PREFIX)) {
    return null;
  }
  const inner = relative.slice(SKILL_PREFIX.length);
  const fixed = { 'gen/guides.json': 'guides.json', 'skill-version.txt': 'skill-version.txt' };
  if (fixed[inner]) {
    return fixed[inner];
  }
  const match = inner.match(/^guides\/([^/]+)\/([^/]+)\.md$/);
  return match && SAFE_SEGMENT.test(match[1]) && SAFE_SEGMENT.test(match[2])
    ? path.join('guides', match[1], `${match[2]}.md`)
    : null;
};

/**
 * Compute the manifest digest of an extracted guides directory
 * @param {string} dir - Directory holding <category>/<id>.md
 * @returns {{count: number, digest: string}} Guide count and digest
 */
const guidesManifest = dir => {
  const lines = readdirSync(dir).flatMap(category => readdirSync(path.join(dir, category))
    .map(file => `${category}/${file} ${gitBlobSha1(readFileSync(path.join(dir, category, file)))}`));
  const sorted = lines.toSorted();
  return { count: sorted.length, digest: createHash('sha256').update(sorted.join('\n')).digest('hex') };
};

const RETRIEVE_LINK = /\(via `npx -y modern-web-guidance@latest retrieve "([a-z0-9-]+)"`\)/g;
const LEFTOVER_NPX = /npx[^\n`]*modern-web-guidance|modern-web-guidance@/;

/**
 * Rewrite upstream "retrieve" links to local guide paths, in place
 * @param {string} dir - Directory holding <category>/<id>.md
 * @returns {number} Number of links rewritten
 * @throws {Error} When a link targets an unknown guide or an npx reference remains
 */
const rewriteGuideLinks = dir => {
  const files = readdirSync(dir).flatMap(category => readdirSync(path.join(dir, category))
    .map(file => `${category}/${file}`));
  const byId = new Map(files.map(key => [path.basename(key, '.md'), key]));
  if (byId.size !== files.length) {
    throw new Error('two guides share the same id: links would be ambiguous');
  }
  return files.reduce((count, key) => {
    const file = path.join(dir, key);
    const source = readFileSync(file, 'utf8');
    let rewritten = 0;
    const text = source.replace(RETRIEVE_LINK, (link, id) => {
      if (!byId.has(id)) {
        return link;
      }
      rewritten += 1;
      return `(\`${byId.get(id)}\`)`;
    });
    if (LEFTOVER_NPX.test(text)) {
      throw new Error(`npx reference left in ${key}`);
    }
    if (rewritten > 0) {
      writeFileSync(file, text);
    }
    return count + rewritten;
  }, 0);
};

/**
 * Extract whitelisted files of a .tgz into the version dir, after manifest check
 * @param {Buffer} archive - Gzipped tar bytes
 * @param {Object} meta - Provenance written to meta.json
 */
const extractArchive = (archive, meta) => {
  const staging = `${versionDir()}.tmp`;
  const stagedGuides = path.join(staging, 'guides');
  rmSync(staging, { recursive: true, force: true });
  try {
    for (const { name, data } of tarEntries(gunzipSync(archive, { maxOutputLength: 4 * MAX_ARCHIVE_BYTES }))) {
      const destination = destinationFor(name);
      if (destination === null) {
        continue;
      }
      if (data.length > MAX_FILE_BYTES) {
        throw new Error(`file too large in archive: ${name}`);
      }
      const target = path.join(staging, destination);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
    if (!existsSync(stagedGuides)) {
      throw new Error('no guide found in archive');
    }
    const manifest = guidesManifest(stagedGuides);
    if (manifest.count !== PINNED.guidesCount || manifest.digest !== PINNED.guidesManifestSha256) {
      throw new Error(`guides do not match pinned version (${manifest.count} guides, digest ${manifest.digest.slice(0, 12)}…)`);
    }
    const linksRewritten = rewriteGuideLinks(stagedGuides);
    writeFileSync(path.join(staging, 'meta.json'), `${JSON.stringify({ ...meta, version: PINNED.version, linksRewritten, syncedAt: new Date().toISOString() }, null, 2)}\n`);
    rmSync(versionDir(), { recursive: true, force: true });
    renameSync(staging, versionDir());
  } finally {
    // No-op after a successful rename; otherwise drops a partial extraction.
    rmSync(staging, { recursive: true, force: true });
  }
};

/**
 * Load the npm archive from a file, the cache, or the registry, and verify it
 * @param {string|undefined} fromFile - User-supplied archive path
 * @returns {Promise<{archive: Buffer, origin: string}>} Verified archive
 */
const loadNpmArchive = async fromFile => {
  const candidates = fromFile ? [fromFile] : [cachedNpmArchive()];
  for (const file of candidates.filter(existsSync)) {
    const archive = readFileSync(file);
    if (sha512Integrity(archive) === PINNED.npmIntegrity) {
      return { archive, origin: file };
    }
    if (fromFile) {
      throw new Error(`sha512 differs from pinned version ${PINNED.version}: ${file}`);
    }
  }
  const archive = await download(PINNED.npmUrl);
  if (sha512Integrity(archive) !== PINNED.npmIntegrity) {
    throw new Error(`unexpected sha512 for ${PINNED.npmUrl}`);
  }
  return { archive, origin: PINNED.npmUrl };
};

/**
 * Keep a verified npm archive in the cache, so `sync` can rebuild offline
 * @param {Buffer} archive - Verified archive bytes
 */
const cacheNpmArchive = archive => {
  if (!existsSync(cachedNpmArchive())) {
    mkdirSync(path.dirname(cachedNpmArchive()), { recursive: true });
    writeFileSync(cachedNpmArchive(), archive);
  }
};

const SYNC_SOURCES = {
  npm: async fromFile => {
    const { archive, origin } = await loadNpmArchive(fromFile);
    extractArchive(archive, { source: 'npm', origin });
    cacheNpmArchive(archive);
    return origin;
  },
  github: async () => {
    extractArchive(await download(GITHUB_URL), { source: 'github', origin: GITHUB_URL, commit: PINNED.githubCommit });
    return GITHUB_URL;
  },
};

/**
 * Normalize a word: crude English plural stripping
 * @param {string} word - Lowercase word
 * @returns {string} Stemmed word
 */
const stem = word => {
  if (word.length > 4 && word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`;
  }
  return word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word;
};

/**
 * Split text into search terms; keeps hyphenated compounds and :pseudo / @rule tokens whole
 * @param {string} text - Any text
 * @returns {string[]} Terms
 */
const tokenize = text => [...text.toLowerCase().matchAll(/[:@]?[a-z0-9]+(?:-[a-z0-9]+)*/g)]
  .flatMap(([word]) => {
    const bare = word.replace(/^[:@]/, '');
    const parts = bare.split('-').filter(part => part.length > 1 && !STOPWORDS.has(part)).map(stem);
    const whole = word !== bare || bare.includes('-') ? [word] : [];
    return [...whole, ...parts];
  });

/**
 * Parse one guide into indexable fields
 * @param {string} markdown - Guide source
 * @returns {{title: string, intro: string, headings: string[], code: string[], body: string}} Fields
 */
const parseGuide = markdown => {
  const lines = markdown.split('\n');
  const title = (lines.find(line => line.startsWith('# ')) ?? '').slice(2).trim();
  const paragraphs = markdown.split(/\n\s*\n/).map(block => block.trim());
  const intro = paragraphs.find(block => block && !block.startsWith('#') && !block.startsWith('```')) ?? '';
  const headings = lines.filter(line => /^#{2,3} /.test(line)).map(line => line.replace(/^#+ /, '').trim());
  const code = [...new Set([...markdown.matchAll(/`([^`\n]{1,60})`/g)].map(([, inner]) => inner))];
  return { title, intro: intro.replace(/\s+/g, ' ').slice(0, 300), headings, code, body: markdown };
};

/**
 * Build the BM25 index from the extracted guides
 * @returns {{docs: Object[], df: Object, avgLength: number, source: string}} Index
 */
const buildIndex = () => {
  if (!existsSync(guidesDir())) {
    fail('Guides missing: run `guides.mjs sync` first.');
  }
  const meta = JSON.parse(readFileSync(metaFile(), 'utf8'));
  const guidesJsonFile = path.join(versionDir(), 'guides.json');
  const upstream = existsSync(guidesJsonFile)
    ? new Map(JSON.parse(readFileSync(guidesJsonFile, 'utf8')).map(entry => [`${entry.category}/${entry.id}`, entry]))
    : new Map();

  const docs = readdirSync(guidesDir()).toSorted().flatMap(category => readdirSync(path.join(guidesDir(), category)).toSorted()
    .map(file => {
      const id = file.replace(/\.md$/, '');
      const markdown = readFileSync(path.join(guidesDir(), category, file), 'utf8');
      const parsed = parseGuide(markdown);
      const entry = upstream.get(`${category}/${id}`);
      const description = entry?.description ?? parsed.intro;
      const features = entry?.featuresUsed ?? [];
      const fields = {
        id: id.replaceAll('-', ' '),
        title: parsed.title,
        features: features.join(' '),
        description,
        headings: parsed.headings.join(' '),
        code: parsed.code.join(' '),
        body: parsed.body,
      };
      // Map, not {}: terms such as "constructor" would hit Object.prototype.
      const tf = new Map();
      Object.entries(fields).forEach(([field, text]) => tokenize(text).forEach(term => {
        tf.set(term, (tf.get(term) ?? 0) + FIELD_WEIGHTS[field]);
      }));
      const length = [...tf.values()].reduce((sum, value) => sum + value, 0);
      return {
        key: `${category}/${id}`,
        category,
        title: parsed.title,
        description,
        features,
        tokenCount: entry?.tokenCount ?? Math.round(markdown.length / 4),
        tokenCountEstimated: !entry,
        length: Math.round(length * 10) / 10,
        tf: Object.fromEntries([...tf].map(([term, value]) => [term, Math.round(value * 10) / 10])),
      };
    }));

  const df = new Map();
  docs.forEach(doc => Object.keys(doc.tf).forEach(term => df.set(term, (df.get(term) ?? 0) + 1)));
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length;
  return {
    version: PINNED.version,
    source: meta.source,
    withUpstreamMetadata: upstream.size > 0,
    avgLength,
    df: Object.fromEntries(df),
    docs,
  };
};

const writeIndex = () => {
  const index = buildIndex();
  writeFileSync(indexFile(), JSON.stringify(index));
  return index;
};

const loadIndex = () => {
  if (!existsSync(indexFile())) {
    fail('Index missing: run `guides.mjs sync` first (or `index` if the guides are already there).');
  }
  return JSON.parse(readFileSync(indexFile(), 'utf8'));
};

/**
 * Score every guide against a query with BM25 over weighted term frequencies
 * @param {Object} index - Loaded index
 * @param {string[]} terms - Query terms
 * @returns {{doc: Object, score: number}[]} Scored guides, best first
 */
const rank = (index, terms) => {
  const total = index.docs.length;
  const unique = [...new Set(terms)];
  return index.docs
    .map(doc => ({
      doc,
      score: unique.reduce((sum, term) => {
        if (!Object.hasOwn(doc.tf, term)) {
          return sum;
        }
        const tf = doc.tf[term];
        const df = index.df[term];
        const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
        const norm = BM25.k1 * (1 - BM25.b + BM25.b * doc.length / index.avgLength);
        return sum + idf * tf * (BM25.k1 + 1) / (tf + norm);
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .toSorted((a, b) => b.score - a.score);
};

/**
 * Split CLI args into positional words and --options
 * @param {string[]} args - Raw arguments
 * @returns {{words: string[], options: Object}} Parsed arguments
 */
const parseArgs = args => args.reduce(({ words, options, pending }, arg) => {
  if (pending) {
    return { words, options: { ...options, [pending]: arg }, pending: null };
  }
  return arg.startsWith('--')
    ? { words, options, pending: arg.slice(2) }
    : { words: [...words, arg], options, pending: null };
}, { words: [], options: {}, pending: null });

const formatTokens = count => `${count.toLocaleString('en-US')} tok`;

const sourceNote = index => (index.withUpstreamMetadata ? '' : ' · degraded index (GitHub source, no guides.json: descriptions are guide intros)');

const COMMANDS = {
  sync: async ({ options }) => {
    const order = options.source ? [options.source] : ['npm', 'github'];
    if (order.some(source => !SYNC_SOURCES[source])) {
      fail('--source expects npm or github.');
    }
    if (options.from && order[0] !== 'npm') {
      fail('--from only applies to an npm archive.');
    }
    const errors = [];
    for (const source of order) {
      try {
        const origin = await SYNC_SOURCES[source](options.from);
        const index = writeIndex();
        process.stdout.write(`Guides ${PINNED.version} synced from ${source} (${origin}): ${index.docs.length} guides, digest verified, links rewritten to local paths${sourceNote(index)}.\n${guidesDir()}\n`);
        return;
      } catch (error) {
        errors.push(`${source}: ${error.message}`);
        if (options.from) {
          break;
        }
      }
    }
    fail(`Sync failed.\n${errors.join('\n')}`, 2);
  },

  index: () => {
    const index = writeIndex();
    process.stdout.write(`Index rebuilt: ${index.docs.length} guides, ${Object.keys(index.df).length} terms${sourceNote(index)}.\n`);
  },

  search: ({ words, options }) => {
    if (words.length === 0) {
      fail('Usage: guides.mjs search <English query…> [--top N] [--category <category>]');
    }
    const index = loadIndex();
    const top = Number.parseInt(options.top ?? '8', 10);
    const scoped = options.category ? { ...index, docs: index.docs.filter(doc => doc.category === options.category) } : index;
    const results = rank(scoped, tokenize(words.join(' '))).slice(0, top);
    if (results.length === 0) {
      process.stdout.write('No matching guide. Rephrase (English, web platform terms) or browse `list`.\n');
      return;
    }
    const lines = results.map(({ doc, score }, position) => [
      `${position + 1}. ${doc.key}.md  (${formatTokens(doc.tokenCount)}${doc.tokenCountEstimated ? ' est.' : ''}, score ${score.toFixed(1)})`,
      `   ${doc.description}`,
      ...(doc.features.length ? [`   Features: ${doc.features.join(', ')}`] : []),
    ].join('\n'));
    process.stdout.write(`Guides (${guidesDir()}):${sourceNote(index)}\n${lines.join('\n')}\n`);
  },

  list: ({ words }) => {
    const index = loadIndex();
    const [category] = words;
    if (!category) {
      const counts = Object.groupBy(index.docs, doc => doc.category);
      process.stdout.write(`${Object.entries(counts).map(([name, docs]) => `${name} (${docs.length})`).join('\n')}\n`);
      return;
    }
    const docs = index.docs.filter(doc => doc.category === category);
    if (docs.length === 0) {
      fail(`Unknown category: ${category}. See \`guides.mjs list\`.`);
    }
    process.stdout.write(`${docs.map(doc => `${doc.key}.md  (${formatTokens(doc.tokenCount)})\n   ${doc.description}`).join('\n')}\n`);
  },
};

const [command, ...rest] = process.argv.slice(2);
const handler = COMMANDS[command];
if (!handler) {
  fail('Usage: guides.mjs <sync|index|search|list> …  (see the script header)');
}
await handler(parseArgs(rest));
