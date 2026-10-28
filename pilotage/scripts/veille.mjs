#!/usr/bin/env node
/**
 * veille — wakes Claude shortly before the prompt cache expires, for a quick checkpoint.
 * Wired as two Claude Code hooks (see references/veille.md):
 *
 *   armer     Stop hook (`asyncRewake: true`): runs the filters, then sleeps PILOTAGE_VEILLE_DELAI
 *             seconds and exits 2 with a wake-up instruction, unless disarmed meanwhile.
 *   desarmer  UserPromptSubmit hook: kills the pending timer of the session.
 *
 * Reads the hook JSON on stdin. Logs one line per decision to <project>/.pilotage/veille.log
 * (nothing is logged outside a project that has a .pilotage/ folder). The transcript is only
 * scanned for token counters and the presence of a skill marker: its content is never printed
 * nor logged.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Integer setting from the environment; an invalid value falls back to the default
 * (a NaN delay would make setTimeout fire at once, after every turn).
 * @param {string} name - variable name
 * @param {number} fallback - default value
 * @param {number} min - smallest accepted value
 * @returns {number} value
 */
const envInt = (name, fallback, min) => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= min ? value : fallback;
};

const DELAI = envInt('PILOTAGE_VEILLE_DELAI', 3300, 1);
const SEUIL = envInt('PILOTAGE_VEILLE_SEUIL', 80000, 0);
const RUN_DIR = process.env.XDG_RUNTIME_DIR ?? os.tmpdir();
const SKILL_MARKERS = ['<command-name>/pilotage</command-name>', '"skill":"pilotage"'];

const pidFile = session => path.join(RUN_DIR, `pilotage-veille-${session}.pid`);

/**
 * Session id from the hook input, only if it is safe in a file name (Claude Code sends a UUID).
 * Anything else (e.g. `../x`) could move the pid file out of RUN_DIR.
 * @param {object} input - hook input
 * @returns {string|null} session id
 */
const sessionOf = input => (/^[A-Za-z0-9-]{1,128}$/.test(input.session_id ?? '') ? input.session_id : null);

/**
 * Nearest .pilotage/ folder, walking up from cwd.
 * @param {string} cwd - hook working directory
 * @returns {string|null} path of the .pilotage/ folder
 */
const findPilotage = cwd => {
  const candidate = path.join(cwd, '.pilotage');
  if (fs.existsSync(path.join(candidate, 'INDEX.md'))) return candidate;
  const parent = path.dirname(cwd);
  return parent === cwd ? null : findPilotage(parent);
};

/**
 * Active chantiers listed in .pilotage/INDEX.md.
 * @param {string|null} dir - .pilotage/ folder
 * @returns {string[]} slugs
 */
const activeChantiers = dir => {
  if (!dir) return [];
  const section = fs.readFileSync(path.join(dir, 'INDEX.md'), 'utf8')
    .split(/^## /m)
    .find(part => part.startsWith('Actifs')) ?? '';
  return [...section.matchAll(/^- \[([a-z0-9][a-z0-9-]*)\]/gm)].map(match => match[1]);
};

/**
 * Builds the logger of a session: one decision line in .pilotage/veille.log, or nothing.
 * @param {string|null} dir - .pilotage/ folder
 * @param {string} session - session id
 * @returns {(message: string) => void} logger
 */
const logger = (dir, session) => message => {
  if (dir) fs.appendFileSync(path.join(dir, 'veille.log'), `${new Date().toISOString()} ${session.slice(0, 8)} ${message}\n`);
};

/**
 * Reads the main-thread assistant usages of a transcript (metadata only).
 * @param {string} file - transcript path
 * @returns {{raw: string, usages: object[]}} raw text (for marker search) and usages in order
 */
const readTranscript = file => {
  const raw = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const usages = raw.split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(entry => entry?.type === 'assistant' && !entry.isSidechain && entry.message?.usage)
    .map(entry => entry.message.usage);
  return { raw, usages };
};

/**
 * Cache lifetime of the last turn that wrote to the cache.
 * @param {object[]} usages - assistant usages
 * @returns {'1h'|'5m'|'inconnu'} lifetime
 */
const cacheTtl = usages => {
  const last = usages.findLast(usage => (usage.cache_creation_input_tokens ?? 0) > 0)?.cache_creation;
  if (!last) return 'inconnu';
  if ((last.ephemeral_1h_input_tokens ?? 0) > 0) return '1h';
  return (last.ephemeral_5m_input_tokens ?? 0) > 0 ? '5m' : 'inconnu';
};

const contextSize = usage => usage
  ? (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
  : 0;

/**
 * Kills the pending timer of a session, if the pid still belongs to a veille timer.
 * @param {string} session - session id
 * @returns {boolean} true when a timer was killed
 */
const disarm = session => {
  const file = pidFile(session);
  if (!fs.existsSync(file)) return false;
  const pid = Number(fs.readFileSync(file, 'utf8'));
  fs.rmSync(file, { force: true });
  let cmdline = '';
  try {
    cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
  } catch {
    return false;
  }
  // cmdline is NUL-separated: only an `armer` timer of this script may be killed.
  if (!cmdline.includes('veille.mjs\0armer')) return false;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return false; // the timer ended between the check and the kill
  }
  return true;
};

const wakeMessage = slugs => [
  `[pilotage · veille] ${Math.round(DELAI / 60)} min sans réponse de l'utilisateur : le cache de la conversation expire à 1 h.`,
  `Point d'étape éclair sur ${slugs.join(', ')} :`,
  "- au plus 2 appels d'outil : une entrée de journal ajoutée par `cat >>` pour ce qui n'est pas encore tracé, et un Edit ciblé de plan.md seulement si « Où on en est » est périmé ;",
  '- aucune lecture de fichier, aucune mesure, aucune autre action ;',
  "- si tout est déjà tracé, aucun appel d'outil ;",
  `- termine par une seule ligne : « Suivi à jour. Pour reprendre : /clear puis /pilotage reprise ${slugs[0]} ».`,
].join('\n');

/**
 * Stop hook: decides whether to arm, then waits and wakes Claude with exit code 2.
 * @param {object} input - hook input
 */
const armer = input => {
  const session = sessionOf(input);
  if (!session) return; // no safe pid file name: never arm
  disarm(session);
  const dir = findPilotage(input.cwd ?? process.cwd());
  const log = logger(dir, session);
  const slugs = activeChantiers(dir);
  if (slugs.length === 0) return; // no chantier: stay silent, even in the log
  const { raw, usages } = readTranscript(input.transcript_path);
  const context = contextSize(usages.at(-1));
  const ttl = cacheTtl(usages);
  const refus = [
    // Without /proc, disarm cannot check a pid: timers would pile up, one per turn.
    [!fs.existsSync('/proc/self/cmdline'), '/proc absent : désarmement impossible'],
    [input.stop_hook_active, 'relance par un hook Stop'],
    [/\/pilotage reprise/.test(input.last_assistant_message ?? ''), 'reprise déjà proposée (D2)'],
    [(input.session_crons?.length ?? 0) + (input.background_tasks?.length ?? 0) > 0, 'réveil déjà prévu (cron ou tâche de fond)'],
    [!SKILL_MARKERS.some(marker => raw.includes(marker)), 'skill pilotage non chargé dans la session'],
    [ttl === '5m', 'cache de 5 min : le réveil réécrirait tout le contexte'],
    [context < SEUIL, `contexte ${Math.round(context / 1000)}K < seuil ${Math.round(SEUIL / 1000)}K`],
  ].find(([condition]) => condition);
  if (refus) {
    log(`non armé : ${refus[1]}`);
    return;
  }
  fs.writeFileSync(pidFile(session), String(process.pid));
  log(`armé : ${DELAI} s, contexte ${Math.round(context / 1000)}K, cache ${ttl}, chantiers ${slugs.join(',')}`);
  process.on('SIGTERM', () => process.exit(0));
  setTimeout(() => {
    fs.rmSync(pidFile(session), { force: true });
    log('réveil');
    process.stderr.write(`${wakeMessage(slugs)}\n`);
    process.exit(2);
  }, DELAI * 1000);
};

/**
 * UserPromptSubmit hook: the user answered, cancel the pending wake-up.
 * @param {object} input - hook input
 */
const desarmer = input => {
  const session = sessionOf(input);
  if (session && disarm(session)) logger(findPilotage(input.cwd ?? process.cwd()), session)("désarmé : réponse de l'utilisateur");
};

const COMMANDS = { armer, desarmer };
const command = COMMANDS[process.argv[2]];
if (!command) {
  console.error('Usage : veille.mjs <armer|desarmer> (JSON du hook sur stdin)');
  process.exit(1);
}
let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}
command(input);
