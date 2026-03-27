import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Feature: js-to-ts-migration, Property 6: 无 @ts-ignore 或 @ts-expect-error
//
// For any .ts file in plugin/ directory (excluding .d.ts files), the file
// should NOT contain @ts-ignore or @ts-expect-error suppression comments.
//
// Migrated .ts files should have proper type annotations instead of
// relying on TypeScript error suppression directives.
//
// **Validates: Requirements 7.4**

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

/**
 * Recursively collect all .ts files from a directory, excluding .d.ts files.
 */
function collectTsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectTsFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// Pattern to match forbidden suppression comments
const TS_IGNORE_REGEX = /@ts-ignore|@ts-expect-error/;

// Collect .ts files once before tests run
const tsFiles = collectTsFiles(PLUGIN_DIR);

describe('Feature: js-to-ts-migration, Property 6: 无 @ts-ignore 或 @ts-expect-error', () => {
  it('should have .ts files to test against', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it('for any sampled .ts file, the file does not contain @ts-ignore or @ts-expect-error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: tsFiles.length - 1 }),
        (index) => {
          const filePath = tsFiles[index];
          const content = fs.readFileSync(filePath, 'utf-8');
          const relPath = path.relative(PROJECT_ROOT, filePath);

          if (TS_IGNORE_REGEX.test(content)) {
            const lines = content.split('\n');
            const matchingLine = lines.find((line) =>
              TS_IGNORE_REGEX.test(line)
            );
            throw new Error(
              `File ${relPath} contains a forbidden suppression comment: "${matchingLine?.trim()}". ` +
              'Migrated .ts files should use proper type annotations instead of @ts-ignore or @ts-expect-error.'
            );
          }
          return true;
        }
      ),
      {
        numRuns: Math.max(100, Math.min(200, tsFiles.length)),
        verbose: 1,
        endOnFailure: true,
      }
    );
  });
});
