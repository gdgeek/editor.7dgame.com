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
  'plugin/mrpp/EditorLoader.ts::./SceneCreater.js', // SceneCreater.js never existed in the repo (TS migration)
]);

/**
 * Recursively collect source files under a directory.
 * @param {string} dir - Directory to scan
 * @param {string[]} extensions - File extensions to include (e.g. ['.js', '.ts'])
 */
function collectSourceFiles(dir, extensions = ['.js']) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...collectSourceFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
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
 * Resolve an import path, handling tsc bundler mode where .ts files
 * import with .js suffix that resolves to .ts source files.
 * Also handles .d.ts type declaration files.
 * Returns the resolved path that actually exists (or the original if none exists).
 */
function resolveImportPath(fileDir, importPath) {
  const resolvedPath = path.resolve(fileDir, importPath);
  // If the .js target exists, use it directly
  if (fs.existsSync(resolvedPath)) return resolvedPath;
  // tsc bundler mode: .ts files import with .js suffix → try .ts then .d.ts
  if (importPath.endsWith('.js')) {
    const tsPath = resolvedPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(tsPath)) return tsPath;
    const dtsPath = resolvedPath.replace(/\.js$/, '.d.ts');
    if (fs.existsSync(dtsPath)) return dtsPath;
  }
  return resolvedPath; // return original for error reporting
}

/**
 * Build a list of { file, importPath, resolvedPath } for all relative imports.
 */
function collectAllImportEntries(sourceFiles) {
  const entries = [];
  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeImports = extractRelativeImports(content);
    const fileDir = path.dirname(filePath);

    for (const importPath of relativeImports) {
      const resolvedPath = resolveImportPath(fileDir, importPath);
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
  // Collect source files: .ts files from plugin/, .js files from three.js/editor/js/
  const pluginDir = path.join(PROJECT_ROOT, 'plugin');
  const editorJsDir = path.join(PROJECT_ROOT, 'three.js', 'editor', 'js');

  const pluginFiles = collectSourceFiles(pluginDir, ['.js', '.ts']);
  const editorJsFiles = collectSourceFiles(editorJsDir, ['.js']);
  const allSourceFiles = [...pluginFiles, ...editorJsFiles];

  // Pre-compute all import entries
  const allImportEntries = collectAllImportEntries(allSourceFiles);

  it('should have found source files to test', () => {
    expect(allSourceFiles.length).toBeGreaterThan(0);
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
