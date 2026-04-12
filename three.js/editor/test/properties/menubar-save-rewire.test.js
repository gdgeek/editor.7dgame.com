import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const RUNTIME_MENUBAR_PATCH = path.join(
  PROJECT_ROOT,
  'plugin-dist/patches/MenubarPatches.js'
);
const runtimeMenubarPatchExists = fs.existsSync(RUNTIME_MENUBAR_PATCH);

function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

describe('menubar save rewire', () => {
  it('source patch keeps the save item when the shortcut text is appended', () => {
    const content = readSource('plugin/patches/MenubarPatches.ts');
    expect(content, 'plugin/patches/MenubarPatches.ts not found').not.toBeNull();
    expect(
      content,
      'Source patch should accept save labels like "保存CTRL+S" instead of requiring an exact text match'
    ).toMatch(/itemText\s*===\s*saveLabel\s*\|\|\s*itemText\.startsWith\(\s*saveLabel\s*\)/);
  });

  it.skipIf(!runtimeMenubarPatchExists)(
    'dist patch mirrors the flexible save-label match used by the source patch',
    () => {
    const content = readSource('plugin-dist/patches/MenubarPatches.js');
    expect(content, 'plugin-dist/patches/MenubarPatches.js not found').not.toBeNull();
    expect(
      content,
      'Runtime dist patch should preserve the save item even when its text includes the keyboard shortcut suffix'
    ).toMatch(/itemText\s*===\s*saveLabel\s*\|\|\s*itemText\.startsWith\(\s*saveLabel\s*\)/);
    }
  );
});
