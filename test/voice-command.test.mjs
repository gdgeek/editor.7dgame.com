import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { History } from '../three.js/editor/js/History.js';
import { VoiceCommand } from '../plugin-dist/mrpp/commands/VoiceCommand.js';
import { readVoiceText, normalizeVoiceText, validateVoiceText } from '../plugin-dist/mrpp/commands/VoiceCommandData.js';
import { legacyVoiceCommands } from '../plugin-dist/mrpp/commands/LegacyVoiceCommands.js';
import { SetCommandValueCommand } from '../plugin-dist/commands/SetCommandValueCommand.js';
import { MetaLoader } from '../plugin-dist/mrpp/MetaLoader.js';
import { MetaFactory } from '../plugin-dist/mrpp/MetaFactory.js';

function field(value = '') { return { dom: { dataset: {} }, setTextContent(next) { value = next; return this; }, setDisabled() { return this; }, setHidden() { return this; }, getValue() { return value; }, setValue(next) { value = next; return this; } }; }
function fixture(command = { type: 'Voice', parameters: { uuid: 'voice-id', action: 'nextStep', parameter: 'existing', extra: { preserved: true } } }) {
  const signals = new Proxy({}, { get(target, key) { return target[key] ??= { active: true, dispatch() {}, add() {} }; } });
  const scene = new THREE.Scene(), object = new THREE.Group();
  object.userData.type = 'polygen'; object.components = []; object.commands = [command]; scene.add(object);
  const editor = { scene, signals, config: { getKey: () => true }, strings: { getKey: key => key },
    objectByUuid(id) { return scene.getObjectByProperty('uuid', id); }, execute(cmd) { this.history.execute(cmd); } };
  editor.history = new History(editor);
  const handler = new VoiceCommand(editor, object, command);
  handler.phraseInput = field(); handler.pinyinInput = field(); handler.errorText = field(); handler.statusText = field(); handler.confirmButton = field(); handler.cancelButton = field(); handler.updateUI();
  return { editor, object, command, handler };
}
function serialized(object) { return JSON.parse(JSON.stringify(MetaLoader.prototype.writeEntity.call({ writeEntity: MetaLoader.prototype.writeEntity }, object))); }

test('all existing device commands are displayed without changing old JSON', () => {
  for (const [action, expected] of Object.entries(legacyVoiceCommands)) {
    const original = { type: 'Voice', parameters: { uuid: 'old-id', action, parameter: 'kept', custom: { old: true } } };
    const before = JSON.stringify(original);
    const { handler, editor, object } = fixture(original);
    assert.equal(handler.phraseInput.getValue(), expected.phrase);
    assert.equal(handler.pinyinInput.getValue(), expected.pinyin);
    handler.update(); // Clicking apply without editing must not migrate old scenes.
    assert.equal(JSON.stringify(original), before);
    assert.equal(editor.history.undos.length, 0);
    assert.deepEqual(serialized(object).children.commands, [JSON.parse(before)]);
  }
});

test('unknown legacy actions survive inspection and no-op apply exactly', () => {
  const original = { type: 'Voice', parameters: { uuid: 'unknown-id', action: 'future-command', parameter: null, extra: 3 } };
  const before = JSON.stringify(original);
  const { handler, editor } = fixture(original); handler.update();
  assert.equal(JSON.stringify(original), before); assert.equal(editor.history.undos.length, 0);
  assert.deepEqual(readVoiceText({ uuid: 'id', action: '__proto__' }), { phrase: '__proto__', pinyin: '' });
  assert.equal(handler.phraseInput.getValue(), 'future-command');
  assert.match(handler.statusText.getValue(), /configured$/);
  assert.match(handler.errorText.getValue(), /unknown_legacy$/);
});

test('legacy voice keys and Chinese values use the existing vocabulary without rewriting JSON', () => {
  for (const [key, expected] of Object.entries(legacyVoiceCommands)) {
    for (const voice of [key, expected.phrase]) {
      const original = { type: 'Voice', parameters: { uuid: 'old-voice-id', voice, parameter: 'kept' } };
      const before = JSON.stringify(original);
      const { handler, editor, object } = fixture(original);
      assert.equal(handler.phraseInput.getValue(), expected.phrase);
      assert.equal(handler.pinyinInput.getValue(), expected.pinyin);
      assert.match(handler.statusText.getValue(), /configured$/);
      assert.equal(handler.errorText.getValue(), '');
      handler.update();
      assert.equal(editor.history.undos.length, 0);
      assert.equal(JSON.stringify(original), before);
      assert.deepEqual(serialized(object).children.commands, [JSON.parse(before)]);
    }
  }
});

test('unknown legacy voice remains visible with an error instead of appearing newly created', () => {
  for (const voice of ['future-command', '尚未定义的口令']) {
    const original = { type: 'Voice', parameters: { uuid: 'unknown-voice', voice } };
    const { handler, editor, object } = fixture(original);
    assert.equal(handler.phraseInput.getValue(), voice);
    assert.equal(handler.pinyinInput.getValue(), '');
    assert.match(handler.statusText.getValue(), /configured$/);
    assert.match(handler.errorText.getValue(), /unknown_legacy$/);
    handler.update();
    assert.equal(editor.history.undos.length, 0);
    assert.deepEqual(serialized(object).children.commands, [original]);
  }
});

test('duplicate phrases and pronunciations include legacy voice keys and Chinese values', () => {
  for (const voice of ['scaleUp', '放大']) {
    const { handler, editor } = fixture(VoiceCommand.Create());
    const other = new THREE.Group();
    other.commands = [{ type: 'Voice', parameters: { uuid: 'legacy-duplicate', voice } }];
    editor.scene.add(other);
    handler.phraseInput.setValue('放大'); handler.pinyinInput.setValue('fang da'); handler.update();
    assert.match(handler.errorText.getValue(), /duplicate_phrase$/);
    handler.phraseInput.setValue('方大'); handler.update();
    assert.match(handler.errorText.getValue(), /duplicate_pinyin$/);
    assert.equal(editor.history.undos.length, 0);
  }
});

test('editing stores action and pinyin atomically while preserving UUID and other data', () => {
  const { handler, command, editor, object } = fixture();
  const before = structuredClone(command.parameters);
  handler.phraseInput.setValue(' 测试咖啡 '); handler.pinyinInput.setValue(' CE   SHI KA FEI '); handler.update();
  assert.deepEqual(command.parameters, { ...before, action: '测试咖啡', pinyin: 'ce shi ka fei' });
  assert.equal(editor.history.undos.length, 1);
  assert.match(handler.statusText.getValue(), /confirmed$/);
  assert.deepEqual(serialized(object).children.commands[0], command);
  const reloaded = fixture(JSON.parse(JSON.stringify(command)));
  assert.equal(reloaded.handler.phraseInput.getValue(), '测试咖啡');
  assert.equal(reloaded.handler.pinyinInput.getValue(), 'ce shi ka fei');
  editor.history.undo(); assert.deepEqual(command.parameters, before);
  assert.equal(Object.hasOwn(command.parameters, 'phrase'), false);
  editor.history.redo(); assert.equal(command.parameters.action, '测试咖啡');
});

test('restored history edits the live command, rather than the serialized copy', () => {
  const { handler, command, editor, object } = fixture();
  const before = structuredClone(command.parameters);
  handler.phraseInput.setValue('测试兔子'); handler.pinyinInput.setValue('ce shi tu zi'); handler.update();
  const json = JSON.parse(JSON.stringify(editor.history.undos[0].toJSON()));
  const restored = new SetCommandValueCommand(editor, object, command, 'parameters', {});
  restored.fromJSON(json);
  assert.equal(restored.command, command);
  restored.undo(); assert.deepEqual(command.parameters, before);
  restored.execute(); assert.equal(command.parameters.action, '测试兔子');
});

test('invalid or incomplete edits leave the old stored pair untouched', () => {
  for (const [phrase, pinyin, error] of [
    ['测试咖啡', '', 'required'], ['', 'ce shi', 'required'], ['test', 'test', 'invalid_phrase'],
    ['测试！', 'ce shi', 'invalid_phrase'], ['测试', 'cè shì', 'invalid_pinyin'], ['测试', 'ce4 shi4', 'invalid_pinyin']
  ]) {
    const { handler, command, editor } = fixture(); const before = JSON.stringify(command);
    handler.phraseInput.setValue(phrase); handler.pinyinInput.setValue(pinyin); handler.update();
    assert.equal(JSON.stringify(command), before); assert.equal(editor.history.undos.length, 0);
    assert.match(handler.errorText.getValue(), new RegExp(error + '$'));
    assert.doesNotMatch(handler.statusText.getValue(), /confirmed$/);
  }
});

test('duplicates and homophones include old vocabulary on other objects', () => {
  const { handler, command, editor } = fixture(VoiceCommand.Create());
  const other = new THREE.Group(); other.commands = [{ type: 'Voice', parameters: { uuid: 'existing', action: 'nextStep' } }]; editor.scene.add(other);
  handler.phraseInput.setValue('下一步'); handler.pinyinInput.setValue('xia yi bu'); handler.update();
  assert.match(handler.errorText.getValue(), /duplicate_phrase$/); assert.equal(command.parameters.action, ''); assert.equal(Object.hasOwn(command.parameters, 'phrase'), false);
  handler.phraseInput.setValue('夏一步'); handler.update();
  assert.match(handler.errorText.getValue(), /duplicate_pinyin$/); assert.equal(editor.history.undos.length, 0);
});

test('new commands have independent IDs and custom text takes precedence over legacy display', () => {
  const first = VoiceCommand.Create(), second = VoiceCommand.Create();
  assert.notEqual(first.parameters.uuid, second.parameters.uuid);
  assert.deepEqual(readVoiceText({ uuid: 'one', action: 'nextStep', phrase: '继续', pinyin: 'ji xu' }), { phrase: '继续', pinyin: 'ji xu' });
  const { handler, command } = fixture(first); handler.phraseInput.setValue('继续'); handler.pinyinInput.setValue('ji xu'); handler.update();
  assert.equal(command.parameters.action, '继续'); assert.equal(Object.hasOwn(command.parameters, 'phrase'), false);
  assert.equal(validateVoiceText(normalizeVoiceText('继续', 'ji xu'), [command, { type: 'Gesture', parameters: { uuid: 'g', action: '', phrase: '继续', pinyin: 'ji xu' } }], command), null);
});

test('applying an empty new command reports missing text without writing anything', () => {
  const { handler, command, editor } = fixture(VoiceCommand.Create());
  const before = JSON.stringify(command); handler.update();
  assert.match(handler.errorText.getValue(), /required$/);
  assert.equal(JSON.stringify(command), before); assert.equal(editor.history.undos.length, 0);
});


test('repeated apply reports no change without adding history, and undo clears success', () => {
  const { handler, command, editor } = fixture(VoiceCommand.Create());
  handler.phraseInput.setValue('打开模型'); handler.pinyinInput.setValue('da kai mo xing'); handler.update();
  assert.match(handler.statusText.getValue(), /confirmed$/);
  const applied = JSON.stringify(command);
  handler.update();
  assert.match(handler.statusText.getValue(), /configured$/);
  assert.equal(editor.history.undos.length, 1);
  assert.equal(JSON.stringify(command), applied);
  editor.history.undo(); handler.updateUI();
  assert.doesNotMatch(handler.statusText.getValue(), /confirmed$/);
});

for (const [description, parameters, expected] of [
  ['canonical', { action: '测试一下吧', pinyin: 'ce shi yi xia ba' }, { phrase: '测试一下吧', pinyin: 'ce shi yi xia ba' }],
  ['saved phrase pair', { action: 'nextStep', phrase: '继续', pinyin: 'ji xu' }, { phrase: '继续', pinyin: 'ji xu' }],
  ['legacy key', { action: 'nextStep' }, { phrase: '下一步', pinyin: 'xia yi bu' }],
  ['legacy voice key', { voice: 'scaleUp' }, { phrase: '放大', pinyin: 'fang da' }],
  ['legacy voice Chinese', { voice: '放大' }, { phrase: '放大', pinyin: 'fang da' }],
  ['legacy action Chinese', { action: '缩小' }, { phrase: '缩小', pinyin: 'suo xiao' }],
  ['action wins over voice', { action: 'scaleDown', voice: 'scaleUp' }, { phrase: '缩小', pinyin: 'suo xiao' }],
  ['null action uses voice', { action: null, voice: 'scaleUp' }, { phrase: '放大', pinyin: 'fang da' }],
  ['empty action does not use voice', { action: '', voice: 'scaleUp' }, { phrase: '', pinyin: '' }],
  ['unknown action does not use known voice', { action: 'unknown', voice: 'scaleUp' }, { phrase: 'unknown', pinyin: '' }],
  ['phrase wins over voice', { voice: 'scaleUp', phrase: '继续', pinyin: 'ji xu' }, { phrase: '继续', pinyin: 'ji xu' }],
  ['empty phrase does not use voice', { voice: 'scaleUp', phrase: '', pinyin: 'fang da' }, { phrase: '', pinyin: 'fang da' }],
  ['null phrase does not use voice', { voice: 'scaleUp', phrase: null }, { phrase: '', pinyin: '' }],
  ['empty pinyin does not use voice', { voice: 'scaleUp', pinyin: '' }, { phrase: '', pinyin: '' }],
  ['empty phrase wins', { action: 'nextStep', phrase: '', pinyin: 'xia yi bu' }, { phrase: '', pinyin: 'xia yi bu' }],
  ['null phrase wins', { action: '继续', phrase: null, pinyin: 'ji xu' }, { phrase: '', pinyin: 'ji xu' }],
  ['invalid phrase wins', { action: 'nextStep', phrase: 42, pinyin: 'xia yi bu' }, { phrase: '', pinyin: 'xia yi bu' }],
  ['missing pinyin', { action: 'nextStep', phrase: '继续' }, { phrase: '继续', pinyin: '' }],
  ['null pinyin is custom', { action: 'nextStep', pinyin: null }, { phrase: 'nextStep', pinyin: '' }],
  ['empty pinyin is custom', { action: 'nextStep', pinyin: '' }, { phrase: 'nextStep', pinyin: '' }],
  ['invalid canonical action', { action: 42, pinyin: 'ji xu' }, { phrase: '', pinyin: 'ji xu' }]
]) {
  test(`reading ${description} preserves the exact source without legacy fallback`, () => {
    const command = { type: 'Voice', parameters: { uuid: 'format-id', parameter: 'kept', ...parameters } };
    const before = JSON.stringify(command);
    const { handler, object, editor } = fixture(command);
    assert.deepEqual(readVoiceText(command.parameters), expected);
    assert.equal(handler.phraseInput.getValue(), expected.phrase);
    assert.equal(handler.pinyinInput.getValue(), expected.pinyin);
    handler.update();
    assert.equal(editor.history.undos.length, 0, 'An unchanged or invalid custom record must not be rewritten');
    assert.equal(JSON.stringify(command), before);
    assert.deepEqual(serialized(object).children.commands, [JSON.parse(before)]);
  });
}

for (const initial of [
  { uuid: 'stable-id', action: 'nextStep', parameter: 'kept', extra: 7 },
  { uuid: 'stable-id', voice: 'scaleUp', parameter: 'kept', extra: 7 },
  { uuid: 'stable-id', voice: '放大', parameter: 'kept', extra: 7 },
  { uuid: 'stable-id', voice: 'scaleUp', action: 'nextStep', phrase: '继续', pinyin: 'ji xu', parameter: 'kept', extra: 7 },
  { uuid: 'stable-id', action: 'nextStep', phrase: '继续', pinyin: 'ji xu', parameter: 'kept', extra: 7 },
  { uuid: 'stable-id', action: '继续', pinyin: 'ji xu', parameter: 'kept', extra: 7 }
]) {
  test(`confirmed ${Object.hasOwn(initial, 'voice') ? 'voice ' + initial.voice : ''} ${Object.hasOwn(initial, 'phrase') ? 'saved phrase' : Object.hasOwn(initial, 'pinyin') ? 'canonical' : 'legacy'} command survives actual save and entity reopen`, async () => {
    const { editor, object, handler, command } = fixture({ type: 'Voice', parameters: structuredClone(initial) });
    object.userData.type = 'anchor'; // Real MetaFactory path with no remote model assets.
    const unrelated = { type: 'Action', parameters: { uuid: 'action-id', action: 'scaleUp', parameter: '2', phrase: 'unrelated' } };
    object.commands.push(structuredClone(unrelated));
    const loader = Object.assign(Object.create(MetaLoader.prototype), { editor, isLoading: false });
    loader.json = JSON.stringify({ meta: await loader.getMeta(), events: editor.scene.events });
    const messages = [];
    editor.signals.messageSend.dispatch = message => messages.push(structuredClone(message));
    await loader.save();
    assert.deepEqual(messages.pop(), { action: 'save-meta-none' });
    assert.deepEqual(command.parameters, initial, 'Opening and saving an unedited entity must not migrate it');

    handler.phraseInput.setValue(' 测试一下吧 ');
    handler.pinyinInput.setValue(' CE   SHI YI XIA BA ');
    handler.update();
    await loader.save();
    const saved = messages.pop();
    assert.equal(saved.action, 'save-meta');
    const entityJson = saved.data.meta.children.entities[0];
    assert.deepEqual(entityJson.children.commands[0].parameters, {
      uuid: 'stable-id', action: '测试一下吧', parameter: 'kept', extra: 7, pinyin: 'ce shi yi xia ba'
    });
    assert.deepEqual(entityJson.children.commands[1], unrelated, 'Voice confirmation must leave Action commands untouched');
    const reopened = await Object.create(MetaFactory.prototype).building(JSON.parse(JSON.stringify(entityJson)), new Map());
    assert.deepEqual(reopened.commands, entityJson.children.commands);
    const view = fixture(reopened.commands[0]);
    assert.equal(view.handler.phraseInput.getValue(), '测试一下吧');
    assert.equal(view.handler.pinyinInput.getValue(), 'ce shi yi xia ba');
    assert.equal(view.command.parameters.uuid, initial.uuid);
    handler.update();
    await loader.save();
    assert.deepEqual(messages.pop(), { action: 'save-meta-none' });
    editor.history.undo();
    assert.deepEqual(command.parameters, initial, 'Undo restores the original format exactly');
    editor.history.redo();
    assert.equal(Object.hasOwn(command.parameters, 'phrase'), false);
    assert.equal(Object.hasOwn(command.parameters, 'voice'), false);
  });
}
