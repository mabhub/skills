#!/usr/bin/env node

/**
 * Shared utilities for TL;DR Skill scripts
 * ESM module with common functions for article analysis
 */

import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';

/**
 * Calculates reading statistics for text content
 * @param {string} content - Text content to analyze
 * @returns {Object} Statistics object
 */
export function calculateStats(content) {
  const words = content.trim().split(/\s+/).filter(word => word.length > 0);
  const characters = content.length;
  const charactersNoSpaces = content.replace(/\s/g, '').length;
  const lines = content.split('\n').length;
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  // Reading time estimation: 250 words per minute (French)
  const readingTimeMinutes = words.length / 250;

  return {
    words: words.length,
    characters,
    charactersNoSpaces,
    lines,
    paragraphs,
    readingTimeMinutes: parseFloat(readingTimeMinutes.toFixed(1))
  };
}

/**
 * Extracts front-matter from markdown content
 * @param {string} content - Markdown content
 * @returns {Object|null} Parsed front-matter or null
 */
export function extractFrontMatter(content) {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return null;
  }

  const frontMatter = frontMatterMatch[1];
  const result = {};

  // Extract key fields
  const sourceMatch = frontMatter.match(/^source:\s*(.+)$/m);
  const authorMatch = frontMatter.match(/^author:\s*(.+)$/m);
  const createdMatch = frontMatter.match(/^created:\s*(.+)$/m);
  const tagsMatch = frontMatter.match(/^tags:\s*\[(.+)\]$/m);

  if (sourceMatch) result.source = sourceMatch[1].trim();
  if (authorMatch) result.author = authorMatch[1].trim();
  if (createdMatch) result.created = createdMatch[1].trim();
  if (tagsMatch) {
    result.tags = tagsMatch[1]
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Checks if a filename is a TL;DR version
 * @param {string} filename - Filename to check
 * @returns {boolean}
 */
export function isTldrFile(filename) {
  return filename.endsWith('.tldr.md');
}

/**
 * Gets the original filename from a TL;DR filename
 * @param {string} tldrFilename - TL;DR filename
 * @returns {string} Original filename
 */
export function getOriginalFilename(tldrFilename) {
  return tldrFilename.replace(/\.tldr\.md$/, '.md');
}

/**
 * Gets the TL;DR filename from an original filename
 * @param {string} originalFilename - Original filename
 * @returns {string} TL;DR filename
 */
export function getTldrFilename(originalFilename) {
  return originalFilename.replace(/\.md$/, '.tldr.md');
}

/**
 * Reads and analyzes a markdown file
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File analysis
 */
export async function analyzeFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const stats = calculateStats(content);
    const fileStats = await stat(filePath);
    const frontMatter = extractFrontMatter(content);

    return {
      path: filePath,
      name: basename(filePath),
      content,
      stats,
      sizeBytes: fileStats.size,
      modified: fileStats.mtime,
      frontMatter,
      exists: true
    };
  } catch (error) {
    return {
      path: filePath,
      name: basename(filePath),
      exists: false,
      error: error.message
    };
  }
}

/**
 * Determines article type based on content and metadata
 * @param {Object} analysis - File analysis object
 * @returns {string} Article type
 */
export function determineArticleType(analysis) {
  const { content, frontMatter, name } = analysis;

  // Check explicit type in front-matter
  if (frontMatter?.type) {
    return frontMatter.type;
  }

  // Heuristics based on content and filename
  const contentLower = content.toLowerCase();
  const nameLower = name.toLowerCase();

  // Technical/documentation
  if (nameLower.includes('docs') || nameLower.includes('api') || nameLower.includes('documentation')) {
    return 'documentation technique';
  }

  if (contentLower.match(/\b(api|documentation|technical|architecture|code|function|class|method|tool|implementation)\b/i)) {
    if (contentLower.includes('```') || contentLower.includes('agent skill') || contentLower.includes('sdk')) {
      return 'documentation technique';
    }
  }

  // Research/study
  if (contentLower.match(/\b(étude|recherche|methodology|résultats|hypothèse|conclusion)\b/i)) {
    return 'article de recherche';
  }

  // Newsletter
  if (contentLower.match(/\b(newsletter|import ai|weekly|roundup)\b/i)) {
    return 'newsletter';
  }

  // Analysis/essay
  if (contentLower.match(/\b(analyse|essai|opinion|réflexion|thèse)\b/i)) {
    return 'analyse';
  }

  // Default to press article
  return 'article de presse';
}

/**
 * Calculates reduction percentage
 * @param {number} originalWords - Original word count
 * @param {number} tldrWords - TL;DR word count
 * @returns {number} Reduction percentage
 */
export function calculateReduction(originalWords, tldrWords) {
  return parseFloat(((1 - tldrWords / originalWords) * 100).toFixed(1));
}

/**
 * Validates TL;DR metrics against requirements
 * @param {Object} tldrStats - TL;DR statistics
 * @returns {Object} Validation result
 */
export function validateTldrMetrics(tldrStats) {
  const MAX_WORDS = 750;
  const MAX_READING_TIME = 3.0;

  const errors = [];
  const warnings = [];

  // Check word count
  if (tldrStats.words > MAX_WORDS) {
    errors.push({
      type: 'word_count',
      message: `Trop de mots: ${tldrStats.words}/${MAX_WORDS}`,
      value: tldrStats.words,
      limit: MAX_WORDS
    });
  } else if (tldrStats.words > MAX_WORDS * 0.9) {
    warnings.push({
      type: 'word_count',
      message: `Proche de la limite: ${tldrStats.words}/${MAX_WORDS} mots`,
      value: tldrStats.words,
      limit: MAX_WORDS
    });
  }

  // Check reading time
  if (tldrStats.readingTimeMinutes > MAX_READING_TIME) {
    errors.push({
      type: 'reading_time',
      message: `Temps de lecture trop long: ${tldrStats.readingTimeMinutes.toFixed(1)}/${MAX_READING_TIME} min`,
      value: tldrStats.readingTimeMinutes,
      limit: MAX_READING_TIME
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      words: tldrStats.words,
      readingTimeMinutes: tldrStats.readingTimeMinutes
    }
  };
}
