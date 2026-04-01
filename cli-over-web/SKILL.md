---
name: cli-over-web
description: >
  Route information lookups through CLI tools instead of WebFetch/WebSearch.
  Use this skill BEFORE reaching for WebFetch or WebSearch — whenever you need
  to look up package info, repository metadata, DNS records, API responses,
  container images, or any structured data that a CLI tool can provide.
  Triggers on: checking package versions, looking up GitHub/GitLab info,
  querying APIs, inspecting DNS/SSL, searching registries, or any task where
  you're tempted to fetch a web page for data that a local CLI already exposes.
  Even if the user says "look up" or "check online", prefer CLI first.
  Triggers FR: "cherche la version", "vérifie le package", "regarde sur npm/pypi",
  "consulte l'API", "cherche en ligne", "quelle est la dernière version de",
  "vérifie les DNS", "regarde les issues", "cherche ce module".
  If the gh-cli or glab-cli skill is already loaded, defer to those for
  GitHub/GitLab operations — this skill adds no value when a forge-specific
  skill is active.
---

# CLI Over Web

When you need information, your first reflex should be a CLI tool — not a browser.
WebFetch and WebSearch are slow, token-heavy, and return unstructured HTML that
needs parsing. CLI tools return structured data instantly and reliably.

This skill exists because it's easy to default to WebFetch out of habit,
even when a one-line CLI command gives a better answer. The table below is your
cheat sheet.

## CLI Lookup Table

### Package Registries

| Need                | CLI                                             | Examples                                                      |
|---------------------|-------------------------------------------------|---------------------------------------------------------------|
| npm package info    | `npm view`                                      | `npm view express version`, `npm view lodash versions --json` |
| npm search          | `npm search`                                    | `npm search markdown parser`                                  |
| Python package info | `pip show`, `pip index versions` (experimental) | `pip show requests`, `pip index versions flask`               |
| Rust crates         | `cargo search`, `cargo info`                    | `cargo search serde`, `cargo info tokio`                      |
| Go modules          | `go list -m -versions`                          | `go list -m -versions github.com/gin-gonic/gin`               |
| System packages     | `apt show`, `apt-cache search`                  | `apt show nginx`, `apt-cache search libssl`                   |

### Code Forges

| Need                      | CLI        | Examples                                                 |
|---------------------------|------------|----------------------------------------------------------|
| GitHub repos, issues, PRs | `gh`       | `gh repo view owner/repo`, `gh issue list -R owner/repo` |
| GitHub API (advanced)     | `gh api`   | `gh api repos/owner/repo/releases --jq '.[0].tag_name'`  |
| GitLab repos, MRs, issues | `glab`     | `glab mr list`, `glab issue view 42`                     |
| GitLab API (advanced)     | `glab api` | `glab api projects/:id/pipelines`                        |

### Infrastructure & Network

| Need                 | CLI                       | Examples                                                                                      |
|----------------------|---------------------------|-----------------------------------------------------------------------------------------------|
| DNS records          | `dig`, `nslookup`         | `dig example.com MX`, `dig +short example.com A`                                              |
| Domain ownership     | `whois`                   | `whois example.com`                                                                           |
| SSL certificates     | `openssl s_client`        | `echo \| openssl s_client -connect example.com:443 2>/dev/null \| openssl x509 -noout -dates` |
| Container images     | `docker manifest inspect` | `docker manifest inspect nginx:latest`                                                        |
| Container registries | `skopeo inspect`          | `skopeo inspect docker://registry.example.com/app:latest`                                     |

### APIs & Data

| Need                | CLI           | Examples                                                                            |
|---------------------|---------------|-------------------------------------------------------------------------------------|
| REST APIs           | `curl` + `jq` | `curl -s https://api.example.com/v1/status \| jq .`                                 |
| Authenticated APIs  | `curl -H`     | `curl -sH "Authorization: Bearer $TOKEN" https://api.example.com/data \| jq .items` |
| JSON transformation | `jq`          | `curl -s url \| jq '.results[] \| {name, version}'`                                 |

**Security note**: prefer authenticated CLI tools (`gh`, `glab`) over raw `curl`
for APIs that already have a CLI wrapper. Never embed secrets directly in
commands — use environment variables (`$TOKEN`, not the actual value).

## Decision Rule

Use WebFetch/WebSearch **only** when:

- You need **narrative content**: documentation prose, tutorials, blog posts, discussions
- You need **visual context**: screenshots, diagrams, UI references
- **No CLI equivalent exists** for the data you need

If you're unsure, try the CLI first. If it doesn't have what you need, then fall back to web.

## Common Pitfalls

- **"Let me check the npm page for..."** — Stop. `npm view <pkg>` has everything: versions, dependencies, description, repository URL, license.
- **"Let me look up the GitHub repo..."** — Stop. `gh repo view owner/repo` gives you description, stars, language, default branch, clone URL.
- **"Let me search for how to..."** — Pause. Is this a factual lookup (use CLI) or a conceptual question (WebSearch is OK)?
- **"Let me check if this package exists..."** — `npm search`, `pip index versions`, `cargo search`. No browser needed.
