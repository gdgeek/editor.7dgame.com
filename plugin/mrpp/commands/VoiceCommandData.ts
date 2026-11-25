import type { MrppCommand } from '../../types/mrpp.js';
import { legacyVoiceCommands } from './LegacyVoiceCommands.js';

export interface VoiceText { phrase: string; pinyin: string }

// Reading an old command must not add fields or change its action/UUID.
export function readVoiceText(parameters: MrppCommand['parameters']): VoiceText {
  if (Object.hasOwn(parameters, 'phrase') || Object.hasOwn(parameters, 'pinyin')) {
    // Existing phrase+pinyin records take precedence over their old action key.
    // Presence (including an invalid/empty value) must not fall back to that key.
    const phrase = Object.hasOwn(parameters, 'phrase') ? parameters.phrase : parameters.action;
    return {
      phrase: typeof phrase === 'string' ? phrase : '',
      pinyin: typeof parameters.pinyin === 'string' ? parameters.pinyin : ''
    };
  }
  const legacy = parameters.action ?? parameters.voice;
  if (typeof legacy !== 'string') return { phrase: '', pinyin: '' };
  if (Object.hasOwn(legacyVoiceCommands, legacy)) return legacyVoiceCommands[legacy];
  return Object.values(legacyVoiceCommands).find(command => command.phrase === legacy)
    ?? { phrase: legacy, pinyin: '' };
}

export function normalizeVoiceText(phrase: string, pinyin: string): VoiceText {
  return { phrase: phrase.trim(), pinyin: pinyin.trim().toLowerCase().replace(/\s+/g, ' ') };
}

export function validateVoiceText(text: VoiceText, commands: MrppCommand[], current: MrppCommand): string | null {
  if (!text.phrase || !text.pinyin) return 'required';
  if (!/^\p{Script=Han}+$/u.test(text.phrase)) return 'invalid_phrase';
  if (!/^[a-z]+(?: [a-z]+)*$/.test(text.pinyin)) return 'invalid_pinyin';
  for (const command of commands) {
    if (command === current || command.type.toLowerCase() !== 'voice') continue;
    const other = readVoiceText(command.parameters);
    const normalized = normalizeVoiceText(other.phrase, other.pinyin);
    if (normalized.phrase === text.phrase) return 'duplicate_phrase';
    if (normalized.pinyin === text.pinyin) return 'duplicate_pinyin';
  }
  return null;
}
