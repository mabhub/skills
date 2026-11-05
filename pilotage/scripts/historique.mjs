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
  fs.appendFileSync(path.join(base, '.git', 'info', 'exclude'), '\n/veille.log\n');
  const sha = commitAll(base, 'État initial', projectTrailers(root, inGit));
  const count = runGit(['ls-files'], { base }).stdout.split('\n').filter(Boolean).length;
  return [`Historique git activé : ${count} fichier(s) commité(s) · ${sha}`];
};
