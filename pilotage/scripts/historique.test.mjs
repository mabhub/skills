/**
 * Tests of the optional git history of .pilotage/ (pilotage.mjs + historique.mjs).
 * Every test runs in a throwaway folder with its own git config: the user's config,
 * identity and repositories are never touched.
 * Run from the repository root: node --test pilotage/scripts/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pilotage.mjs');
const PROPOSAL = 'Historique git possible : init --git (voir references/historique.md)';
// No GIT_* variable (GIT_DIR, GIT_AUTHOR_*…) nor EMAIL leaks from the developer's shell.
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|EMAIL$)/.test(key)));
const SETUP_IDENTITY = {
  GIT_AUTHOR_NAME: 'Setup',
  GIT_AUTHOR_EMAIL: 'setup@example.invalid',
  GIT_COMMITTER_NAME: 'Setup',
  GIT_COMMITTER_EMAIL: 'setup@example.invalid',
};

/**
 * Creates a throwaway project (git repository, optionally with one empty commit) and helpers.
 * @param {import('node:test').TestContext} t - test context, used for cleanup
 * @param {{identity?: boolean, commit?: boolean}} [options] - git identity in the config, initial project commit
 * @returns {object} sandbox helpers
 */
const sandbox = (t, { identity = true, commit = true } = {}) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilotage-test-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const gitconfig = path.join(tmp, 'gitconfig');
  fs.writeFileSync(gitconfig, identity ? '[user]\n\tname = Test\n\temail = test@example.invalid\n' : '');
  const project = path.join(tmp, 'projet');
  fs.mkdirSync(project);
  const env = { ...CLEAN_ENV, HOME: tmp, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: '1' };
  const setupEnv = { ...env, ...SETUP_IDENTITY };
  const pilotage = path.join(project, '.pilotage');
  const git = (...args) => execFileSync('git', args, { cwd: project, env: setupEnv, encoding: 'utf8' }).trim();
  const miniGit = (...args) => execFileSync(
    'git',
    ['--git-dir', path.join(pilotage, '.git'), '--work-tree', pilotage, ...args],
    { env: setupEnv, encoding: 'utf8' },
  ).trim();
  const run = (args, extraEnv = {}) => spawnSync(
    process.execPath,
    [SCRIPT, ...args],
    { cwd: project, env: { ...env, ...extraEnv }, encoding: 'utf8' },
  );
  /** PATH holding only a link to node: git is unavailable. */
  const noGitPath = () => {
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    if (!fs.existsSync(path.join(bin, 'node'))) fs.symlinkSync(process.execPath, path.join(bin, 'node'));
    return { PATH: bin };
  };
  git('init', '-q', '-b', 'main');
  if (commit) git('commit', '-q', '--allow-empty', '-m', 'initial');
  return { tmp, gitconfig, project, pilotage, git, miniGit, run, noGitPath };
};

const trailer = (s, key) => s.miniGit('log', '-1', `--format=%(trailers:key=${key},valueonly)`);

test('init proposes history once when git is available', t => {
  const s = sandbox(t);
  const first = s.run(['init', '--chantier', 'demo']);
  assert.equal(first.status, 0, first.stderr);
  assert.ok(first.stdout.includes(PROPOSAL), first.stdout);
  const second = s.run(['init', '--chantier', 'autre']);
  assert.equal(second.status, 0, second.stderr);
  assert.ok(!second.stdout.includes('Historique git possible'), second.stdout);
});

test('init does not propose history without git', t => {
  const s = sandbox(t);
  const noGit = s.noGitPath();
  const init = s.run(['init', '--chantier', 'demo'], noGit);
  assert.equal(init.status, 0, init.stderr);
  assert.ok(!init.stdout.includes('Historique git possible'), init.stdout);
  const withGit = s.run(['init', '--git'], noGit);
  assert.equal(withGit.status, 1);
  assert.match(withGit.stderr, /git indisponible/);
  assert.ok(!fs.existsSync(path.join(s.pilotage, '.git')));
});

test('init --git --chantier demo creates the chantier and the initial commit', t => {
  const s = sandbox(t);
  const res = s.run(['init', '--git', '--chantier', 'demo']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(fs.existsSync(path.join(s.pilotage, 'demo', 'plan.md')));
  assert.equal(s.miniGit('log', '--format=%s'), 'État initial');
  assert.equal(trailer(s, 'Projet-HEAD'), s.git('rev-parse', 'HEAD'));
  assert.equal(trailer(s, 'Projet-branche'), 'main');
  assert.match(res.stdout, /Historique git activé : \d+ fichier\(s\) commité\(s\) · [0-9a-f]{7}/);
  assert.ok(!res.stdout.includes('Historique git possible'), res.stdout);
});

test('init --git on an existing .pilotage commits everything', t => {
  const s = sandbox(t);
  assert.equal(s.run(['init', '--chantier', 'demo']).status, 0);
  const res = s.run(['init', '--git']);
  assert.equal(res.status, 0, res.stderr);
  const files = s.miniGit('ls-files').split('\n');
  assert.ok(files.includes('INDEX.md'), files.join(', '));
  assert.ok(files.includes('demo/journal.md'), files.join(', '));
});

test('init --git twice says already active', t => {
  const s = sandbox(t);
  assert.equal(s.run(['init', '--git']).status, 0);
  const again = s.run(['init', '--git']);
  assert.equal(again.status, 0, again.stderr);
  assert.ok(again.stdout.includes('Historique git déjà actif'), again.stdout);
  assert.equal(s.miniGit('rev-list', '--count', 'HEAD'), '1');
});

test('init --git without identity fails', t => {
  const s = sandbox(t, { identity: false });
  const res = s.run(['init', '--git']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /identité git absente/);
  assert.ok(!fs.existsSync(path.join(s.pilotage, '.git')), 'no repository, hence no commit');
});

test('init --git in a project without commits has no Projet trailers', t => {
  const s = sandbox(t, { commit: false });
  const res = s.run(['init', '--git']);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(s.miniGit('log', '--format=%s'), 'État initial');
  assert.equal(trailer(s, 'Projet-HEAD'), '');
  assert.equal(trailer(s, 'Projet-branche'), '');
});

test('veille.log is excluded', t => {
  const s = sandbox(t);
  fs.mkdirSync(s.pilotage);
  fs.writeFileSync(path.join(s.pilotage, 'veille.log'), 'log\n');
  assert.equal(s.run(['init', '--git']).status, 0);
  assert.ok(!s.miniGit('ls-files').split('\n').includes('veille.log'));
});

test('git clean -fdx in the project keeps .pilotage', t => {
  const s = sandbox(t);
  assert.equal(s.run(['init', '--git', '--chantier', 'demo']).status, 0);
  s.git('clean', '-fdx');
  assert.ok(fs.existsSync(path.join(s.pilotage, 'INDEX.md')));
  assert.ok(fs.existsSync(path.join(s.pilotage, 'demo', 'plan.md')));
});

/**
 * Sandbox with history on and one chantier `demo`.
 * @param {import('node:test').TestContext} t - test context
 * @returns {object} sandbox helpers
 */
const activeSandbox = t => {
  const s = sandbox(t);
  const init = s.run(['init', '--git', '--chantier', 'demo']);
  assert.equal(init.status, 0, init.stderr);
  return s;
};
const commitCount = s => Number(s.miniGit('rev-list', '--count', 'HEAD'));
const touch = (s, file, text = '\nmodifié\n') => fs.appendFileSync(path.join(s.pilotage, file), text);

test('point commits with chantier trailer', t => {
  const s = activeSandbox(t);
  const res = s.run(['point', 'demo']);
  assert.equal(res.status, 0, res.stderr);
  const sha = s.miniGit('rev-parse', '--short=7', 'HEAD');
  assert.ok(res.stdout.includes(`Historique : point d'étape commité (demo) · ${sha}`), res.stdout);
  assert.equal(s.miniGit('log', '-1', '--format=%s'), "Point d'étape · demo");
  assert.equal(trailer(s, 'Chantier'), 'demo');
  assert.equal(trailer(s, 'Projet-HEAD'), s.git('rev-parse', 'HEAD'));
});

test('point without changes makes an empty commit', t => {
  const s = activeSandbox(t);
  assert.equal(s.run(['point', 'demo']).status, 0);
  assert.equal(s.run(['point', 'demo']).status, 0);
  assert.equal(commitCount(s), 3);
});

test('point refuses outside history mode and leaves the project repo alone', t => {
  const s = sandbox(t);
  assert.equal(s.run(['init', '--chantier', 'demo']).status, 0);
  const before = s.git('rev-list', '--count', 'HEAD');
  const res = s.run(['point', 'demo']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /historique git non activé \(init --git\)/);
  assert.equal(s.git('rev-list', '--count', 'HEAD'), before);
  assert.ok(!fs.existsSync(path.join(s.pilotage, '.git')));
});

test('point needs an existing chantier', t => {
  const s = activeSandbox(t);
  for (const args of [['point'], ['point', 'absent'], ['point', '../..']]) {
    const res = s.run(args);
    assert.equal(res.status, 1, args.join(' '));
    assert.match(res.stderr, /Usage : point/);
  }
  assert.equal(commitCount(s), 1);
});

test('point fails without identity', t => {
  const s = activeSandbox(t);
  fs.writeFileSync(s.gitconfig, '');
  const res = s.run(['point', 'demo']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /identité git absente/);
  assert.equal(commitCount(s), 1);
});

test('contexte catches up pending changes', t => {
  const s = activeSandbox(t);
  touch(s, 'demo/plan.md');
  const res = s.run(['contexte']);
  assert.equal(res.status, 0, res.stderr);
  const lines = res.stdout.split('\n');
  assert.match(lines[0], /^Veille cache/);
  assert.equal(lines[1], 'Historique git : actif · rattrapage commité (demo)');
  assert.equal(s.miniGit('log', '-1', '--format=%s'), 'Rattrapage (contexte) · demo');
  assert.equal(trailer(s, 'Chantier'), '');
  const clean = s.run(['contexte']);
  assert.equal(clean.stdout.split('\n')[1], 'Historique git : actif');
  touch(s, 'INDEX.md');
  assert.equal(s.run(['contexte']).stdout.split('\n')[1], 'Historique git : actif · rattrapage commité (racine)');
});

test('catch-up without identity warns and continues', t => {
  const s = activeSandbox(t);
  touch(s, 'demo/plan.md');
  fs.writeFileSync(s.gitconfig, '');
  const res = s.run(['reprise', 'demo']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('Historique git : actif · rattrapage impossible (identité git absente), suivi non commité'), res.stdout);
  assert.ok(res.stdout.includes('=== demo/plan.md ==='), res.stdout);
  assert.equal(commitCount(s), 1);
});

test('catch-up without git warns and continues', t => {
  const s = activeSandbox(t);
  touch(s, 'demo/plan.md');
  const res = s.run(['reprise', 'demo'], s.noGitPath());
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('rattrapage impossible (git indisponible)'), res.stdout);
  assert.ok(res.stdout.includes('=== demo/plan.md ==='), res.stdout);
});

test('journal shrink raises an alert without content', t => {
  const s = activeSandbox(t);
  const journal = path.join(s.pilotage, 'demo', 'journal.md');
  const original = fs.readFileSync(journal, 'utf8');
  fs.writeFileSync(journal, `${original}\n- [directive] SECRET-TEST-123\n`);
  assert.equal(s.run(['point', 'demo']).status, 0);
  fs.writeFileSync(journal, `${original}\n`);
  const before = commitCount(s);
  const res = s.run(['point', 'demo']);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /ALERTE : demo\/journal\.md a perdu 1 ligne\(s\) \(version précédente : lignes \d+\)/);
  assert.ok(!res.stdout.includes('SECRET-TEST-123'));
  assert.ok(!res.stderr.includes('SECRET-TEST-123'));
  assert.equal(commitCount(s), before + 1);
});

test('deleted journal raises an alert', t => {
  const s = activeSandbox(t);
  const journal = path.join(s.pilotage, 'demo', 'journal.md');
  const lines = fs.readFileSync(journal, 'utf8').split('\n').length - 1;
  fs.rmSync(journal);
  const res = s.run(['point', 'demo']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes(`ALERTE : demo/journal.md a perdu ${lines} ligne(s) (version précédente : lignes 1-${lines})`), res.stdout);
});

test('standard mode output is unchanged', t => {
  const s = sandbox(t);
  assert.equal(s.run(['init', '--chantier', 'demo']).status, 0);
  for (const args of [['contexte'], ['reprise', 'demo']]) {
    const res = s.run(args);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(!res.stdout.includes('Historique'), res.stdout);
  }
});
