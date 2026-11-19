# Maintaining web-platform-guidance

Read this only when measuring the search, changing the guides version, or editing
`scripts/guides.mjs`. Nothing here is needed to use the guides during a task.

## Measuring the search: `evals/`

`node evals/eval-search.mjs <set.json> [--k N] [--upstream <dir>]` reports recall@K and
MRR@10 of `guides.mjs search` on an annotated query set.

- `evals/search-queries.json`: 62 queries written while looking at the guide
  descriptions (optimistic).
- `evals/search-queries-blind.json`: 45 queries written without seeing the corpus, 6 of
  them out of corpus (skipped in the score).

Thresholds: recall@5 ≥ 90 % on the blind set, recall@8 ≥ 95 % on both sets.
Version 1.0.1: blind 92.3 % @5 and 97.4 % @8, first set 98.4 % @8.

`--upstream <dir>` compares with Google's own search. Extract the cached archive
(`<cache>/archives/modern-web-guidance-<version>.tgz`) into a temporary directory and
point at `package/skills/modern-web-guidance`. Only its `search.mjs` is imported, which
runs its code: in 1.0.1 it imports only Node built-ins (`fs`, `path`, `zlib`), does no
network access and writes a log file only if `ENABLE_FILE_LOGGING=true`. Re-read it
(`grep -nE "import|require|fetch|http" search.mjs`) before using `--upstream` on a new
version. Never run `modern-web.mjs`, which carries the telemetry.

## Changing the guides version

Never automatic. To move to a new version:

1. Review the guides diff between both versions on the GitHub repository.
2. Update the `PINNED` constants at the top of `scripts/guides.mjs`: version, npm
   archive URL and sha512, GitHub commit holding the same guides, manifest digest,
   guide count. The manifest digest is the sha256 of the sorted
   `<category>/<id>.md <git blob sha1>` lines joined by `\n`, computed on the
   files as published (before link rewriting).
3. Run `guides.mjs sync`. It fails if a cross-guide `npx … retrieve` link has a new
   shape or targets an unknown guide: extend `RETRIEVE_LINK` rather than loosen
   `LEFTOVER_NPX`.
4. Run both `evals/` sets. A recall below the thresholds is fixed before shipping.

## Known traps

- The npm archive also contains `watchdog/` (telemetry) and the CLI: extract only the
  whitelisted paths, never execute anything from it.
- `gen/guides.json` exists only in the npm archive, not on GitHub. Without it, the
  index falls back to guide intros (`degraded index`).
- `prompt-api` has a `.md` file but no entry in `guides.json` (1.0.1).
- Term frequency tables are `Map`s: a plain `{}` inherits `constructor` and breaks
  scoring with `NaN`.
