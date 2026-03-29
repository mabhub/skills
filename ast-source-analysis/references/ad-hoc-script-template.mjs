#!/usr/bin/env node

/**
 * Ad-hoc AST analysis script template
 *
 * Copy this file to the target project's temp/ directory and customize
 * the CUSTOM ANALYSIS section. Keep the file in temp/ — do not commit it.
 *
 * Usage:
 *   node temp/my-analysis.mjs [directory]
 *   node temp/my-analysis.mjs [directory] --json
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';

// ── Configuration ──────────────────────────────────────────────────────────

const ROOT = process.argv[2] ?? '.';
const JSON_OUTPUT = process.argv.includes('--json');

// File extensions to parse
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

// ── File discovery ─────────────────────────────────────────────────────────

function findFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { recursive: true })) {
    const parts = entry.split('/');
    if (parts.some(p => SKIP_DIRS.has(p))) continue;
    if (EXTENSIONS.has(extname(entry))) {
      files.push(join(dir, entry));
    }
  }
  return files.sort();
}

// ── Utility ────────────────────────────────────────────────────────────────

function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

// ── Main analysis loop ─────────────────────────────────────────────────────

const files = findFiles(ROOT);
const results = [];
const errors = [];

for (const filepath of files) {
  const source = readFileSync(filepath, 'utf-8');
  const rel = relative(ROOT, filepath);

  let parseResult;
  try {
    parseResult = parseSync(filepath, source);
  } catch (e) {
    errors.push({ file: rel, error: e.message });
    continue;
  }

  if (parseResult.errors.length > 0) {
    errors.push({ file: rel, parseErrors: parseResult.errors.map(e => e.message) });
  }

  // ── CUSTOM ANALYSIS HERE ──────────────────────────────────────────────

  // Example 1: Collect all comments
  // for (const comment of parseResult.comments) {
  //   results.push({
  //     file: rel,
  //     line: lineAt(source, comment.start),
  //     type: comment.type,
  //     value: comment.value.trim(),
  //   });
  // }

  // Example 2: Visit AST nodes with the Visitor pattern
  const visitor = new Visitor({
    FunctionDeclaration(node) {
      // Collect exported functions with their parameter count
      results.push({
        file: rel,
        line: lineAt(source, node.start),
        name: node.id?.name ?? '<anonymous>',
        params: node.params.length,
        async: node.async,
      });
    },

    // Use ':exit' suffix to run AFTER all children are visited
    // 'FunctionDeclaration:exit'(node) { ... }
  });

  visitor.visit(parseResult.program);

  // Example 3: Use result.module for import/export metadata (no traversal needed)
  // for (const imp of parseResult.module.staticImports) {
  //   results.push({
  //     file: rel,
  //     from: imp.moduleRequest.value,
  //     specifiers: imp.entries.map(e => e.localName.value),
  //   });
  // }

  // ── END CUSTOM ANALYSIS ───────────────────────────────────────────────
}

// ── Output ─────────────────────────────────────────────────────────────────

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ root: ROOT, filesAnalyzed: files.length, errors, results }, null, 2));
} else {
  console.log(`Analyzed ${files.length} files in ${ROOT}`);
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.file}: ${e.error ?? e.parseErrors?.join(', ')}`));
  }
  console.log(`\nResults (${results.length}):`);
  results.forEach(r => {
    const loc = `${r.file}:${r.line}`;
    // Customize this output to match your result shape
    console.log(`  ${loc.padEnd(50)} ${JSON.stringify(r)}`);
  });
}
