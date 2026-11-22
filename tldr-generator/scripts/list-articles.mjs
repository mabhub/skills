#!/usr/bin/env node

/**
 * List all source articles (.md) in a library and whether each has an
 * associated .tldr.md companion. Sorted by the source article's date
 * (front-matter `created`, falling back to file mtime), oldest first so the
 * most recent articles land at the bottom — where a scrolling terminal stops.
 *
 * Output formats: aligned text table (default), --json, --md, --html.
 * Use --desc / --reverse to sort newest first.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import {
  isTldrFile,
  getTldrFilename,
  analyzeFile,
  extractFrontMatter,
} from '../tools/utils.mjs';

/** Meta/system markdown files that are not library articles. */
const META_FILES = new Set([
  'README.md',
  'INDEX.md',
  'CLAUDE.md',
  'AGENTS.md',
  'GEMINI.md',
  'COPILOT.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'LICENSE.md',
]);

/**
 * Normalizes a front-matter `created` value into a sortable Date.
 * Handles the MarkDownload format "2026-05-29T14:33:13 (UTC +02:00)" by
 * stripping the parenthetical offset note, which Date cannot parse.
 * @param {string} raw - Raw front-matter date string
 * @returns {Date|null} Parsed date, or null if unparseable
 */
const parseCreated = raw => {
  if (!raw) {
    return null;
  }
  const cleaned = raw.replace(/\s*\(UTC[^)]*\)\s*/i, '').trim();
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formats a Date as YYYY-MM-DD, or a placeholder when null.
 * @param {Date|null} date - Date to format
 * @returns {string} ISO date or "??????????"
 */
const formatDate = date => (date ? date.toISOString().slice(0, 10) : '??????????');

/**
 * Builds a URL-friendly slug from an article title, used as the permalink
 * fragment. Strips diacritics, lowercases, and collapses non-alphanumerics to
 * hyphens. Titles in this library produce unique slugs.
 * @param {string} title - Article title
 * @returns {string} Slug
 */
const slugify = title =>
  title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Scans a directory and builds the article inventory.
 * @param {string} directory - Directory to scan
 * @returns {Promise<Array<Object>>} One entry per source article
 */
const collectArticles = async directory => {
  const files = await readdir(directory);
  const sources = files.filter(
    f => f.endsWith('.md') && !isTldrFile(f) && !META_FILES.has(f),
  );

  const entries = [];
  for (const file of sources) {
    const analysis = await analyzeFile(join(directory, file));
    if (!analysis.exists) {
      continue;
    }

    const created = parseCreated(analysis.frontMatter?.created);
    const date = created ?? analysis.modified;
    const tldrPath = resolve(directory, getTldrFilename(file));
    const title = basename(file, '.md');

    entries.push({
      filename: file,
      title,
      slug: slugify(title),
      hasTldr: existsSync(tldrPath),
      tldrPath,
      source: analysis.frontMatter?.source ?? null,
      date,
      dateSource: created ? 'created' : 'mtime',
      words: analysis.stats.words,
    });
  }

  return entries;
};

/**
 * Sorts entries by date. Entries with an unknown date (no created, no mtime)
 * are always pushed to the end regardless of direction.
 * @param {Array<Object>} entries - Article entries
 * @param {boolean} ascending - Oldest first when true
 * @returns {Array<Object>} New sorted array
 */
const sortByDate = (entries, ascending) =>
  entries.toSorted((a, b) => {
    if (!a.date) {
      return 1;
    }
    if (!b.date) {
      return -1;
    }
    const diff = a.date.getTime() - b.date.getTime();
    return ascending ? diff : -diff;
  });

/**
 * Wraps visible text in an OSC 8 terminal hyperlink pointing at a file URL.
 * The escape sequence has zero display width, so callers should pad/truncate
 * `text` to the desired column width before wrapping it.
 * Compatible terminals (GNOME Terminal, iTerm2, kitty, WezTerm…) delegate the
 * click to the OS handler (xdg-open), opening the file in its default app.
 * @param {string} text - Already-aligned visible label
 * @param {string} targetPath - Absolute path to the file to open
 * @returns {string} OSC 8 hyperlink sequence
 */
const osc8 = (text, targetPath) => {
  const url = pathToFileURL(targetPath).href;
  const open = `\x1b]8;;${url}\x07`;
  const close = '\x1b]8;;\x07';
  return `${open}${text}${close}`;
};

/**
 * Renders the inventory as an aligned text table for the terminal.
 * Titles of articles that have a .tldr.md are wrapped as clickable links
 * (OSC 8) opening that companion file in the system's default application.
 * @param {Array<Object>} entries - Sorted article entries
 * @returns {string} Printable report
 */
const renderText = entries => {
  const titleWidth = Math.min(
    70,
    entries.reduce((max, e) => Math.max(max, e.title.length), 0),
  );

  const rows = entries.map(e => {
    const flag = e.hasTldr ? '✓' : '✗';
    const star = e.dateSource === 'mtime' ? '*' : ' ';
    const label = e.title.length > titleWidth
      ? `${e.title.slice(0, titleWidth - 1)}…`
      : e.title.padEnd(titleWidth);
    const title = e.hasTldr ? osc8(label, e.tldrPath) : label;
    return `${formatDate(e.date)}${star}  ${flag}  ${title}`;
  });

  const withTldr = entries.filter(e => e.hasTldr).length;
  const missing = entries.length - withTldr;
  const footer = [
    '',
    `Total: ${entries.length} articles  |  ✓ TL;DR: ${withTldr}  |  ✗ manquants: ${missing}`,
    '(* date issue de la mtime du fichier, faute de champ `created`)',
  ].join('\n');

  return `${rows.join('\n')}\n${footer}`;
};

/**
 * Renders the inventory as a Markdown table.
 * @param {Array<Object>} entries - Sorted article entries
 * @returns {string} Markdown table
 */
const renderMarkdown = entries => {
  const header = '| Date | TL;DR | Article |\n|---|:---:|---|';
  const rows = entries.map(e => {
    const flag = e.hasTldr ? '✓' : '✗';
    const note = e.dateSource === 'mtime' ? ' \\*' : '';
    const title = e.title.replace(/\|/g, '\\|');
    return `| ${formatDate(e.date)}${note} | ${flag} | ${title} |`;
  });
  return [header, ...rows].join('\n');
};

/**
 * Renders the inventory as a standalone HTML reader. The page embeds the
 * article list as JSON and fetches each .tldr.md on demand (served over HTTP),
 * rendering Markdown to HTML with marked (CDN) and a built-in minimal parser as
 * an offline fallback. Layout is a list + reading panel, responsive for mobile.
 * @param {Array<Object>} entries - Sorted article entries (newest first)
 * @param {Object} [options] - Render options
 * @param {string|null} [options.feedUrl] - When set, adds an Atom feed
 *   auto-discovery <link> in the head; omitted when no feed is generated.
 * @returns {string} HTML page
 */
const renderHtml = (entries, { feedUrl = null } = {}) => {
  const withTldr = entries.filter(e => e.hasTldr).length;
  const feedLink = feedUrl
    ? `\n<link rel="alternate" type="application/atom+xml" title="Flux TL;DR" href="${feedUrl}">`
    : '';

  // Data embedded for the client. mdFile/tldrFile are URL-encoded relative
  // paths, resolved against the document URL when served over HTTP. slug is the
  // permalink fragment. source is the original article URL when present.
  const data = entries.map(e => ({
    title: e.title,
    slug: e.slug,
    hasTldr: e.hasTldr,
    mdFile: encodeURIComponent(e.filename),
    tldrFile: e.hasTldr
      ? encodeURIComponent(getTldrFilename(e.filename))
      : null,
    source: e.source,
    date: formatDate(e.date),
    mtimeDate: e.dateSource === 'mtime',
  }));

  // JSON is injected inside a <script type="application/json"> block; only "<"
  // needs escaping to prevent premature tag closing.
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lecteur TL;DR</title>${feedLink}
<style>
  :root {
    --bg: #fff; --fg: #1a1a1a; --muted: #666; --line: #e2e2e2;
    --accent: #0b66c2; --ok: #1a7f37; --missing: #cf222e; --sidebar: #fafafa;
  }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: var(--fg); background: var(--bg); }
  #app { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; height: 100vh; }
  #sidebar { border-right: 1px solid var(--line); background: var(--sidebar); display: flex; flex-direction: column; min-height: 0; }
  #sidebar header { padding: 0.9rem 1rem; border-bottom: 1px solid var(--line); }
  #sidebar h1 { font-size: 1rem; margin: 0 0 0.4rem; }
  .summary { font-size: 0.78rem; color: var(--muted); margin: 0; }
  #filter { width: 100%; margin-top: 0.6rem; padding: 0.4rem 0.5rem; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
  #list { overflow-y: auto; flex: 1; min-height: 0; list-style: none; margin: 0; padding: 0; }
  #list li { border-bottom: 1px solid var(--line); }
  #list button { width: 100%; text-align: left; background: none; border: 0; padding: 0.55rem 1rem; cursor: pointer; font: inherit; color: inherit; display: flex; gap: 0.5rem; align-items: baseline; }
  #list button:hover { background: #f0f0f0; }
  #list li.active button { background: #e7f0fb; box-shadow: inset 3px 0 0 var(--accent); }
  .flag { font-weight: bold; flex: none; }
  .flag.ok { color: var(--ok); } .flag.missing { color: var(--missing); }
  .meta { flex: none; font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .item-title { flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; }
  #reader { overflow-y: auto; padding: 2rem clamp(1rem, 5vw, 4rem); min-height: 0; }
  #reader.placeholder { display: grid; place-items: center; color: var(--muted); }
  .content { max-width: 70ch; margin: 0 auto; line-height: 1.65; }
  .content h1, .content h2, .content h3 { line-height: 1.25; }
  .content pre { background: #f5f5f5; padding: 0.8rem; border-radius: 6px; overflow-x: auto; }
  .content code { background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 4px; }
  .content pre code { background: none; padding: 0; }
  .content blockquote { border-left: 3px solid var(--line); margin: 0; padding-left: 1rem; color: var(--muted); }
  .content img { max-width: 100%; height: auto; }
  .content table { border-collapse: collapse; }
  .content th, .content td { border: 1px solid var(--line); padding: 0.3rem 0.6rem; }
  .err { color: var(--missing); }
  .article-head { max-width: 70ch; margin: 0 auto 1.4rem; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding-bottom: 0.8rem; border-bottom: 1px solid var(--line); }
  .toolbar .spacer { flex: 1; }
  .btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.7rem; border: 1px solid var(--line); border-radius: 6px; background: var(--sidebar); color: inherit; text-decoration: none; cursor: pointer; font: inherit; font-size: 0.82rem; }
  .btn:hover:not([disabled]):not([aria-disabled="true"]) { background: #f0f0f0; }
  .btn[disabled], .btn[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
  .btn.copied { background: #e6f4ea; border-color: var(--ok); color: var(--ok); }
  .tabs { display: inline-flex; gap: 0.2rem; }
  .tab { padding: 0.35rem 0.8rem; border: 1px solid var(--line); background: var(--sidebar); color: var(--muted); cursor: pointer; font: inherit; font-size: 0.82rem; }
  .tab:first-child { border-radius: 6px 0 0 6px; }
  .tab:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
  .tab:hover:not([disabled]):not([aria-selected="true"]) { background: #f0f0f0; }
  .tab[aria-selected="true"] { background: var(--bg); color: var(--accent); border-color: var(--accent); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent); }
  .tab[disabled] { opacity: 0.45; cursor: not-allowed; }
  .source-link { display: block; margin-top: 0.7rem; font-size: 0.85rem; color: var(--muted); overflow-wrap: anywhere; }
  .source-link a { color: var(--accent); }
  #back { display: none; }
  @media (max-width: 720px) {
    #app { grid-template-columns: 1fr; }
    #sidebar { border-right: 0; }
    #reader { display: none; }
    body.reading #sidebar { display: none; }
    body.reading #reader { display: block; }
    #back { display: inline-block; margin-bottom: 1rem; padding: 0.4rem 0.8rem; border: 1px solid var(--line); border-radius: 6px; background: var(--sidebar); cursor: pointer; font: inherit; }
  }
</style>
</head>
<body>
<div id="app">
  <div id="sidebar">
    <header>
      <h1>Lecteur TL;DR</h1>
      <p class="summary">${entries.length} articles &middot; ${withTldr} avec TL;DR &middot; ${entries.length - withTldr} manquants</p>
      <input id="filter" type="search" placeholder="Filtrer&hellip;" autocomplete="off">
    </header>
    <ul id="list"></ul>
  </div>
  <div id="reader" class="placeholder"><div>Sélectionnez un article dans la liste.</div></div>
</div>

<script type="application/json" id="data">${payload}</script>
<script>
"use strict";
const ARTICLES = JSON.parse(document.getElementById("data").textContent);
const listEl = document.getElementById("list");
const readerEl = document.getElementById("reader");
const filterEl = document.getElementById("filter");

/**
 * Loads marked from CDN. Started as early as possible so a permalink present on
 * first load does not race it: open() awaits this before rendering, which is
 * what makes table rendering deterministic rather than network-dependent.
 * Never rejects — a CDN failure resolves too, and renderMarkdown then falls
 * back to miniMarkdown (no tables, but a readable page).
 * @type {Promise<void>}
 */
const markedReady = new Promise(resolve => {
  const cdn = document.createElement("script");
  // Pinned with its SRI hash: an unpinned URL follows every new release, and
  // marked.min.js is gone from recent ones (404, so tables were never rendered).
  cdn.src = "https://cdn.jsdelivr.net/npm/marked@18.1.3/lib/marked.umd.js";
  cdn.integrity = "sha384-tp/syYhgK+FeVVrz2SPmgKX5atVZ8P8hReAvOPUn58M265VNy1IbdmZAY7Jmd0gF";
  cdn.crossOrigin = "anonymous";
  cdn.addEventListener("load", () => resolve());
  cdn.addEventListener("error", () => resolve()); // offline: keep the fallback
  document.head.appendChild(cdn);
});

/**
 * Strips leading YAML front-matter so neither renderer prints it as text.
 * @param {string} src - Raw Markdown
 * @returns {string} Body without front-matter
 */
const stripFrontMatter = src => src.replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n?/, "");

/**
 * Escapes HTML-significant characters for safe text rendering.
 * @param {string} s - Raw text
 * @returns {string} Escaped text
 */
const escapeHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Minimal Markdown-to-HTML renderer used as offline fallback when marked
 * fails to load. Handles headings, lists, fenced code, paragraphs.
 * @param {string} src - Markdown body (front-matter already stripped)
 * @returns {string} HTML string
 */
const miniMarkdown = src => {
  const lines = escapeHtml(src).split("\\n");
  const out = [];
  let inList = false, inCode = false;
  const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const line of lines) {
    if (/^\\s*\`\`\`/.test(line)) {
      if (inCode) { out.push("</code></pre>"); inCode = false; }
      else { flushList(); out.push("<pre><code>"); inCode = true; }
      continue;
    }
    if (inCode) { out.push(line); continue; }
    const heading = line.match(/^(#{1,6})\\s+(.*)$/);
    if (heading) { flushList(); const n = heading[1].length; out.push("<h" + n + ">" + inline(heading[2]) + "</h" + n + ">"); continue; }
    const item = line.match(/^\\s*[-*]\\s+(.*)$/);
    if (item) { if (!inList) { out.push("<ul>"); inList = true; } out.push("<li>" + inline(item[1]) + "</li>"); continue; }
    if (line.trim() === "") { flushList(); continue; }
    flushList(); out.push("<p>" + inline(line) + "</p>");
  }
  flushList(); if (inCode) out.push("</code></pre>");
  return out.join("\\n");
};
/**
 * Renders inline Markdown spans (code, bold, italic, links) for the fallback.
 * @param {string} s - Single line of escaped text
 * @returns {string} HTML with inline spans
 */
const inline = s => s
  .replace(/\`([^\`]+)\`/g, "<code>$1</code>")
  .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
  .replace(/\\*([^*]+)\\*/g, "<em>$1</em>")
  .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

/**
 * Renders Markdown to HTML via marked when available, else the fallback.
 * @param {string} src - Raw Markdown (front-matter stripped here)
 * @returns {string} HTML string
 */
const renderMarkdown = src => {
  const body = stripFrontMatter(src);
  return window.marked ? window.marked.parse(body) : miniMarkdown(body);
};

const bySlug = new Map(ARTICLES.map((a, i) => [a.slug, i]));
let currentIndex = -1;
let currentMode = "tldr"; // "tldr" | "md"
let currentMarkdown = ""; // raw Markdown of the displayed file, for copying

/**
 * Rebuilds the sidebar list, optionally filtered by a title substring.
 * @param {string} filter - Case-insensitive title filter
 * @returns {void}
 */
const buildList = filter => {
  const q = filter.trim().toLowerCase();
  listEl.innerHTML = "";
  ARTICLES.forEach((a, i) => {
    if (q && !a.title.toLowerCase().includes(q)) return;
    const li = document.createElement("li");
    if (i === currentIndex) li.className = "active";
    const btn = document.createElement("button");
    btn.innerHTML =
      '<span class="meta">' + a.date + (a.mtimeDate ? "*" : "") + '</span>' +
      '<span class="flag ' + (a.hasTldr ? "ok" : "missing") + '">' + (a.hasTldr ? "✓" : "✗") + '</span>' +
      '<span class="item-title"></span>';
    btn.querySelector(".item-title").textContent = a.title;
    btn.addEventListener("click", () => navigate(a.slug, defaultMode(a)));
    li.appendChild(btn);
    listEl.appendChild(li);
  });
};

/**
 * Default view for an article: its TL;DR when available, else the source .md.
 * @param {Object} a - Article entry
 * @returns {string} "tldr" or "md"
 */
const defaultMode = a => (a.hasTldr ? "tldr" : "md");

/**
 * Builds the reader header: mode toggle, download buttons, optional source link.
 * @param {Object} a - Article entry being displayed
 * @returns {HTMLElement} Header element
 */
const buildHead = a => {
  const head = document.createElement("div");
  head.className = "article-head";

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  toolbar.appendChild(buildTabs(a));

  const spacer = document.createElement("span");
  spacer.className = "spacer";
  toolbar.appendChild(spacer);

  toolbar.appendChild(copyBtn("Copier le Markdown", () => copyMarkdown()));
  toolbar.appendChild(copyBtn("Copier le HTML", () => copyHtml()));
  toolbar.appendChild(downloadBtn(a.mdFile, "⤓ .md", true));
  toolbar.appendChild(downloadBtn(a.tldrFile, "⤓ .tldr.md", a.hasTldr));

  head.appendChild(toolbar);

  const title = document.createElement("h2");
  title.textContent = a.title;
  head.appendChild(title);

  if (a.source) {
    const p = document.createElement("p");
    p.className = "source-link";
    const link = document.createElement("a");
    link.href = a.source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = a.source;
    p.append("Source : ", link);
    head.appendChild(p);
  }
  return head;
};

/**
 * Builds the source-mode tabs (Résumé / Original). The active tab reflects the
 * current mode; the TL;DR tab is disabled when no .tldr.md exists. Selecting a
 * tab navigates (and updates the permalink) through the existing router.
 * @param {Object} a - Article entry being displayed
 * @returns {HTMLElement} Tabs container
 */
const buildTabs = a => {
  const tabs = document.createElement("div");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");

  const mk = (mode, label, enabled) => {
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.textContent = label;
    tab.setAttribute("aria-selected", currentMode === mode ? "true" : "false");
    if (!enabled) {
      tab.disabled = true;
      tab.title = "Pas encore de résumé pour cet article";
    } else {
      tab.addEventListener("click", () => navigate(a.slug, mode));
    }
    return tab;
  };

  tabs.appendChild(mk("tldr", "Résumé (.tldr.md)", a.hasTldr));
  tabs.appendChild(mk("md", "Original (.md)", true));
  return tabs;
};

/**
 * Builds a copy-to-clipboard button that flashes a confirmation on success.
 * @param {string} label - Button label
 * @param {() => Promise<boolean>} action - Copy action returning success
 * @returns {HTMLElement} Button element
 */
const copyBtn = (label, action) => {
  const b = document.createElement("button");
  b.className = "btn";
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", async () => {
    const ok = await action();
    flashCopied(b, ok ? "Copié ✓" : "Échec", label);
  });
  return b;
};

/**
 * Briefly shows feedback text on a button, then restores its label.
 * @param {HTMLElement} btn - Button to update
 * @param {string} feedback - Temporary text
 * @param {string} label - Original label to restore
 * @returns {void}
 */
const flashCopied = (btn, feedback, label) => {
  btn.textContent = feedback;
  btn.classList.add("copied");
  setTimeout(() => { btn.textContent = label; btn.classList.remove("copied"); }, 1200);
};

/**
 * Copies the currently displayed raw Markdown to the clipboard.
 * @returns {Promise<boolean>} Whether the copy succeeded
 */
const copyMarkdown = () => writeText(currentMarkdown);

/**
 * Copies the rendered article as both plain HTML markup (text/plain) and rich
 * HTML (text/html), so it pastes as source in code editors and as formatted
 * content in rich editors.
 * @returns {Promise<boolean>} Whether the copy succeeded
 */
const copyHtml = async () => {
  const box = readerEl.querySelector(".content");
  if (!box) return false;
  const html = box.innerHTML;
  try {
    const item = new ClipboardItem({
      "text/plain": new Blob([html], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    return writeText(html); // fallback: markup as plain text
  }
};

/**
 * Writes plain text to the clipboard, with an execCommand fallback for
 * non-secure contexts where navigator.clipboard is unavailable.
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Whether the copy succeeded
 */
const writeText = async text => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err2) {
      return false;
    }
  }
};

/**
 * Builds a download control. Enabled ones are <a download>; disabled ones are
 * inert buttons (a missing .tldr.md cannot be downloaded).
 * @param {string|null} file - URL-encoded relative file path
 * @param {string} label - Button label
 * @param {boolean} enabled - Whether the file exists
 * @returns {HTMLElement} Anchor or button element
 */
const downloadBtn = (file, label, enabled) => {
  if (enabled && file) {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = file;
    a.setAttribute("download", "");
    a.textContent = label;
    return a;
  }
  const b = document.createElement("button");
  b.className = "btn";
  b.disabled = true;
  b.textContent = label;
  b.title = "Indisponible : pas de .tldr.md";
  return b;
};

/**
 * Loads and displays an article in the reading panel, then renders its header.
 * Falls back to the source .md when the requested TL;DR does not exist.
 * @param {number} i - Article index
 * @param {string} mode - Requested view: "tldr" or "md"
 * @returns {Promise<void>}
 */
const open = async (i, mode) => {
  const a = ARTICLES[i];
  const requestedMode = mode === "md" || !a.hasTldr ? "md" : "tldr";
  currentIndex = i;
  currentMode = requestedMode;
  buildList(filterEl.value);
  document.body.classList.add("reading");
  readerEl.classList.remove("placeholder");

  const render = bodyNode => {
    readerEl.innerHTML = "";
    readerEl.appendChild(backButton());
    readerEl.appendChild(buildHead(a));
    readerEl.appendChild(bodyNode);
    wireBack();
  };

  const loading = document.createElement("div");
  loading.className = "content";
  loading.innerHTML = "<p>Chargement&hellip;</p>";
  render(loading);

  const file = requestedMode === "tldr" ? a.tldrFile : a.mdFile;
  currentMarkdown = "";
  try {
    // Both run concurrently: awaiting marked costs nothing once it is cached,
    // and on a cold load it overlaps with the fetch instead of following it.
    const [res] = await Promise.all([fetch(file), markedReady]);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const md = await res.text();
    if (currentIndex !== i || currentMode !== requestedMode) return; // superseded
    currentMarkdown = stripFrontMatter(md); // matches what is rendered/copied
    const box = document.createElement("div");
    box.className = "content";
    box.innerHTML = renderMarkdown(md);
    render(box);
  } catch (err) {
    const box = document.createElement("div");
    box.className = "content";
    box.innerHTML =
      '<p class="err">Impossible de charger le fichier (' + escapeHtml(String(err.message)) +
      ').</p><p>Servez le dossier en HTTP, p.&nbsp;ex.&nbsp;: <code>npx serve</code> ou <code>python -m http.server</code>.</p>';
    render(box);
  }
};

/**
 * Creates the "back to list" button (visible on narrow screens).
 * @returns {HTMLElement} Button element
 */
const backButton = () => {
  const b = document.createElement("button");
  b.id = "back";
  b.innerHTML = "&larr; Liste";
  return b;
};

/**
 * Wires the back button to clear the hash and return to the list view.
 * @returns {void}
 */
const wireBack = () => {
  const b = document.getElementById("back");
  if (b) b.addEventListener("click", () => { location.hash = ""; document.body.classList.remove("reading"); });
};

/**
 * Navigates to an article by updating the location hash, which drives route().
 * Fragment form: #slug (default view) or #slug/md (force the source .md view).
 * @param {string} slug - Article slug
 * @param {string} mode - "tldr" or "md"
 * @returns {void}
 */
const navigate = (slug, mode) => {
  const frag = mode === "md" ? slug + "/md" : slug;
  if (("#" + frag) === location.hash) { route(); return; }
  location.hash = frag; // triggers hashchange -> route()
};

/**
 * Resolves the current location hash to an article + mode and opens it. An
 * empty hash returns to the placeholder; an unknown slug is ignored.
 * @returns {void}
 */
const route = () => {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!raw) {
    document.body.classList.remove("reading");
    readerEl.className = "placeholder";
    readerEl.innerHTML = "<div>Sélectionnez un article dans la liste.</div>";
    currentIndex = -1;
    buildList(filterEl.value);
    return;
  }
  const m = raw.match(/^(.*?)(?:\\/(md|tldr))?$/);
  const slug = m[1];
  const mode = m[2] || "";
  const i = bySlug.get(slug);
  if (i === undefined) return; // unknown slug: leave current view untouched
  open(i, mode || defaultMode(ARTICLES[i]));
};

window.addEventListener("hashchange", route);
filterEl.addEventListener("input", () => buildList(filterEl.value));
buildList("");
route(); // honour a permalink present on first load

// marked is loaded at the top of this script (see markedReady), early enough
// that a permalink on first load cannot race it.
</script>
</body>
</html>`;
};

/**
 * Escapes text for inclusion in XML (used for titles and as the escaping pass
 * that turns rendered HTML into an XML-safe string for <content type="html">).
 * @param {string} s - Raw text
 * @returns {string} XML-escaped text
 */
const xmlEscape = s =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Renders inline Markdown spans (code, bold, italic, links) to HTML.
 * @param {string} s - Single escaped line
 * @returns {string} HTML with inline spans
 */
const inlineMarkdown = s =>
  s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" rel="noopener">$1</a>',
    );

/**
 * Minimal Markdown-to-HTML renderer used Node-side for feed <content>. Handles
 * headings, unordered lists, fenced code, blockquotes and paragraphs. The
 * browser keeps its own renderer (marked + fallback); this one has no deps so
 * the feed can be generated offline.
 * @param {string} src - Markdown body (front-matter already stripped)
 * @returns {string} HTML string
 */
const markdownToHtml = src => {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = src.split('\n');
  const out = [];
  let inList = false;
  let inCode = false;
  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) {
        out.push('</code></pre>');
        inCode = false;
      } else {
        flushList();
        out.push('<pre><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(esc(line));
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      const n = heading[1].length;
      out.push(`<h${n}>${inlineMarkdown(esc(heading[2]))}</h${n}>`);
      continue;
    }
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(esc(item[1]))}</li>`);
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushList();
      out.push(`<blockquote>${inlineMarkdown(esc(quote[1]))}</blockquote>`);
      continue;
    }
    if (line.trim() === '') {
      flushList();
      continue;
    }
    flushList();
    out.push(`<p>${inlineMarkdown(esc(line))}</p>`);
  }
  flushList();
  if (inCode) {
    out.push('</code></pre>');
  }
  return out.join('\n');
};

/**
 * Strips leading YAML front-matter from Markdown (Node-side counterpart of the
 * browser helper).
 * @param {string} src - Raw Markdown
 * @returns {string} Body without front-matter
 */
const stripFrontMatterNode = src =>
  src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

/**
 * Formats a Date as an RFC-3339 / ISO-8601 UTC timestamp for Atom.
 * @param {Date|null} date - Date to format
 * @returns {string} ISO timestamp (epoch when null)
 */
const isoStamp = date => (date ? date.toISOString() : new Date(0).toISOString());

/**
 * Renders the inventory as an Atom 1.0 feed. Only articles that have a
 * .tldr.md are included; each entry embeds the full TL;DR rendered to HTML in
 * <content type="html">, links to its HTML permalink (baseUrl/index.html#slug),
 * and is identified by that permalink. Requires an absolute baseUrl.
 * @param {Array<Object>} entries - Sorted article entries (newest first)
 * @param {Object} options - Feed options
 * @param {string} options.baseUrl - Absolute site base URL (no trailing slash)
 * @param {string} options.updated - Feed-level updated timestamp (ISO)
 * @returns {Promise<string>} Atom XML document
 */
const renderAtom = async (entries, { baseUrl, updated }) => {
  const base = baseUrl.replace(/\/+$/, '');
  const feedId = `${base}/feed.xml`;
  const withTldr = entries.filter(e => e.hasTldr);

  const entriesXml = [];
  for (const e of withTldr) {
    const permalink = `${base}/index.html#${e.slug}`;
    let contentHtml = '';
    let author = null;
    try {
      const raw = await readFile(e.tldrPath, 'utf-8');
      contentHtml = markdownToHtml(stripFrontMatterNode(raw));
      author = extractFrontMatter(raw)?.author ?? null;
    } catch {
      contentHtml = '<p>(résumé indisponible)</p>';
    }
    // An explicit per-entry author keeps feed readers from falling back to the
    // feed title (whose "TL;DR" was being mis-parsed on the ";").
    const authorName = author || e.source || 'Bibliothèque TLDR';
    const sourceLink = e.source
      ? `\n    <link rel="related" href="${xmlEscape(e.source)}"/>`
      : '';
    entriesXml.push(
      `  <entry>
    <title>${xmlEscape(e.title)}</title>
    <id>${xmlEscape(permalink)}</id>
    <link rel="alternate" type="text/html" href="${xmlEscape(permalink)}"/>${sourceLink}
    <author><name>${xmlEscape(authorName)}</name></author>
    <updated>${isoStamp(e.date)}</updated>
    <content type="html">${xmlEscape(contentHtml)}</content>
  </entry>`,
    );
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Bibliothèque TLDR</title>
  <subtitle>Résumés TLDR des articles capturés</subtitle>
  <author><name>Bibliothèque TLDR</name></author>
  <id>${xmlEscape(feedId)}</id>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(feedId)}"/>
  <link rel="alternate" type="text/html" href="${xmlEscape(`${base}/index.html`)}"/>
  <updated>${updated}</updated>
  <generator>tldr list-articles</generator>
${entriesXml.join('\n')}
</feed>
`;
};

/** Maps a format flag to its renderer. */
const RENDERERS = {
  json: entries =>
    JSON.stringify(
      {
        count: entries.length,
        withTldr: entries.filter(e => e.hasTldr).length,
        articles: entries.map(e => ({
          filename: e.filename,
          hasTldr: e.hasTldr,
          date: e.date ? e.date.toISOString() : null,
          dateSource: e.dateSource,
          words: e.words,
        })),
      },
      null,
      2,
    ),
  md: renderMarkdown,
  html: renderHtml,
  text: renderText,
};

/**
 * Reads the value of a `--flag value` or `--flag=value` option from argv.
 * @param {Array<string>} argv - Arguments
 * @param {string} flag - Long flag (e.g. "--base-url")
 * @returns {string|null} Value or null when absent
 */
const optionValue = (argv, flag) => {
  const eq = argv.find(a => a.startsWith(`${flag}=`));
  if (eq) {
    return eq.slice(flag.length + 1);
  }
  const idx = argv.indexOf(flag);
  return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : null;
};

/**
 * Parses CLI args into options. Sort direction is resolved per format unless
 * the user forces it: text reads bottom-up so it defaults to ascending (newest
 * last); html/atom show the top first so they default to descending.
 * @param {Array<string>} argv - process.argv.slice(2)
 * @returns {Object} Parsed options
 */
const parseArgs = argv => {
  const has = (...flags) => flags.some(f => argv.includes(f));
  const format = has('--json')
    ? 'json'
    : has('--md', '--markdown')
      ? 'md'
      : has('--html')
        ? 'html'
        : has('--atom', '--rss')
          ? 'atom'
          : 'text';
  // The value following an option (`--base-url <url>`) is not a directory.
  const positional = argv.filter(
    (a, i) => !a.startsWith('-') && argv[i - 1] !== '--base-url',
  );

  const forcedAsc = has('--asc');
  const forcedDesc = has('--desc', '--reverse');
  const newestFirstByDefault = format === 'html' || format === 'atom';
  const ascending = forcedAsc
    ? true
    : forcedDesc
      ? false
      : !newestFirstByDefault;

  return {
    directory: positional[0] || process.cwd(),
    format,
    ascending,
    feed: has('--feed'),
    baseUrl: optionValue(argv, '--base-url'),
  };
};

/**
 * Resolves the absolute feed URL from a base URL, or throws a clear error.
 * @param {string|null} baseUrl - User-provided base URL
 * @param {string} context - What needs it, for the message
 * @returns {{base: string, feedUrl: string}}
 */
const requireBaseUrl = (baseUrl, context) => {
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw new Error(
      `${context} nécessite une URL absolue via --base-url (ex. --base-url https://mon-site.fr)`,
    );
  }
  const base = baseUrl.replace(/\/+$/, '');
  return { base, feedUrl: `${base}/feed.xml` };
};

/** Entry point. */
const main = async () => {
  const { directory, format, ascending, feed, baseUrl } = parseArgs(
    process.argv.slice(2),
  );
  const entries = sortByDate(await collectArticles(directory), ascending);
  const updated = new Date().toISOString();

  // --feed: write index.html (with feed autodiscovery) and/or feed.xml to disk.
  if (feed) {
    const { feedUrl } = requireBaseUrl(baseUrl, 'La génération du flux (--feed)');
    const atom = await renderAtom(entries, { baseUrl, updated });
    await writeFile(join(directory, 'feed.xml'), atom, 'utf-8');
    const written = ['feed.xml'];
    if (format === 'html') {
      await writeFile(
        join(directory, 'index.html'),
        renderHtml(entries, { feedUrl }),
        'utf-8',
      );
      written.unshift('index.html');
    }
    const withTldr = entries.filter(e => e.hasTldr).length;
    console.error(
      `Écrit ${written.join(' + ')} dans ${directory} (${withTldr} entrées dans le flux).`,
    );
    return;
  }

  // Atom to stdout.
  if (format === 'atom') {
    requireBaseUrl(baseUrl, 'Le flux Atom');
    console.log(await renderAtom(entries, { baseUrl, updated }));
    return;
  }

  console.log(RENDERERS[format](entries));
};

const isMainModule =
  process.argv[1] && import.meta.url.includes('list-articles.mjs');

if (isMainModule) {
  main().catch(err => {
    console.error(`Erreur: ${err.message}`);
    process.exit(1);
  });
}

export { collectArticles, sortByDate };
