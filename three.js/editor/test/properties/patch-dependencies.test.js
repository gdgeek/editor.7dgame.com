import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

function extractRelativeImports(content) {
  const re = /^import\s+[^'"]*from\s+['"](\.[^'"]+)['"]/gm;
  const paths = [];
  let m;
  while ((m = re.exec(content)) !== null) paths.push(m[1]);
  return paths;
}

function resolveImportPath(sourceRelPath, importPath) {
  const sourceDir = path.dirname(path.join(PROJECT_ROOT, sourceRelPath));
  const resolved = path.resolve(sourceDir, importPath);
  const candidates = [
    resolved,
    resolved.replace(/\.js$/, '.ts'),
    resolved.replace(/\.js$/, '.d.ts'),
    resolved + '.ts',
    resolved + '.d.ts',
    resolved + '.js',
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

const PATCH_FILES = [
  'plugin/patches/EditorPatches.ts',
  'plugin/patches/SidebarPatches.ts',
  'plugin/patches/MenubarPatches.ts',
  'plugin/patches/LoaderPatches.ts',
  'plugin/patches/UIThreePatches.ts',
  'plugin/patches/ViewportPatches.ts',
];

describe('patch-dependencies: UIOutliner, Loader API, import path validity', () => {

  it('ui.three.js exists and contains UIOutliner with prototype pattern', () => {
    const uiThreePath = 'three.js/editor/js/libs/ui.three.js';
    const abs = path.join(PROJECT_ROOT, uiThreePath);
    expect(fs.existsSync(abs), `File not found: ${abs}`).toBe(true);

    const content = readSource(uiThreePath);
    expect(content).not.toBeNull();
    expect(content, 'UIOutliner not defined/exported in ui.three.js').toMatch(/UIOutliner/);
    // r183 uses ES6 class syntax; verify UIOutliner is defined as a class
    expect(content, 'class UIOutliner not found in ui.three.js').toMatch(/class\s+UIOutliner/);

    const uiThreeContent = readSource('plugin/patches/UIThreePatches.ts');
    expect(uiThreeContent).not.toBeNull();
    expect(uiThreeContent, 'UIThreePatches.ts does not import UIOutliner from ui.three.js').toMatch(/UIOutliner/);
    // Verify the import statement references ui.three.js
    expect(uiThreeContent, 'UIThreePatches.ts import does not reference ui.three.js').toMatch(/ui\.three/);
  });

  it('Loader.js exists and LoaderPatches.ts imports KTX2Loader', () => {
    const loaderPath = 'three.js/editor/js/Loader.js';
    const abs = path.join(PROJECT_ROOT, loaderPath);
    expect(fs.existsSync(abs), `File not found: ${abs}`).toBe(true);

    const loaderContent = readSource('plugin/patches/LoaderPatches.ts');
    expect(loaderContent).not.toBeNull();
    expect(loaderContent, 'LoaderPatches.ts does not import KTX2Loader').toMatch(/KTX2Loader/);
  });

  it('patch files have at least one relative import in total', () => {
    let total = 0;
    for (const file of PATCH_FILES) {
      const content = readSource(file);
      if (content) total += extractRelativeImports(content).length;
    }
    expect(total, 'No relative imports found across all patch files').toBeGreaterThan(0);
  });

  // Feature: patch-injection-tests, Property 7: Loader.js API 完整性
  it('P7: loadFiles and loadFile methods exist in Loader.js', () => {
    const methods = ['loadFiles', 'loadFile'];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: methods.length - 1 }),
        (idx) => {
          const method = methods[idx];
          const content = readSource('three.js/editor/js/Loader.js');
          expect(content, 'Loader.js not found').not.toBeNull();
          expect(content, `Loader.js missing method: ${method}`).toContain(method);
        }
      ),
      { numRuns: Math.max(100, methods.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

  // Feature: patch-injection-tests, Property 8: Patch 文件导入路径完整性
  it('P8: every relative import in patch files resolves to an existing file', () => {
    // Build all (patchFile, importPath) pairs
    const allPairs = [];
    for (const file of PATCH_FILES) {
      const content = readSource(file);
      if (!content) continue;
      const imports = extractRelativeImports(content);
      for (const imp of imports) {
        allPairs.push({ file, imp });
      }
    }

    expect(allPairs.length, 'No import pairs found').toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allPairs.length - 1 }),
        (idx) => {
          const { file, imp } = allPairs[idx];
          const resolved = resolveImportPath(file, imp);
          expect(
            resolved,
            `Dangling import in ${file}: '${imp}' does not resolve to an existing file`
          ).not.toBeNull();
        }
      ),
      { numRuns: Math.max(100, allPairs.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

});
