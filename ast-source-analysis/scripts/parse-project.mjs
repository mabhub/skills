#!/usr/bin/env node

/**
 * AST-based project analysis backend.
 * Handles file discovery, parsing, and structured extraction.
 * Claude handles interpretation and reporting.
 *
 * Usage:
 *   node parse-project.mjs [directory] [options]
 *
 * Options:
 *   --extract <list>   Extractors: comments,imports,exports,functions,classes,jsx,metrics
 *   --include <glob>   File glob to include (default: **\/*.{js,jsx,ts,tsx,mjs})
 *   --exclude <glob>   File glob to exclude (default: node_modules,dist,build)
 *   --json             JSON output (default: human-readable)
 *   --summary          Add aggregate statistics
 *   --per-file         Group results by file
 *   --max-files <n>    Limit number of files parsed
 *   --verbose          Show progress on stderr
 *
 * Examples:
 *   node parse-project.mjs src --extract metrics --summary
 *   node parse-project.mjs . --extract comments --json
 *   node parse-project.mjs . --extract imports,exports --json --summary
 *   node parse-project.mjs src --extract functions --json --per-file
 */

// ── Dependency check ────────────────────────────────────────────────────────
// oxc-parser is resolved from CWD (target project) or from the script's own directory.
// This lets the skill script be invoked from any working directory as long as
// oxc-parser is installed in either the CWD or the skill directory.

import { createRequire } from 'node:module';

let parseSync, Visitor;
const tryResolve = [
  // 1. Target project's node_modules (most common: run from project root)
  () => import(new URL('oxc-parser', `file://${process.cwd()}/node_modules/oxc-parser/`).href),
  // 2. Skill directory's node_modules (fallback: skill has oxc-parser installed)
  () => import(new URL('../../node_modules/oxc-parser/src-js/index.js', import.meta.url).href),
];

let loaded = false;
for (const attempt of tryResolve) {
  try {
    ({ parseSync, Visitor } = await attempt());
    loaded = true;
    break;
  } catch { /* try next */ }
}

if (!loaded) {
  // Last fallback: let Node resolve from CWD via createRequire
  try {
    const req = createRequire(process.cwd() + '/package.json');
    ({ parseSync, Visitor } = req('oxc-parser'));
    loaded = true;
  } catch { /* give up */ }
}

if (!loaded) {
  console.error('oxc-parser not found. Install it in the target project:');
  console.error('  npm install --no-save oxc-parser   # then npm prune when done');
  console.error('');
  console.error('Or check if it is already installed:');
  console.error('  ls node_modules/oxc-parser');
  process.exit(1);
}

import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, relative, resolve } from 'node:path';

// ── CLI parsing ─────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    directory: '.',
    extractors: ['metrics'],
    json: false,
    summary: false,
    perFile: false,
    maxFiles: Infinity,
    verbose: false,
    excludeDirs: new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out', 'vendor', '__pycache__']),
    excludeFilePatterns: [/\.env/, /credential/i, /secret/i, /token/i, /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/],
    extensions: new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']),
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (!arg.startsWith('--') && i === 0) {
      opts.directory = arg;
    } else if (arg === '--extract' && args[i + 1]) {
      opts.extractors = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--summary') {
      opts.summary = true;
    } else if (arg === '--per-file') {
      opts.perFile = true;
    } else if (arg === '--verbose') {
      opts.verbose = true;
    } else if (arg === '--max-files' && args[i + 1]) {
      opts.maxFiles = parseInt(args[++i], 10);
    } else if (arg === '--help') {
      console.log(readFileSync(new URL(import.meta.url), 'utf-8').match(/\/\*\*([\s\S]*?)\*\//)[0]);
      process.exit(0);
    }
    i++;
  }
  return opts;
}

// ── File discovery ──────────────────────────────────────────────────────────

function discoverFiles(dir, opts) {
  const files = [];
  const absDir = resolve(dir);

  for (const entry of readdirSync(absDir, { recursive: true })) {
    const parts = entry.split('/');
    if (parts.some(p => opts.excludeDirs.has(p))) continue;
    if (!opts.extensions.has(extname(entry))) continue;
    const basename = parts[parts.length - 1];
    if (opts.excludeFilePatterns.some(re => re.test(basename))) continue;
    files.push(join(absDir, entry));
  }

  files.sort();
  return opts.maxFiles < Infinity ? files.slice(0, opts.maxFiles) : files;
}

// ── Utilities ───────────────────────────────────────────────────────────────

function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function contextLineAt(source, offset) {
  // Return the next non-blank line after the given offset
  const rest = source.slice(offset);
  const lines = rest.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
      return trimmed.slice(0, 80);
    }
  }
  return null;
}

// ── Extractors ───────────────────────────────────────────────────────────────

function extractComments(filepath, source, pr) {
  const results = [];
  for (const comment of pr.comments) {
    const startLine = lineAt(source, comment.start);
    const ctx = contextLineAt(source, comment.end);

    if (comment.type === 'Line') {
      const value = comment.value.trim();
      if (value) {
        results.push({ file: filepath, line: startLine, type: 'Line', value, context: ctx });
      }
    } else {
      // Block comment: split into lines, strip leading * from JSDoc
      const lines = comment.value.split('\n');
      lines.forEach((raw, i) => {
        const value = raw.replace(/^\s*\*?\s?/, '').trim();
        if (value) {
          results.push({ file: filepath, line: startLine + i, type: 'Block', value, context: i === lines.length - 1 ? ctx : null });
        }
      });
    }
  }
  return results;
}

function extractImports(filepath, source, pr) {
  const results = [];
  // Static imports from module metadata (most reliable)
  for (const imp of pr.module.staticImports) {
    const specifiers = imp.entries.map(e => {
      const kind = e.importName?.kind;
      if (kind === 'Default') return `default as ${e.localName.value}`;
      if (kind === 'NamespaceObject') return `* as ${e.localName.value}`;
      const imported = e.importName?.name ?? e.localName.value;
      const local = e.localName.value;
      return imported !== local ? `${imported} as ${local}` : local;
    });
    results.push({
      file: filepath,
      line: lineAt(source, imp.start),
      source: imp.moduleRequest.value,
      specifiers,
      isType: imp.entries.every(e => e.isType),
      isDynamic: false,
    });
  }
  // Dynamic imports
  for (const dyn of pr.module.dynamicImports) {
    results.push({
      file: filepath,
      line: lineAt(source, dyn.start),
      source: null, // expression, not a static string
      specifiers: [],
      isType: false,
      isDynamic: true,
    });
  }
  return results;
}

function extractExports(filepath, source, pr) {
  const results = [];
  for (const exp of pr.module.staticExports) {
    for (const entry of exp.entries) {
      const name = entry.exportName?.name ?? null;
      const kind = entry.exportName?.kind ?? 'Name';
      results.push({
        file: filepath,
        line: lineAt(source, exp.start),
        name,
        kind,
        isDefault: kind === 'Default',
        isType: entry.isType,
        reExportFrom: entry.moduleRequest?.value ?? null,
      });
    }
  }
  return results;
}

function extractFunctions(filepath, source, pr) {
  const results = [];
  const exported = new Set(
    pr.module.staticExports.flatMap(e => e.entries.map(en => en.localName?.name).filter(Boolean))
  );

  const visitor = new Visitor({
    FunctionDeclaration(node) {
      if (!node.id) return;
      const bodyLines = source.slice(node.start, node.end).split('\n').length;
      results.push({
        file: filepath,
        line: lineAt(source, node.start),
        name: node.id.name,
        kind: 'function',
        params: node.params.map(p => p.name ?? (p.left?.name) ?? '…'),
        isAsync: node.async,
        isGenerator: node.generator,
        isExported: exported.has(node.id.name),
        bodyLines,
      });
    },
    MethodDefinition(node) {
      const name = node.key?.name ?? node.key?.value ?? '<computed>';
      const fn = node.value;
      const bodyLines = fn ? source.slice(fn.start, fn.end).split('\n').length : 0;
      results.push({
        file: filepath,
        line: lineAt(source, node.start),
        name,
        kind: node.static ? 'static-method' : node.kind === 'constructor' ? 'constructor' : 'method',
        params: fn?.params?.map(p => p.name ?? (p.left?.name) ?? '…') ?? [],
        isAsync: fn?.async ?? false,
        isGenerator: fn?.generator ?? false,
        isExported: false,
        bodyLines,
      });
    },
    VariableDeclarator(node) {
      // Arrow functions assigned to variables: const fn = () => {}
      if (!node.init || (node.init.type !== 'ArrowFunctionExpression' && node.init.type !== 'FunctionExpression')) return;
      const name = node.id?.name;
      if (!name) return;
      const fn = node.init;
      const bodyLines = source.slice(fn.start, fn.end).split('\n').length;
      results.push({
        file: filepath,
        line: lineAt(source, node.start),
        name,
        kind: fn.type === 'ArrowFunctionExpression' ? 'arrow' : 'function-expr',
        params: fn.params.map(p => p.name ?? (p.left?.name) ?? '…'),
        isAsync: fn.async,
        isGenerator: fn.generator ?? false,
        isExported: exported.has(name),
        bodyLines,
      });
    },
  });

  visitor.visit(pr.program);
  return results;
}

function extractClasses(filepath, source, pr) {
  const results = [];
  const exported = new Set(
    pr.module.staticExports.flatMap(e => e.entries.map(en => en.localName?.name).filter(Boolean))
  );

  const visitor = new Visitor({
    ClassDeclaration(node) {
      const methods = node.body.body
        .filter(m => m.type === 'MethodDefinition')
        .map(m => ({
          name: m.key?.name ?? m.key?.value ?? '<computed>',
          kind: m.kind,
          static: m.static,
          params: m.value?.params?.length ?? 0,
        }));

      const properties = node.body.body
        .filter(m => m.type === 'PropertyDefinition')
        .map(m => ({
          name: m.key?.name ?? m.key?.value ?? '<computed>',
          static: m.static,
        }));

      results.push({
        file: filepath,
        line: lineAt(source, node.start),
        name: node.id?.name ?? '<anonymous>',
        superClass: node.superClass?.name ?? node.superClass?.object?.name ?? null,
        methods,
        properties,
        isExported: exported.has(node.id?.name),
      });
    },
  });

  visitor.visit(pr.program);
  return results;
}

function extractJsx(filepath, source, pr) {
  const results = [];
  // Detect React components: functions/arrows returning JSX (heuristic: name starts with uppercase)
  const visitor = new Visitor({
    FunctionDeclaration(node) {
      if (!node.id?.name || !/^[A-Z]/.test(node.id.name)) return;
      const props = node.params[0];
      const propNames = props?.properties?.map(p => p.key?.name ?? '?') ?? [];
      results.push({
        file: filepath,
        line: lineAt(source, node.start),
        name: node.id.name,
        kind: 'function',
        props: propNames,
        isExported: false, // refined later if needed
      });
    },
    VariableDeclarator(node) {
      if (!node.id?.name || !/^[A-Z]/.test(node.id.name)) return;
      const fn = node.init;
      if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) return;
      const props = fn.params[0];
      const propNames = props?.properties?.map(p => p.key?.name ?? '?') ?? [];
      results.push({
        file: filepath,
        line: lineAt(source, node.start),
        name: node.id.name,
        kind: 'arrow',
        props: propNames,
        isExported: false,
      });
    },
  });

  visitor.visit(pr.program);
  return results;
}

function extractMetrics(filepath, source, pr) {
  const sourceLines = source.split('\n');
  const commentOffsets = new Set();

  for (const comment of pr.comments) {
    const startLine = lineAt(source, comment.start);
    const endLine = lineAt(source, comment.end);
    for (let l = startLine; l <= endLine; l++) commentOffsets.add(l);
  }

  let codeLines = 0, commentLines = 0, blankLines = 0;
  sourceLines.forEach((line, i) => {
    const l = i + 1;
    if (!line.trim()) blankLines++;
    else if (commentOffsets.has(l)) commentLines++;
    else codeLines++;
  });

  return [{
    file: filepath,
    lines: sourceLines.length,
    codeLines,
    commentLines,
    blankLines,
    functionCount: 0, // filled in combined mode
    importCount: pr.module.staticImports.length + pr.module.dynamicImports.length,
    exportCount: pr.module.staticExports.reduce((n, e) => n + e.entries.length, 0),
  }];
}

// ── Extractor registry ──────────────────────────────────────────────────────

const EXTRACTORS = {
  comments: extractComments,
  imports: extractImports,
  exports: extractExports,
  functions: extractFunctions,
  classes: extractClasses,
  jsx: extractJsx,
  metrics: extractMetrics,
};

// ── Summary builders ─────────────────────────────────────────────────────────

function buildSummary(extractor, results) {
  switch (extractor) {
    case 'comments': {
      const byType = results.reduce((acc, r) => { acc[r.type] = (acc[r.type] ?? 0) + 1; return acc; }, {});
      const byFile = new Set(results.map(r => r.file));
      return { total: results.length, byType, filesWithComments: byFile.size };
    }
    case 'imports': {
      const external = results.filter(r => !r.source?.startsWith('.') && r.source).length;
      const internal = results.filter(r => r.source?.startsWith('.')).length;
      return { total: results.length, external, internal, dynamic: results.filter(r => r.isDynamic).length };
    }
    case 'exports': {
      return {
        total: results.length,
        default: results.filter(r => r.isDefault).length,
        named: results.filter(r => !r.isDefault).length,
        reExports: results.filter(r => r.reExportFrom).length,
      };
    }
    case 'functions': {
      const avg = results.length ? Math.round(results.reduce((s, r) => s + r.bodyLines, 0) / results.length) : 0;
      const long = results.filter(r => r.bodyLines > 50).length;
      return { total: results.length, exported: results.filter(r => r.isExported).length, async: results.filter(r => r.isAsync).length, avgBodyLines: avg, longFunctions: long };
    }
    case 'metrics': {
      const totals = results.reduce((acc, r) => {
        acc.lines += r.lines; acc.codeLines += r.codeLines;
        acc.commentLines += r.commentLines; acc.blankLines += r.blankLines;
        acc.imports += r.importCount; acc.exports += r.exportCount;
        return acc;
      }, { lines: 0, codeLines: 0, commentLines: 0, blankLines: 0, imports: 0, exports: 0 });
      totals.commentRatio = totals.lines ? `${Math.round(totals.commentLines / totals.lines * 100)}%` : '0%';
      totals.avgLinesPerFile = results.length ? Math.round(totals.lines / results.length) : 0;
      return totals;
    }
    default:
      return { total: results.length };
  }
}

// ── Human-readable formatters ───────────────────────────────────────────────

function formatHuman(extractor, results, summary, opts) {
  const lines = [];

  switch (extractor) {
    case 'metrics': {
      const colW = [55, 6, 6, 8, 8, 8, 8];
      const header = ['File', 'Lines', 'Code', 'Comments', 'Blank', 'Imports', 'Exports'];
      lines.push(header.map((h, i) => h.padEnd(colW[i])).join('  '));
      lines.push('-'.repeat(colW.reduce((s, w) => s + w + 2, 0)));
      for (const r of results) {
        const rel = relative(opts.directory, r.file);
        lines.push([
          rel.padEnd(colW[0]),
          String(r.lines).padEnd(colW[1]),
          String(r.codeLines).padEnd(colW[2]),
          String(r.commentLines).padEnd(colW[3]),
          String(r.blankLines).padEnd(colW[4]),
          String(r.importCount).padEnd(colW[5]),
          String(r.exportCount).padEnd(colW[6]),
        ].join('  '));
      }
      if (summary) {
        lines.push('');
        lines.push(`Total: ${summary.lines} lines | Code: ${summary.codeLines} | Comments: ${summary.commentLines} (${summary.commentRatio}) | Avg ${summary.avgLinesPerFile} lines/file`);
      }
      break;
    }
    case 'functions': {
      for (const r of results) {
        const rel = relative(opts.directory, r.file);
        const flags = [r.isAsync && 'async', r.isExported && 'export'].filter(Boolean).join(' ');
        lines.push(`${rel}:${r.line}  ${r.kind.padEnd(12)}  ${r.name.padEnd(35)}  (${r.params.join(', ')})  ${r.bodyLines}L  ${flags}`);
      }
      if (summary) lines.push(`\n${summary.total} functions | ${summary.exported} exported | ${summary.async} async | avg ${summary.avgBodyLines} lines | ${summary.longFunctions} long (>50L)`);
      break;
    }
    case 'imports': {
      for (const r of results) {
        const rel = relative(opts.directory, r.file);
        const specs = r.specifiers.length ? `{ ${r.specifiers.join(', ')} }` : r.isDynamic ? 'dynamic' : 'side-effect';
        lines.push(`${rel}:${r.line}  from ${(r.source ?? '?').padEnd(40)}  ${specs}`);
      }
      if (summary) lines.push(`\n${summary.total} imports | ${summary.internal} internal | ${summary.external} external | ${summary.dynamic} dynamic`);
      break;
    }
    case 'comments': {
      for (const r of results) {
        const rel = relative(opts.directory, r.file);
        lines.push(`${rel}:${r.line}  [${r.type.slice(0, 1)}]  ${r.value}`);
      }
      if (summary) lines.push(`\n${summary.total} comments (${summary.byType.Line ?? 0} line, ${summary.byType.Block ?? 0} block) in ${summary.filesWithComments} files`);
      break;
    }
    default: {
      for (const r of results) {
        const rel = relative(opts.directory, r.file);
        lines.push(`${rel}:${r.line ?? '?'}  ${JSON.stringify(r)}`);
      }
      if (summary) lines.push(`\nTotal: ${summary.total}`);
    }
  }

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const files = discoverFiles(opts.directory, opts);

  if (opts.verbose) process.stderr.write(`Found ${files.length} files in ${resolve(opts.directory)}\n`);

  const allResults = {};
  for (const ext of opts.extractors) {
    if (!EXTRACTORS[ext]) {
      console.error(`Unknown extractor: ${ext}. Available: ${Object.keys(EXTRACTORS).join(', ')}`);
      process.exit(1);
    }
    allResults[ext] = [];
  }

  const parseErrors = [];

  for (const filepath of files) {
    if (opts.verbose) process.stderr.write(`  Parsing ${relative(opts.directory, filepath)}\n`);

    const source = readFileSync(filepath, 'utf-8');
    let pr;
    try {
      pr = parseSync(filepath, source);
    } catch (e) {
      parseErrors.push({ file: relative(opts.directory, filepath), error: e.message });
      continue;
    }

    if (pr.errors.length > 0) {
      parseErrors.push({ file: relative(opts.directory, filepath), parseErrors: pr.errors.map(e => e.message) });
    }

    const rel = relative(opts.directory, filepath);
    for (const ext of opts.extractors) {
      const extracted = EXTRACTORS[ext](rel, source, pr);
      allResults[ext].push(...extracted);
    }
  }

  if (opts.json) {
    const output = {
      directory: resolve(opts.directory),
      generated: new Date().toISOString(),
      filesAnalyzed: files.length,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    };

    for (const ext of opts.extractors) {
      const results = allResults[ext];
      output[ext] = opts.perFile
        ? groupByFile(results)
        : results;
      if (opts.summary) output[`${ext}Summary`] = buildSummary(ext, results);
    }

    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`AST Analysis — ${resolve(opts.directory)}`);
    console.log(`${files.length} files analyzed${parseErrors.length ? ` (${parseErrors.length} errors)` : ''}\n`);

    for (const ext of opts.extractors) {
      const results = allResults[ext];
      const summary = opts.summary ? buildSummary(ext, results) : null;
      if (opts.extractors.length > 1) console.log(`\n── ${ext.toUpperCase()} ──`);
      console.log(formatHuman(ext, results, summary, opts));
    }
  }
}

function groupByFile(results) {
  const byFile = {};
  for (const r of results) {
    if (!byFile[r.file]) byFile[r.file] = [];
    byFile[r.file].push(r);
  }
  return byFile;
}

main().catch(e => { console.error(e); process.exit(1); });
