#!/usr/bin/env node
/**
 * purge-filtre — tree filter run by `git filter-branch` during `pilotage.mjs purge`.
 *
 * Walks the checked-out tree (the working directory), replaces every match of the patterns read
 * from the file named by PILOTAGE_MOTIFS, and rewrites changed files in their original encoding.
 * Prints nothing: the matches may be secrets. No network access, nothing written elsewhere.
 *
 * Write scope: git filter-branch runs a tree filter inside `<work tree>/.git-rewrite/t`, a throwaway
 * checkout of one commit of the `.pilotage/` history. The script refuses to run anywhere else, so a
 * manual run from a project folder cannot rewrite its files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { decodeFile, parsePatterns, redact } from './motifs.mjs';

const cwd = process.cwd();
const inRewriteCheckout = path.basename(cwd) === 't' && path.basename(path.dirname(cwd)) === '.git-rewrite';
if (!process.env.GIT_COMMIT || !process.env.PILOTAGE_MOTIFS || !inRewriteCheckout) {
  console.error('purge-filtre : à lancer uniquement par `pilotage.mjs purge` (filtre de git filter-branch).');
  process.exit(2);
}

const patterns = parsePatterns(fs.readFileSync(process.env.PILOTAGE_MOTIFS, 'utf8'));

/**
 * @param {string} dir - folder to walk
 * @returns {string[]} regular files below it (symbolic links are not followed)
 */
const filesBelow = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return filesBelow(full);
  return entry.isFile() ? [full] : [];
});

filesBelow(cwd).forEach(file => {
  const { text, encoding } = decodeFile(fs.readFileSync(file));
  const cleaned = redact(text, patterns);
  if (cleaned.count > 0) fs.writeFileSync(file, Buffer.from(cleaned.text, encoding));
});
