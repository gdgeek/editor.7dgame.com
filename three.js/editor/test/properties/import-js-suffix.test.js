import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: js-to-ts-migration, Property 3: 所有 .ts 文件的 import 路径使用 .js 后缀
 *
 * For any .ts file in plugin/ directory (excluding .d.ts files), every relative
 * import path (starting with ./ or ../) should end with a .js suffix.
 * This is required because tsc in moduleResolution "bundler" mode resolves
 * .js imports to .ts source files, and the compiled output retains .js paths
 * for browser-native ES module loading.
 *
 * **Validates: Requirements 4.6, 6.1**
 */

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

/**
 * Extract relative import paths from file content.
 * Only captures imports starting with './' or '../'.
 * Returns array of { importPath, line } objects.
 */
function extractRelativeImports(fileContent) {
  const imports = [];

  // Static imports: import ... from './path' or import ... from "../path"
  const staticImportRegex = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/gm;
  let match;
  while ((match = staticImportRegex.exec(fileContent)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic imports: import('./path') or import("../path")
  const dynamicImportRegex = /\bimport\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(fileContent)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Build a flat list of { file, importPath } entries for all relative imports
 * found in .ts files under plugin/.
 */
function collectAllImportEntries(tsFiles) {
  const entries = [];
  for (const filePath of tsFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeImports = extractRelativeImports(content);
    const relFile = path.relative(PROJECT_ROOT, filePath);

    for (const importPath of relativeImports) {
      entries.push({ file: relFile, importPath });
    }
  }
  return entries;
}

// Collect data once before tests run
const tsFiles = collectTsFiles(PLUGIN_DIR);
const allImportEntries = collectAllImportEntries(tsFiles);

describe('Feature: js-to-ts-migration, Property 3: 所有 .ts 文件的 import 路径使用 .js 后缀', () => {
  it('should have .ts files with relative imports to test against', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
    expect(allImportEntries.length).toBeGreaterThan(0);
  });

  it('for any sampled relative import in a .ts file, the import path ends with .js', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allImportEntries.length - 1 }),
        (index) => {
          const entry = allImportEntries[index];

          if (!entry.importPath.endsWith('.js')) {
            throw new Error(
              `Import path does not end with .js suffix in ${entry.file}: ` +
              `import '${entry.importPath}' — expected .js extension`
            );
          }
          return true;
        }
      ),
      {
        numRuns: Math.max(100, Math.min(200, allImportEntries.length)),
        verbose: 1,
        endOnFailure: true,
      }
    );
  });
});
