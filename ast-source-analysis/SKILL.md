---
name: ast-source-analysis
description: >
  AST-based source code analysis using oxc-parser for JS/TS/JSX/TSX codebases.
  Use when the user asks to analyze code structure, find patterns, audit
  conventions, map dependencies, extract metrics, or understand a large
  codebase at scale. Preferred over grep/regex: produces structured, accurate
  results immune to formatting variations.
  Trigger phrases: "analyze the code", "find all functions/imports/comments",
  "dependency map", "import graph", "code metrics", "convention audit",
  "dead code", "naming conventions", "codebase overview", "comment analysis",
  "TODO/FIXME inventory", "what does this codebase look like".
---

# AST Source Analysis

## Philosophy

**The script handles the boring part. Claude handles the interesting part.**

- **Script** (`parse-project.mjs`) — File discovery, parsing, structured extraction.
  Outputs normalized JSON or human-readable tables.
- **Claude** — Interprets the data, classifies patterns, cross-references with
  project context, produces actionable reports.

**Decision tree:**

```
Does a built-in extractor answer the question?
  ├─ Yes → Run parse-project.mjs with the right --extract flag
  └─ No  → Copy references/ad-hoc-script-template.mjs to target project's temp/
             and add custom analysis logic
```

---

## Handling the oxc-parser dependency

`parse-project.mjs` requires `oxc-parser` at runtime. The target project may not have it.
Choose the strategy that fits the context:

**Strategy A — Temporary install (most common)**
```bash
# In the target project directory:
npm install --no-save oxc-parser
node /path/to/ast-source-analysis/scripts/parse-project.mjs . --extract metrics
npm prune   # clean up when done
```

**Strategy B — Already installed**
```bash
# Check first:
ls node_modules/oxc-parser 2>/dev/null && echo "already installed"
```

**Strategy C — Install in skill directory, run from there**
```bash
cd /path/to/my-skills/ast-source-analysis
npm install --no-save oxc-parser
node scripts/parse-project.mjs /path/to/target/project --extract metrics
npm prune
```

---

## CLI Reference: `parse-project.mjs`

```
node parse-project.mjs [directory] [options]

Arguments:
  directory              Project root to analyze (default: current directory)

Options:
  --extract <list>       Comma-separated extractors (default: metrics):
                           comments  — All comments with surrounding context
                           imports   — Static and dynamic imports
                           exports   — Named, default, and re-exports
                           functions — Function declarations, arrows, methods
                           classes   — Class declarations with methods/properties
                           jsx       — React components (uppercase-named functions)
                           metrics   — Per-file line counts, function/import totals
  --json                 JSON output (default: human-readable)
  --summary              Add aggregate statistics to output
  --per-file             Group JSON results by file instead of flat list
  --max-files <n>        Stop after n files (useful for sampling large projects)
  --verbose              Show parsing progress on stderr

Examples:
  node parse-project.mjs src --extract metrics --summary
  node parse-project.mjs . --extract comments --json
  node parse-project.mjs . --extract imports,exports --json --summary
  node parse-project.mjs src --extract functions --json --per-file
  node parse-project.mjs . --extract comments,metrics --json --summary --max-files 50
```

---

## Extractor Output Reference

### `comments`
All comments (line `//` and block `/* */`) with surrounding context.
```json
{ "file": "src/api.js", "line": 47, "type": "Line",
  "value": "Retry on transient server errors", "context": "if (response.status >= 500) {" }
```
Block comments are split into individual lines. JSDoc blocks are included (each `*` line separately).

### `imports`
```json
{ "file": "src/hooks/useAuth.js", "line": 3,
  "source": "react", "specifiers": ["useState", "useEffect"],
  "isType": false, "isDynamic": false }
```

### `exports`
```json
{ "file": "src/services/api.js", "line": 1,
  "name": "callOdooApi", "kind": "Name",
  "isDefault": false, "isType": false, "reExportFrom": null }
```

### `functions`
```json
{ "file": "src/services/api.js", "line": 42,
  "name": "callOdooApi", "kind": "function",
  "params": ["model", "method", "args"],
  "isAsync": true, "isGenerator": false, "isExported": true, "bodyLines": 38 }
```
`kind` is one of: `function`, `arrow`, `function-expr`, `method`, `static-method`, `constructor`.

### `classes`
```json
{ "file": "src/components/App.jsx", "line": 12,
  "name": "App", "superClass": "React.Component",
  "methods": [{ "name": "render", "kind": "method", "static": false, "params": 0 }],
  "properties": [{ "name": "displayName", "static": false }],
  "isExported": true }
```

### `jsx`
React components detected by uppercase naming convention.
```json
{ "file": "src/components/Button.jsx", "line": 8,
  "name": "Button", "kind": "arrow",
  "props": ["label", "onClick", "disabled"], "isExported": false }
```

### `metrics`
```json
{ "file": "src/services/api.js", "lines": 245,
  "codeLines": 198, "commentLines": 32, "blankLines": 15,
  "functionCount": 0, "importCount": 8, "exportCount": 4 }
```

---

## Analysis Cookbook

### 5.1 Comment Analysis

**Questions:** What language are the comments in? Are there TODO/FIXME items? What's the JSDoc coverage?

```bash
node parse-project.mjs . --extract comments --json > /tmp/comments.json
```

**Claude's role:**
- **Language detection** — Score each comment with French signals (accented characters +3 each, French articles `du/de/la/le/les/des/avec/pour` +2 each) vs English signals (articles `the/this/that` +2, common verbs `returns/throws/checks` +2). If French score = 0 → English by default. See `references/ad-hoc-script-template.mjs` for the full pattern (or refer to the comment analysis done on corpus-tempo-app).
- **TODO inventory** — Filter `value` matching `/\b(TODO|FIXME|HACK|XXX|NOTE)\b/i`. Cross-reference with `git blame` if staleness matters.
- **JSDoc coverage** — From `functions` extractor, find functions without a block comment on the line just before them.

**Case study:** The corpus-tempo-app comment language analysis found 80.7% English / 19.3% French across 752 classified comment lines. French concentrated in original service files (`storage.js`, `gitlab-auth.js`); newer files were English-only.

---

### 5.2 Import/Export Mapping

**Questions:** What are the internal dependencies? Are there circular imports? Which exports are never imported?

```bash
node parse-project.mjs src --extract imports,exports --json > /tmp/deps.json
```

**Claude's role:**
1. Build an adjacency list from `imports.source` (filter to internal sources starting with `./` or `../`)
2. Detect cycles: DFS from each node, flag back-edges
3. Dead exports: collect all export names across all files, then check which are never in any file's import specifiers
4. Fan-in/fan-out: count how many files import each module

**Tip:** For path resolution, note that `imports.source` is relative to each file. Build absolute paths by resolving against the importer's directory.

---

### 5.3 Code Pattern Detection

**Questions:** Are naming conventions followed? Are there overly complex functions?

```bash
node parse-project.mjs src --extract functions,classes --json > /tmp/structure.json
```

**Claude's role:**
- **Naming conventions:** Check `functions` results where `file` matches `src/hooks/**` — all should have `name` starting with `use`. Check components (uppercase names) are in `src/components/**`.
- **Complexity signals:** `bodyLines > 50` flags long functions. `params.length > 5` flags large parameter lists.
- **Async without error handling:** Filter `isAsync: true` functions; cross-reference with `comments` to check if try/catch is documented.
- **Missing `displayName`:** For JSX components, check if `classes[].properties` includes `{ name: 'displayName' }` or if there's an assignment in the function body.

---

### 5.4 Codebase Metrics

**Questions:** What does this codebase look like at a high level?

```bash
node parse-project.mjs . --extract metrics --summary
```

The human-readable output is usually sufficient here. Claude adds interpretation:
- Comment ratio < 5% → under-documented
- Average file size > 300 lines → files may need splitting
- High import count with low export count → possible God files
- Many test files vs few source files → good test coverage ratio

For richer data:
```bash
node parse-project.mjs . --extract metrics,functions,imports --json --summary
```

---

### 5.5 Convention Auditing

**Questions:** Does the code follow the conventions in CLAUDE.md or a style guide?

**Approach:**
1. Read the project's CLAUDE.md (or style guide) and extract the testable rules
2. Map each rule to an extractor:
   - "All components have a displayName" → `jsx` + search source for `.displayName =`
   - "Services never import React" → `imports` filtered to files in `src/services/**`
   - "No default exports" → `exports` where `isDefault: true`
   - "Hooks start with `use`" → `functions` in `src/hooks/**`
3. Run the relevant extractors and check each rule
4. For rules requiring custom traversal, use the ad-hoc template

---

## Writing an Ad-Hoc Analysis Script

When built-in extractors are insufficient (e.g., language classification needs custom scoring, or you need to cross-reference comments with their adjacent AST nodes):

1. Copy the template to the target project:
   ```bash
   cp /path/to/ast-source-analysis/references/ad-hoc-script-template.mjs temp/my-analysis.mjs
   ```

2. Install oxc-parser if needed:
   ```bash
   npm install --no-save oxc-parser
   ```

3. Customize the `CUSTOM ANALYSIS HERE` section:
   - Use `parseResult.comments` for comment data
   - Use `new Visitor({...})` for AST traversal
   - Use `parseResult.module.staticImports` for import metadata without traversal
   - Use `lineAt(source, node.start)` to get line numbers from offsets

4. Run and pipe to Claude:
   ```bash
   node temp/my-analysis.mjs . --json
   ```

5. Clean up:
   ```bash
   rm temp/my-analysis.mjs
   npm prune
   ```

**The script lives in the project's `temp/` directory, not in this skill.**

---

## Multi-Language Extensibility (Design Notes)

This skill targets JS/TS via oxc-parser. The `parse-project.mjs` architecture anticipates other parsers:

- The parsing step is isolated: `parseSync(filepath, source)` → `{ program, comments, module, errors }`
- Adding Python/Go/Rust support would mean routing to a different parser (e.g., tree-sitter) for those extensions
- The extractors (`comments`, `functions`, etc.) would need language-specific variants — Python has `def` instead of `function`, Go has `func`, etc.
- The file discovery, output formatting, and CLI layers would remain unchanged

When the need arises, extend `parse-project.mjs` by adding an `extension → parser` routing table at the top of the file.
