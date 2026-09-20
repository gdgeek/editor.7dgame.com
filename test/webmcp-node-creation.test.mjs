import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { History } from '../three.js/editor/js/History.js';
import { MetaLoader } from '../plugin-dist/mrpp/MetaLoader.js';
import { WebMcpMetaFactory } from '../plugin-dist/webmcp/WebMcpMetaFactory.js';
import { createWebMcpNodeCreationRequestHandlers } from '../plugin-dist/utils/WebMcpNodeCreationHandlers.js';
import { resetEditorContext } from '../plugin-dist/webmcp/EditorContext.js';

const PREVIEW = 'webmcp-preview-node-creation-batch';
const COMPLETE = 'webmcp-complete-node-creation-batch';
const QUERY = 'webmcp-get-node-creation-operation';
function signal() { return { active: true, dispatch() {}, add() {} }; }
function editorFixture() {
  globalThis.window = { resources: new Map() };
  const signals = new Proxy({}, { get(target, key) { return target[key] ??= signal(); } });
  const editor = {
    scene: new THREE.Scene(), signals, data: { id: 42, saveable: true, resources: [] }, selected: null,
    strings: { getKey: key => key }, config: { getKey: () => false },
    objectByUuid(id) { return this.scene.getObjectByProperty('uuid', id); },
    select(object) { this.selected = object; }, deselect() { this.selected = null; },
    addObject(object, parent = this.scene) { parent.add(object); },
    removeObject(object) { object.removeFromParent(); },
    execute(command) { this.history.execute(command); }
  };
  editor.scene.events = { inputs: [], outputs: [] };
  editor.history = new History(editor);
  editor.metaLoader = { getLoadingStatus: () => false, getMeta: async () => MetaLoader.prototype.write.call({ writeEntity: MetaLoader.prototype.writeEntity }, editor.scene), json: null };
  return editor;
}
const empty = (clientKey, options = {}) => ({ clientKey, kind: 'empty', ...options });
const resource = (clientKey, options = {}) => ({ clientKey, kind: 'resource', resource: { id: 7, type: 'polygen', name: 'Eye', file: { url: 'https://example.test/eye.glb' } }, ...options });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function request(handlers, items, operationId = 'batch') {
  const staged = await handlers[PREVIEW]({ items });
  assert.equal(staged.ok, true, JSON.stringify(staged));
  return { operationId, expectedEntityVersion: staged.expectedEntityVersion, items: staged.items };
}
function loaded(raw) {
  const node = new THREE.Group(); node.name = raw.parameters.name; node.uuid = raw.parameters.uuid; node.type = raw.type;
  node.visible = raw.parameters.active; node.userData = { type: raw.type, ...raw.parameters }; node.components = []; node.commands = [];
  return node;
}

test('forward parents preserve request sibling order, real UUIDs and one undo/redo step', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
  const items = [empty('first', { parentClientKey: 'group', name: 'First' }), empty('group', { name: 'ContentRoot' }), empty('second', { parentClientKey: 'group' }), empty('last')];
  const staged = await handlers[PREVIEW]({ items });
  assert.deepEqual(staged.creationOrder, ['group', 'first', 'second', 'last']);
  assert.deepEqual(staged.summary, { total: 4, resources: 0, empty: 4, text: 0 });
  assert.equal(editor.scene.children.length, 0);
  const result = await handlers[COMPLETE]({ operationId: 'forward', expectedEntityVersion: staged.expectedEntityVersion, items: staged.items });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.items.map(item => item.clientKey), ['first', 'group', 'second', 'last']);
  const group = editor.objectByUuid(result.items[1].nodeId);
  assert.equal(group.name, 'ContentRoot');
  assert.deepEqual(group.children.map(node => node.uuid), [result.items[0].nodeId, result.items[2].nodeId]);
  assert.equal(result.items[0].parentNodeId, group.uuid);
  assert.equal(editor.history.undos.length, 1);
  editor.history.undo(); assert.equal(editor.scene.children.length, 0);
  editor.history.redo(); assert.equal(editor.scene.children.length, 2); assert.equal(editor.objectByUuid(result.items[0].nodeId).parent, group);
});

test('existing parent, visibility and degree transform persist through serialization and undo', async () => {
  const editor = editorFixture(), existing = new THREE.Group(); existing.userData.type = 'Entity'; existing.name = 'Existing'; editor.scene.add(existing);
  const handlers = createWebMcpNodeCreationRequestHandlers(editor);
  const payload = await request(handlers, [empty('a', { parentNodeId: existing.uuid, visible: false, transform: { position: { x: 2 }, rotationDegrees: { y: 90 }, scale: { z: 3 } } }), empty('b', { parentNodeId: existing.uuid })]);
  const result = await handlers[COMPLETE](payload); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(editor.scene.children.length, 1); assert.equal(existing.children.length, 2);
  const node = existing.children[0]; assert.equal(node.visible, false); assert.equal(node.position.x, 2); assert.equal(node.rotation.y, Math.PI / 2); assert.equal(node.scale.z, 3);
  const saved = result.meta.children.entities[0].children.entities[0];
  assert.equal(saved.parameters.active, false); assert.equal(saved.parameters.transform.rotate.y, 90); assert.equal(saved.parameters.uuid, node.uuid);
  editor.history.undo(); assert.equal(existing.children.length, 0); assert.equal(existing.parent, editor.scene);
  editor.history.redo(); assert.deepEqual(existing.children.map(node => node.uuid), result.items.map(item => item.nodeId));
});

test('Text uses the real factory and round-trips content, style, hierarchy and stable IDs', async () => {
  const previousDocument = globalThis.document;
  const context = new Proxy({}, { get(target, key) { return target[key] ??= key === 'measureText' ? text => ({ width: text.length * 12 }) : () => {}; } });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  try {
    const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
    const payload = await request(handlers, [empty('content'), empty('console'), { kind: 'text', clientKey: 'selection', parentClientKey: 'console', text: { content: '当前选择\n尚未作答', color: '#11aa33', rect: { x: 1.6 }, size: 32, align: { horizontal: 'left' }, background: { enable: false }, follow: true } }]);
    const result = await handlers[COMPLETE](payload); assert.equal(result.ok, true, JSON.stringify(result));
    const text = editor.objectByUuid(result.items[2].nodeId);
    assert.equal(text.userData.text, '当前选择\n尚未作答'); assert.equal(text.userData.size, 32); assert.equal(text.userData.align.horizontal, 'left'); assert.equal(text.userData.background.enable, false);
    const reopened = new THREE.Group(); await new WebMcpMetaFactory(editor).readMeta(reopened, result.meta, new Map());
    const restored = reopened.getObjectByProperty('uuid', text.uuid);
    assert.equal(restored.parent.uuid, result.items[1].nodeId); assert.equal(restored.userData.text, text.userData.text); assert.deepEqual(restored.userData.rect, { x: 1.6, y: 0.32 });
  } finally { globalThis.document = previousDocument; }
});

test('invalid duplicate, missing or cyclic parents and oversized batches never stage', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
  for (const items of [
    [empty('same'), empty('same')], [empty('a', { parentClientKey: 'absent' })],
    [empty('a', { parentClientKey: 'a' })], [empty('a', { parentClientKey: 'b' }), empty('b', { parentClientKey: 'a' })],
    [empty('a', { parentNodeId: 'missing' })], [empty('a', { parentNodeId: null, parentClientKey: 'b' }), empty('b')],
    Array.from({ length: 21 }, (_, index) => empty(String(index))), [],
    [{ kind: 'text', clientKey: 'bad', text: { size: 0 } }], [empty('a', { transform: { rotate: { x: 1 } } })]
  ]) {
    const result = await handlers[PREVIEW]({ items }); assert.equal(result.ok, false, JSON.stringify(items)); assert.equal(result.status, 'not_applied');
  }
  assert.equal(editor.scene.children.length, 0); assert.equal(editor.history.undos.length, 0);
});

test('same resource can instantiate twice with distinct UUIDs and one registered resource', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor), original = WebMcpMetaFactory.prototype.building;
  WebMcpMetaFactory.prototype.building = async raw => loaded(raw);
  try {
    const result = await handlers[COMPLETE](await request(handlers, [resource('left'), resource('right')]));
    assert.equal(result.ok, true, JSON.stringify(result)); assert.notEqual(result.items[0].nodeId, result.items[1].nodeId);
    assert.equal(editor.data.resources.length, 1); assert.equal(window.resources.size, 1); assert.equal(result.items[1].resourceId, 7);
  } finally { WebMcpMetaFactory.prototype.building = original; }
});

test('version conflict and edits during preload leave no batch nodes or resource registrations', async () => {
  for (const when of ['before', 'during']) {
    const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor), original = WebMcpMetaFactory.prototype.building;
    const started = deferred(), loading = deferred();
    WebMcpMetaFactory.prototype.building = raw => { started.resolve(); return loading.promise.then(() => loaded(raw)); };
    try {
      const payload = await request(handlers, [resource('model')]);
      if (when === 'before') editor.scene.events.inputs.push({ uuid: 'changed' });
      const pending = handlers[COMPLETE](payload);
      if (when === 'during') { await started.promise; editor.scene.events.inputs.push({ uuid: 'changed' }); loading.resolve(); }
      const result = await pending;
      assert.equal(result.ok, false); assert.equal(result.status, 'not_applied');
      assert.equal(editor.scene.children.length, 0); assert.equal(editor.history.undos.length, 0); assert.equal(window.resources.size, 0); assert.deepEqual(editor.data.resources, []);
    } finally { WebMcpMetaFactory.prototype.building = original; }
  }
});

test('failure on a later preload never inserts earlier successful items', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor), original = WebMcpMetaFactory.prototype.building;
  let count = 0;
  WebMcpMetaFactory.prototype.building = async raw => { if (++count === 2) throw new Error('bad GLB'); return loaded(raw); };
  try {
    const payload = await request(handlers, [resource('one'), resource('two')]);
    const result = await handlers[COMPLETE](payload); assert.equal(result.ok, false); assert.equal(result.status, 'not_applied');
    assert.equal(result.items.length, 2); assert.ok(result.items.every(item => item.status === 'not_applied'));
    assert.equal(editor.scene.children.length, 0); assert.equal(editor.history.undos.length, 0); assert.equal(window.resources.size, 0);
    const retry = await handlers[COMPLETE](payload); assert.equal(retry.replayed, true); assert.equal(count, 2);
  } finally { WebMcpMetaFactory.prototype.building = original; }
});

test('partial insertion and late history failures restore the prior tree, selection and history', async () => {
  for (const failure of ['second-insertion', 'history']) {
    const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
    const selected = new THREE.Group(); selected.userData.type = 'Entity'; editor.scene.add(selected); editor.select(selected);
    const oldRedo = {}; editor.history.redos = [oldRedo];
    const payload = await request(handlers, [empty('one'), empty('two')]);
    if (failure === 'second-insertion') { let count = 0; editor.addObject = object => { editor.scene.add(object); if (++count === 2) throw new Error('insert failed'); }; }
    else editor.signals.historyChanged.dispatch = () => { throw new Error('history signal failed'); };
    const result = await handlers[COMPLETE](payload);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(result.status, 'not_applied');
    assert.deepEqual(editor.scene.children, [selected]); assert.equal(editor.selected, selected); assert.deepEqual(editor.history.undos, []); assert.deepEqual(editor.history.redos, [oldRedo]);
    assert.equal(editor.signals.sceneGraphChanged.active, true);
  }
});

test('concurrent and completed retries reuse the result and reject a conflicting payload', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor), original = WebMcpMetaFactory.prototype.building;
  const loading = deferred(), started = deferred(); let count = 0;
  WebMcpMetaFactory.prototype.building = raw => { count++; started.resolve(); return loading.promise.then(() => loaded(raw)); };
  try {
    const payload = await request(handlers, [resource('eye')]);
    const first = handlers[COMPLETE](payload), second = handlers[COMPLETE](payload); await started.promise;
    assert.equal(handlers[QUERY]({ operationId: 'batch' }).status, 'in_progress');
    const busy = await handlers[COMPLETE]({ ...payload, operationId: 'other' }); assert.equal(busy.code, 'EDITOR_BUSY');
    loading.resolve(); const result = await first, repeated = await second;
    assert.equal(result.ok, true); assert.equal(repeated.replayed, true); assert.deepEqual(repeated.items, result.items); assert.equal(count, 1);
    const replay = await handlers[COMPLETE](payload); assert.equal(replay.replayed, true); assert.equal(editor.scene.children.length, 1);
    const conflict = await handlers[COMPLETE]({ ...payload, items: [{ ...payload.items[0], name: 'Changed' }] });
    assert.equal(conflict.code, 'OPERATION_CONFLICT'); assert.equal(conflict.status, 'unknown'); assert.equal(conflict.recovery.safeToReplayWithNewOperationId, false);
    assert.deepEqual(handlers[QUERY]({ operationId: 'batch' }).items, result.items);
  } finally { WebMcpMetaFactory.prototype.building = original; }
});

test('batch timeout is terminal and a late resource cannot attach or start the next load', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor, { loadTimeoutMs: 10 }), original = WebMcpMetaFactory.prototype.building;
  const loading = deferred(); let count = 0;
  WebMcpMetaFactory.prototype.building = raw => { count++; return loading.promise.then(() => loaded(raw)); };
  try {
    const payload = await request(handlers, [resource('one'), resource('two')]);
    const result = await handlers[COMPLETE](payload); assert.equal(result.code, 'LOAD_TIMEOUT'); assert.equal(result.status, 'not_applied');
    assert.equal(result.recovery.nextAction, 'preview_again_with_new_operation_id');
    loading.resolve(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(count, 1); assert.equal(editor.scene.children.length, 0); assert.equal(window.resources.size, 0);
    const repeated = await handlers[COMPLETE](payload); assert.equal(repeated.replayed, true); assert.equal(repeated.code, 'LOAD_TIMEOUT');
  } finally { WebMcpMetaFactory.prototype.building = original; }
});

test('INIT cancels loading and receipt queries explicitly report a new session as unknown', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor), original = WebMcpMetaFactory.prototype.building;
  const loading = deferred(), started = deferred();
  WebMcpMetaFactory.prototype.building = raw => { started.resolve(); return loading.promise.then(() => loaded(raw)); };
  try {
    const pending = handlers[COMPLETE](await request(handlers, [resource('eye')])); await started.promise;
    resetEditorContext(editor); const result = await pending; assert.equal(result.status, 'not_applied');
    const receipt = handlers[QUERY]({ operationId: 'batch' }); assert.equal(receipt.status, 'unknown'); assert.equal(receipt.recovery.safeToReplayWithNewOperationId, false);
    loading.resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(editor.scene.children.length, 0);
  } finally { WebMcpMetaFactory.prototype.building = original; }
});

test('applied receipt survives read-back failure and retries never duplicate it', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
  const payload = await request(handlers, [empty('root')]);
  const getMeta = editor.metaLoader.getMeta; let reads = 0;
  editor.metaLoader.getMeta = async () => { if (++reads > 2) throw new Error('snapshot failed'); return getMeta(); };
  const result = await handlers[COMPLETE](payload);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.readBackVerified, false); assert.equal(result.status, 'applied');
  assert.equal(result.recovery.persisted, false); assert.equal(result.recovery.scope, 'editor-session');
  const replay = await handlers[COMPLETE](payload); assert.equal(replay.replayed, true); assert.equal(replay.items[0].nodeId, result.items[0].nodeId); assert.equal(editor.scene.children.length, 1);
});

test('an unexpected error after commit still returns all UUIDs as applied', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
  const payload = await request(handlers, [empty('root')]);
  Object.defineProperty(editor.data, 'resources', { get: () => [], set: () => { throw new Error('registry unavailable'); } });
  const result = await handlers[COMPLETE](payload);
  assert.equal(result.ok, true); assert.equal(result.status, 'applied'); assert.equal(result.readBackVerified, false);
  assert.equal(result.readBackError, 'registry unavailable'); assert.equal(editor.objectByUuid(result.items[0].nodeId), editor.scene.children[0]);
  const retry = await handlers[COMPLETE](payload); assert.equal(retry.replayed, true); assert.equal(editor.scene.children.length, 1);
});

test('incomplete rollback returns unknown with generated UUIDs for inspection and forbids replay', async () => {
  const editor = editorFixture(), handlers = createWebMcpNodeCreationRequestHandlers(editor);
  const payload = await request(handlers, [empty('root')]);
  editor.addObject = object => { editor.scene.add(object); object.removeFromParent = () => { throw new Error('cannot remove'); }; throw new Error('partial insertion'); };
  editor.removeObject = () => { throw new Error('cannot remove'); };
  const result = await handlers[COMPLETE](payload);
  assert.equal(result.ok, false); assert.equal(result.status, 'unknown'); assert.equal(result.code, 'ROLLBACK_INCOMPLETE');
  assert.equal(result.recovery.safeToReplayWithNewOperationId, false); assert.equal(result.items[0].status, 'unknown');
  assert.equal(editor.objectByUuid(result.items[0].nodeId), editor.scene.children[0]);
  const replay = await handlers[COMPLETE](payload); assert.equal(replay.replayed, true); assert.equal(editor.scene.children.length, 1);
});
