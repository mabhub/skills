#!/usr/bin/env node

/**
 * Analyze a specific article to help with TL;DR generation
 * Provides metadata, type detection, and structure analysis
 */

import { analyzeFile, determineArticleType, calculateStats } from '../tools/utils.mjs';

/**
 * Analyzes an article in depth for TL;DR generation
 * @param {string} filePath - Path to article file
 * @returns {Promise<Object>} Detailed analysis
 */
async function analyzeArticleForTldr(filePath) {
  const analysis = await analyzeFile(filePath);

  if (!analysis.exists) {
    return {
      error: `File not found: ${filePath}`,
      exists: false
    };
  }

  const articleType = determineArticleType(analysis);
  const { content } = analysis;

  // Extract structure information
  const structure = analyzeStructure(content);

  // Identify key elements
  const keyElements = extractKeyElements(content);

  return {
    filename: analysis.name,
    type: articleType,
    stats: analysis.stats,
    frontMatter: analysis.frontMatter,
    structure,
    keyElements,
    recommendations: generateRecommendations(analysis, articleType)
  };
}

/**
 * Analyzes document structure
 * @param {string} content - Article content
 * @returns {Object} Structure analysis
 */
function analyzeStructure(content) {
  const lines = content.split('\n');

  const h1Count = (content.match(/^# /gm) || []).length;
  const h2Count = (content.match(/^## /gm) || []).length;
  const h3Count = (content.match(/^### /gm) || []).length;
  const listsCount = (content.match(/^[-*+] /gm) || []).length;
  const codeBlocksCount = (content.match(/```/g) || []).length / 2;
  const linksCount = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;

  return {
    headings: {
      h1: h1Count,
      h2: h2Count,
      h3: h3Count,
      total: h1Count + h2Count + h3Count
    },
    lists: listsCount,
    codeBlocks: codeBlocksCount,
    links: linksCount,
    hasFrontMatter: content.startsWith('---')
  };
}

/**
 * Extracts key elements from content
 * @param {string} content - Article content
 * @returns {Object} Key elements
 */
function extractKeyElements(content) {
  // Extract dates
  const dates = extractDates(content);

  // Extract numbers/statistics
  const numbers = extractNumbers(content);

  // Extract quoted text
  const quotes = extractQuotes(content);

  // Extract section titles (H2 level)
  const sections = (content.match(/^## (.+)$/gm) || [])
    .map(s => s.replace(/^## /, '').trim())
    .slice(0, 10); // Limit to first 10 sections

  return {
    dates: dates.slice(0, 5), // Top 5 dates
    numbers: numbers.slice(0, 10), // Top 10 numbers
    quotes: quotes.slice(0, 5), // Top 5 quotes
    sections
  };
}

/**
 * Extracts dates from content
 * @param {string} content - Content to analyze
 * @returns {Array<string>} Found dates
 */
function extractDates(content) {
  const datePatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g, // ISO dates
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, // MM/DD/YYYY
    /\b\d{1,2} [a-zéû]+ \d{4}\b/gi, // DD month YYYY (French)
  ];

  const dates = new Set();
  datePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(d => dates.add(d));
    }
  });

  return Array.from(dates);
}

/**
 * Extracts significant numbers from content
 * @param {string} content - Content to analyze
 * @returns {Array<Object>} Found numbers with context
 */
function extractNumbers(content) {
  const numberPattern = /\b(\d+[.,]?\d*)\s*([%€$]|mots?|articles?|millions?|milliards?|heures?|minutes?|jours?|ans?|années?)\b/gi;
  const matches = content.match(numberPattern);

  if (!matches) return [];

  return [...new Set(matches)].slice(0, 10);
}

/**
 * Extracts quoted text
 * @param {string} content - Content to analyze
 * @returns {Array<string>} Found quotes
 */
function extractQuotes(content) {
  const quotePattern = /[«"][^»"]+[»"]/g;
  const matches = content.match(quotePattern);

  if (!matches) return [];

  return matches
    .map(q => q.replace(/[«»""]/g, '').trim())
    .filter(q => q.length > 20 && q.length < 200) // Reasonable length
    .slice(0, 5);
}

/**
 * Generates recommendations for TL;DR generation
 * @param {Object} analysis - File analysis
 * @param {string} articleType - Detected article type
 * @returns {Object} Recommendations
 */
function generateRecommendations(analysis, articleType) {
  const { stats } = analysis;
  const targetWords = Math.min(750, Math.round(stats.words * 0.4));
  const reductionPercent = ((stats.words - targetWords) / stats.words * 100).toFixed(0);

  const templateMap = {
    'documentation technique': 'TEMPLATES.md (Articles techniques/documentation)',
    'article de recherche': 'TEMPLATES.md (Articles recherche/étude)',
    'newsletter': 'TEMPLATES.md (Newsletters/multi-sujets)',
    'analyse': 'TEMPLATES.md (Articles d\'analyse/essai)',
    'article de presse': 'TEMPLATES.md (Articles de presse/actualité)'
  };

  return {
    suggestedTemplate: templateMap[articleType] || templateMap['article de presse'],
    targetWordCount: targetWords,
    targetReductionPercent: parseInt(reductionPercent),
    estimatedReadingTime: (targetWords / 250).toFixed(1),
    priority: stats.words > 3000 ? 'high' : stats.words > 1500 ? 'medium' : 'low',
    tips: generateTips(articleType, stats)
  };
}

/**
 * Generates specific tips based on article type
 * @param {string} type - Article type
 * @param {Object} stats - Article statistics
 * @returns {Array<string>} Tips
 */
function generateTips(type, stats) {
  const tips = [];

  if (stats.words > 5000) {
    tips.push('Article très long : privilégier approche thématique avec sous-sections claires');
  }

  if (type === 'documentation technique') {
    tips.push('Préserver terminologie technique et spécifications importantes');
    tips.push('Utiliser listes à puces pour données structurées');
  } else if (type === 'article de presse') {
    tips.push('Structurer chronologiquement les événements');
    tips.push('Identifier clairement les acteurs principaux');
  } else if (type === 'analyse') {
    tips.push('Énoncer clairement la thèse de l\'auteur');
    tips.push('Résumer les 3-5 arguments principaux');
  } else if (type === 'newsletter') {
    tips.push('Créer des sections thématiques claires');
    tips.push('Traiter chaque sujet proportionnellement');
  }

  return tips;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const jsonOutput = args.includes('--json') || args.includes('-j');

  if (!filePath) {
    console.error('Usage: analyze-article.mjs <article.md> [--json]');
    process.exit(1);
  }

  const analysis = await analyzeArticleForTldr(filePath);

  if (jsonOutput) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    if (analysis.error) {
      console.error(`❌ ${analysis.error}`);
      process.exit(1);
    }

    console.log(`\n📄 Analyse: ${analysis.filename}\n`);
    console.log(`Type détecté: ${analysis.type}`);
    console.log(`\nStatistiques:`);
    console.log(`  Mots: ${analysis.stats.words.toLocaleString('fr-FR')}`);
    console.log(`  Temps de lecture: ${analysis.stats.readingTimeMinutes.toFixed(1)} min`);
    console.log(`  Paragraphes: ${analysis.stats.paragraphs}`);

    if (analysis.frontMatter) {
      console.log(`\nMétadonnées:`);
      if (analysis.frontMatter.source) console.log(`  Source: ${analysis.frontMatter.source}`);
      if (analysis.frontMatter.author) console.log(`  Auteur: ${analysis.frontMatter.author}`);
      if (analysis.frontMatter.tags) console.log(`  Tags: ${analysis.frontMatter.tags.join(', ')}`);
    }

    console.log(`\nStructure:`);
    console.log(`  Titres: H1=${analysis.structure.headings.h1}, H2=${analysis.structure.headings.h2}, H3=${analysis.structure.headings.h3}`);
    console.log(`  Listes: ${analysis.structure.lists} items`);
    console.log(`  Blocs de code: ${analysis.structure.codeBlocks}`);
    console.log(`  Liens: ${analysis.structure.links}`);

    if (analysis.keyElements.sections.length > 0) {
      console.log(`\nSections principales:`);
      analysis.keyElements.sections.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
    }

    console.log(`\n💡 Recommandations pour le TL;DR:`);
    console.log(`  Template: ${analysis.recommendations.suggestedTemplate}`);
    console.log(`  Objectif: ~${analysis.recommendations.targetWordCount} mots (réduction ~${analysis.recommendations.targetReductionPercent}%)`);
    console.log(`  Temps de lecture cible: ~${analysis.recommendations.estimatedReadingTime} min`);
    console.log(`  Priorité: ${analysis.recommendations.priority}`);

    if (analysis.recommendations.tips.length > 0) {
      console.log(`\nConseils:`);
      analysis.recommendations.tips.forEach(tip => {
        console.log(`  • ${tip}`);
      });
    }

    console.log('');
  }
}

// Run if called directly (check for common patterns)
const isMainModule = process.argv[1] && (
  import.meta.url.endsWith(process.argv[1]) ||
  import.meta.url.includes('analyze-article.mjs')
);

if (isMainModule && process.argv.length > 2) {
  main().catch(console.error);
}

export { analyzeArticleForTldr };
