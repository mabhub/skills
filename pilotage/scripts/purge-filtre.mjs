#!/usr/bin/env node
/**
 * purge-filtre — tree filter run by `git filter-branch` during `pilotage.mjs purge`.
 *
 * Walks the checked-out tree (the working directory), replaces every match of the patterns read
 * from the file named by PILOTAGE_MOTIFS, and rewrites changed files in their original encoding.
 * Prints nothing: the matches may be secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { decodeFile, parsePatterns, redact } from './motifs.mjs';

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

filesBelow(process.cwd()).forEach(file => {
  const { text, encoding } = decodeFile(fs.readFileSync(file));
  const cleaned = redact(text, patterns);
  if (cleaned.count > 0) fs.writeFileSync(file, Buffer.from(cleaned.text, encoding));
});
