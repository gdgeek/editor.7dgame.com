import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

function extractExportNames(content) {
  const names = [];
  const braceRe = /^export\s*\{([^}]+)\}/gm;
  let m;
  while ((m = braceRe.exec(content)) !== null) {
    m[1].split(',').forEach(part => {
      const alias = part.trim().split(/\s+as\s+/).pop().trim();
      if (alias) names.push(alias);
    });
  }
  const declRe = /^export\s+(?:async\s+)?(?:function\*?\s+|class\s+|(?:const|let|var)\s+)(\w+)/gm;
  while ((m = declRe.exec(content)) !== null) names.push(m[1]);
  return [...new Set(names)].sort();
}

function extractLanguageMappingBlock(content) {
  // Handle TypeScript type annotation: LANGUAGE_MAPPING: Record<...> = { ... }
  // or plain JS: LANGUAGE_MAPPING = { ... }
  const blockMatch = content.match(/LANGUAGE_MAPPING[^=]*=\s*\{([^}]+)\}/s);
  if (!blockMatch) return null;
  return blockMatch[1];
}

function extractLanguageMappingKeys(content) {
  const block = extractLanguageMappingBlock(content);
  if (!block) return [];
  const keyRe = /['"]([^'"]+)['"]\s*:/g;
  const keys = [];
  let m;
  while ((m = keyRe.exec(block)) !== null) keys.push(m[1]);
  return keys;
}

function extractLanguageMappingValues(content) {
  const block = extractLanguageMappingBlock(content);
  if (!block) return [];
  // Match: 'key': 'value' or "key": "value"
  const pairRe = /['"][^'"]+['"]\s*:\s*['"]([^'"]+)['"]/g;
  const values = [];
  let m;
  while ((m = pairRe.exec(block)) !== null) values.push(m[1]);
  return values;
}

function extractCustomSignalNames(content) {
  // Scan for editor.signals.XXX = new Signal()
  const signalRe = /editor\.signals\.(\w+)\s*=\s*new\s+Signal/g;
  const names = [];
  let m;
  while ((m = signalRe.exec(content)) !== null) names.push(m[1]);
  return [...new Set(names)];
}

function extractStringsLanguageCodes(content) {
  // Strings.js defines languages as top-level keys of the `values` object:
  //   fa: { ... }, en: { ... }, zh: { ... }, etc.
  // Match lines like: \t\tfa: { or \t\ten: {
  const codes = [];
  // Use flexible whitespace to handle any indentation
  const re = /^[ \t]+([a-z]{2}):\s*\{/gm;
  let m;
  while ((m = re.exec(content)) !== null) codes.push(m[1]);
  return [...new Set(codes)];
}

describe('patch-language-signals: LANGUAGE_MAPPING and custom signals', () => {

  // Sub-task 2.2: Unit test — LANGUAGE_MAPPING required source language codes
  it('LANGUAGE_MAPPING contains required source language codes', () => {
    const content = readSource('plugin/patches/EditorPatches.ts');
    expect(content, 'EditorPatches.ts not found').not.toBeNull();
    const keys = extractLanguageMappingKeys(content);
    const required = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'fr-FR'];
    for (const k of required) {
      expect(keys, `LANGUAGE_MAPPING missing required key: ${k}`).toContain(k);
    }
  });

  // Sub-task 2.3: Unit test — custom signals set non-empty and contains required signals
  it('custom signals set is non-empty and contains required signals', () => {
    const content = readSource('plugin/patches/EditorPatches.ts');
    expect(content).not.toBeNull();
    const signals = extractCustomSignalNames(content);
    expect(signals.length, 'No custom signals found in registerCustomSignals').toBeGreaterThan(0);
    const required = ['upload', 'release', 'objectsChanged', 'componentAdded', 'componentChanged', 'componentRemoved'];
    for (const s of required) {
      expect(signals, `Custom signal missing: ${s}`).toContain(s);
    }
  });

  // Sub-task 2.4: Unit test — savingStarted/savingFinished conditional guard
  it('savingStarted and savingFinished use conditional guard if (!editor.signals.XXX)', () => {
    const content = readSource('plugin/patches/EditorPatches.ts');
    expect(content).not.toBeNull();
    expect(content, 'Missing conditional guard for savingStarted').toMatch(/if\s*\(\s*!\s*editor\.signals\.savingStarted\s*\)/);
    expect(content, 'Missing conditional guard for savingFinished').toMatch(/if\s*\(\s*!\s*editor\.signals\.savingFinished\s*\)/);
  });

  // Sub-task 2.5: Property P5 — LANGUAGE_MAPPING target value completeness
  // Feature: patch-injection-tests, Property 5: LANGUAGE_MAPPING 目标值完整性
  it('P5: every LANGUAGE_MAPPING target value appears in Strings.js language codes', () => {
    const editorContent = readSource('plugin/patches/EditorPatches.ts');
    const stringsContent = readSource('three.js/editor/js/Strings.js');
    expect(editorContent).not.toBeNull();
    expect(stringsContent).not.toBeNull();

    const values = extractLanguageMappingValues(editorContent);
    const langCodes = extractStringsLanguageCodes(stringsContent);

    expect(values.length, 'No LANGUAGE_MAPPING values found').toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: values.length - 1 }),
        (idx) => {
          const val = values[idx];
          expect(val, `LANGUAGE_MAPPING value must be non-empty string`).toBeTruthy();
          expect(langCodes, `LANGUAGE_MAPPING target '${val}' not found in Strings.js language codes`).toContain(val);
        }
      ),
      { numRuns: Math.max(100, values.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

  // Sub-task 2.6: Property P6 — signal name format invariant
  // Feature: patch-injection-tests, Property 6: 信号名称格式不变量
  it('P6: every custom signal name is a valid JavaScript identifier', () => {
    const content = readSource('plugin/patches/EditorPatches.ts');
    expect(content).not.toBeNull();
    const signals = extractCustomSignalNames(content);
    expect(signals.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: signals.length - 1 }),
        (idx) => {
          const name = signals[idx];
          expect(name, `Signal name '${name}' is not a valid JS identifier`).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/);
        }
      ),
      { numRuns: Math.max(100, signals.length * 2), endOnFailure: true, verbose: 1 }
    );
  });

});
