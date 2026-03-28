import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Feature: js-to-ts-migration, Property 4: 导出接口名称不变
 *
 * For any migrated .ts file in plugin/ directory (excluding .d.ts files),
 * the set of export names should exactly match the baseline snapshot
 * captured from the original .js files. This ensures the migration
 * preserves all public API surfaces.
 *
 * **Validates: Requirements 3.6**
 */

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

/**
 * Baseline snapshot of export names per file.
 * Keys are relative paths from project root (e.g. "plugin/access/Access.ts").
 * Values are sorted arrays of exported names.
 */
const EXPORT_BASELINE = {
  'plugin/access/Access.ts': ['ABILITIES', 'Access', 'ROLES', 'ROLE_ABILITY'],
  'plugin/bootstrap/meta-bootstrap.ts': ['initMetaEditor'],
  'plugin/bootstrap/verse-bootstrap.ts': ['initVerseEditor'],
  'plugin/commands/AddCommandCommand.ts': ['AddCommandCommand'],
  'plugin/commands/AddComponentCommand.ts': ['AddComponentCommand'],
  'plugin/commands/AddEventCommand.ts': ['AddEventCommand'],
  'plugin/commands/MoveMultipleObjectsCommand.ts': ['MoveMultipleObjectsCommand'],
  'plugin/commands/MultiTransformCommand.ts': ['MultiTransformCommand'],
  'plugin/commands/RemoveCommandCommand.ts': ['RemoveCommandCommand'],
  'plugin/commands/RemoveComponentCommand.ts': ['RemoveComponentCommand'],
  'plugin/commands/RemoveEventCommand.ts': ['RemoveEventCommand'],
  'plugin/commands/SetCommandValueCommand.ts': ['SetCommandValueCommand'],
  'plugin/commands/SetComponentValueCommand.ts': ['SetComponentValueCommand'],
  'plugin/commands/SetEventValueCommand.ts': ['SetEventValueCommand'],
  'plugin/i18n/MrppStrings.ts': ['mrppStrings'],
  'plugin/mrpp/Builder.ts': ['Builder'],
  'plugin/mrpp/CommandContainer.ts': ['CommandContainer'],
  'plugin/mrpp/ComponentContainer.ts': ['ComponentContainer'],
  'plugin/mrpp/EditorLoader.ts': ['EditorLoader'],
  'plugin/mrpp/EventContainer.ts': ['EventContainer'],
  'plugin/mrpp/Factory.ts': ['Factory'],
  'plugin/mrpp/MetaFactory.ts': ['MetaFactory'],
  'plugin/mrpp/MetaLoader.ts': ['MetaLoader'],
  'plugin/mrpp/VerseFactory.ts': ['VerseFactory'],
  'plugin/mrpp/VerseLoader.ts': ['VerseLoader'],
  'plugin/mrpp/commands/GestureCommand.ts': ['GestureCommand'],
  'plugin/mrpp/commands/VoiceCommand.ts': ['VoiceCommand'],
  'plugin/mrpp/components/ActionComponent.ts': ['ActionComponent'],
  'plugin/mrpp/components/MovedComponent.ts': ['MovedComponent'],
  'plugin/mrpp/components/RotateComponent.ts': ['RotateComponent'],
  'plugin/mrpp/components/TooltipComponent.ts': ['TooltipComponent'],
  'plugin/mrpp/components/TriggerComponent.ts': ['TriggerComponent'],
  'plugin/patches/EditorPatches.ts': ['LANGUAGE_MAPPING', 'applyEditorPatches'],
  'plugin/patches/LoaderPatches.ts': ['applyLoaderPatches'],
  'plugin/patches/MenubarPatches.ts': ['applyMenubarPatches'],
  'plugin/patches/SidebarPatches.ts': [
    'applySidebarPatches', 'applySidebarPropertiesPatches', 'clearTabbedPanel',
    'getHierarchyLabel', 'hideAutosaveCheckbox', 'hideObjectPropertyRows',
    'injectOutlinerCustomIcons', 'injectOutlinerFilter', 'injectOutlinerSearchUI',
  ],
  'plugin/patches/UIThreePatches.ts': ['applyUIThreePatches'],
  'plugin/patches/ViewportPatches.ts': [
    'applyViewportPatches', 'computeEnhancedBoundingBox', 'computeMultiSelectionBoundingBox',
  ],
  'plugin/ui/menubar/Menubar.Command.ts': ['MenubarCommand'],
  'plugin/ui/menubar/Menubar.Component.ts': ['MenubarComponent'],
  'plugin/ui/menubar/Menubar.Entity.ts': ['MenubarEntity'],
  'plugin/ui/menubar/Menubar.Goto.ts': ['MenubarGoto'],
  'plugin/ui/menubar/Menubar.MrppAdd.ts': ['injectMrppAddMenu'],
  'plugin/ui/menubar/Menubar.MrppEdit.ts': ['injectMrppEditMenu'],
  'plugin/ui/menubar/Menubar.Replace.ts': ['MenubarReplace'],
  'plugin/ui/menubar/Menubar.Scene.ts': ['MenubarScene'],
  'plugin/ui/menubar/Menubar.Screenshot.ts': ['MenubarScreenshot'],
  'plugin/ui/sidebar/Sidebar.Animation.ts': ['SidebarAnimation'],
  'plugin/ui/sidebar/Sidebar.Blockly.ts': ['SidebarBlockly'],
  'plugin/ui/sidebar/Sidebar.Command.ts': ['SidebarCommand'],
  'plugin/ui/sidebar/Sidebar.Component.ts': ['SidebarComponent'],
  'plugin/ui/sidebar/Sidebar.Events.ts': ['SidebarEvents'],
  'plugin/ui/sidebar/Sidebar.Media.ts': ['SidebarMedia'],
  'plugin/ui/sidebar/Sidebar.Meta.ts': ['SidebarMeta'],
  'plugin/ui/sidebar/Sidebar.MultipleObjects.ts': ['SidebarMultipleObjects'],
  'plugin/ui/sidebar/Sidebar.ObjectExt.ts': ['getLocalizedObjectType', 'injectSidebarObjectExtensions', 'injectUserDataJsonViewer'],
  'plugin/ui/sidebar/Sidebar.Screenshot.ts': ['SidebarScreenshot'],
  'plugin/ui/sidebar/Sidebar.Text.ts': ['SidebarText'],
  'plugin/utils/DialogUtils.ts': ['DialogUtils'],
  'plugin/utils/GlobalShortcuts.ts': ['initializeGlobalShortcuts'],
  'plugin/utils/ScreenshotUtils.ts': ['ScreenshotUtils'],
  'plugin/utils/TextUtils.ts': ['createTextMesh'],
  'plugin/utils/UnsavedEntityGuard.ts': ['bindParentNavigationGuard', 'hasUnsavedEntityChanges', 'runEntitySaveGuard'],
  'plugin/utils/WebpUtils.ts': ['createMeshFromUrl', 'getResourceLayout'],
};

/**
 * Collect all .ts files from plugin/ directory using `find` command,
 * excluding .d.ts type declaration files.
 */
function collectTsFiles() {
  const output = execSync(
    `find "${PLUGIN_DIR}" -name "*.ts" ! -name "*.d.ts" -type f`
  ).toString().trim();
  if (!output) return [];
  return output.split('\n').sort();
}

/**
 * Extract export names from a TypeScript file's content.
 * Handles: export { A, B }, export function/class/const/let/var, export default.
 */
function extractExportNames(content) {
  const names = [];
  let m;

  // export { Name1, Name2, ... }
  const exportBraceRegex = /^export\s*\{([^}]+)\}/gm;
  while ((m = exportBraceRegex.exec(content)) !== null) {
    m[1].split(',').forEach((n) => {
      const parts = n.trim().split(/\s+as\s+/);
      const name = (parts.length > 1 ? parts[1] : parts[0]).trim();
      if (name) names.push(name);
    });
  }

  // export function name / export async function name
  const exportFuncRegex = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  while ((m = exportFuncRegex.exec(content)) !== null) names.push(m[1]);

  // export class name
  const exportClassRegex = /^export\s+class\s+(\w+)/gm;
  while ((m = exportClassRegex.exec(content)) !== null) names.push(m[1]);

  // export const/let/var name
  const exportVarRegex = /^export\s+(?:const|let|var)\s+(\w+)/gm;
  while ((m = exportVarRegex.exec(content)) !== null) names.push(m[1]);

  // export default
  if (/^export\s+default\b/m.test(content)) names.push('default');

  return names.sort();
}

// Collect data once before tests run
const tsFiles = collectTsFiles();
const baselineKeys = Object.keys(EXPORT_BASELINE);

describe('Feature: js-to-ts-migration, Property 4: 导出接口名称不变', () => {
  it('should have .ts files with baseline entries to test against', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
    expect(baselineKeys.length).toBeGreaterThan(0);
  });

  it('for any sampled .ts file, its export names match the baseline snapshot exactly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: baselineKeys.length - 1 }),
        (index) => {
          const relPath = baselineKeys[index];
          const absPath = path.join(PROJECT_ROOT, relPath);

          // File must exist
          if (!fs.existsSync(absPath)) {
            throw new Error(
              `Baseline file does not exist: ${relPath}`
            );
          }

          const content = fs.readFileSync(absPath, 'utf-8');
          const actualExports = extractExportNames(content);
          const expectedExports = EXPORT_BASELINE[relPath];

          // Compare sorted arrays
          const actualStr = JSON.stringify(actualExports);
          const expectedStr = JSON.stringify(expectedExports);

          if (actualStr !== expectedStr) {
            throw new Error(
              `Export names mismatch in ${relPath}:\n` +
              `  expected: ${expectedStr}\n` +
              `  actual:   ${actualStr}`
            );
          }

          return true;
        }
      ),
      {
        numRuns: Math.max(100, baselineKeys.length * 2),
        verbose: 1,
        endOnFailure: true,
      }
    );
  });
});
