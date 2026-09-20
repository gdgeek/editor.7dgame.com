import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { History } from '../three.js/editor/js/History.js';
import { MetaLoader } from '../plugin-dist/mrpp/MetaLoader.js';
import { createWebMcpMediaRequestHandlers } from '../plugin-dist/utils/WebMcpMediaHandlers.js';
import { markImportedAnimations } from '../plugin-dist/webmcp/ImportedAnimationMetadata.js';
import { getEntityWebMcpState, markEntitySaved } from '../plugin-dist/webmcp/EntityReadHandlers.js';
import { resetEditorContext } from '../plugin-dist/webmcp/EditorContext.js';
import { hasActiveEditorAnimationPreview } from '../plugin-dist/webmcp/EditorAnimationPreview.js';
import { setupBridgeHandlers } from '../plugin-dist/utils/BridgeHandlers.js';

function fixture() {
  const signals = new Proxy({}, { get(target, key) { return target[key] ??= { active: true, add() {}, dispatch() {} }; } });
  const editor = {
    scene: new THREE.Scene(), signals, data: { id: 42, saveable: true, resources: [] },
    strings: { getKey: key => key }, config: { getKey: () => false }, selected: null,
    objectByUuid(id) { return this.scene.getObjectByProperty('uuid', id); },
    select(object) { this.selected = object; }, execute(command) { this.history.execute(command); }
  };
  editor.scene.events = { inputs: [], outputs: [] };
  editor.mixer = new THREE.AnimationMixer(editor.scene);
  editor.history = new History(editor);
  editor.metaLoader = { json: null, getLoadingStatus: () => false, getMeta: async () => MetaLoader.prototype.write.call({ writeEntity: MetaLoader.prototype.writeEntity }, editor.scene) };
  const handlers = createWebMcpMediaRequestHandlers(editor);
  const add = (type, data = {}) => {
    const object = new THREE.Group(); object.name = type; object.userData = { type, ...data }; object.components = []; object.commands = [];
    editor.scene.add(object); return object;
  };
  return { editor, handlers, add };
}
const completePayload = staged => ({ nodeId: staged.nodeId, proposed: staged.proposed, propertiesVersion: staged.propertiesVersion, contextGeneration: staged.contextGeneration, entityVersion: staged.entityVersion });

test('import provenance distinguishes unresolved, pending, parsed empty, and actual duplicate-named clips', () => {
  const { editor, handlers, add } = fixture(); const object = add('Polygen', { resource: 17, animations: ['stored-only'] });
  const read = () => handlers['webmcp-get-model-animation-metadata']({ nodeId: object.uuid });
  assert.equal(read().parseStatus, 'unknown'); assert.equal(read().clips, null);
  editor.metaLoader.getLoadingStatus = () => true; assert.equal(read().parseStatus, 'pending');
  editor.metaLoader.getLoadingStatus = () => false;
  markImportedAnimations(object, []); assert.equal(read().parseStatus, 'ready'); assert.deepEqual(read().clips, []);
  const clip1 = new THREE.AnimationClip('Eye_full', 5, []), clip2 = new THREE.AnimationClip('Eye_full', 7, []);
  object.animations = [clip1, clip2]; markImportedAnimations(object, object.animations);
  editor.data.resources.push({ id: 17, file: { id: 88 }, revision: 'r2' });
  const metadata = read();
  assert.deepEqual(metadata.clips.map(c => [c.selectionValue, c.name, c.duration]), [['clip:0', 'Eye_full', 5], ['clip:1', 'Eye_full', 7]]);
  assert.equal(metadata.resourceVersion, 'r2'); assert.equal(metadata.source, 'gltf-import');
  editor.data.resources[0].revision = 'r3'; assert.notEqual(read().animationVersion, metadata.animationVersion);
  delete editor.data.resources[0].revision; editor.data.resources[0].file.md5 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const beforeMd5Change = read(); editor.data.resources[0].file.md5 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  assert.notEqual(read().resourceVersion, beforeMd5Change.resourceVersion);
  assert.notEqual(read().animationVersion, beforeMd5Change.animationVersion);
  assert.equal(object.userData.parseStatus, undefined); assert.deepEqual(object.userData.animations, ['stored-only']);
});

test('Sound authoring changes retain node fields, serialize, save/read back, and undo in one step', async () => {
  const { editor, handlers, add } = fixture(); const object = add('Sound', { resource: 12, loop: true, volume: 0.7, rate: 1, play: false, customLegacy: 'preserve' });
  const before = JSON.stringify(object.userData);
  const staged = await handlers['webmcp-stage-node-authoring-properties']({ nodeId: object.uuid, properties: { loop: false, play: true, volume: 0, rate: 1.5 } });
  assert.equal(staged.ok, true, JSON.stringify(staged)); assert.equal(JSON.stringify(object.userData), before); assert.equal(editor.history.undos.length, 0);
  const result = await handlers['webmcp-complete-node-authoring-properties'](completePayload(staged));
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.saved, false); assert.equal(result.readBackVerified, true);
  const parameters = result.meta.children.entities[0].parameters;
  assert.equal(parameters.loop, false); assert.equal(parameters.play, true); assert.equal(parameters.volume, 0); assert.equal(parameters.rate, 1.5); assert.equal(parameters.customLegacy, 'preserve');
  await markEntitySaved(editor, { expectedEntityVersion: result.entityVersion });
  const read = await getEntityWebMcpState(editor); assert.equal(read.changed, false);
  assert.equal((await handlers['webmcp-get-node-authoring-properties']({ nodeId: object.uuid })).properties.loop, false);
  assert.equal(editor.history.undos.length, 1); editor.history.undo(); assert.equal(JSON.stringify(object.userData), before);
  editor.history.redo(); assert.equal(object.userData.loop, false);
});

test('Text fields use the actual serialized schema, preserve unrelated data, and support multiline content', async () => {
  const { editor, handlers, add } = fixture(); const object = add('Text', { text: '旧值', resource: 99 });
  const properties = { text: '当前选择\n近视', size: 32, color: '#FFAA00', rect: { x: 2, y: 0.5 }, align: { horizontal: 'left', vertical: 'top' }, background: { enable: false, opacity: 0 }, follow: true };
  const staged = await handlers['webmcp-stage-node-authoring-properties']({ nodeId: object.uuid, properties });
  assert.equal(staged.ok, true, JSON.stringify(staged)); assert.equal(object.userData.text, '旧值');
  const result = await handlers['webmcp-complete-node-authoring-properties'](completePayload(staged));
  assert.equal(result.ok, true, JSON.stringify(result));
  const saved = result.meta.children.entities[0].parameters;
  assert.equal(saved.text, properties.text); assert.equal(saved.size, 32); assert.equal(saved.color, '#FFAA00');
  assert.deepEqual(saved.rect, { x: 2, y: 0.5 }); assert.equal(saved.background.opacity, 0); assert.equal(saved.resource, 99); assert.equal(saved.follow, true);
  editor.history.undo(); assert.equal(object.userData.text, '旧值');
});

test('authoring rejects unsupported fields, illegal ranges, stale entity/node versions, and new sessions without mutations', async () => {
  const { editor, handlers, add } = fixture(); const sound = add('Sound'), text = add('Text'), other = add('Polygen');
  for (const properties of [{ loop: 'false' }, { volume: -1 }, { rate: 5 }, { autoplay: true }, { volume: Infinity }]) {
    assert.equal((await handlers['webmcp-stage-node-authoring-properties']({ nodeId: sound.uuid, properties })).ok, false);
  }
  for (const properties of [{ size: 1 }, { size: 9.5 }, { color: 'red' }, { rect: { x: 100 } }, { text: 'a'.repeat(10001) }, { align: { horizontal: 'outside' } }, { background: { opacity: -1 } }]) {
    assert.equal((await handlers['webmcp-stage-node-authoring-properties']({ nodeId: text.uuid, properties })).ok, false);
  }
  const stage = () => handlers['webmcp-stage-node-authoring-properties']({ nodeId: sound.uuid, properties: { loop: true } });
  let staged = await stage(); other.position.x = 1;
  assert.equal((await handlers['webmcp-complete-node-authoring-properties'](completePayload(staged))).code, 'ENTITY_CONFLICT');
  staged = await stage(); sound.userData.rate = 2;
  assert.equal((await handlers['webmcp-complete-node-authoring-properties'](completePayload(staged))).code, 'NODE_PROPERTIES_CONFLICT');
  staged = await stage(); resetEditorContext(editor);
  assert.equal((await handlers['webmcp-complete-node-authoring-properties'](completePayload(staged))).code, 'CONTEXT_CHANGED');
  assert.equal(editor.history.undos.length, 0); assert.equal(sound.userData.loop, undefined);
  editor.data.saveable = false;
  assert.equal((await handlers['webmcp-get-node-authoring-properties']({ nodeId: sound.uuid })).ok, true);
  assert.equal((await stage()).code, 'READ_ONLY');
});

test('editor preview pause/seek/stop have real mixer effects, restore original bindings, and produce no save receipts', async () => {
  const { editor, handlers, add } = fixture(); const object = add('Polygen'); object.position.x = 7;
  const clip = new THREE.AnimationClip('Eye_full', 5, [new THREE.NumberKeyframeTrack('.position[x]', [0, 5], [1, 6])]);
  object.animations = [clip]; markImportedAnimations(object, object.animations);
  const metadata = handlers['webmcp-get-model-animation-metadata']({ nodeId: object.uuid });
  const control = (command, rest = {}) => handlers['webmcp-control-editor-animation-preview']({ nodeId: object.uuid, expectedAnimationVersion: metadata.animationVersion, command, clipIndex: 0, ...rest });
  let result = control('play'); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.status, 'playing');
  editor.mixer.update(1); assert.ok(object.position.x > 1 && object.position.x < 3);
  const duringPreview = await getEntityWebMcpState(editor);
  assert.equal(duringPreview.meta.children.entities[0].parameters.transform.position.x, 7);
  assert.equal(control('pause').status, 'paused'); const paused = object.position.x; editor.mixer.update(1); assert.equal(object.position.x, paused);
  result = control('seek', { time: 3 }); assert.equal(result.status, 'paused'); assert.equal(result.time, 3); assert.ok(Math.abs(object.position.x - 4) < 1e-10);
  assert.equal(control('resume').status, 'playing');
  result = control('stop'); assert.equal(result.status, 'stopped'); assert.equal(object.position.x, 7);
  for (const key of ['meta', 'events', 'entityVersion', 'readBackVerified', 'writeReceipt', 'saved']) assert.equal(Object.hasOwn(result, key), false);
  assert.equal(result.scope, 'editor-preview'); assert.equal(result.persisted, false); assert.equal(result.runtimeControl, false); assert.equal(editor.history.undos.length, 0);
  const invalid = control('seek', { time: 6 }); assert.equal(invalid.code, 'INVALID_RANGE'); assert.equal(object.position.x, 7);
  const stale = handlers['webmcp-control-editor-animation-preview']({ nodeId: object.uuid, expectedAnimationVersion: 'stale', command: 'play', clipIndex: 0 });
  assert.equal(stale.code, 'ANIMATION_CONFLICT'); assert.equal(object.position.x, 7);
});

test('bridge refuses transform staging, commits, and saving during preview, while leaving reads and stop available', async () => {
  const { editor, handlers, add } = fixture(); const messages = new Map(), responses = []; let writes = 0, saves = 0;
  const bridge = { onMessage: (name, handler) => messages.set(name, handler), postResponse: payload => responses.push(payload), postMessage() {}, destroy() {} };
  setupBridgeHandlers({ bridge, editor, responseActions: new Set(), mapToResponsePayload: () => ({}), getLoaderChanged: async () => true, getLoaderData: async () => { saves++; return {}; }, loaderJsonSetter() {}, requestHandlers: {
    ...handlers, 'webmcp-stage-node-transform': () => { writes++; return { ok: true }; }, 'webmcp-complete-node-transform': () => { writes++; return { ok: true }; }
  } });
  messages.get('INIT')({ config: { hostSessionId: 'active' } });
  const object = add('Polygen'); object.animations = [new THREE.AnimationClip('Eye_full', 5, [])]; markImportedAnimations(object, object.animations);
  const metadata = handlers['webmcp-get-model-animation-metadata']({ nodeId: object.uuid });
  const common = { nodeId: object.uuid, expectedAnimationVersion: metadata.animationVersion, clipIndex: 0 };
  assert.equal(handlers['webmcp-control-editor-animation-preview']({ ...common, command: 'play' }).ok, true);
  for (const action of ['webmcp-stage-node-transform', 'webmcp-complete-node-transform', 'save-before-leave', 'save', 'webmcp-mark-entity-saved']) {
    messages.get('REQUEST')({ action, hostSessionId: 'active' }, { id: action });
    assert.equal(responses.at(-1).code, 'ANIMATION_PREVIEW_ACTIVE');
  }
  assert.equal(writes, 0); assert.equal(saves, 0);
  messages.get('REQUEST')({ action: 'webmcp-get-editor-animation-preview', nodeId: object.uuid, hostSessionId: 'active' }, { id: 'read' });
  await Promise.resolve(); assert.equal(responses.at(-1).ok, true); assert.equal(responses.at(-1).status, 'playing');
  messages.get('REQUEST')({ action: 'webmcp-control-editor-animation-preview', ...common, command: 'stop', hostSessionId: 'active' }, { id: 'stop' });
  await Promise.resolve(); assert.equal(responses.at(-1).ok, true); assert.equal(hasActiveEditorAnimationPreview(editor), false);
  messages.get('REQUEST')({ action: 'webmcp-stage-node-transform', hostSessionId: 'active' }, { id: 'write' });
  await Promise.resolve(); assert.equal(writes, 1);
});

test('user input stops the preview before the UI changes a transform; navigation also cleans up', async t => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = new EventTarget(); Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => { if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument); else delete globalThis.document; });
  const { editor, handlers, add } = fixture(); const object = add('Polygen'); object.position.x = 7;
  object.animations = [new THREE.AnimationClip('Eye_full', 5, [new THREE.NumberKeyframeTrack('.position[x]', [0, 5], [1, 6])])]; markImportedAnimations(object, object.animations);
  const metadata = handlers['webmcp-get-model-animation-metadata']({ nodeId: object.uuid });
  const play = () => handlers['webmcp-control-editor-animation-preview']({ nodeId: object.uuid, expectedAnimationVersion: metadata.animationVersion, command: 'play', clipIndex: 0 });
  play(); editor.mixer.update(1); assert.notEqual(object.position.x, 7);
  document.addEventListener('pointerdown', () => { assert.equal(object.position.x, 7); object.position.x = 99; }, { once: true });
  document.dispatchEvent(new Event('pointerdown'));
  assert.equal(object.position.x, 99); assert.equal(hasActiveEditorAnimationPreview(editor), false);
  assert.equal((await getEntityWebMcpState(editor)).meta.children.entities[0].parameters.transform.position.x, 99);
  play(); editor.mixer.update(1); resetEditorContext(editor);
  assert.equal(object.position.x, 99); assert.equal(hasActiveEditorAnimationPreview(editor), false);
});

test('switching between nested preview roots restores both authored poses before taking the next snapshot', async () => {
  const { editor, handlers, add } = fixture(); const parent = add('Polygen'), child = add('Polygen');
  parent.name = 'Parent'; child.name = 'Child'; parent.add(child);
  parent.position.x = 7; child.position.x = 11; child.position.y = 13;
  parent.animations = [new THREE.AnimationClip('parent', 5, [
    new THREE.NumberKeyframeTrack('.position[x]', [0, 5], [1, 6]),
    new THREE.NumberKeyframeTrack('Child.position[y]', [0, 5], [2, 7])
  ])];
  child.animations = [new THREE.AnimationClip('child', 5, [new THREE.NumberKeyframeTrack('.position[x]', [0, 5], [3, 8])])];
  for (const object of [parent, child]) markImportedAnimations(object, object.animations);
  const control = (object, command, rest = {}) => handlers['webmcp-control-editor-animation-preview']({
    nodeId: object.uuid, command, clipIndex: 0, ...rest,
    expectedAnimationVersion: handlers['webmcp-get-model-animation-metadata']({ nodeId: object.uuid }).animationVersion
  });
  const state = object => handlers['webmcp-get-editor-animation-preview']({ nodeId: object.uuid });
  assert.equal(control(child, 'play').ok, true); editor.mixer.update(1); assert.notEqual(child.position.x, 11);
  assert.equal(control(parent, 'play').ok, true); assert.equal(child.position.x, 11); assert.equal(state(child).status, 'stopped');
  editor.mixer.update(1); assert.notEqual(parent.position.x, 7); assert.notEqual(child.position.y, 13);
  const next = control(child, 'seek', { time: 2 }); assert.equal(next.ok, true, JSON.stringify(next));
  assert.equal(next.concurrencyPolicy, 'one-model-per-editor'); assert.equal(state(parent).status, 'stopped');
  assert.equal(parent.position.x, 7); assert.equal(child.position.y, 13); assert.notEqual(child.position.x, 11);
  const saved = (await getEntityWebMcpState(editor)).meta.children.entities[0];
  assert.equal(saved.parameters.transform.position.x, 7);
  assert.deepEqual(saved.children.entities[0].parameters.transform.position, { x: 11, y: 13, z: 0 });
  assert.equal(control(child, 'stop').ok, true);
  assert.equal(parent.position.x, 7); assert.equal(child.position.x, 11); assert.equal(child.position.y, 13);
  assert.equal(hasActiveEditorAnimationPreview(editor), false);
});
