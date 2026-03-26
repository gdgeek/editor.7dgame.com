import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Feature: mrpp-code-separation, Property 2: i18n string completeness
 *
 * For any MRPP string key and any supported language (en-us, zh-cn, ja-jp, zh-tw, th-th),
 * the refactored Strings module (which merges mrppStrings via spread operator) should
 * contain the key with the correct value matching the original mrppStrings source.
 *
 * **Validates: Requirements 8.3, 8.4, 13.6**
 */

// Tests run from three.js/editor/test/ — project root is 3 levels up
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');

const LANGUAGES = ['en-us', 'zh-cn', 'ja-jp', 'zh-tw', 'th-th'];

// r183 Strings.js uses different language codes than MrppStrings keys.
// Map MrppStrings key → r183 language code. Languages not in r183 are omitted.
const MRPP_LANG_TO_R183 = {
  'en-us': 'en',
  'zh-cn': 'zh',
  'ja-jp': 'ja',
  // 'zh-tw' and 'th-th' are not present in r183 Strings.js
};
// Only test languages that r183 actually supports
const TESTABLE_LANGUAGES = Object.keys(MRPP_LANG_TO_R183);

/**
 * Parse mrppStrings from the source file by evaluating the object literal.
 */
function loadMrppStrings() {
  const filePath = path.join(PROJECT_ROOT, 'plugin/i18n/MrppStrings.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  // Transform: `const mrppStrings = { ... }; export { mrppStrings };`
  // into a function that returns the object
  const cleaned = content
    .replace(/export\s*\{[^}]*\}\s*;?\s*$/, '')
    .replace(/^const\s+mrppStrings\s*=\s*/, 'return ');
  return new Function(cleaned)();
}

/**
 * Parse Strings.js and build the merged values map for each language.
 *
 * Strings.js imports mrppStrings and uses spread to merge them.
 * We simulate this by:
 * 1. Reading Strings.js source
 * 2. Replacing the import statement with an injected mrppStrings variable
 * 3. Replacing the export statement
 * 4. Evaluating the Strings function with a mock config for each language
 */
function loadMergedStrings(mrppStrings) {
  const filePath = path.join(PROJECT_ROOT, 'three.js/editor/js/Strings.js');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Remove the import line for mrppStrings (it's injected via closure)
  // Remove the export statement at the end
  const cleaned = content
    .replace(/^\s*import\s*\{[^}]*mrppStrings[^}]*\}[^;]*;/m, '')
    .replace(/export\s*\{[^}]*\}\s*;?\s*$/, '');

  // Build a function that takes mrppStrings and returns the Strings function
  // The cleaned code defines `function Strings(config) { ... }`
  // We wrap it so mrppStrings is available in scope
  const wrapper = new Function('mrppStrings', cleaned + '\nreturn Strings;');
  const StringsFn = wrapper(mrppStrings);

  const result = {};
  for (const mrppLang of TESTABLE_LANGUAGES) {
    const r183Lang = MRPP_LANG_TO_R183[mrppLang];
    const config = {
      getKey: (k) => (k === 'language' ? r183Lang : undefined),
    };
    result[mrppLang] = StringsFn(config);
  }
  return result;
}

describe('Property 2: i18n string completeness', () => {
  const mrppStrings = loadMrppStrings();
  const mergedStrings = loadMergedStrings(mrppStrings);

  // Build all (language, key, expectedValue) pairs — only for r183-supported languages
  const allPairs = [];
  for (const lang of TESTABLE_LANGUAGES) {
    const langStrings = mrppStrings[lang];
    if (!langStrings) continue;
    for (const key of Object.keys(langStrings)) {
      allPairs.push({ lang, key, expectedValue: langStrings[key] });
    }
  }

  it('should have loaded mrppStrings with all 5 languages', () => {
    expect(mrppStrings).toBeDefined();
    for (const lang of LANGUAGES) {
      expect(mrppStrings[lang], `mrppStrings missing language: ${lang}`).toBeDefined();
      expect(Object.keys(mrppStrings[lang]).length).toBeGreaterThan(0);
    }
  });

  it('should have (language, key) pairs to test', () => {
    expect(allPairs.length).toBeGreaterThan(0);
  });

  it('for any randomly sampled (key, language) from mrppStrings, the merged Strings output contains the correct value', () => {
    if (allPairs.length === 0) return;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allPairs.length - 1 }),
        (index) => {
          const { lang, key, expectedValue } = allPairs[index];
          const actualValue = mergedStrings[lang].getKey(key);

          if (actualValue !== expectedValue) {
            throw new Error(
              `Mismatch for key '${key}' in language '${lang}': ` +
              `expected '${expectedValue}', got '${actualValue}'`
            );
          }
          return true;
        }
      ),
      {
        numRuns: Math.max(100, Math.min(300, allPairs.length)),
        verbose: 1,
        endOnFailure: true,
      }
    );
  });

  it('exhaustive check: every mrppStrings key×language pair exists in merged Strings', () => {
    const mismatches = [];

    for (const { lang, key, expectedValue } of allPairs) {
      const actualValue = mergedStrings[lang].getKey(key);

      if (actualValue !== expectedValue) {
        mismatches.push(
          `[${lang}] '${key}': expected '${expectedValue}', got '${actualValue}'`
        );
      }
    }

    expect(
      mismatches,
      `i18n string mismatches found:\n${mismatches.join('\n')}`
    ).toHaveLength(0);
  });
});
