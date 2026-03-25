import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: mrpp-code-separation, Property 3: three.js reference unchanged
 *
 * For any JavaScript file in `plugin/`, every import that references the three.js
 * library should use the bare specifier `'three'` (via import map), NOT a relative
 * path like `'../../three.js/build/three.module.js'`.
 *
 * **Validates: Requirement 9.4**
 */

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract all import specifiers that reference 'three' in any form.
 * Returns objects with { specifier, isBare } where isBare means it uses 'three' bare specifier.
 */
function extractThreeImports(content) {
  const results = [];
  // Match: import ... from '...' or import('...')
  const importRegex = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const specifier = m[1];
    // Check if this import references three.js library
    if (specifier === 'three' || /three(?:\.js)?\/build\/three/i.test(specifier)) {
      results.push({ specifier, isBare: specifier === 'three' });
    }
  }
  return results;
}

describe('Property 3: three.js reference unchanged', () => {
  const pluginFiles = collectJsFiles(PLUGIN_DIR);

  // Collect all three.js import entries
  const entries = [];
  for (const filePath of pluginFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const threeImports = extractThreeImports(content);
    for (const imp of threeImports) {
      entries.push({
        file: path.relative(PROJECT_ROOT, filePath),
        ...imp,
      });
    }
  }

  it('should have found plugin JS files', () => {
    expect(pluginFiles.length).toBeGreaterThan(0);
  });

  it('all three.js imports in plugin/ use bare specifier "three"', () => {
    if (entries.length === 0) return; // no three imports found, that's fine

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: entries.length - 1 }),
        (index) => {
          const entry = entries[index];
          if (!entry.isBare) {
            throw new Error(
              `${entry.file}: uses relative path '${entry.specifier}' instead of bare specifier 'three'`
            );
          }
          return true;
        }
      ),
      { numRuns: Math.min(100, entries.length), verbose: 1 }
    );
  });

  it('exhaustive: no plugin/ file imports three.js via relative path', () => {
    const violations = entries.filter(e => !e.isBare);
    expect(
      violations.map(v => `${v.file}: '${v.specifier}'`),
      `Files using relative three.js imports:\n${violations.map(v => `${v.file}: '${v.specifier}'`).join('\n')}`
    ).toHaveLength(0);
  });
});
