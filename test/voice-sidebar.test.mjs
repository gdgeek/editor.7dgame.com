import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { History } from '../three.js/editor/js/History.js';
import { SidebarCommand } from '../plugin-dist/ui/sidebar/Sidebar.Command.js';
import { SetCommandValueCommand } from '../plugin-dist/commands/SetCommandValueCommand.js';
import { MetaFactory } from '../plugin-dist/mrpp/MetaFactory.js';
import { MetaLoader } from '../plugin-dist/mrpp/MetaLoader.js';

// Reuse the DOM dependency already installed in this superproject's web app.
// After the editor build, run from the editor root:
// node --test --import ./test/register-three.mjs ./test/voice-sidebar.test.mjs
const requireWeb = createRequire(new URL('../../../web/package.json', import.meta.url));
const { JSDOM } = requireWeb('jsdom');
const signalSource = readFileSync(new URL('../three.js/editor/js/libs/signals.min.js', import.meta.url), 'utf8');
const labels = {
  'sidebar/command/select/button': '添加指令',
  'sidebar/command/select/voice': '语音指令',
  'sidebar/command/select/gesture': '手势指令',
  'sidebar/command/voice/phrase': '中文口令',
  'sidebar/command/voice/pinyin': '拼音',
  'sidebar/command/voice/phrase_placeholder': '请输入中文口令',
  'sidebar/command/voice/pinyin_placeholder': '例如：da kai mo xing',
  'sidebar/command/voice/confirm': '确认修改',
  'sidebar/command/voice/create': '完成设置',
  'sidebar/command/remove': '删除指令',
  'menubar/command/success': '已添加{0}',
};

function voice(uuid, phrase, pinyin) {
  return { type: 'Voice', parameters: { uuid, action: 'scaleUp', parameter: 'kept', phrase, pinyin } };
}

function entity(name, commands) {
  const object = new THREE.Group();
  object.type = 'Entity';
  object.name = name;
  object.commands = commands;
  return object;
}

function fixture(t) {
  const dom = new JSDOM('<!doctype html><body></body>', {
    url: 'http://localhost:3002/test/voice-sidebar', runScripts: 'outside-only',
  });
  dom.window.eval(signalSource);
  const errors = [];
  dom.window.addEventListener('error', event => {
    errors.push(event.message);
    event.preventDefault();
  });
  const globals = new Map();
  for (const name of ['window', 'document', 'Event', 'Element', 'HTMLElement']) {
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value: name === 'window' ? dom.window : dom.window[name], configurable: true, writable: true });
  }
  t.after(() => {
    dom.window.close();
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    assert.deepEqual(errors, [], 'DOM event handlers must not throw silently');
  });

  const signals = new Proxy({}, {
    get(target, key) { return target[key] ??= new dom.window.signals.Signal(); },
  });
  const a = voice('voice-a', '打开灯光', 'da kai deng guang');
  const b = voice('voice-b', '关闭窗帘', 'guan bi chuang lian');
  const object = entity('对象一', [a, b]);
  const notifications = [];
  const editor = {
    type: 'meta', scene: new THREE.Scene(), signals, selected: object, selectedObjects: [object],
    strings: { getKey: key => labels[key] ?? key },
    config: { getKey: () => true },
    getSelectedObjects() { return this.selectedObjects.slice(); },
    objectByUuid(uuid) { return this.scene.getObjectByProperty('uuid', uuid); },
    execute(command) { this.history.execute(command); },
    showNotification(message, isError) { notifications.push({ message, isError }); },
    showConfirmation(_message, confirm) { confirm(); },
  };
  editor.scene.add(object);
  editor.history = new History(editor);
  const panel = SidebarCommand(editor);
  dom.window.document.body.appendChild(panel.container.dom);
  // The production properties sidebar calls this same update on selection.
  signals.objectSelected.add(panel.update);
  const select = objects => {
    editor.selectedObjects = objects;
    editor.selected = objects.at(-1) ?? null;
    signals.objectSelected.dispatch(editor.selected);
  };
  select([object]);

  const root = panel.container.dom;
  const buttons = text => [...root.querySelectorAll('button')].filter(button => button.textContent === text);
  const fields = index => ({
    phrase: root.querySelectorAll('input[aria-label="中文口令"]')[index],
    pinyin: root.querySelectorAll('input[aria-label="拼音"]')[index],
    apply: root.querySelectorAll('.mrpp-voice-confirm')[index],
  });
  const fill = (input, value) => {
    assert.ok(input, 'The actual sidebar input must exist');
    input.focus();
    input.value = value;
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    input.blur();
  };
  const fillVoice = (index, phrase, pinyin) => {
    const controls = fields(index);
    fill(controls.phrase, phrase);
    fill(controls.pinyin, pinyin);
    return controls;
  };
  const add = (type = 'Voice') => {
    root.querySelector('select').value = type;
    buttons('添加指令')[0].click();
    assert.deepEqual(errors, []);
  };
  return { editor, object, a, b, root, fields, fillVoice, buttons, add, select, notifications, errors };
}

test('real sidebar adds Voice and Gesture without the removed UISelect method', t => {
  const f = fixture(t);
  f.add('Voice');
  assert.equal(f.object.commands.length, 3);
  assert.equal(f.object.commands[2].type, 'Voice');
  assert.equal(f.fields(2).phrase.value, '');
  assert.equal(f.fields(2).phrase.placeholder, '请输入中文口令');
  assert.equal(f.fields(2).pinyin.value, '');
  assert.equal(f.fields(2).pinyin.placeholder, '例如：da kai mo xing');
  assert.equal(f.notifications.at(-1).message, '已添加语音指令');
  f.add('Gesture');
  assert.equal(f.object.commands.length, 4);
  assert.equal(f.object.commands[3].type, 'Gesture');
  assert.equal(f.notifications.at(-1).message, '已添加手势指令');
  assert.equal(f.editor.history.undos.length, 2);
});

for (const voice of ['scaleUp', '放大']) {
  test(`actual entity load and sidebar preserve legacy voice ${voice} on save, edit and undo`, async t => {
    const f = fixture(t);
    const original = {
      type: 'entity',
      parameters: {
        uuid: 'legacy-entity', name: '旧实体', active: true,
        transform: { position: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      },
      children: { entities: [], components: [], commands: [
        { type: 'Voice', parameters: { uuid: 'old-command', voice, parameter: 'kept', extra: 7 } },
      ] },
    };
    const loaded = await Object.create(MetaFactory.prototype).building(structuredClone(original), new Map());
    f.editor.scene.clear();
    f.editor.scene.add(loaded);
    f.select([loaded]);
    assert.equal(f.fields(0).phrase.value, '放大');
    assert.equal(f.fields(0).pinyin.value, 'fang da');
    assert.match(f.root.querySelector('[role="status"]').textContent, /configured$/);
    assert.equal(f.root.querySelector('[role="alert"]').textContent, '');
    assert.equal(f.fields(0).apply.disabled, true);

    const loader = Object.assign(Object.create(MetaLoader.prototype), { editor: f.editor, isLoading: false });
    const meta = await loader.getMeta();
    assert.deepEqual(meta.children.entities[0], original);
    loader.json = JSON.stringify({ meta, events: f.editor.scene.events });
    const messages = [];
    f.editor.signals.messageSend.add(message => messages.push(structuredClone(message)));
    await loader.save();
    assert.deepEqual(messages.pop(), { action: 'save-meta-none' });
    loaded.name = '仅改实体名称';
    await loader.save();
    const saved = messages.pop();
    assert.equal(saved.action, 'save-meta');
    assert.deepEqual(saved.data.meta.children.entities[0].children.commands, original.children.commands,
      'Saving another property must preserve the original voice-only JSON exactly');

    f.fillVoice(0, '测试咖啡', ' CE SHI KA FEI ').apply.click();
    assert.deepEqual(loaded.commands[0].parameters, {
      uuid: 'old-command', action: '测试咖啡', pinyin: 'ce shi ka fei', parameter: 'kept', extra: 7,
    });
    f.editor.history.undo();
    assert.deepEqual(loaded.commands, original.children.commands);
    assert.equal(f.fields(0).phrase.value, '放大');
    assert.equal(f.fields(0).pinyin.value, 'fang da');
    f.editor.history.redo();
    assert.equal(loaded.commands[0].parameters.action, '测试咖啡');
    assert.equal(Object.hasOwn(loaded.commands[0].parameters, 'voice'), false);
  });
}

test('applying A preserves B DOM and draft through real signals and undo/redo', t => {
  const f = fixture(t);
  const originalA = structuredClone(f.a.parameters);
  const originalB = structuredClone(f.b.parameters);
  const a = f.fillVoice(0, '测试咖啡', ' CE  SHI KA FEI ');
  const b = f.fillVoice(1, '测试白马', 'ce shi bai ma');
  assert.deepEqual(f.a.parameters, originalA, 'Typing, change, and blur must not apply the pair');
  a.apply.click();
  assert.deepEqual(f.errors, []);
  const { phrase: removedPhrase, ...remainingA } = originalA;
  assert.deepEqual(f.a.parameters, { ...remainingA, action: '测试咖啡', pinyin: 'ce shi ka fei' });
  assert.equal(Object.hasOwn(f.a.parameters, 'phrase'), false);
  assert.deepEqual(f.b.parameters, originalB);
  assert.equal(f.fields(1).phrase, b.phrase, 'Another row must not be rebuilt');
  assert.equal(f.fields(1).pinyin, b.pinyin);
  assert.equal(b.phrase.value, '测试白马');
  assert.equal(b.pinyin.value, 'ce shi bai ma');
  assert.equal(f.editor.history.undos.length, 1);
  assert.match(f.root.querySelector('[role="status"]').textContent, /confirmed$/);

  f.editor.history.undo();
  assert.match(f.root.querySelector('[role="status"]').textContent, /configured$/);
  assert.deepEqual(f.a.parameters, originalA);
  assert.equal(f.fields(0).phrase.value, originalA.phrase);
  assert.equal(f.fields(1).phrase, b.phrase);
  assert.equal(b.phrase.value, '测试白马');
  f.editor.history.redo();
  assert.equal(f.fields(0).phrase.value, '测试咖啡');
  assert.equal(f.fields(1).phrase, b.phrase);
  assert.equal(b.pinyin.value, 'ce shi bai ma');
});

test('new command apply, delete, undo and redo rebuild the correct rows', t => {
  const f = fixture(t);
  f.add();
  const added = f.object.commands[2];
  const uuid = added.parameters.uuid;
  assert.equal(Object.hasOwn(added.parameters, 'phrase'), false);
  f.fillVoice(2, '测试兔子', 'ce shi tu zi').apply.click();
  assert.equal(added.parameters.action, '测试兔子');
  assert.equal(added.parameters.pinyin, 'ce shi tu zi');
  assert.equal(Object.hasOwn(added.parameters, 'phrase'), false);
  f.buttons('删除指令')[2].click();
  assert.equal(f.object.commands.length, 2);
  assert.equal(f.root.querySelectorAll('input[aria-label="中文口令"]').length, 2);

  f.editor.history.undo();
  assert.equal(f.object.commands[2], added);
  assert.equal(f.object.commands[2].parameters.uuid, uuid);
  assert.equal(f.fields(2).phrase.value, '测试兔子');
  f.editor.history.undo();
  assert.equal(f.fields(2).phrase.value, '');
  f.editor.history.undo();
  assert.equal(f.object.commands.length, 2);
  f.editor.history.redo();
  f.editor.history.redo();
  assert.equal(f.fields(2).phrase.value, '测试兔子');
  f.editor.history.redo();
  assert.equal(f.object.commands.length, 2);
  assert.equal(f.root.querySelectorAll('input[aria-label="中文口令"]').length, 2);
});

test('selection refresh clears old row references and ignores unrelated changes', t => {
  const f = fixture(t);
  const c = voice('voice-c', '测试小猫', 'ce shi xiao mao');
  const other = entity('对象二', [c]);
  f.editor.scene.add(other);
  f.select([other]);
  assert.equal(f.fields(0).phrase.value, '测试小猫');
  const pending = f.fillVoice(0, '测试熊猫', 'ce shi xiong mao');
  f.editor.execute(new SetCommandValueCommand(f.editor, f.object, f.a, 'parameters', {
    ...f.a.parameters, phrase: '测试苹果', pinyin: 'ce shi ping guo',
  }));
  assert.equal(f.fields(0).phrase, pending.phrase);
  assert.equal(pending.phrase.value, '测试熊猫');
  assert.equal(c.parameters.phrase, '测试小猫');
  f.select([f.object]);
  assert.equal(f.fields(0).phrase.value, '测试苹果');
  assert.equal(f.fields(1).phrase.value, '关闭窗帘');
  assert.equal(pending.phrase.isConnected, false);
});

test('multi-selection add and undo retain the summary, and deselection clears rows', t => {
  const f = fixture(t);
  const other = entity('对象二', [voice('voice-c', '测试小猫', 'ce shi xiao mao')]);
  f.editor.scene.add(other);
  f.select([f.object, other]);
  assert.equal(f.root.querySelectorAll('input[aria-label="中文口令"]').length, 0);
  assert.match(f.root.textContent, /对象一/);
  assert.match(f.root.textContent, /对象二/);
  f.add();
  assert.equal(f.object.commands.length, 3);
  assert.equal(other.commands.length, 2);
  f.editor.history.undo();
  f.editor.history.undo();
  assert.equal(f.object.commands.length, 2);
  assert.equal(other.commands.length, 1);
  f.select([]);
  assert.equal(f.root.querySelectorAll('input, button, select').length, 0);
});
