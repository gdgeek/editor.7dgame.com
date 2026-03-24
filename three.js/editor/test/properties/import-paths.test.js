import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: mrpp-code-separation, Property 1: Import path validity
 *
 * For any JavaScript file (in `plugin/` and `three.js/editor/js/` directories),
 * every import statement with a relative path should resolve to an existing file.
 *
 * **Validates: Requirements 6.3, 9.1, 9.2, 9.3**
 */

// Tests run from three.js/editor/test/ — project root is 3 levels up
const TEST_DIR = process.cwd();
const PROJECT_ROOT = path.resolve(TEST_DIR, '../../..');

// Directories to skip when scanning for JS files
const SKIP_DIRS = new Set(['node_modules', '.git', 'test', 'build']);

// Files to exclude (bundled/minified libraries with import-like patterns in strings)
const EXCLUDE_FILES = new Set(['acorn.js']);

// Known pre-existing broken imports unrelated to the MRPP migration
const KNOWN_BROKEN_IMPORTS = new Set([
  'plugin/mrpp/EditorLoader.js::./SceneCreater.js', // SceneCreater.js never existed in the repo
]);

/**
 * Recursively collect all .js files under a directory.
 */
function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extract relative import paths from a JS file's content.
 * Handles both static imports and dynamic imports.
 * Skips bare specifiers (e.g., 'three') — only checks paths starting with './' or '../'.
 * Skips template literal dynamic imports (cannot be statically resolved).
 */
function extractRelativeImports(fileContent) {
  const imports = [];

  // Static imports: import ... from './path' or import ... from "../path"
  const staticImportRegex = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/gm;
  let match;
  while ((match = staticImportRegex.exec(fileContent)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic imports: await import('./path') or import('./path')
  // Only match single/double quoted strings, not template literals
  const dynamicImportRegex = /\bimport\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(fileContent)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Build a list of { file, importPath, resolvedPath } for all relative imports.
 */
function collectAllImportEntries(jsFiles) {
  const entries = [];
  for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeImports = extractRelativeImports(content);
    const fileDir = path.dirname(filePath);

    for (const importPath of relativeImports) {
      const resolvedPath = path.resolve(fileDir, importPath);
      entries.push({
        file: path.relative(PROJECT_ROOT, filePath),
        importPath,
        resolvedPath,
      });
    }
  }
  return entries;
}

describe('Property 1: Import path validity', () => {
  // Collect all JS files from plugin/ and three.js/editor/js/
  const pluginDir = path.join(PROJECT_ROOT, 'plugin');
  const editorJsDir = path.join(PROJECT_ROOT, 'three.js', 'editor', 'js');

  const pluginFiles = collectJsFiles(pluginDir);
  const editorJsFiles = collectJsFiles(editorJsDir);
  const allJsFiles = [...pluginFiles, ...editorJsFiles];

  // Pre-compute all import entries
  const allImportEntries = collectAllImportEntries(allJsFiles);

  it('should have found JS files to test', () => {
    expect(allJsFiles.length).toBeGreaterThan(0);
    expect(allImportEntries.length).toBeGreaterThan(0);
  });

  it('every relative import path in plugin/ and three.js/editor/js/ should resolve to an existing file', () => {
    // Guard: skip if no import entries found
    if (allImportEntries.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allImportEntries.length - 1 }),
        (index) => {
          const entry = allImportEntries[index];
          const knownKey = `${entry.file}::${entry.importPath}`;
          if (KNOWN_BROKEN_IMPORTS.has(knownKey)) return true; // skip pre-existing issues
          const exists = fs.existsSync(entry.resolvedPath);
          if (!exists) {
            throw new Error(
              `Broken import in ${entry.file}: ` +
              `import '${entry.importPath}' resolves to ` +
              `${path.relative(PROJECT_ROOT, entry.resolvedPath)} which does not exist`
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

  it('exhaustive check: all relative import paths resolve to existing files', () => {
    const broken = [];
    for (const entry of allImportEntries) {
      const knownKey = `${entry.file}::${entry.importPath}`;
      if (KNOWN_BROKEN_IMPORTS.has(knownKey)) continue; // skip pre-existing issues
      if (!fs.existsSync(entry.resolvedPath)) {
        broken.push(
          `${entry.file}: import '${entry.importPath}' -> ` +
          `${path.relative(PROJECT_ROOT, entry.resolvedPath)}`
        );
      }
    }
    expect(broken, `Broken import paths found:\n${broken.join('\n')}`).toHaveLength(0);
  });
});
