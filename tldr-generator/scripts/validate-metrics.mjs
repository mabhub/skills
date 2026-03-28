#!/usr/bin/env node

/**
 * Validate TL;DR metrics against requirements
 * Checks word count, reading time, and comparison with original
 */

import { analyzeFile, calculateReduction, validateTldrMetrics, getOriginalFilename } from '../tools/utils.mjs';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Validates a TL;DR file against its original
 * @param {string} tldrPath - Path to TL;DR file
 * @returns {Promise<Object>} Validation result
 */
async function validateTldr(tldrPath) {
  // Analyze TL;DR file
  const tldrAnalysis = await analyzeFile(tldrPath);

  if (!tldrAnalysis.exists) {
    return {
      valid: false,
      error: `TL;DR file not found: ${tldrPath}`
    };
  }

  // Find and analyze original file
  const originalFilename = getOriginalFilename(tldrAnalysis.name);
  const originalPath = join(dirname(tldrPath), originalFilename);

  let originalAnalysis = null;
  let hasOriginal = false;

  if (existsSync(originalPath)) {
    originalAnalysis = await analyzeFile(originalPath);
    hasOriginal = originalAnalysis.exists;
  }

  // Validate metrics
  const metricsValidation = validateTldrMetrics(tldrAnalysis.stats);

  // Calculate comparison with original if available
  let comparison = null;
  if (hasOriginal) {
    comparison = {
      originalWords: originalAnalysis.stats.words,
      tldrWords: tldrAnalysis.stats.words,
      reduction: calculateReduction(originalAnalysis.stats.words, tldrAnalysis.stats.words),
      originalReadingTime: originalAnalysis.stats.readingTimeMinutes,
      tldrReadingTime: tldrAnalysis.stats.readingTimeMinutes
    };

    // Add warning if reduction is too low
    if (comparison.reduction < 20) {
      metricsValidation.warnings.push({
        type: 'low_reduction',
        message: `Réduction faible: ${comparison.reduction.toFixed(1)}% (recommandé > 20%)`,
        value: comparison.reduction,
        recommendation: 'Considérer une synthèse plus agressive'
      });
    }
  }

  // Validate front-matter
  const frontMatterValidation = validateFrontMatter(tldrAnalysis.frontMatter);

  return {
    valid: metricsValidation.valid && frontMatterValidation.valid,
    tldr: {
      filename: tldrAnalysis.name,
      words: tldrAnalysis.stats.words,
      readingTime: tldrAnalysis.stats.readingTimeMinutes
    },
    original: hasOriginal ? {
      filename: originalAnalysis.name,
      words: originalAnalysis.stats.words,
      readingTime: originalAnalysis.stats.readingTimeMinutes
    } : null,
    comparison,
    metrics: metricsValidation,
    frontMatter: frontMatterValidation,
    warnings: [
      ...metricsValidation.warnings,
      ...frontMatterValidation.warnings
    ],
    errors: [
      ...metricsValidation.errors,
      ...frontMatterValidation.errors
    ]
  };
}

/**
 * Validates front-matter content
 * @param {Object} frontMatter - Front-matter object
 * @returns {Object} Validation result
 */
function validateFrontMatter(frontMatter) {
  const errors = [];
  const warnings = [];

  if (!frontMatter) {
    errors.push({
      type: 'missing_frontmatter',
      message: 'Front-matter YAML non trouvé'
    });
    return { valid: false, errors, warnings };
  }

  // Check required fields
  const requiredFields = ['created', 'source', 'author'];
  requiredFields.forEach(field => {
    if (!frontMatter[field]) {
      errors.push({
        type: 'missing_field',
        field,
        message: `Champ requis manquant: '${field}'`
      });
    }
  });

  // Check tags
  if (!frontMatter.tags || frontMatter.tags.length === 0) {
    warnings.push({
      type: 'missing_tags',
      message: 'Aucun tag défini (recommandé: 3-10 tags)'
    });
  } else if (frontMatter.tags.length < 3) {
    warnings.push({
      type: 'few_tags',
      message: `Peu de tags (${frontMatter.tags.length}), recommandé: 3-10`
    });
  } else if (frontMatter.tags.length > 10) {
    warnings.push({
      type: 'many_tags',
      message: `Beaucoup de tags (${frontMatter.tags.length}), recommandé: 3-10`
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const tldrPath = args[0];
  const jsonOutput = args.includes('--json') || args.includes('-j');

  if (!tldrPath) {
    console.error('Usage: validate-metrics.mjs <article.tldr.md> [--json]');
    process.exit(1);
  }

  const validation = await validateTldr(tldrPath);

  if (jsonOutput) {
    console.log(JSON.stringify(validation, null, 2));
  } else {
    if (validation.error) {
      console.error(`❌ ${validation.error}`);
      process.exit(1);
    }

    console.log(`\n📊 Validation: ${validation.tldr.filename}\n`);

    // Display metrics
    console.log('Métriques:');
    console.log(`  Mots: ${validation.tldr.words}/750`);
    console.log(`  Temps de lecture: ${validation.tldr.readingTime.toFixed(1)} min/3.0 min`);

    // Display comparison if available
    if (validation.comparison) {
      console.log(`\nComparaison avec l'original:`);
      console.log(`  Original: ${validation.comparison.originalWords.toLocaleString('fr-FR')} mots (${validation.comparison.originalReadingTime.toFixed(1)} min)`);
      console.log(`  TL;DR: ${validation.comparison.tldrWords.toLocaleString('fr-FR')} mots (${validation.comparison.tldrReadingTime.toFixed(1)} min)`);
      console.log(`  Réduction: ${validation.comparison.reduction.toFixed(1)}%`);
    }

    // Display errors
    if (validation.errors.length > 0) {
      console.log(`\n❌ Erreurs bloquantes:`);
      validation.errors.forEach(error => {
        console.log(`  • ${error.message}`);
      });
    }

    // Display warnings
    if (validation.warnings.length > 0) {
      console.log(`\n⚠️  Avertissements:`);
      validation.warnings.forEach(warning => {
        console.log(`  • ${warning.message}`);
        if (warning.recommendation) {
          console.log(`    → ${warning.recommendation}`);
        }
      });
    }

    // Final verdict
    if (validation.valid && validation.warnings.length === 0) {
      console.log(`\n✅ Validation réussie - TL;DR conforme\n`);
    } else if (validation.valid) {
      console.log(`\n✅ Validation réussie avec avertissements\n`);
    } else {
      console.log(`\n❌ Validation échouée - corrections nécessaires\n`);
      process.exit(1);
    }
  }
}

// Run if called directly
const isMainModule = process.argv[1] && import.meta.url.includes('validate-metrics.mjs');

if (isMainModule) {
  main().catch(console.error);
}

export { validateTldr };
