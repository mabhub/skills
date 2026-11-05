/**
 * Tests of the purge patterns (motifs.mjs).
 * Run from the repository root: node --test pilotage/scripts/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPLACEMENT, containsAny, decodeFile, parsePatterns, redact } from './motifs.mjs';

test('literal and regex lines', () => {
  const [literal] = parsePatterns('abc.def\n');
  assert.ok(!containsAny('abcXdef', [literal]));
  assert.ok(containsAny('xx abc.def yy', [literal]));
  const [regex] = parsePatterns('regex:tok-[0-9]+\n');
  assert.ok(containsAny('un tok-42 ici', [regex]));
  assert.ok(regex.flags.includes('g'));
});

test('empty lines and CRLF are ignored', () => {
  const patterns = parsePatterns('abc\r\n\r\n');
  assert.equal(patterns.length, 1);
  assert.ok(!containsAny('xyz', patterns));
  assert.ok(containsAny('xabcx', patterns));
});

test('refused lines name the line, not the content', () => {
  for (const line of ['==> VALEUR', 'glob:VALEUR*', 'literal:VALEUR', 'regex:(VALEUR', 'regex:a*']) {
    assert.throws(() => parsePatterns(`ok\n${line}\n`), error => {
      assert.match(error.message, /^motif refusé ligne 2 : /);
      assert.ok(!error.message.includes('VALEUR'), error.message);
      assert.ok(!error.message.includes('a*'), error.message);
      return true;
    });
  }
});

test('a file without patterns is refused', () => {
  assert.throws(() => parsePatterns('\n\r\n'), /aucun motif/);
});

test('redact replaces every occurrence', () => {
  const patterns = parsePatterns('abc\nregex:tok-[0-9]+\n');
  const { text, count } = redact('abc et abc', patterns);
  assert.equal(count, 2);
  assert.equal(text, `${REPLACEMENT} et ${REPLACEMENT}`);
  assert.equal(redact('tok-1 tok-22 rien', patterns).count, 2);
  assert.deepEqual(redact('rien', patterns), { text: 'rien', count: 0 });
});

test('containsAny does not depend on a previous match', () => {
  const patterns = parsePatterns('regex:tok-[0-9]+\n');
  assert.ok(containsAny('aaaa tok-1', patterns));
  assert.ok(containsAny('tok-2', patterns));
});

test('decodeFile keeps the original encoding', () => {
  assert.deepEqual(decodeFile(Buffer.from('é', 'utf8')), { text: 'é', encoding: 'utf8' });
  assert.deepEqual(decodeFile(Buffer.from([0xe9])), { text: 'é', encoding: 'latin1' });
});
