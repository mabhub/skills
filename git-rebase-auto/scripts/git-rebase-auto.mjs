#!/usr/bin/env node

/**
 * git-rebase-auto — Non-interactive Git rebase driver for LLM agents
 *
 * Bypasses the interactive editor by injecting a pre-built rebase todo-list
 * via the GIT_SEQUENCE_EDITOR mechanism.
 *
 * Usage:
 *   node git-rebase-auto.mjs <base-ref> [options]
 *
 * Options:
 *   --plan <file>        Path to a rebase plan file (one instruction per line)
 *   --plan-json <file>   Path to a JSON plan file (array of {action, hash, label?})
 *   --dry-run            Print the generated todo-list without executing the rebase
 *   --autosquash         Enable git's --autosquash mode (squash!/fixup! commits)
 *   --strategy <name>    Merge strategy (ort, recursive, …)
 *   --onto <ref>         Rebase --onto <newbase>
 *   --help               Show this help
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
 *     { "action": "squash", "hash": "def5678", "label": "fix typo in login" },
 *     { "action": "reword", "hash": "9abcdef", "label": "chore: bump version" },
 *     { "action": "drop",   "hash": "1234abc", "label": "wip: scratch" }
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
 */

import { execSync, spawnSync } from 'node:child_process';
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

// ---------------------------------------------------------------------------
// Helpers
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
        throw new Error(`Unknown rebase action: "${rawAction}"`);
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
    throw new Error('JSON plan must be an array of instruction objects.');
  }
  return entries.map(({ action: rawAction, hash, label = '' }) => {
    if (!rawAction) throw new Error('Each JSON entry must have an "action" field.');
    const action = normalizeAction(rawAction.toLowerCase());
    if (!VALID_ACTIONS.has(action)) {
      throw new Error(`Unknown rebase action: "${rawAction}"`);
    }
    if (action === 'exec' || action === 'break' || action === 'label' || action === 'reset') {
      // These actions don't use a commit hash — rest is the label/command
      return { action, rest: label };
    }
    if (!hash) throw new Error(`Entry with action "${action}" is missing a "hash" field.`);
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

/**
 * Run a command and return its trimmed stdout.
 * Throws on non-zero exit.
 * @param {string} cmd
 * @param {Object} [opts]
 * @returns {string}
 */
const run = (cmd, opts = {}) =>
  execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();

/**
 * Verify that we are inside a git repository.
 */
const assertGitRepo = () => {
  try {
    run('git rev-parse --is-inside-work-tree');
  } catch {
    throw new Error('Not inside a git repository.');
  }
};

/**
 * Verify that a ref exists in the current repository.
 * @param {string} ref
 */
const assertRefExists = ref => {
  try {
    run(`git rev-parse --verify ${ref}`);
  } catch {
    throw new Error(`Git ref not found: "${ref}"`);
  }
};

// ---------------------------------------------------------------------------
// Sequence-editor injector generator
// ---------------------------------------------------------------------------

/**
 * Write a tiny shell script that replaces the git todo-list file with our
 * pre-built plan. This script is set as GIT_SEQUENCE_EDITOR so that git
 * calls it instead of opening a real editor.
 *
 * @param {string} todoContent - The rebase todo-list content to inject
 * @param {string} tmpDir      - Temporary directory to write helpers into
 * @returns {string}           - Path to the injector script
 */
const buildInjectorScript = (todoContent, tmpDir) => {
  const planPath = join(tmpDir, 'rebase-plan.txt');
  const injectorPath = join(tmpDir, 'sequence-editor.sh');

  writeFileSync(planPath, todoContent, 'utf8');

  // The injector receives the path to git's todo-list as $1.
  // It simply overwrites it with our pre-built plan.
  const script = `#!/bin/sh\ncp "${planPath}" "$1"\n`;
  writeFileSync(injectorPath, script, { encoding: 'utf8', mode: 0o755 });

  return injectorPath;
};

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the current log of commits between HEAD and baseRef, for context.
 * @param {string} baseRef
 * @returns {string}
 */
const fetchCommitRange = baseRef => {
  try {
    return run(`git log --oneline ${baseRef}..HEAD`);
  } catch {
    return '(could not retrieve commit range)';
  }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async () => {
  // --- Argument parsing ---
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      plan:       { type: 'string' },
      'plan-json': { type: 'string' },
      'dry-run':  { type: 'boolean', default: false },
      autosquash: { type: 'boolean', default: false },
      strategy:   { type: 'string' },
      onto:       { type: 'string' },
      help:       { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    // Print the JSDoc header block as help text
    const src = readFileSync(new URL(import.meta.url), 'utf8');
    const helpMatch = src.match(/\/\*\*([\s\S]*?)\*\//);
    if (helpMatch) console.log(helpMatch[1].replace(/^\s*\* ?/gm, '').trim());
    process.exit(0);
  }

  const [baseRef] = positionals;
  if (!baseRef) {
    console.error('Error: <base-ref> is required. Run with --help for usage.');
    process.exit(1);
  }

  if (!values.plan && !values['plan-json']) {
    console.error('Error: either --plan <file> or --plan-json <file> is required.');
    process.exit(1);
  }

  // --- Load plan ---
  const planSource = values.plan ?? values['plan-json'];
  const planPath = resolve(planSource);

  if (!existsSync(planPath)) {
    console.error(`Error: plan file not found: ${planPath}`);
    process.exit(1);
  }

  const planContent = readFileSync(planPath, 'utf8');
  const instructions = values['plan-json']
    ? parseJsonPlan(planContent)
    : parseTextPlan(planContent);

  if (instructions.length === 0) {
    console.error('Error: the plan file contains no instructions.');
    process.exit(1);
  }

  const todoContent = serializePlan(instructions);

  // --- Dry-run: just show what would be executed ---
  if (values['dry-run']) {
    console.log('=== Rebase plan (dry-run) ===\n');
    console.log(todoContent);
    console.log('=== Commits in range ===\n');
    assertGitRepo();
    assertRefExists(baseRef);
    console.log(fetchCommitRange(baseRef));
    console.log('\n(dry-run: no rebase was executed)');
    process.exit(0);
  }

  // --- Validate environment ---
  assertGitRepo();
  assertRefExists(baseRef);
  if (values.onto) assertRefExists(values.onto);

  // --- Build temp dir + injector ---
  const tmpDir = mkdtempSync(join(tmpdir(), 'git-rebase-auto-'));

  try {
    const injectorPath = buildInjectorScript(todoContent, tmpDir);

    // --- Build git rebase command ---
    const rebaseArgs = ['rebase', '--interactive'];
    if (values.autosquash) rebaseArgs.push('--autosquash');
    if (values.strategy) rebaseArgs.push(`--strategy=${values.strategy}`);
    if (values.onto) rebaseArgs.push('--onto', values.onto);
    rebaseArgs.push(baseRef);

    console.log(`Executing: git ${rebaseArgs.join(' ')}`);
    console.log(`Plan:\n${todoContent}`);

    const result = spawnSync('git', rebaseArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        GIT_SEQUENCE_EDITOR: injectorPath,
        // Ensure reword/edit steps that open a commit-msg editor use a no-op
        // editor if the caller has not already set one. The caller can override
        // GIT_EDITOR to provide a custom message file injector for reword steps.
        GIT_EDITOR: process.env.GIT_EDITOR ?? 'true',
      },
    });

    process.exit(result.status ?? 1);

  } finally {
    // Cleanup temp dir
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Non-fatal cleanup failure
    }
  }
};

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
