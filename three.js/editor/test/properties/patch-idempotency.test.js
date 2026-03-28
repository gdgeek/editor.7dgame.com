import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

describe('patch-idempotency: guard flags prevent double-patching', () => {

  // Sub-task 4.1: UIThreePatches multi-select patch guard
  it('UIThreePatches has _mrppMultiSelectPatched read guard', () => {
    const content = readSource('plugin/patches/UIThreePatches.ts');
    expect(content, 'UIThreePatches.ts not found').not.toBeNull();
    // Should appear in an if-check (read)
    expect(content, 'Missing _mrppMultiSelectPatched read guard in UIThreePatches.ts').toMatch(/_mrppMultiSelectPatched/);
    // Should appear in an assignment (write)
    expect(content, 'Missing _mrppMultiSelectPatched write assignment in UIThreePatches.ts').toMatch(/_mrppMultiSelectPatched\s*=/);
  });

  // Sub-task 4.2: UIThreePatches drop handler guard
  it('UIThreePatches has _mrppDropPatched guard flag', () => {
    const content = readSource('plugin/patches/UIThreePatches.ts');
    expect(content, 'UIThreePatches.ts not found').not.toBeNull();
    expect(content, 'Missing _mrppDropPatched guard in UIThreePatches.ts').toContain('_mrppDropPatched');
  });

  // Sub-task 4.3: DeferredUIPatches boolean guard variables
  it('DeferredUIPatches has sidebarPatched and menubarPatched guard variables', () => {
    const content = readSource('plugin/utils/DeferredUIPatches.ts');
    expect(content, 'DeferredUIPatches.ts not found').not.toBeNull();
    expect(content, 'Missing sidebarPatched variable in DeferredUIPatches.ts').toContain('sidebarPatched');
    expect(content, 'Missing menubarPatched variable in DeferredUIPatches.ts').toContain('menubarPatched');
  });

});
