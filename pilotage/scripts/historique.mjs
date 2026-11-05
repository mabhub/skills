/**
 * historique — optional git history of the .pilotage/ folder (nested repository .pilotage/.git).
 *
 * Every git command on the nested repository passes `--git-dir <base>/.git --work-tree <base>`
 * explicitly, so it can never fall back on the project repository. The project repository is
 * only ever read. Output is French (user-facing).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { containsAny, decodeFile, parsePatterns } from './motifs.mjs';

/** Error with a French, user-facing message; the caller prints it and exits with code 1. */
export class HistoryError extends Error {}

/**
 * Runs git without a shell.
 * @param {string[]} args - git arguments
 * @param {{base?: string, cwd?: string, env?: object}} [options] - nested repository folder, or working directory
 * @returns {{ok: boolean, status: number, stdout: string, stderr: string}} result (status -1 when git cannot start)
 */
export const runGit = (args, { base, cwd, env } = {}) => {
  const prefix = base ? ['--git-dir', path.join(base, '.git'), '--work-tree', base] : [];
  const res = spawnSync('git', [...prefix, ...args], {
    cwd: cwd ?? base,
    env: env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const status = res.error ? -1 : res.status ?? -1;
  return { ok: status === 0, status, stdout: (res.stdout ?? '').trim(), stderr: (res.stderr ?? '').trim() };
};

/**
 * @returns {boolean} true when `git --version` answers
 */
export const gitAvailable = () => runGit(['--version']).ok;

/**
 * @param {string} base - .pilotage folder
 * @returns {boolean} true when the history mode is on (.pilotage/.git exists)
 */
export const historyActive = base => fs.existsSync(path.join(base, '.git'));

const IDENTITY_ERROR = 'ERREUR : identité git absente (user.name / user.email), aucun commit.';

/**
 * Reads a git config value as the nested repository would see it. Before the repository exists,
 * git runs in .pilotage with discovery stopped at the project root, so the project's local config
 * is never read (it would not apply to the nested repository).
 * @param {string} base - .pilotage folder (must exist)
 * @param {string} key - config key
 * @returns {string} value, or '' when unset
 */
const configValue = (base, key) => (historyActive(base)
  ? runGit(['config', key], { base })
  : runGit(['config', key], { cwd: base, env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(base) } })
).stdout;

/**
 * Checks that commits get the user's identity; git is never allowed to guess one.
 * @param {string} base - .pilotage folder
 * @returns {string|null} null when name and e-mail are known, else the error message
 */
export const identityProblem = base => {
  const name = process.env.GIT_AUTHOR_NAME || configValue(base, 'user.name');
  const email = process.env.GIT_AUTHOR_EMAIL || process.env.EMAIL || configValue(base, 'user.email');
  return name && email ? null : IDENTITY_ERROR;
};

/**
 * Current commit and branch of the project (read only).
 * @param {string} root - project root
 * @param {boolean} inGit - project is a git repository
 * @returns {{sha: string, branch: string}|null} null outside git or before the first commit
 */
export const projectHead = (root, inGit) => {
  if (!inGit) return null;
  const head = runGit(['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root });
  if (!head.ok) return null;
  const branch = runGit(['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: root });
  return { sha: head.stdout, branch: branch.ok ? branch.stdout : 'détachée' };
};

/**
 * Commits the whole .pilotage folder, without hooks nor signature, with the user's identity.
 * @param {string} base - .pilotage folder
 * @param {string} message - generated subject
 * @param {string[]} trailers - `Key: value` trailers
 * @returns {string} short sha of the new commit
 */
const commitAll = (base, message, trailers) => {
  const add = runGit(['add', '-A'], { base });
  if (!add.ok) throw new HistoryError(`ERREUR : git add a échoué (${add.stderr.split('\n')[0]}).`);
  const commit = runGit([
    '-c', 'commit.gpgsign=false',
    // A missing folder disables every hook, including the ones --no-verify leaves on.
    '-c', `core.hooksPath=${path.join(base, '.git', 'sans-hooks')}`,
    'commit', '-q', '--no-verify', '--allow-empty', '-m', message,
    ...trailers.flatMap(value => ['--trailer', value]),
  ], { base });
  if (!commit.ok) throw new HistoryError(`ERREUR : commit impossible (${commit.stderr.split('\n')[0]}).`);
  return runGit(['rev-parse', '--short=7', 'HEAD'], { base }).stdout;
};

/**
 * `Projet-*` trailers linking a commit to the project's state.
 * @param {string} root - project root
 * @param {boolean} inGit - project is a git repository
 * @returns {string[]} trailers (none outside git or before the first project commit)
 */
const projectTrailers = (root, inGit) => {
  const head = projectHead(root, inGit);
  return head ? [`Projet-HEAD: ${head.sha}`, `Projet-branche: ${head.branch}`] : [];
};

/**
 * `init --git`: creates the nested repository and commits the existing content.
 * @param {{base: string, root: string, inGit: boolean}} context - .pilotage folder, project root, git flag
 * @returns {string[]} lines to print
 * @throws {HistoryError} when git or the identity is missing
 */
export const initHistory = ({ base, root, inGit }) => {
  if (!gitAvailable()) throw new HistoryError('ERREUR : git indisponible, historique impossible.');
  if (historyActive(base)) return ['Historique git déjà actif'];
  const problem = identityProblem(base);
  if (problem) throw new HistoryError(problem);
  const init = runGit(['init', '-q', base], { cwd: base });
  if (!init.ok) throw new HistoryError(`ERREUR : git init a échoué (${init.stderr.split('\n')[0]}).`);
  // .git-rewrite: filter-branch's temporary checkout (purge); a leftover may hold a secret.
  fs.appendFileSync(path.join(base, '.git', 'info', 'exclude'), '\n/veille.log\n/.git-rewrite/\n');
  const sha = commitAll(base, 'État initial', projectTrailers(root, inGit));
  const count = runGit(['ls-files'], { base }).stdout.split('\n').filter(Boolean).length;
  return [`Historique git activé : ${count} fichier(s) commité(s) · ${sha}`];
};

const firstLine = text => text.split('\n')[0];

/**
 * Formats line ranges as `12-14, 20`.
 * @param {Array<[number, number]>} ranges - [first, last] pairs
 * @returns {string} formatted ranges
 */
const formatRanges = ranges => ranges.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(', ');

/**
 * Alerts for journals that lost lines since the last commit (append-only rule). Only the hunk
 * headers of the diff are parsed: the removed lines may hold a secret and are never printed.
 * @param {string} base - .pilotage folder (history on)
 * @returns {string[]} one alert per shrunk journal, deleted ones included
 */
export const journalAlerts = base => runGit(['-c', 'core.quotePath=false', 'diff', '--name-only', '--no-renames', 'HEAD'], { base }).stdout
  .split('\n')
  .filter(file => /^[^/]+\/journal\.md$/.test(file))
  .flatMap(file => {
    const ranges = runGit(['diff', '-U0', '--no-ext-diff', '--no-textconv', '--no-color', 'HEAD', '--', file], { base }).stdout
      .split('\n')
      .map(line => line.match(/^@@ -(\d+)(?:,(\d+))? \+/))
      .filter(Boolean)
      .map(([, start, count = '1']) => [Number(start), Number(count)])
      .filter(([, count]) => count > 0)
      .map(([start, count]) => [start, start + count - 1]);
    const lost = ranges.reduce((sum, [from, to]) => sum + to - from + 1, 0);
    return lost > 0
      ? [`ALERTE : ${file} a perdu ${lost} ligne(s) (version précédente : lignes ${formatRanges(ranges)})`]
      : [];
  });

/**
 * Checks that a commit can be made; throws otherwise.
 * @param {string} base - .pilotage folder
 * @throws {HistoryError} history off, git unavailable or identity missing
 */
const assertCanCommit = base => {
  if (!historyActive(base)) throw new HistoryError('ERREUR : historique git non activé (init --git).');
  if (!gitAvailable()) throw new HistoryError('ERREUR : git indisponible, historique impossible.');
  const problem = identityProblem(base);
  if (problem) throw new HistoryError(problem);
};

/**
 * `point <slug>`: commits the whole .pilotage folder at the end of a checkpoint, linked to the
 * project's state. Commits even without changes, so the link records the current HEAD.
 * @param {{base: string, root: string, inGit: boolean, slug: string}} context - .pilotage folder, project root, git flag, chantier
 * @returns {string[]} lines to print
 * @throws {HistoryError} history off, git unavailable, identity missing or commit failure
 */
export const commitPoint = ({ base, root, inGit, slug }) => {
  assertCanCommit(base);
  const alerts = journalAlerts(base);
  const sha = commitAll(base, `Point d'étape · ${slug}`, [`Chantier: ${slug}`, ...projectTrailers(root, inGit)]);
  return [`Historique : point d'étape commité (${slug}) · ${sha}`, ...alerts];
};

/**
 * Catch-up at the start of `contexte` and `reprise`: commits pending changes, without trailers.
 * Never throws: resuming and measuring must not be blocked by the history.
 * @param {{base: string, command: string}} context - .pilotage folder (history on), calling command
 * @returns {string[]} status line, then journal alerts
 */
export const catchUp = ({ base, command }) => {
  const failed = reason => [`Historique git : actif · rattrapage impossible (${reason}), suivi non commité`];
  try {
    if (!gitAvailable()) return failed('git indisponible');
    const status = runGit(['status', '--porcelain'], { base });
    if (!status.ok) return failed(`git status a échoué : ${firstLine(status.stderr)}`);
    if (status.stdout === '') return ['Historique git : actif'];
    if (identityProblem(base)) return failed('identité git absente');
    const alerts = journalAlerts(base);
    const add = runGit(['add', '-A'], { base });
    if (!add.ok) return failed(`git add a échoué : ${firstLine(add.stderr)}`);
    const dirs = [...new Set(runGit(['-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--no-renames'], { base }).stdout
      .split('\n')
      .filter(file => file.includes('/'))
      .map(file => file.split('/')[0]))].toSorted();
    const touched = dirs.length > 0 ? dirs.join(', ') : 'racine';
    commitAll(base, `Rattrapage (${command}) · ${touched}`, []);
    return [`Historique git : actif · rattrapage commité (${touched})`, ...alerts];
  } catch (error) {
    return failed(error instanceof HistoryError ? error.message.replace(/^ERREUR : |\.$/g, '') : 'erreur inattendue');
  }
};

const LINK_MAX = 30;
// One record per commit, opened by \x1e; fields separated by \x00.
const LINK_FORMAT = `%x1e${['%H', '%cI', ...['Chantier', 'Projet-HEAD', 'Projet-branche']
  .map(key => `%(trailers:key=${key},valueonly,separator=%x2C)`)].join('%x00')}`;

/**
 * Commit of the nested repository that links a chantier to the project: its last `point`,
 * else the most recent link without `Chantier` (the initial commit, valid for all chantiers).
 * @param {string} base - .pilotage folder (history on)
 * @param {string} slug - chantier
 * @returns {{date: string, sha: string, branch: string}|null} linked state, or null
 */
const lastLink = (base, slug) => {
  const records = runGit(['log', `--format=${LINK_FORMAT}`], { base }).stdout
    .split('\x1e')
    .map(record => record.split('\0').map(field => field.trim()))
    .filter(([, , , sha]) => /^[0-9a-f]{40,64}$/.test(sha ?? ''))
    .map(([, date, chantier, sha, branch]) => ({ date, chantier, sha, branch }));
  return records.find(record => record.chantier === slug) ?? records.find(record => record.chantier === '') ?? null;
};

/**
 * Project commits since the chantier's last checkpoint, with an alert when the noted HEAD left
 * the current history (rebase, reset, other branch). The project repository is only read.
 * @param {{base: string, root: string, inGit: boolean, slug: string}} context - .pilotage folder, project root, git flag, chantier
 * @returns {string[]|null} lines replacing `git log -8`, or null when no link is usable
 */
export const projectLink = ({ base, root, inGit, slug }) => {
  if (!inGit || !historyActive(base) || !gitAvailable()) return null;
  const link = lastLink(base, slug);
  const head = projectHead(root, inGit);
  if (!link || !head) return null;
  const short = link.sha.slice(0, 7);
  const header = `=== git — commits depuis le dernier point d'étape (${link.date.slice(0, 16).replace('T', ' ')}, ${short}) ===`;
  const exact = runGit(['merge-base', '--is-ancestor', link.sha, 'HEAD'], { cwd: root }).status === 0;
  const alert = exact ? [] : [`ALERTE : le HEAD du dernier point d'étape (${short}, branche ${link.branch}) n'est plus dans l'historique de ${head.branch} (rebase, reset ou changement de branche) : liste approximative, par date.`];
  const range = exact ? [`${link.sha}..HEAD`] : [`--since=${link.date}`, 'HEAD'];
  const commits = runGit(['log', '--oneline', '--no-decorate', ...range], { cwd: root }).stdout.split('\n').filter(Boolean);
  const listed = commits.length === 0 ? ['(aucun commit)'] : commits.slice(0, LINK_MAX);
  const more = commits.length > LINK_MAX ? [`… +${commits.length - LINK_MAX} autres`] : [];
  return [header, ...alert, ...listed, ...more];
};

const FILTER_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'purge-filtre.mjs');

/**
 * @param {string} dir - folder to walk
 * @param {string[]} [skip] - entry names skipped at this level
 * @returns {string[]} regular files below it (symbolic links are not followed)
 */
const filesBelow = (dir, skip = []) => fs.readdirSync(dir, { withFileTypes: true })
  .filter(entry => !skip.includes(entry.name))
  .flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesBelow(full);
    return entry.isFile() ? [full] : [];
  });

/**
 * Counts the blobs and commits of the nested repository, unreachable ones included, whose
 * content matches a pattern. Contents are only tested, never returned.
 * @param {string} base - .pilotage folder (history on)
 * @param {RegExp[]} patterns - purge patterns
 * @returns {{blob: number, commit: number}} matching objects by type
 * @throws {HistoryError} when the objects cannot be read
 */
const objectsWithPattern = (base, patterns) => {
  const ids = runGit(['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype)'], { base }).stdout
    .split('\n')
    .map(line => line.split(' '))
    .filter(([, type]) => type === 'blob' || type === 'commit')
    .map(([id]) => id);
  const count = { blob: 0, commit: 0 };
  if (ids.length === 0) return count;
  const res = spawnSync('git', ['--git-dir', path.join(base, '.git'), 'cat-file', '--batch'], {
    input: `${ids.join('\n')}\n`, maxBuffer: 1024 ** 3, stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (res.status !== 0) throw new HistoryError('ERREUR : lecture des objets du mini-dépôt impossible.');
  const out = res.stdout;
  // Output: `<id> <type> <size>\n<content>\n` per object.
  for (let pos = 0; pos < out.length;) {
    const eol = out.indexOf(0x0a, pos);
    const [, type, size] = out.subarray(pos, eol).toString('utf8').split(' ');
    if (containsAny(decodeFile(out.subarray(eol + 1, eol + 1 + Number(size))).text, patterns)) count[type] += 1;
    pos = eol + 1 + Number(size) + 1;
  }
  return count;
};

/**
 * Reads and checks the patterns file: it must exist outside .pilotage/ (it would be committed).
 * @param {string} base - .pilotage folder
 * @param {string} patternsFile - path given by the user
 * @returns {{file: string, patterns: RegExp[]}} resolved path and patterns
 * @throws {HistoryError} missing file, file inside .pilotage, refused pattern
 */
const readPatterns = (base, patternsFile) => {
  if (!patternsFile || !fs.existsSync(patternsFile)) throw new HistoryError('ERREUR : fichier de motifs introuvable.');
  const file = fs.realpathSync(patternsFile);
  const realBase = fs.realpathSync(base);
  if (file === realBase || file.startsWith(`${realBase}${path.sep}`)) {
    throw new HistoryError('ERREUR : le fichier de motifs doit être hors de .pilotage/ (il y serait commité).');
  }
  try {
    return { file, patterns: parsePatterns(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    throw new HistoryError(`ERREUR : ${error.message}.`);
  }
};

/**
 * Runs a git command on the nested repository and throws on failure.
 * @param {string} base - .pilotage folder
 * @param {string[]} args - git arguments
 * @param {object} [env] - environment
 * @returns {string} stdout
 * @throws {HistoryError} on failure (first line of stderr)
 */
const mustGit = (base, args, env) => {
  const res = runGit(args, { base, env });
  if (!res.ok) throw new HistoryError(`ERREUR : git ${args[0]} a échoué (${firstLine(res.stderr)}).`);
  return res.stdout;
};

/**
 * `purge --motifs <file>`: rewrites the whole history of .pilotage/ to replace every match of
 * the patterns, then checks that no object still holds one. Only counts are printed.
 * @param {{base: string, patternsFile: string}} context - .pilotage folder, patterns file
 * @returns {string[]} lines to print
 * @throws {HistoryError} on any refusal or failure (the patterns file is then kept)
 */
export const purgeHistory = ({ base, patternsFile }) => {
  assertCanCommit(base);
  const { file, patterns } = readPatterns(base, patternsFile);
  const current = filesBelow(base, ['.git'])
    .filter(name => containsAny(decodeFile(fs.readFileSync(name)).text, patterns)).length;
  if (current > 0) {
    throw new HistoryError(`ERREUR : un motif est encore présent dans ${current} fichier(s) actuel(s) : le retirer d'abord.`);
  }
  const caughtUp = catchUp({ base, command: 'purge' });
  if (runGit(['status', '--porcelain'], { base }).stdout !== '') {
    throw new HistoryError('ERREUR : suivi non commité, purge impossible.');
  }
  // Commit objects hold identities, shas and trailers, which the tree filter cannot rewrite.
  const { blob: found, commit: inCommits } = objectsWithPattern(base, patterns);
  if (inCommits > 0) {
    throw new HistoryError(`ERREUR : le motif correspond aussi à ${inCommits} commit(s) du mini-dépôt (auteur, e-mail, sha ou branche), que la purge ne réécrit pas : préciser le motif. Fichier de motifs conservé.`);
  }
  if (found === 0) {
    fs.rmSync(file);
    return [...caughtUp, "Purge : aucun motif trouvé dans l'historique, rien à réécrire."];
  }
  const commits = () => mustGit(base, ['rev-list', '--all']).split('\n');
  const before = commits();
  mustGit(base, ['filter-branch', '-f', '--tree-filter', '"$PILOTAGE_NODE" "$PILOTAGE_PURGE_FILTRE"', '--', '--all'], {
    ...process.env,
    FILTER_BRANCH_SQUELCH_WARNING: '1',
    PILOTAGE_NODE: process.execPath,
    PILOTAGE_PURGE_FILTRE: FILTER_SCRIPT,
    PILOTAGE_MOTIFS: file,
  });
  mustGit(base, ['for-each-ref', '--format=%(refname)', 'refs/original/']).split('\n').filter(Boolean)
    .forEach(ref => mustGit(base, ['update-ref', '-d', ref]));
  mustGit(base, ['reflog', 'expire', '--expire=now', '--all']);
  mustGit(base, ['gc', '--prune=now', '--aggressive', '-q']);
  const left = objectsWithPattern(base, patterns).blob;
  if (left > 0) {
    throw new HistoryError(`ERREUR : vérification échouée, ${left} objet(s) contiennent encore un motif. Fichier de motifs conservé.`);
  }
  const after = new Set(commits());
  const rewritten = before.filter(id => !after.has(id)).length;
  fs.rmSync(file);
  return [...caughtUp, `Purge : ${found} objet(s) contenaient un motif · ${rewritten} commit(s) réécrit(s) · vérification OK · fichier de motifs supprimé`];
};
