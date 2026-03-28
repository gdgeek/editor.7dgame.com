import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

// ── Inline tool functions ────────────────────────────────────────────

function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

function extractExportNames(content) {
  const names = [];
  // export { A, B as C, ... }
  const braceRe = /^export\s*\{([^}]+)\}/gm;
  let m;
  while ((m = braceRe.exec(content)) !== null) {
    m[1].split(',').forEach(part => {
      const alias = part.trim().split(/\s+as\s+/).pop().trim();
      if (alias) names.push(alias);
    });
  }
  // export function/class/const/let/var name
  const declRe = /^export\s+(?:async\s+)?(?:function\*?\s+|class\s+|(?:const|let|var)\s+)(\w+)/gm;
  while ((m = declRe.exec(content)) !== null) {
    names.push(m[1]);
  }
  // export default — skip (no named export)
  return [...new Set(names)].sort();
}

function findCallLine(content, fnName) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(fnName + '(')) return i;
  }
  return -1;
}

// ── Data constants ───────────────────────────────────────────────────

const PATCH_EXPORTS = [
  { file: 'plugin/patches/EditorPatches.ts',   exports: ['applyEditorPatches', 'LANGUAGE_MAPPING'] },
  { file: 'plugin/patches/SidebarPatches.ts',  exports: ['applySidebarPatches', 'applySidebarPropertiesPatches'] },
  { file: 'plugin/patches/MenubarPatches.ts',  exports: ['applyMenubarPatches'] },
  { file: 'plugin/patches/LoaderPatches.ts',   exports: ['applyLoaderPatches'] },
  { file: 'plugin/patches/UIThreePatches.ts',  exports: ['applyUIThreePatches'] },
  { file: 'plugin/patches/ViewportPatches.ts', exports: ['applyViewportPatches', 'computeEnhancedBoundingBox'] },
];

const BOOTSTRAP_CALLS = [
  { file: 'plugin/bootstrap/meta-bootstrap.ts',  calls: ['applyEditorPatches', 'applyLoaderPatches', 'applyViewportPatches', 'applyUIThreePatches', 'applyDeferredUIPatches'] },
  { file: 'plugin/bootstrap/verse-bootstrap.ts', calls: ['applyEditorPatches', 'applyLoaderPatches', 'applyViewportPatches', 'applyUIThreePatches', 'applyDeferredUIPatches'] },
];

const EDITOR_ITEMS = [
  // methods
  'setScene', 'addObject', 'removeObject', 'select', 'clear', 'fromJSON', 'toJSON',
  // props
  'signals', 'config', 'sceneHelpers',
  // signals
  'objectSelected', 'objectChanged', 'transformModeChanged', 'sceneGraphChanged',
];

// ── Tests ────────────────────────────────────────────────────────────

describe('Patch file exports', () => {

  it('bootstrap files exist', () => {
    for (const { file } of BOOTSTRAP_CALLS) {
      const content = readSource(file);
      expect(content, `Bootstrap file not found: ${file}`).not.toBeNull();
    }
  });

  // Feature: patch-injection-tests, Property 1: Patch 文件导出名称完整性
  it('P1: every expected export name is present in its patch file', () => {
    const allPairs = PATCH_EXPORTS.flatMap(({ file, exports }) => exports.map(name => ({ file, name })));
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allPairs.length - 1 }),
        (idx) => {
          const { file, name } = allPairs[idx];
          const content = readSource(file);
          expect(content).not.toBeNull();
          const actual = extractExportNames(content);
          expect(actual, `Export name missing in ${file}:\n  expected: ${name}\n  actual exports: ${JSON.stringify(actual)}`).toContain(name);
        }
      ),
      { numRuns: Math.max(100, allPairs.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

  // Feature: patch-injection-tests, Property 2: Bootstrap 调用覆盖完整性
  it('P2: every expected patch call is present in its bootstrap file', () => {
    const allCallPairs = BOOTSTRAP_CALLS.flatMap(({ file, calls }) => calls.map(fn => ({ file, fn })));
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allCallPairs.length - 1 }),
        (idx) => {
          const { file, fn } = allCallPairs[idx];
          const content = readSource(file);
          expect(content).not.toBeNull();
          expect(content, `Call missing in ${file}: expected call to ${fn}(`).toContain(fn + '(');
        }
      ),
      { numRuns: Math.max(100, allCallPairs.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

  // Feature: patch-injection-tests, Property 3: Bootstrap 调用顺序不变量
  it('P3: applyEditorPatches is called before applyLoaderPatches in every bootstrap file', () => {
    const bootstrapFiles = BOOTSTRAP_CALLS.map(b => b.file);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: bootstrapFiles.length - 1 }),
        (idx) => {
          const file = bootstrapFiles[idx];
          const content = readSource(file);
          expect(content).not.toBeNull();
          const editorLine = findCallLine(content, 'applyEditorPatches');
          const loaderLine = findCallLine(content, 'applyLoaderPatches');
          expect(editorLine, `applyEditorPatches not found in ${file}`).toBeGreaterThanOrEqual(0);
          expect(loaderLine, `applyLoaderPatches not found in ${file}`).toBeGreaterThanOrEqual(0);
          expect(editorLine, `In ${file}: applyEditorPatches (line ${editorLine}) must come before applyLoaderPatches (line ${loaderLine})`).toBeLessThan(loaderLine);
        }
      ),
      { numRuns: Math.max(100, bootstrapFiles.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

  // Feature: patch-injection-tests, Property 4: Editor.js API 完整性
  it('P4: every expected Editor.js API name is present in Editor.js', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EDITOR_ITEMS.length - 1 }),
        (idx) => {
          const name = EDITOR_ITEMS[idx];
          const content = readSource('three.js/editor/js/Editor.js');
          expect(content).not.toBeNull();
          expect(content, `Editor.js missing: ${name}`).toContain(name);
        }
      ),
      { numRuns: Math.max(100, EDITOR_ITEMS.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

});
