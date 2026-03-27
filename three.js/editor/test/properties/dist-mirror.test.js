import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: js-to-ts-migration, Property 2: plugin-dist/ 镜像 plugin/ 目录结构
 *
 * For any .ts file in plugin/ directory, after tsc compilation, a corresponding
 * .js file should exist in plugin-dist/ with the same relative path
 * (e.g., plugin/mrpp/MetaLoader.ts → plugin-dist/mrpp/MetaLoader.js).
 *
 * **Validates: Requirements 1.4**
 */

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

/**
 * Recursively collect all .ts files from a directory, excluding .d.ts files.
 * Returns paths relative to the given directory.
 */
function collectTsFiles(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath, baseDir));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

const pluginDir = path.join(PROJECT_ROOT, 'plugin');
const tsFiles = collectTsFiles(pluginDir);

describe('Feature: js-to-ts-migration, Property 2: plugin-dist/ 镜像 plugin/ 目录结构', () => {
  it('should have .ts files in plugin/ to test against', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it('for any sampled .ts file in plugin/, a corresponding .js file exists in plugin-dist/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: tsFiles.length - 1 }),
        (index) => {
          const relativeTsPath = tsFiles[index];
          // Convert .ts → .js for the expected output path
          const relativeJsPath = relativeTsPath.replace(/\.ts$/, '.js');
          const distJsPath = path.join(PROJECT_ROOT, 'plugin-dist', relativeJsPath);

          if (!fs.existsSync(distJsPath)) {
            throw new Error(
              `Missing compiled output: plugin-dist/${relativeJsPath} does not exist ` +
              `(source: plugin/${relativeTsPath})`
            );
          }
          return true;
        }
      ),
      {
        numRuns: 100,
        verbose: 1,
        endOnFailure: true,
      }
    );
  });
});
