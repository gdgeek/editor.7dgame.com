import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: mrpp-code-separation, Property 4: No TypeScript files
 *
 * The plugin/ directory should contain only JavaScript files (.js),
 * never TypeScript files (.ts, .tsx).
 *
 * **Validates: Requirement 14.1**
 */

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

function collectAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectAllFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

describe('Property 4: No TypeScript files in plugin/', () => {
  const allFiles = collectAllFiles(PLUGIN_DIR);

  it('should have found files in plugin/', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('no file in plugin/ has .ts or .tsx extension', () => {
    if (allFiles.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allFiles.length - 1 }),
        (index) => {
          const file = allFiles[index];
          const ext = path.extname(file).toLowerCase();
          if (ext === '.ts' || ext === '.tsx') {
            throw new Error(
              `TypeScript file found: ${path.relative(PROJECT_ROOT, file)}`
            );
          }
          return true;
        }
      ),
      { numRuns: Math.min(100, allFiles.length), verbose: 1 }
    );
  });

  it('exhaustive: no .ts or .tsx files exist in plugin/', () => {
    const tsFiles = allFiles
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.ts' || ext === '.tsx';
      })
      .map(f => path.relative(PROJECT_ROOT, f));

    expect(
      tsFiles,
      `TypeScript files found:\n${tsFiles.join('\n')}`
    ).toHaveLength(0);
  });
});
