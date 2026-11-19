#!/usr/bin/env node
/**
 * Measure recall@K and MRR@10 of `guides.mjs search` on a query set.
 *
 * Usage: node evals/eval-search.mjs <queries.json> [--k 5] [--upstream <dir>]
 *
 * --upstream: directory holding the upstream `search.mjs` (extracted from the pinned
 * npm archive, never installed). Only that module is imported: it does no network
 * access, unlike the upstream CLI, which carries the telemetry.
 * Queries whose `relevant` list is empty (need not covered by the guides) are skipped.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const GUIDES_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'guides.mjs');

const args = process.argv.slice(2);
const option = name => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const queriesFile = args.find((arg, at) => !arg.startsWith('--') && !args[at - 1]?.startsWith('--'));
if (!queriesFile) {
  console.error('Usage : node evals/eval-search.mjs <queries.json> [--k 5] [--upstream <dir>]');
  process.exit(1);
}
const K = Number(option('k') ?? 5);
const upstreamDir = option('upstream');

const all = JSON.parse(readFileSync(queriesFile, 'utf8')).queries;
const queries = all.filter(({ relevant }) => relevant.length > 0);

/**
 * Run our search and return the ranked guide keys
 * @param {string} query - English query
 * @returns {string[]} "<category>/<id>" keys, best first
 */
const ours = query => {
  const run = spawnSync(process.execPath, [GUIDES_SCRIPT, 'search', ...query.split(/\s+/), '--top', '10'], { encoding: 'utf8' });
  if (run.status !== 0) {
    console.error(run.stderr);
    process.exit(2);
  }
  return [...run.stdout.matchAll(/^\d+\. ([a-z0-9-]+\/[a-z0-9-]+)\.md/gm)].map(([, key]) => key);
};

const searchUseCases = upstreamDir ? (await import(path.resolve(upstreamDir, 'search.mjs'))).searchUseCases : undefined;
const upstream = async query => (await searchUseCases(query)).map(({ category, id }) => `${category}/${id}`);

/**
 * Score one ranking against the relevant guides
 * @param {string[]} ranked - Ranked keys
 * @param {string[]} relevant - Acceptable keys
 * @returns {{hit: boolean, rr: number, rank: (number|string)}} Hit in top K, reciprocal rank, rank shown
 */
const score = (ranked, relevant) => {
  const at = ranked.slice(0, 10).findIndex(key => relevant.includes(key));
  return { hit: at >= 0 && at < K, rr: at >= 0 ? 1 / (at + 1) : 0, rank: at >= 0 ? at + 1 : '-' };
};

const engines = { ours, ...(searchUseCases ? { upstream } : {}) };
const totals = Object.fromEntries(Object.keys(engines).map(name => [name, { hit: 0, rr: 0 }]));
for (const { q, relevant } of queries) {
  const results = {};
  for (const [name, engine] of Object.entries(engines)) {
    results[name] = score(await engine(q), relevant);
    totals[name].hit += results[name].hit;
    totals[name].rr += results[name].rr;
  }
  if (Object.values(results).some(({ hit }) => !hit)) {
    console.log(`${Object.entries(results).map(([name, { rank }]) => `${name} ${String(rank).padStart(2)}`).join(' · ')} · ${q}`);
  }
}

const n = queries.length;
console.log(`\n${n} queries (${all.length - n} out-of-corpus skipped)`);
Object.entries(totals).forEach(([name, { hit, rr }]) => {
  console.log(`${name.padEnd(8)} : recall@${K} ${(hit / n * 100).toFixed(1)} % (${hit}/${n}) · MRR@10 ${(rr / n).toFixed(3)}`);
});
