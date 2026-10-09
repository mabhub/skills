#!/usr/bin/env node
/**
 * pilotage — deterministic helpers for the `pilotage` skill.
 *
 * Subcommands:
 *   init [--chantier <slug>] [--titre <titre>]   create .pilotage/ (git-excluded) and optionally a chantier
 *   decision <slug> <titre...>                   create the next numbered decision file
 *   modele <slug> <essais|connaissances>         add an optional template to a chantier
 *   reprise [<slug>] [--entrees N]               print what a new session needs to resume (index, plan, last journal entries, git)
 *   contexte [--session <id>]                    measure the current session: context size, pauses, cache rewrites
 *
 * Output is French (user-facing). Transcript content is never printed: `contexte` reads only
 * types, timestamps and token counts.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ASSETS = path.join(SKILL_DIR, 'assets');
const DIR_NAME = '.pilotage';
const EXCLUDE_LINE = `/${DIR_NAME}/`;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Runs a git command and returns trimmed stdout, or null outside a repository / on failure.
 * @param {string[]} args - git arguments
 * @param {string} cwd - working directory
 * @returns {string|null} stdout or null
 */
const git = (args, cwd) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

/**
 * Resolves the project root: git toplevel when inside a repository, cwd otherwise.
 * @returns {{root: string, inGit: boolean}} root directory and git flag
 */
const projectRoot = () => {
  const top = git(['rev-parse', '--show-toplevel'], process.cwd());
  return { root: top ?? process.cwd(), inGit: top !== null };
};

/**
 * Parses `--key value` flags and positional arguments.
 * @param {string[]} argv - raw arguments
 * @returns {{flags: Object<string,string>, positional: string[]}} parsed arguments
 */
const parseArgs = argv => argv.reduce(
  (acc, arg, i, all) => {
    if (acc.skip) return { ...acc, skip: false };
    if (arg.startsWith('--')) {
      return { ...acc, flags: { ...acc.flags, [arg.slice(2)]: all[i + 1] ?? '' }, skip: true };
    }
    return { ...acc, positional: [...acc.positional, arg] };
  },
  { flags: {}, positional: [], skip: false },
);

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Fills a template from assets/ with {{KEY}} placeholders.
 * @param {string} name - template file name
 * @param {Object<string,string>} values - placeholder values
 * @returns {string} rendered text
 */
const render = (name, values) => Object.entries(values).reduce(
  (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
  fs.readFileSync(path.join(ASSETS, name), 'utf8'),
);

/**
 * Writes a file only if it does not exist yet.
 * @param {string} file - target path
 * @param {string} content - file content
 * @returns {boolean} true if written
 */
const writeIfAbsent = (file, content) => {
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, content);
  return true;
};

/**
 * Ensures .pilotage/ is listed in the repository's info/exclude (worktree-aware).
 * Refuses to proceed if .pilotage is already tracked by git.
 * @param {string} root - repository root
 * @returns {string} human-readable status line
 */
const ensureExcluded = root => {
  const tracked = git(['ls-files', '--', DIR_NAME], root);
  if (tracked) {
    console.error(`ERREUR : ${DIR_NAME}/ contient des fichiers suivis par git. Arrêt, à régler avec l'utilisateur.`);
    process.exit(2);
  }
  const excludePath = path.resolve(root, git(['rev-parse', '--git-path', 'info/exclude'], root));
  const current = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  if (current.split('\n').some(line => line.trim() === EXCLUDE_LINE)) {
    return `exclusion déjà présente dans ${excludePath}`;
  }
  fs.mkdirSync(path.dirname(excludePath), { recursive: true });
  const prefix = current === '' || current.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(excludePath, `${prefix}${EXCLUDE_LINE}\n`);
  return `exclusion ajoutée dans ${excludePath}`;
};

/**
 * `init`: create .pilotage/, its INDEX.md, and optionally a chantier skeleton.
 * @param {{flags: Object<string,string>}} args - parsed arguments
 */
const cmdInit = ({ flags }) => {
  const { root, inGit } = projectRoot();
  const base = path.join(root, DIR_NAME);
  fs.mkdirSync(base, { recursive: true });
  console.log(inGit ? ensureExcluded(root) : 'hors dépôt git : aucune exclusion nécessaire');
  const indexWritten = writeIfAbsent(
    path.join(base, 'INDEX.md'),
    render('INDEX.md', { PROJET: path.basename(root) }),
  );
  console.log(`${base}/INDEX.md ${indexWritten ? 'créé' : 'existant'}`);

  const slug = flags.chantier;
  if (!slug) return;
  if (!SLUG_RE.test(slug)) {
    console.error(`ERREUR : slug invalide « ${slug} » (minuscules, chiffres, tirets).`);
    process.exit(1);
  }
  const dir = path.join(base, slug);
  fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
  const values = { TITRE: flags.titre || slug, DATE: today() };
  ['plan.md', 'journal.md', 'connaissances.md'].forEach(out => {
    const written = writeIfAbsent(path.join(dir, out), render(out, values));
    console.log(`${dir}/${out} ${written ? 'créé' : 'existant (non modifié)'}`);
  });
};

/**
 * `decision`: create decisions/NNN-<slug-titre>.md from the template.
 * @param {{positional: string[]}} args - parsed arguments
 */
const cmdDecision = ({ positional }) => {
  const [slug, ...words] = positional;
  const titre = words.join(' ');
  const { root } = projectRoot();
  const dir = path.join(root, DIR_NAME, slug ?? '', 'decisions');
  if (!slug || !titre || !fs.existsSync(dir)) {
    console.error('Usage : decision <chantier-existant> <titre de la décision>');
    process.exit(1);
  }
  const next = fs.readdirSync(dir)
    .map(name => Number.parseInt(name, 10))
    .filter(Number.isFinite)
    .reduce((max, n) => Math.max(max, n), 0) + 1;
  const num = String(next).padStart(3, '0');
  const fileSlug = titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const file = path.join(dir, `${num}-${fileSlug}.md`);
  fs.writeFileSync(file, render('decision.md', { NUM: num, TITRE: titre, DATE: today() }));
  console.log(file);
};

/**
 * Returns the last `count` journal entries (blocks starting with "## ").
 * @param {string} text - journal content
 * @param {number} count - number of entries
 * @returns {{shown: string, total: number}} rendered entries and total count
 */
const lastEntries = (text, count) => {
  const blocks = text.split(/^(?=## )/m).filter(block => block.startsWith('## '));
  return { shown: blocks.slice(-count).join('').trimEnd(), total: blocks.length };
};

/**
 * Lists decision files with their status line.
 * @param {string} dir - decisions directory
 * @returns {string[]} one line per decision
 */
const decisionSummaries = dir => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
  .filter(name => name.endsWith('.md'))
  .toSorted()
  .map(name => {
    const statut = fs.readFileSync(path.join(dir, name), 'utf8')
      .match(/^- \*\*Statut\*\* : (.*)$/m)?.[1] ?? '?';
    return `- ${name} — ${statut}`;
  });

const BASE_ENTRIES = new Set(['plan.md', 'journal.md', 'connaissances.md', 'decisions']);

/**
 * Removes template guidance comments and the blank lines they leave behind.
 * @param {string} text - markdown content
 * @returns {string} text without HTML comments
 */
const stripComments = text => text.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trimEnd();

/**
 * Lists complementary files of a chantier (recursively), with their size, without reading them aloud.
 * @param {string} dir - chantier directory
 * @returns {string[]} one line per file
 */
const extraFiles = dir => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)))
  .filter(rel => !BASE_ENTRIES.has(rel.split(path.sep)[0]))
  .toSorted()
  .map(rel => {
    const file = path.join(dir, rel);
    const { size } = fs.statSync(file);
    const lines = size < 1_000_000 ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length : null;
    return `- ${rel} (${lines === null ? `${Math.round(size / 1024)} Ko` : `${lines} ligne${lines > 1 ? 's' : ''}`})`;
  });

/**
 * Finds backticked paths in the "Repères" section of a plan that no longer exist.
 * A path is resolved against the chantier directory, then the project root; `~` is expanded
 * and a trailing `:line` or `:start-end` is ignored. Commands (with spaces) and URLs are skipped.
 * @param {string} planText - plan.md content
 * @param {{root: string, dir: string}} bases - project root and chantier directory
 * @returns {string[]} missing paths as written in the plan
 */
const missingReferences = (planText, { root, dir }) => {
  const section = planText.split(/^## /m).find(block => block.startsWith('Repères')) ?? '';
  return [...section.matchAll(/`([^`\s]+)`/g)]
    .map(match => match[1])
    .filter(ref => ref.includes('/') && !ref.includes('://'))
    .filter(ref => {
      const clean = ref.replace(/:\d+(-\d+)?$/, '').replace(/^~(?=\/)/, os.homedir());
      return !(path.isAbsolute(clean) ? [clean] : [path.join(dir, clean), path.join(root, clean)])
        .some(candidate => fs.existsSync(candidate));
    });
};

/**
 * `reprise`: print index, plan, last journal entries, decision statuses and git state in one go.
 * @param {{flags: Object<string,string>, positional: string[]}} args - parsed arguments
 */
const cmdReprise = ({ flags, positional }) => {
  const { root, inGit } = projectRoot();
  const base = path.join(root, DIR_NAME);
  const index = path.join(base, 'INDEX.md');
  if (!fs.existsSync(index)) {
    console.log(`Aucun ${DIR_NAME}/INDEX.md dans ${root} → rien à reprendre.`);
    return;
  }
  console.log(`=== ${DIR_NAME}/INDEX.md ===\n${fs.readFileSync(index, 'utf8').trimEnd()}\n`);
  const [slug] = positional;
  if (!slug) {
    console.log('(Préciser le chantier : reprise <slug>)');
    return;
  }
  const dir = path.join(base, slug);
  if (!fs.existsSync(dir)) {
    console.error(`ERREUR : chantier « ${slug} » introuvable dans ${base}.`);
    process.exit(1);
  }
  if (inGit && git(['check-ignore', '-q', path.join(DIR_NAME, 'INDEX.md')], root) === null) {
    console.log(`ALERTE : ${DIR_NAME}/ n'est plus ignoré par git (relancer init, ne rien commiter).\n`);
  }
  const plan = path.join(dir, 'plan.md');
  if (fs.existsSync(plan)) {
    const planText = stripComments(fs.readFileSync(plan, 'utf8'));
    console.log(`=== ${slug}/plan.md ===\n${planText}\n`);
    const missing = missingReferences(planText, { root, dir });
    if (missing.length > 0) console.log(`ALERTE : chemins cités dans « Repères » introuvables :\n${missing.map(p => `- ${p}`).join('\n')}\n`);
  }

  const knowledge = path.join(dir, 'connaissances.md');
  if (fs.existsSync(knowledge)) {
    const headings = fs.readFileSync(knowledge, 'utf8').split('\n').filter(line => /^#{2,3} /.test(line));
    console.log(`=== ${slug}/connaissances.md — titres seulement ===\n${headings.join('\n') || '(vide)'}\n`);
  }

  const journal = path.join(dir, 'journal.md');
  if (fs.existsSync(journal)) {
    const count = Number.parseInt(flags.entrees ?? '3', 10);
    const { shown, total } = lastEntries(fs.readFileSync(journal, 'utf8'), count);
    console.log(`=== ${slug}/journal.md — ${Math.min(count, total)} dernière(s) entrée(s) sur ${total} ===\n${shown}\n`);
  }
  const decisions = decisionSummaries(path.join(dir, 'decisions'));
  if (decisions.length > 0) console.log(`=== ${slug}/decisions ===\n${decisions.join('\n')}\n`);
  const others = extraFiles(dir);
  if (others.length > 0) console.log(`=== ${slug} — fichiers complémentaires (non affichés) ===\n${others.join('\n')}\n`);

  if (inGit) {
    const status = git(['status', '--short', '--branch'], root);
    const log = git(['log', '--oneline', '-8'], root);
    console.log(`=== git ===\n${status}\n\n${log}`);
  }
};

/**
 * Converts a directory path to Claude Code's project slug (every non-alphanumeric char → "-").
 * @param {string} dir - absolute directory
 * @returns {string} project slug
 */
const projectSlug = dir => dir.replace(/[^a-zA-Z0-9]/g, '-');

/**
 * Locates the transcript of the current session.
 * @param {string|undefined} sessionId - explicit session id
 * @returns {string|null} transcript path
 */
const findTranscript = sessionId => {
  const projectDir = path.join(os.homedir(), '.claude', 'projects', projectSlug(process.cwd()));
  if (!fs.existsSync(projectDir)) return null;
  if (sessionId) {
    const file = path.join(projectDir, `${sessionId}.jsonl`);
    return fs.existsSync(file) ? file : null;
  }
  const latest = fs.readdirSync(projectDir)
    .filter(name => name.endsWith('.jsonl'))
    .map(name => ({ name, mtime: fs.statSync(path.join(projectDir, name)).mtimeMs }))
    .toSorted((a, b) => b.mtime - a.mtime)[0];
  return latest ? path.join(projectDir, latest.name) : null;
};

/**
 * Parses a transcript into main-thread turns and user prompts (metadata only).
 * @param {string} file - transcript path
 * @returns {{turns: Array<{ts: number, context: number, written: number}>, prompts: number[]}} parsed data
 */
const parseTranscript = file => fs.readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .reduce((acc, line) => {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      return acc;
    }
    if (entry.isSidechain || !entry.timestamp) return acc;
    const ts = Date.parse(entry.timestamp);
    const usage = entry.type === 'assistant' ? entry.message?.usage : null;
    if (usage) {
      const written = usage.cache_creation_input_tokens ?? 0;
      const context = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + written;
      return { ...acc, turns: [...acc.turns, { ts, context, written }] };
    }
    const content = entry.type === 'user' && !entry.isMeta ? entry.message?.content : null;
    const isPrompt = typeof content === 'string'
      || (Array.isArray(content) && content.some(part => part.type === 'text'));
    return isPrompt ? { ...acc, prompts: [...acc.prompts, ts] } : acc;
  }, { turns: [], prompts: [] });

const fmtK = n => `${Math.round(n / 1000)}K`;
const fmtMin = ms => `${Math.round(ms / 60000)} min`;

/**
 * `contexte`: report context size, pauses and full cache rewrites of the current session.
 * @param {{flags: Object<string,string>}} args - parsed arguments
 */
const cmdContexte = ({ flags }) => {
  const file = findTranscript(flags.session);
  if (!file) {
    console.log('Transcript introuvable (passer --session <id>). Taille de contexte inconnue.');
    return;
  }
  const { turns, prompts } = parseTranscript(file);
  if (turns.length === 0) {
    console.log(`Aucun tour mesurable dans ${path.basename(file)}.`);
    return;
  }
  const last = turns.at(-1);
  // Gap before each prompt = time since the previous assistant turn.
  const pauses = prompts
    .map(ts => ({ ts, gap: ts - (turns.findLast(turn => turn.ts < ts)?.ts ?? ts) }))
    .filter(pause => pause.gap > 0);
  const lastPause = pauses.at(-1);
  const longPauses = pauses.filter(pause => pause.gap > 60 * 60000);
  // A full rewrite: most of the context written to cache in one turn after a previous turn existed.
  const rewrites = turns.slice(1).filter(turn => turn.written > 0.6 * turn.context && turn.context > 50000);

  console.log(`Session : ${path.basename(file, '.jsonl')}${flags.session ? '' : ' (transcript le plus récent du projet)'}`);
  console.log(`Contexte au dernier tour : ${fmtK(last.context)} · tours mesurés : ${turns.length}`);
  console.log(`Pic de contexte : ${fmtK(Math.max(...turns.map(turn => turn.context)))}`);
  console.log(`Pause avant le dernier message : ${lastPause ? fmtMin(lastPause.gap) : 'aucune'}`);
  console.log(`Pauses > 1 h dans la session : ${longPauses.length}`);
  console.log(`Réécritures complètes du cache : ${rewrites.length}${rewrites.length ? ` (dernière : ${fmtK(rewrites.at(-1).written)})` : ''}`);
};

/** Optional templates that `modele` can add to an existing chantier. */
const OPTIONAL_TEMPLATES = new Set(['essais', 'connaissances']);

/**
 * `modele`: add an optional template (e.g. essais.md) to an existing chantier, never overwriting.
 * @param {{positional: string[]}} args - parsed arguments
 */
const cmdModele = ({ positional }) => {
  const [slug, name] = positional;
  const { root } = projectRoot();
  const dir = path.join(root, DIR_NAME, slug ?? '');
  if (!slug || !OPTIONAL_TEMPLATES.has(name) || !fs.existsSync(dir)) {
    console.error(`Usage : modele <chantier-existant> <${[...OPTIONAL_TEMPLATES].join('|')}>`);
    process.exit(1);
  }
  const file = path.join(dir, `${name}.md`);
  const written = writeIfAbsent(file, render(`${name}.md`, { TITRE: slug, DATE: today() }));
  console.log(`${file} ${written ? 'créé' : 'existant (non modifié)'}`);
};

const COMMANDS = {
  modele: cmdModele,
  init: cmdInit,
  decision: cmdDecision,
  reprise: cmdReprise,
  contexte: cmdContexte,
};

const [command, ...rest] = process.argv.slice(2);
const handler = COMMANDS[command];
if (!handler) {
  console.error('Usage : pilotage.mjs <init|decision|modele|reprise|contexte> [options]');
  process.exit(1);
}
handler(parseArgs(rest));
