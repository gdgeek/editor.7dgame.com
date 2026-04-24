import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const RUNTIME_DEFERRED_UI_PATCH = path.join(
  PROJECT_ROOT,
  'plugin-dist/utils/DeferredUIPatches.js'
);
const runtimeDeferredUiPatchExists = fs.existsSync(RUNTIME_DEFERRED_UI_PATCH);

function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

describe('deferred-ui runtime sync', () => {
  it.skipIf(!runtimeDeferredUiPatchExists)(
    'runtime DeferredUIPatches does not use the legacy object extension injection path',
    () => {
    const content = readSource('plugin-dist/utils/DeferredUIPatches.js');

    expect(content, 'plugin-dist/utils/DeferredUIPatches.js not found').not.toBeNull();
    expect(content, 'Runtime DeferredUIPatches should not import legacy object extension hooks')
      .not.toContain('injectSidebarObjectExtensions');
    expect(content, 'Runtime DeferredUIPatches should not import legacy JSON viewer hook')
      .not.toContain('injectUserDataJsonViewer');
    expect(content, 'Runtime DeferredUIPatches should not call hideObjectPropertyRows')
      .not.toContain('hideObjectPropertyRows');
    expect(content, 'Runtime DeferredUIPatches should not query the ambiguous #objectTab selector')
      .not.toMatch(/querySelector\(\s*['"]#objectTab['"]\s*\)/);
    }
  );
});
