# Exemples JavaScript Complets

## Script Node.js Simple

```javascript
#!/usr/bin/env node

/**
 * JSON file processing script
 */

import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Loads and parses a JSON file
 * @param {string} filePath - File path
 * @returns {Promise<Object>} Parsed data
 */
const loadJSON = async (filePath) => {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
};

/**
 * Transforms data according to business rules
 * @param {Object} data - Data to transform
 * @returns {Object} Transformed data
 */
const transformData = (data) => {
  return {
    ...data,
    processedAt: new Date().toISOString(),
    items: data.items?.map(item => ({
      ...item,
      normalized: item.value?.toLowerCase(),
    })),
  };
};

/**
 * Main entry point
 * @param {Object} options - Execution options
 * @param {string} options.input - Input file
 * @param {string} options.output - Output file
 */
const main = async ({ input, output }) => {
  const data = await loadJSON(input);
  const transformed = transformData(data);
  await writeFile(output, JSON.stringify(transformed, null, 2));
  console.log(`✅ Processing complete: ${output}`);
};

// Execution
main({
  input: process.argv[2] ?? 'input.json',
  output: process.argv[3] ?? 'output.json',
}).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
```

## Module ESM Réutilisable

```javascript
/**
 * Data validation utilities
 * @module validators
 */

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {boolean} true if valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a data set against a schema
 * @param {Object} options - Validation options
 * @param {Object} options.data - Data to validate
 * @param {Object} options.schema - Validation schema
 * @returns {Object} Result with { valid: boolean, errors: string[] }
 */
export const validate = ({ data, schema }) => {
  const errors = [];

  Object.entries(schema).forEach(([key, validator]) => {
    if (!validator(data[key])) {
      errors.push(`Invalid field: ${key}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Creates a custom validator
 * @param {Function} predicate - Validation function
 * @param {string} message - Error message
 * @returns {Function} Validator function
 */
export const createValidator = (predicate, message) => {
  return (value) => {
    if (!predicate(value)) {
      throw new Error(message);
    }
    return true;
  };
};

export default { isValidEmail, validate, createValidator };
```
