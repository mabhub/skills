/**
 * motifs — patterns of the `purge` command (one per line: a literal value, or `regex:<source>`
 * in JavaScript syntax). Error messages name the line, never its content: it may be a secret.
 */

export const REPLACEMENT = '***REMOVED***';

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds the regex of one non-empty line.
 * @param {string} line - pattern line, without line ending
 * @param {number} number - 1-based line number, for the error message
 * @returns {RegExp} global regex
 * @throws {Error} refused line (message without the line's content)
 */
const lineToRegExp = (line, number) => {
  const refuse = reason => new Error(`motif refusé ligne ${number} : ${reason}`);
  if (line.includes('==>')) throw refuse('syntaxe « ==> » non prise en charge');
  if (/^(glob|literal):/.test(line)) throw refuse('préfixe non pris en charge (seul « regex: » existe)');
  if (!line.startsWith('regex:')) return new RegExp(escapeRegExp(line), 'g');
  let regex;
  try {
    regex = new RegExp(line.slice('regex:'.length), 'g');
  } catch {
    throw refuse('expression régulière invalide en JavaScript');
  }
  if (''.search(regex) === 0) throw refuse('l\'expression correspond à la chaîne vide');
  return regex;
};

/**
 * Parses a patterns file.
 * @param {string} text - file content
 * @returns {RegExp[]} global regexes, in file order
 * @throws {Error} refused line, or no pattern at all
 */
export const parsePatterns = text => {
  const patterns = text.split('\n')
    .map((line, i) => [line.replace(/\r$/, ''), i + 1])
    .filter(([line]) => line !== '')
    .map(([line, number]) => lineToRegExp(line, number));
  if (patterns.length === 0) throw new Error('aucun motif dans le fichier');
  return patterns;
};

/**
 * Replaces every match of every pattern.
 * @param {string} text - text to clean
 * @param {RegExp[]} patterns - global regexes
 * @returns {{text: string, count: number}} cleaned text and number of replacements
 */
export const redact = (text, patterns) => patterns.reduce(({ text: current, count }, regex) => {
  let found = 0;
  const replaced = current.replace(regex, () => {
    found += 1;
    return REPLACEMENT;
  });
  return { text: replaced, count: count + found };
}, { text, count: 0 });

/**
 * @param {string} text - text to search
 * @param {RegExp[]} patterns - regexes (their lastIndex is ignored)
 * @returns {boolean} true when one pattern matches
 */
export const containsAny = (text, patterns) => patterns.some(regex => text.search(regex) !== -1);

/**
 * Decodes a file as UTF-8 when it round-trips, as latin1 otherwise (every byte kept).
 * @param {Buffer} buffer - raw content
 * @returns {{text: string, encoding: 'utf8'|'latin1'}} text and encoding to write it back with
 */
export const decodeFile = buffer => {
  const text = buffer.toString('utf8');
  return Buffer.from(text, 'utf8').equals(buffer)
    ? { text, encoding: 'utf8' }
    : { text: buffer.toString('latin1'), encoding: 'latin1' };
};
