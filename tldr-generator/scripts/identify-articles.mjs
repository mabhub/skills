#!/usr/bin/env node

/**
 * Identify articles needing TL;DR generation
 * Scans directory and returns list of articles without TL;DR versions
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isTldrFile, getTldrFilename, analyzeFile } from '../tools/utils.mjs';
import { existsSync } from 'node:fs';

/**
 * Identifies articles that need TL;DR generation
 * @param {string} directory - Directory to scan
 * @returns {Promise<Array>} Articles needing TL;DR
 */
async function identifyArticles(directory = '.') {
  try {
    const files = await readdir(directory);

    // Filter markdown files (exclude README.md, INDEX.md, and .tldr.md files)
    const mdFiles = files.filter(f =>
      f.endsWith('.md') &&
      !isTldrFile(f) &&
      f !== 'README.md' &&
      f !== 'INDEX.md'
    );

    const results = [];

    for (const file of mdFiles) {
      const filePath = join(directory, file);
      const tldrPath = join(directory, getTldrFilename(file));
      const hasTldr = existsSync(tldrPath);

      if (!hasTldr) {
        // Analyze the original file to get metadata
        const analysis = await analyzeFile(filePath);

        if (analysis.exists) {
          results.push({
            filename: file,
            path: filePath,
            words: analysis.stats.words,
            readingTime: analysis.stats.readingTimeMinutes,
            estimatedTldrWords: Math.round(analysis.stats.words * 0.5),
            source: analysis.frontMatter?.source || null,
            priority: analysis.stats.words > 3000 ? 'high' : analysis.stats.words > 1500 ? 'medium' : 'low'
          });
        }
      }
    }

    // Sort by word count (longest first)
    results.sort((a, b) => b.words - a.words);

    return results;
  } catch (error) {
    console.error(`Error scanning directory: ${error.message}`);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const directory = args[0] || process.cwd();
  const jsonOutput = args.includes('--json') || args.includes('-j');

  const articles = await identifyArticles(directory);

  if (jsonOutput) {
    console.log(JSON.stringify({
      directory,
      count: articles.length,
      articles
    }, null, 2));
  } else {
    console.log(`\n📋 Articles nécessitant un TL;DR: ${articles.length}\n`);

    if (articles.length === 0) {
      console.log('✅ Tous les articles ont un TL;DR\n');
    } else {
      articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.filename}`);
        console.log(`   Mots: ${article.words.toLocaleString('fr-FR')} (~${article.estimatedTldrWords} mots estimés pour TL;DR)`);
        console.log(`   Temps de lecture: ${article.readingTime.toFixed(1)} min`);
        console.log(`   Priorité: ${article.priority}`);
        if (article.source) {
          console.log(`   Source: ${article.source}`);
        }
        console.log('');
      });
    }
  }
}

// Run if called directly
const isMainModule = process.argv[1] && import.meta.url.includes('identify-articles.mjs');

if (isMainModule) {
  main().catch(console.error);
}

export { identifyArticles };
