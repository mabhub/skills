#!/usr/bin/env node

/**
 * Tests for git-rebase-auto.mjs — each test runs the script against a
 * throwaway git repository created under the OS temp directory.
 *
 * Run: node --test git-rebase-auto/scripts/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./git-rebase-auto.mjs', import.meta.url));

/** Isolated git environment: fixed identity, no user or system config. */
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_EDITOR: 'true',
};

/**
 * Run git in a directory and return trimmed stdout; throws on failure.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
const git = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/**
 * Run the script under test.
 * @param {string} cwd
 * @param {string[]} args
 * @param {Object} [env] - extra environment variables
 * @returns {{status: number, out: string}} out = stdout + stderr
 */
const runScript = (cwd, args, env = {}) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    env: { ...GIT_ENV, ...env },
    encoding: 'utf8',
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

/**
 * Create a repository with a root commit and one commit per entry.
 * @param {Array<{file: string, content: string, msg: string}>} commits
 * @returns {{dir: string, sha: Object<string, string>, cleanup: () => void}}
 *   sha maps each commit message to its abbreviated hash
 */
const makeRepo = (commits) => {
  const dir = mkdtempSync(join(tmpdir(), 'gra-test-'));
  git(dir, ['init', '-q', '-b', 'main']);
  writeFileSync(join(dir, 'README'), 'base\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'base']);
  git(dir, ['tag', 'base']);
  git(dir, ['checkout', '-q', '-b', 'feature']);
  const sha = {};
  for (const { file, content, msg } of commits) {
    writeFileSync(join(dir, file), content);
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', msg]);
    sha[msg] = git(dir, ['rev-parse', '--short', 'HEAD']);
  }
  return { dir, sha, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

/** Subjects from base (exclusive) to HEAD, oldest first. */
const subjects = dir => git(dir, ['log', '--reverse', '--format=%s', 'base..HEAD']).split('\n').filter(Boolean);

const THREE = [
  { file: 'a.txt', content: 'a\n', msg: 'add a' },
  { file: 'b.txt', content: 'b\n', msg: 'add b' },
  { file: 'c.txt', content: 'c\n', msg: 'add c' },
];

test('--help prints usage and exits 0', () => {
  const { status, out } = runScript(tmpdir(), ['--help']);
  assert.equal(status, 0);
  assert.match(out, /Usage:/);
});

test('missing base-ref exits 1', () => {
  const { status, out } = runScript(tmpdir(), []);
  assert.equal(status, 1);
  assert.match(out, /<base-ref> is required/);
});

test('neither plan nor --autosquash exits 1', () => {
  const { dir, cleanup } = makeRepo(THREE);
  try {
    const { status, out } = runScript(dir, ['base']);
    assert.equal(status, 1);
    assert.match(out, /Give --autosquash, or a plan/);
  } finally { cleanup(); }
});

test('--root together with a base ref exits 1', () => {
  const { dir, cleanup } = makeRepo(THREE);
  try {
    const { status, out } = runScript(dir, ['base', '--root', '--autosquash']);
    assert.equal(status, 1);
    assert.match(out, /--root replaces <base-ref>/);
  } finally { cleanup(); }
});

test('unknown action in text plan exits 1', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, `yolo ${sha['add a']}\n`);
    const { status, out } = runScript(dir, ['base', '--plan', plan]);
    assert.equal(status, 1);
    assert.match(out, /Unknown rebase action: "yolo"/);
  } finally { cleanup(); }
});

test('unknown base ref exits 1 without rebasing', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, `pick ${sha['add a']}\n`);
    const { status, out } = runScript(dir, ['nope', '--plan', plan]);
    assert.equal(status, 1);
    assert.match(out, /Git ref not found: "nope"/);
    assert.deepEqual(subjects(dir), ['add a', 'add b', 'add c']);
  } finally { cleanup(); }
});

test('--dry-run prints plan and range, leaves HEAD untouched', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    const head = git(dir, ['rev-parse', 'HEAD']);
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, `# comment\n\np ${sha['add a']} add a\nf ${sha['add b']}\n`);
    const { status, out } = runScript(dir, ['base', '--plan', plan, '--dry-run']);
    assert.equal(status, 0);
    assert.match(out, new RegExp(`pick ${sha['add a']} add a\\nfixup ${sha['add b']}\\n`));
    assert.match(out, /add c/);
    assert.match(out, /no rebase was executed/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']), head);
  } finally { cleanup(); }
});

test('text plan: squash/fixup melds commits and keeps content', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, [
      `pick ${sha['add a']}`,
      `fixup ${sha['add b']}`,
      `squash ${sha['add c']}`,
    ].join('\n'));
    const { status } = runScript(dir, ['base', '--plan', plan]);
    assert.equal(status, 0);
    assert.equal(subjects(dir).length, 1);
    for (const f of ['a.txt', 'b.txt', 'c.txt']) assert.ok(existsSync(join(dir, f)), f);
  } finally { cleanup(); }
});

test('JSON plan: drop removes a commit and its file', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    const plan = join(dir, '.git', 'plan.json');
    writeFileSync(plan, JSON.stringify([
      { action: 'pick', hash: sha['add a'], label: 'add a' },
      { action: 'drop', hash: sha['add b'] },
      { action: 'pick', hash: sha['add c'] },
    ]));
    const { status } = runScript(dir, ['base', '--plan-json', plan]);
    assert.equal(status, 0);
    assert.deepEqual(subjects(dir), ['add a', 'add c']);
    assert.ok(!existsSync(join(dir, 'b.txt')));
  } finally { cleanup(); }
});

test('JSON plan: entry without hash is rejected', () => {
  const { dir, cleanup } = makeRepo(THREE);
  try {
    const plan = join(dir, '.git', 'plan.json');
    writeFileSync(plan, JSON.stringify([{ action: 'pick' }]));
    const { status, out } = runScript(dir, ['base', '--plan-json', plan]);
    assert.equal(status, 1);
    assert.match(out, /missing a "hash" field/);
  } finally { cleanup(); }
});

test('reorder: plan order becomes history order', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, `pick ${sha['add c']}\npick ${sha['add a']}\npick ${sha['add b']}\n`);
    const { status } = runScript(dir, ['base', '--plan', plan]);
    assert.equal(status, 0);
    assert.deepEqual(subjects(dir), ['add c', 'add a', 'add b']);
  } finally { cleanup(); }
});

test('plan + --autosquash is refused before any change', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  try {
    writeFileSync(join(dir, 'a.txt'), 'a2\n');
    git(dir, ['commit', '-q', '-am', `fixup! add a`]);
    const fix = git(dir, ['rev-parse', '--short', 'HEAD']);
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, ['add a', 'add b', 'add c'].map(m => `pick ${sha[m]}`).join('\n') + `\npick ${fix}\n`);
    const head = git(dir, ['rev-parse', 'HEAD']);
    const { status, out } = runScript(dir, ['base', '--plan', plan, '--autosquash']);
    assert.equal(status, 1);
    assert.match(out, /--autosquash cannot be combined with a plan/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']), head);
    assert.equal(git(dir, ['for-each-ref', 'refs/backup']), '');
  } finally { cleanup(); }
});

test('conflict: exits non-zero and leaves the rebase in progress', () => {
  const { dir, sha, cleanup } = makeRepo([
    { file: 'f.txt', content: 'one\n', msg: 'create f' },
    { file: 'f.txt', content: 'two\n', msg: 'edit f' },
  ]);
  try {
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, `pick ${sha['edit f']}\npick ${sha['create f']}\n`);
    const { status } = runScript(dir, ['base', '--plan', plan]);
    assert.notEqual(status, 0);
    assert.ok(existsSync(join(dir, '.git', 'rebase-merge')), 'rebase should be in progress');
    git(dir, ['rebase', '--abort']);
    assert.deepEqual(subjects(dir), ['create f', 'edit f']);
  } finally { cleanup(); }
});

/** Repo with three commits plus `fixup! add a` on top. */
const makeFixupRepo = () => {
  const repo = makeRepo(THREE);
  writeFileSync(join(repo.dir, 'a.txt'), 'a2\n');
  git(repo.dir, ['commit', '-q', '-am', 'fixup! add a']);
  return repo;
};

test('--autosquash without plan melds fixup! commits and saves a backup ref', () => {
  const { dir, cleanup } = makeFixupRepo();
  const tmp = mkdtempSync(join(tmpdir(), 'gra-tmp-'));
  try {
    const before = git(dir, ['rev-parse', 'HEAD']);
    const { status, out } = runScript(dir, ['base', '--autosquash'], { TMPDIR: tmp });
    assert.equal(status, 0, out);
    assert.deepEqual(subjects(dir), ['add a', 'add b', 'add c']);
    assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8'), 'a2\n');
    const [ref] = git(dir, ['for-each-ref', '--format=%(refname)', 'refs/backup']).split('\n');
    assert.match(ref, /^refs\/backup\/rebase-\d{8}-\d{4}$/);
    assert.equal(git(dir, ['rev-parse', ref]), before);
    assert.match(out, /git reset --hard refs\/backup\/rebase-/);
    assert.deepEqual(readdirSync(tmp), [], 'temporary directory must be removed');

    const again = runScript(dir, ['base', '--autosquash']);
    assert.equal(again.status, 0, again.out);
    const refs = git(dir, ['for-each-ref', '--format=%(refname)', 'refs/backup']).split('\n');
    assert.equal(refs.length, 2, 'a second backup must not overwrite the first');
  } finally { cleanup(); rmSync(tmp, { recursive: true, force: true }); }
});

test('--autosquash --dry-run shows the todo git would build and changes nothing', () => {
  const { dir, sha, cleanup } = makeFixupRepo();
  try {
    const fix = git(dir, ['rev-parse', '--short', 'HEAD']);
    const head = git(dir, ['rev-parse', 'HEAD']);
    const { status, out } = runScript(dir, ['base', '--autosquash', '--dry-run']);
    assert.equal(status, 0, out);
    // Recent git writes `pick <sha> # <subject>` in the todo-list; older versions omit `# `.
    assert.match(out, new RegExp(`pick ${sha['add a']} (# )?add a\\nfixup ${fix} (# )?fixup! add a\\npick ${sha['add b']}`));
    assert.equal(git(dir, ['rev-parse', 'HEAD']), head);
    assert.equal(git(dir, ['for-each-ref', 'refs/backup']), '');
    assert.ok(!existsSync(join(dir, '.git', 'rebase-merge')), 'no rebase may be left in progress');
    assert.equal(git(dir, ['status', '--porcelain']), '');
  } finally { cleanup(); }
});

test('--root --autosquash can fix up the root commit', () => {
  const { dir, cleanup } = makeRepo(THREE);
  try {
    writeFileSync(join(dir, 'README'), 'base2\n');
    git(dir, ['commit', '-q', '-am', 'fixup! base']);
    const { status, out } = runScript(dir, ['--root', '--autosquash']);
    assert.equal(status, 0, out);
    assert.deepEqual(git(dir, ['log', '--reverse', '--format=%s']).split('\n'), ['base', 'add a', 'add b', 'add c']);
    assert.equal(readFileSync(join(dir, 'README'), 'utf8'), 'base2\n');
  } finally { cleanup(); }
});

test('dirty working tree is refused', () => {
  const { dir, cleanup } = makeFixupRepo();
  try {
    writeFileSync(join(dir, 'b.txt'), 'changed\n');
    const { status, out } = runScript(dir, ['base', '--autosquash']);
    assert.equal(status, 1);
    assert.match(out, /uncommitted changes/);
    assert.equal(git(dir, ['for-each-ref', 'refs/backup']), '');
  } finally { cleanup(); }
});

test('protected branch is refused unless --allow-protected', () => {
  const { dir, cleanup } = makeFixupRepo();
  try {
    git(dir, ['checkout', '-q', '-B', 'release/1.0']);
    const refused = runScript(dir, ['base', '--autosquash']);
    assert.equal(refused.status, 1);
    assert.match(refused.out, /"release\/1.0" is a protected branch/);
    const allowed = runScript(dir, ['base', '--autosquash', '--allow-protected']);
    assert.equal(allowed.status, 0, allowed.out);
    assert.deepEqual(subjects(dir), ['add a', 'add b', 'add c']);
  } finally { cleanup(); }
});

test('warns when commits to rewrite are already on a remote', () => {
  const { dir, cleanup } = makeFixupRepo();
  const remote = mkdtempSync(join(tmpdir(), 'gra-remote-'));
  try {
    git(remote, ['init', '-q', '--bare']);
    git(dir, ['remote', 'add', 'origin', remote]);
    git(dir, ['push', '-q', 'origin', 'HEAD~1:refs/heads/feature']);
    git(dir, ['fetch', '-q', 'origin']);
    const { status, out } = runScript(dir, ['base', '--autosquash', '--dry-run']);
    assert.equal(status, 0, out);
    assert.match(out, /3 of the 4 commits to rewrite are already on a remote/);
    assert.match(out, /--force-with-lease/);
  } finally { cleanup(); rmSync(remote, { recursive: true, force: true }); }
});

test('plan mode removes its temporary directory', () => {
  const { dir, sha, cleanup } = makeRepo(THREE);
  const tmp = mkdtempSync(join(tmpdir(), 'gra-tmp-'));
  try {
    const plan = join(dir, '.git', 'plan.txt');
    writeFileSync(plan, `pick ${sha['add a']}\npick ${sha['add b']}\npick ${sha['add c']}\n`);
    const { status, out } = runScript(dir, ['base', '--plan', plan], { TMPDIR: tmp });
    assert.equal(status, 0, out);
    assert.deepEqual(readdirSync(tmp), []);
  } finally { cleanup(); rmSync(tmp, { recursive: true, force: true }); }
});
