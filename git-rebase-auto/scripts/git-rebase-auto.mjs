#!/usr/bin/env node

/**
 * git-rebase-auto — Non-interactive Git rebase driver for LLM agents
 *
 * Runs `git rebase -i` without an editor. Two modes:
 *   --autosquash   git builds the todo-list itself (fixup!/squash!/amend!
 *                  commits moved under their targets) and it is accepted as is.
 *   --plan(-json)  the todo-list is replaced by a pre-built plan.
 *
 * Usage:
 *   node git-rebase-auto.mjs <base-ref> --autosquash [options]
 *   node git-rebase-auto.mjs <base-ref> --plan <file> [options]
 *   node git-rebase-auto.mjs --root (--autosquash | --plan <file>) [options]
 *
 * Options:
 *   --autosquash         Let git order fixup!/squash! commits (no plan allowed)
 *   --plan <file>        Rebase plan file (one instruction per line)
 *   --plan-json <file>   JSON plan file (array of {action, hash, label?})
 *   --root               Rebase from the root commit (replaces <base-ref>)
 *   --dry-run            Run the checks and print the todo-list, change nothing
 *   --onto <ref>         Rebase --onto <newbase>
 *   --strategy <name>    Merge strategy (ort, recursive, …)
 *   --allow-protected    Allow rebasing main, master, develop, release/*,
 *                        production (only after the user said so explicitly)
 *   --help               Show this help
 *
 * Checks (dry-run included): refuses a dirty working tree (tracked files),
 * a protected branch without --allow-protected, and a plan combined with
 * --autosquash; warns when commits of the range are already on a remote.
 *
 * Before rewriting, saves HEAD as refs/backup/rebase-YYYYMMDD-HHMM:
 *   list     git for-each-ref refs/backup
 *   restore  git reset --hard refs/backup/rebase-YYYYMMDD-HHMM
 *   delete   git update-ref -d refs/backup/rebase-YYYYMMDD-HHMM
 *
 * Plan file format (text):
 *   pick   abc1234 feat: add login
 *   squash def5678 fix typo in login
 *   reword 9abcdef chore: bump version
 *   drop   1234abc wip: scratch
 *
 * Plan file format (JSON):
 *   [
 *     { "action": "pick",   "hash": "abc1234", "label": "feat: add login" },
 *     { "action": "fixup",  "hash": "def5678" },
 *     { "action": "exec",   "label": "npm test" }
 *   ]
 *
 * Supported rebase actions:
 *   pick | p       — use commit as-is
 *   reword | r     — use commit, but edit the message
 *   edit | e       — use commit, but stop for amending
 *   squash | s     — meld into previous commit, edit message
 *   fixup | f      — meld into previous commit, discard message
 *   drop | d       — remove commit
 *   exec           — run shell command (exec <cmd>)
 *   label          — label current HEAD (label <name>)
 *   reset          — reset HEAD to a label (reset <name>)
 *   merge          — create a merge commit (merge [-C <hash>] <label>)
 *   break          — pause rebase at this point
 *
 * Exit codes: 0 success · 1 refused or usage error (nothing changed) ·
 * other non-zero: git's status, the rebase may be in progress (conflict).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ACTIONS = new Set([
  'pick', 'p',
  'reword', 'r',
  'edit', 'e',
  'squash', 's',
  'fixup', 'f',
  'drop', 'd',
  'exec',
  'label',
  'reset',
  'merge',
  'break',
]);

const ACTION_ALIASES = {
  p: 'pick',
  r: 'reword',
  e: 'edit',
  s: 'squash',
  f: 'fixup',
  d: 'drop',
};

const PROTECTED_BRANCHES = [/^main$/, /^master$/, /^develop$/, /^release\//, /^production$/];

/** Thrown for refusals and usage errors: exit 1, nothing was changed. */
class Refusal extends Error {}

// ---------------------------------------------------------------------------
// Plan parsing
// ---------------------------------------------------------------------------

/**
 * Normalize a single-letter action alias to its full name.
 * @param {string} action
 * @returns {string}
 */
const normalizeAction = action => ACTION_ALIASES[action] ?? action;

/**
 * Parse a text plan file into an array of instruction objects.
 * Lines starting with '#' or empty lines are ignored.
 * @param {string} content - Raw file content
 * @returns {Array<{action: string, rest: string}>}
 */
const parseTextPlan = content =>
  content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => {
      const [rawAction, ...rest] = line.split(/\s+/);
      const action = normalizeAction(rawAction.toLowerCase());
      if (!VALID_ACTIONS.has(action)) {
        throw new Refusal(`Unknown rebase action: "${rawAction}"`);
      }
      return { action, rest: rest.join(' ') };
    });

/**
 * Parse a JSON plan file into instruction objects.
 * @param {string} content - Raw JSON content
 * @returns {Array<{action: string, rest: string}>}
 */
const parseJsonPlan = content => {
  const entries = JSON.parse(content);
  if (!Array.isArray(entries)) {
    throw new Refusal('JSON plan must be an array of instruction objects.');
  }
  return entries.map(({ action: rawAction, hash, label = '' }) => {
    if (!rawAction) throw new Refusal('Each JSON entry must have an "action" field.');
    const action = normalizeAction(rawAction.toLowerCase());
    if (!VALID_ACTIONS.has(action)) {
      throw new Refusal(`Unknown rebase action: "${rawAction}"`);
    }
    if (action === 'exec' || action === 'break' || action === 'label' || action === 'reset') {
      // These actions don't use a commit hash — rest is the label/command
      return { action, rest: label };
    }
    if (!hash) throw new Refusal(`Entry with action "${action}" is missing a "hash" field.`);
    return { action, rest: label ? `${hash} ${label}` : hash };
  });
};

/**
 * Serialize instruction objects back to git rebase todo-list format.
 * @param {Array<{action: string, rest: string}>} instructions
 * @returns {string}
 */
const serializePlan = instructions =>
  instructions.map(({ action, rest }) => `${action} ${rest}`.trimEnd()).join('\n') + '\n';

// ---------------------------------------------------------------------------
// Git helpers (argument arrays, never a shell)
// ---------------------------------------------------------------------------

/**
 * Run git and return its result without throwing.
 * @param {string[]} args
 * @param {Object} [env] - extra environment variables
 * @returns {{status: number|null, stdout: string, stderr: string}}
 */
const gitRaw = (args, env = {}) => {
  const r = spawnSync('git', args, { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
};

/**
 * Run git and return trimmed stdout; throws a Refusal on failure.
 * @param {string[]} args
 * @param {string} message - error shown on failure
 * @returns {string}
 */
const git = (args, message) => {
  const r = gitRaw(args);
  if (r.status !== 0) throw new Refusal(message ?? `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
};

/** @param {string} ref */
const assertRefExists = ref => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], `Git ref not found: "${ref}"`);

/**
 * Revision range rewritten by the rebase, as git rev-list arguments.
 * @param {string|undefined} baseRef - undefined with --root
 * @returns {string[]}
 */
const rangeArgs = baseRef => (baseRef ? [`${baseRef}..HEAD`] : ['HEAD']);

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Refuse unsafe situations; return warnings that do not block.
 * @param {{baseRef?: string, allowProtected: boolean}} opts
 * @returns {string[]} warnings
 */
const runChecks = ({ baseRef, allowProtected }) => {
  git(['rev-parse', '--is-inside-work-tree'], 'Not inside a git repository.');

  const inProgress = ['rebase-merge', 'rebase-apply']
    .some(d => existsSync(git(['rev-parse', '--git-path', d])));
  if (inProgress) {
    throw new Refusal('A rebase is already in progress: finish it (git rebase --continue) or abort it (git rebase --abort).');
  }

  const dirty = git(['status', '--porcelain', '--untracked-files=no']);
  if (dirty) {
    throw new Refusal(`Working tree has uncommitted changes to tracked files; commit or stash them first:\n${dirty}`);
  }

  const branch = gitRaw(['symbolic-ref', '--quiet', '--short', 'HEAD']).stdout;
  if (branch && PROTECTED_BRANCHES.some(re => re.test(branch)) && !allowProtected) {
    throw new Refusal(`"${branch}" is a protected branch. Rebase it only if the user asked for it explicitly, then pass --allow-protected.`);
  }

  const warnings = [];
  const total = Number(git(['rev-list', '--count', ...rangeArgs(baseRef)]));
  const local = Number(git(['rev-list', '--count', ...rangeArgs(baseRef), '--not', '--remotes']));
  if (total > local) {
    warnings.push(`${total - local} of the ${total} commits to rewrite are already on a remote: publishing the result will need git push --force-with-lease (never run it without the user's go-ahead).`);
  }
  return warnings;
};

// ---------------------------------------------------------------------------
// Rebase execution
// ---------------------------------------------------------------------------

/**
 * Build the `git rebase` argument list.
 * @param {Object} values - parsed options
 * @param {string|undefined} baseRef
 * @returns {string[]}
 */
const rebaseArgs = (values, baseRef) => [
  'rebase', '--interactive',
  ...(values.autosquash ? ['--autosquash'] : []),
  ...(values.strategy ? [`--strategy=${values.strategy}`] : []),
  ...(values.onto ? ['--onto', values.onto] : []),
  ...(values.root ? ['--root'] : [baseRef]),
];

/**
 * Sequence editor that copies $GRA_TODO_IN over git's todo-list ($1) when set,
 * and saves git's own todo-list to $GRA_TODO_OUT then empties it when set
 * (git then stops with "nothing to do" without touching the history).
 * @param {string} tmpDir
 * @returns {string} path of the editor script
 */
const writeSequenceEditor = tmpDir => {
  const path = join(tmpDir, 'sequence-editor.sh');
  const script = [
    '#!/bin/sh',
    'if [ -n "$GRA_TODO_OUT" ]; then cp "$1" "$GRA_TODO_OUT" && : > "$1"; exit 0; fi',
    'if [ -n "$GRA_TODO_IN" ]; then cp "$GRA_TODO_IN" "$1"; fi',
    '',
  ].join('\n');
  writeFileSync(path, script, { encoding: 'utf8', mode: 0o755 });
  return path;
};

/**
 * Ask git which todo-list it would produce, without rebasing.
 * @param {string[]} args - git rebase arguments
 * @param {string} tmpDir
 * @returns {string} todo-list without comments
 */
const previewGitTodo = (args, tmpDir) => {
  const out = join(tmpDir, 'git-todo.txt');
  const head = git(['rev-parse', 'HEAD']);
  gitRaw(args, { GIT_SEQUENCE_EDITOR: writeSequenceEditor(tmpDir), GRA_TODO_OUT: out });
  if (git(['rev-parse', 'HEAD']) !== head) {
    throw new Error('HEAD moved during the dry-run preview; check git reflog.');
  }
  if (!existsSync(out)) return '(git produced no todo-list: nothing to rebase)\n';
  return readFileSync(out, 'utf8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .join('\n') + '\n';
};

/**
 * Save HEAD under refs/backup/rebase-YYYYMMDD-HHMM (suffix -2, -3… if taken).
 * @returns {string} the backup ref
 */
const createBackupRef = () => {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  for (let n = 1; n < 100; n += 1) {
    const ref = `refs/backup/rebase-${stamp}${n > 1 ? `-${n}` : ''}`;
    // Empty old value: create only, never overwrite an existing backup.
    if (gitRaw(['update-ref', ref, 'HEAD', '']).status === 0) return ref;
  }
  throw new Refusal('Could not create a backup ref under refs/backup/.');
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const HELP = () => {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  const helpMatch = src.match(/\/\*\*([\s\S]*?)\*\//);
  return helpMatch ? helpMatch[1].replace(/^\s*\* ?/gm, '').trim() : '';
};

/**
 * @param {string[]} argv
 * @returns {number} exit code
 */
const main = argv => {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      plan:              { type: 'string' },
      'plan-json':       { type: 'string' },
      'dry-run':         { type: 'boolean', default: false },
      autosquash:        { type: 'boolean', default: false },
      root:              { type: 'boolean', default: false },
      strategy:          { type: 'string' },
      onto:              { type: 'string' },
      'allow-protected': { type: 'boolean', default: false },
      help:              { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP());
    return 0;
  }

  const [baseRef] = positionals;
  if (values.root && baseRef) throw new Refusal('--root replaces <base-ref>: give one or the other.');
  if (!values.root && !baseRef) throw new Refusal('<base-ref> is required (or --root). Run with --help for usage.');

  const planSource = values.plan ?? values['plan-json'];
  if (planSource && values.autosquash) {
    throw new Refusal('--autosquash cannot be combined with a plan: the plan replaces the todo-list git would build, '
      + 'so fixup! commits would stay separate. Either write the fixup lines in the plan, or drop the plan and keep --autosquash.');
  }
  if (!planSource && !values.autosquash) {
    throw new Refusal('Give --autosquash, or a plan with --plan <file> / --plan-json <file>.');
  }

  let todoContent;
  if (planSource) {
    const planPath = resolve(planSource);
    if (!existsSync(planPath)) throw new Refusal(`Plan file not found: ${planPath}`);
    const planContent = readFileSync(planPath, 'utf8');
    const instructions = values['plan-json'] ? parseJsonPlan(planContent) : parseTextPlan(planContent);
    if (instructions.length === 0) throw new Refusal('The plan file contains no instructions.');
    todoContent = serializePlan(instructions);
  }

  if (baseRef) assertRefExists(baseRef);
  if (values.onto) assertRefExists(values.onto);
  const warnings = runChecks({ baseRef, allowProtected: values['allow-protected'] });
  warnings.forEach(w => console.error(`Warning: ${w}`));

  const args = rebaseArgs(values, baseRef);
  const tmpDir = mkdtempSync(join(tmpdir(), 'git-rebase-auto-'));
  try {
    if (values['dry-run']) {
      console.log(`=== Would run: git ${args.join(' ')} ===\n`);
      console.log(todoContent ?? previewGitTodo(args, tmpDir));
      console.log('=== Commits in range ===\n');
      console.log(git(['log', '--oneline', ...rangeArgs(baseRef)]));
      console.log('\n(dry-run: checks passed, no rebase was executed)');
      return 0;
    }

    const backupRef = createBackupRef();
    console.log(`Backup: ${backupRef}  (restore: git reset --hard ${backupRef})`);
    console.log(`Executing: git ${args.join(' ')}`);
    if (todoContent) console.log(`Plan:\n${todoContent}`);

    const env = { GIT_SEQUENCE_EDITOR: writeSequenceEditor(tmpDir) };
    if (todoContent) {
      env.GRA_TODO_IN = join(tmpDir, 'rebase-plan.txt');
      writeFileSync(env.GRA_TODO_IN, todoContent, 'utf8');
    }
    const result = spawnSync('git', args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
        // reword/squash steps would open an editor: keep the message unless
        // the caller provides its own GIT_EDITOR.
        GIT_EDITOR: process.env.GIT_EDITOR ?? 'true',
      },
    });

    if (result.status !== 0) {
      console.error('\nRebase stopped. Resolve, then git rebase --continue; or git rebase --abort.');
      console.error(`Pre-rebase state kept in ${backupRef}.`);
      return result.status ?? 1;
    }
    console.log(`\n${git(['log', '--oneline', ...rangeArgs(values.onto ?? baseRef)])}`);
    console.log(`\nDone. Backup: ${backupRef} (delete when satisfied: git update-ref -d ${backupRef})`);
    return 0;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
};

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Refusal ? `Error: ${err.message}` : `Fatal: ${err.message}`);
  process.exitCode = 1;
}
