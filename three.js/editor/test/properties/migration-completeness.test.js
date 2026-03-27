import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: js-to-ts-migration, Property 1: 所有迁移目标文件均为 .ts
 *
 * For any file in the migration target list (~64 files), the file should exist
 * with a .ts extension in the plugin/ directory, and the corresponding .js
 * original should no longer exist.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4**
 */

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

// Complete list of migration target file paths (relative to project root, without extension)
const MIGRATION_TARGETS = [
  // plugin/utils/ (6 files)
  'plugin/utils/DialogUtils',
  'plugin/utils/TextUtils',
  'plugin/utils/WebpUtils',
  'plugin/utils/ScreenshotUtils',
  'plugin/utils/GlobalShortcuts',
  'plugin/utils/UnsavedEntityGuard',

  // plugin/mrpp/components/ (5 files)
  'plugin/mrpp/components/ActionComponent',
  'plugin/mrpp/components/MovedComponent',
  'plugin/mrpp/components/RotateComponent',
  'plugin/mrpp/components/TooltipComponent',
  'plugin/mrpp/components/TriggerComponent',

  // plugin/mrpp/commands/ (2 files)
  'plugin/mrpp/commands/GestureCommand',
  'plugin/mrpp/commands/VoiceCommand',

  // plugin/mrpp/ containers, factories, builder (7 files)
  'plugin/mrpp/ComponentContainer',
  'plugin/mrpp/CommandContainer',
  'plugin/mrpp/EventContainer',
  'plugin/mrpp/Factory',
  'plugin/mrpp/MetaFactory',
  'plugin/mrpp/VerseFactory',
  'plugin/mrpp/Builder',

  // plugin/commands/ (11 files)
  'plugin/commands/AddCommandCommand',
  'plugin/commands/AddComponentCommand',
  'plugin/commands/AddEventCommand',
  'plugin/commands/RemoveCommandCommand',
  'plugin/commands/RemoveComponentCommand',
  'plugin/commands/RemoveEventCommand',
  'plugin/commands/SetCommandValueCommand',
  'plugin/commands/SetComponentValueCommand',
  'plugin/commands/SetEventValueCommand',
  'plugin/commands/MoveMultipleObjectsCommand',
  'plugin/commands/MultiTransformCommand',

  // plugin/access/ (1 file)
  'plugin/access/Access',

  // plugin/i18n/ (1 file)
  'plugin/i18n/MrppStrings',

  // plugin/mrpp/ loaders (3 files)
  'plugin/mrpp/MetaLoader',
  'plugin/mrpp/VerseLoader',
  'plugin/mrpp/EditorLoader',

  // plugin/patches/ (6 files)
  'plugin/patches/EditorPatches',
  'plugin/patches/LoaderPatches',
  'plugin/patches/MenubarPatches',
  'plugin/patches/SidebarPatches',
  'plugin/patches/UIThreePatches',
  'plugin/patches/ViewportPatches',

  // plugin/ui/sidebar/ (11 files)
  'plugin/ui/sidebar/Sidebar.Animation',
  'plugin/ui/sidebar/Sidebar.Blockly',
  'plugin/ui/sidebar/Sidebar.Command',
  'plugin/ui/sidebar/Sidebar.Component',
  'plugin/ui/sidebar/Sidebar.Events',
  'plugin/ui/sidebar/Sidebar.Media',
  'plugin/ui/sidebar/Sidebar.Meta',
  'plugin/ui/sidebar/Sidebar.MultipleObjects',
  'plugin/ui/sidebar/Sidebar.ObjectExt',
  'plugin/ui/sidebar/Sidebar.Screenshot',
  'plugin/ui/sidebar/Sidebar.Text',

  // plugin/ui/menubar/ (9 files)
  'plugin/ui/menubar/Menubar.Command',
  'plugin/ui/menubar/Menubar.Component',
  'plugin/ui/menubar/Menubar.Entity',
  'plugin/ui/menubar/Menubar.Goto',
  'plugin/ui/menubar/Menubar.MrppAdd',
  'plugin/ui/menubar/Menubar.MrppEdit',
  'plugin/ui/menubar/Menubar.Replace',
  'plugin/ui/menubar/Menubar.Scene',
  'plugin/ui/menubar/Menubar.Screenshot',

  // plugin/bootstrap/ (2 files)
  'plugin/bootstrap/meta-bootstrap',
  'plugin/bootstrap/verse-bootstrap',
];

describe('Feature: js-to-ts-migration, Property 1: 所有迁移目标文件均为 .ts', () => {
  it('should have a non-empty migration target list', () => {
    expect(MIGRATION_TARGETS.length).toBeGreaterThan(0);
  });

  it('for any sampled migration target, the .ts file exists and the .js file does not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MIGRATION_TARGETS.length - 1 }),
        (index) => {
          const target = MIGRATION_TARGETS[index];
          const tsPath = path.join(PROJECT_ROOT, `${target}.ts`);
          const jsPath = path.join(PROJECT_ROOT, `${target}.js`);

          const tsExists = fs.existsSync(tsPath);
          const jsExists = fs.existsSync(jsPath);

          if (!tsExists) {
            throw new Error(
              `Migration target missing .ts file: ${target}.ts does not exist`
            );
          }
          if (jsExists) {
            throw new Error(
              `Migration target still has .js file: ${target}.js should have been removed`
            );
          }
          return true;
        }
      ),
      {
        numRuns: 100,
        verbose: 1,
        endOnFailure: true,
      }
    );
  });
});
