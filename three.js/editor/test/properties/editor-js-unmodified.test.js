import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Feature: js-to-ts-migration, Property 7: three.js/editor/js/ 目录未被修改
//
// For any file in three.js/editor/js/ directory (recursively), the migration
// process should NOT have introduced any .ts files. All files should remain
// as they were before migration (.js only). Pre-existing .d.ts type
// declaration files are excluded from this check since they are not
// migration artifacts.
//
// **Validates: Requirements 10.4**

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const EDITOR_JS_DIR = path.join(PROJECT_ROOT, 'three.js', 'editor', 'js');

/**
 * Recursively collect all files from a directory.
 */
function collectAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectAllFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

// Collect all files once before tests run
const allFiles = collectAllFiles(EDITOR_JS_DIR);

// Identify any .ts files (excluding .d.ts declaration files)
const tsFiles = allFiles.filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.d.ts')
);

describe('Feature: js-to-ts-migration, Property 7: three.js/editor/js/ 目录未被修改', () => {
  it('should have files in editor/js/ to test against', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('precondition: no .ts files exist in three.js/editor/js/', () => {
    if (tsFiles.length > 0) {
      const relPaths = tsFiles.map((f) => path.relative(PROJECT_ROOT, f));
      throw new Error(
        `Found ${tsFiles.length} unexpected .ts file(s) in three.js/editor/js/:\n` +
        relPaths.map((p) => `  - ${p}`).join('\n')
      );
    }
    expect(tsFiles.length).toBe(0);
  });

  it('for any sampled file in editor/js/, the file does not have a .ts extension', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allFiles.length - 1 }),
        (index) => {
          const filePath = allFiles[index];
          const relPath = path.relative(PROJECT_ROOT, filePath);

          // .d.ts files are type declarations, not migration artifacts — skip them
          if (filePath.endsWith('.d.ts')) {
            return true;
          }

          if (filePath.endsWith('.ts')) {
            throw new Error(
              `File ${relPath} is a .ts file in three.js/editor/js/. ` +
              'The migration should not have introduced any .ts files into this directory.'
            );
          }
          return true;
        }
      ),
      {
        numRuns: Math.max(100, Math.min(200, allFiles.length)),
        verbose: 1,
        endOnFailure: true,
      }
    );
  });
});
