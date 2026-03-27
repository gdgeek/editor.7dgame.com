import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: js-to-ts-migration-prep — TypeScript 迁移状态验证
 *
 * このテストファイルは JS → TS 迁移の前後で異なる役割を果たします：
 *
 * 【迁移前（現在）】
 *   "迁移前状态" テストが有効：plugin/ に .ts ファイルが存在しないことを検証。
 *   "迁移后状态" テストはスキップ。
 *
 * 【迁移后】
 *   "迁移前状态" テストを削除またはスキップし、
 *   "迁移后状态" テストの describe.skip を describe に変更して有効化。
 *   plugin/ に .ts ファイルが存在することを検証。
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const PLUGIN_DIR = path.join(PROJECT_ROOT, 'plugin');

function collectAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...collectAllFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 迁移前状态：plugin/ 中不存在 .ts 文件（准备阶段の基線検証）
// ---------------------------------------------------------------------------
describe('迁移前状态: plugin/ 中不存在 TypeScript 文件', () => {
  const allFiles = collectAllFiles(PLUGIN_DIR);

  it('should have found files in plugin/', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('no file in plugin/ has .ts or .tsx extension', () => {
    if (allFiles.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allFiles.length - 1 }),
        (index) => {
          const file = allFiles[index];
          const ext = path.extname(file).toLowerCase();
          if (ext === '.ts' || ext === '.tsx') {
            throw new Error(
              `TypeScript file found: ${path.relative(PROJECT_ROOT, file)}`
            );
          }
          return true;
        }
      ),
      { numRuns: Math.min(100, allFiles.length), verbose: 1 }
    );
  });

  it('exhaustive: no .ts or .tsx files exist in plugin/', () => {
    const tsFiles = allFiles
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.ts' || ext === '.tsx';
      })
      .map(f => path.relative(PROJECT_ROOT, f));

    expect(
      tsFiles,
      `TypeScript files found:\n${tsFiles.join('\n')}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 迁移后状态：plugin/ 中存在 .ts 文件（迁移完了後に有効化）
// 迁移完成后，将下面的 describe.skip 改为 describe 以启用此测试。
// ---------------------------------------------------------------------------
describe.skip('迁移后状态: plugin/ 中存在 TypeScript 文件', () => {
  const allFiles = collectAllFiles(PLUGIN_DIR);

  it('should have found files in plugin/', () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('at least one .ts file exists in plugin/', () => {
    const tsFiles = allFiles.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ext === '.ts' || ext === '.tsx';
    });

    expect(
      tsFiles.length,
      'Expected at least one TypeScript file in plugin/ after migration'
    ).toBeGreaterThan(0);
  });
});
