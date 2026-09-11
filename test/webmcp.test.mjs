import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { History } from '../three.js/editor/js/History.js';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../plugin-dist/commands/WebMcpBatchCommand.js';
import { AddComponentCommand } from '../plugin-dist/commands/AddComponentCommand.js';
import { RemoveComponentCommand } from '../plugin-dist/commands/RemoveComponentCommand.js';
import { executeAtomicCommand } from '../plugin-dist/webmcp/AtomicCommands.js';
import { createWebMcpNodeCloneRequestHandlers } from '../plugin-dist/utils/WebMcpNodeCloneHandlers.js';
import { createWebMcpNodeDeletionRequestHandlers } from '../plugin-dist/utils/WebMcpNodeDeletionHandlers.js';
import { createWebMcpComponentRequestHandlers } from '../plugin-dist/utils/WebMcpComponentHandlers.js';
import { createWebMcpResourcePlacementRequestHandlers } from '../plugin-dist/utils/WebMcpResourcePlacementHandlers.js';
import { completeVerseSceneEntityPlacement } from '../plugin-dist/webmcp/VerseScenePlacementHandlers.js';
import { createVerseSceneVersion } from '../plugin-dist/webmcp/VerseSceneReadHandlers.js';
import { getEntityWebMcpState, markEntitySaved } from '../plugin-dist/webmcp/EntityReadHandlers.js';
import { MessageBridge } from '../plugin-dist/utils/MessageBridge.js';
import { setupBridgeHandlers } from '../plugin-dist/utils/BridgeHandlers.js';
import { resetEditorContext, captureEditorState, awaitEditorLoad, withPlacement } from '../plugin-dist/webmcp/EditorContext.js';
import { MetaLoader } from '../plugin-dist/mrpp/MetaLoader.js';
import { WebMcpMetaFactory } from '../plugin-dist/webmcp/WebMcpMetaFactory.js';
import { ensureMetaSignalRegistry } from '../plugin-dist/mrpp/MetaSignalRegistry.js';

function signal() { return { active: true, dispatch() {}, add() {} }; }
function editorFixture() {
  const signals = new Proxy({}, { get(target, key) { return target[key] ??= signal(); } });
  const editor = {
    scene: new THREE.Scene(), signals, data: { id: 42, saveable: true, resources: [], user: { role: 'root' } },
    strings: { getKey: key => key }, config: { getKey: () => false }, selected: null,
    objectByUuid(id) { return this.scene.getObjectByProperty('uuid', id); },
    select(object) { this.selected = object; }, deselect() { this.selected = null; },
    addObject(object, parent = this.scene, index) { parent.add(object); if (index !== undefined) { parent.children.pop(); parent.children.splice(index, 0, object); } },
    removeObject(object) { object.removeFromParent(); },
    execute(command) { this.history.execute(command); }
  };
  editor.scene.events = { inputs: [], outputs: [] };
  editor.history = new History(editor);
  editor.metaLoader = { json: null, getLoadingStatus: () => false, getMeta: async () => MetaLoader.prototype.write.call({ writeEntity: MetaLoader.prototype.writeEntity }, editor.scene) };
  return editor;
}
function node(name) { const result = new THREE.Group(); result.name = name; result.userData.type = 'polygen'; result.components = []; result.commands = []; return result; }
const rotate = id => ({ type: 'Rotate', parameters: { uuid: id, speed: { x: 0, y: 0, z: 0 } } });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

test('batch removals use current identities and preserve exact undo/redo order', () => {
  const editor = editorFixture(), object = node('model');
  const [a, b, c] = ['A', 'B', 'C'].map(rotate); object.components = [a, b, c]; editor.scene.add(object);
  const command = new MultiCmdsCommand(editor, [new RemoveComponentCommand(editor, object, a), new RemoveComponentCommand(editor, object, b)]);
  executeAtomicCommand(editor, command); assert.deepEqual(object.components, [c]);
  editor.history.undo(); assert.deepEqual(object.components, [a, b, c]);
  editor.history.redo(); assert.deepEqual(object.components, [c]);
});

test('mixed add/remove failure rolls state and real history back', () => {
  const editor = editorFixture(), object = node('model'); editor.scene.add(object);
  const a = rotate('A'), b = rotate('B'); object.components = [a];
  const oldRedo = {}; editor.history.redos = [oldRedo];
  const fail = { execute() { throw new Error('injected failure'); }, undo() {} };
  assert.throws(() => executeAtomicCommand(editor, new MultiCmdsCommand(editor, [new RemoveComponentCommand(editor, object, a), new AddComponentCommand(editor, object, b), fail])), /injected/);
  assert.deepEqual(object.components, [a]); assert.deepEqual(editor.history.undos, []); assert.deepEqual(editor.history.redos, [oldRedo]);
  assert.equal(editor.signals.sceneGraphChanged.active, true);
});

test('partial child failure is undone, and failed rollback is reported explicitly', () => {
  const editor = editorFixture(); let value = 0;
  const partial = { execute() { value = 5; throw new Error('partial write'); }, undo() { value = 0; } };
  assert.throws(() => executeAtomicCommand(editor, new MultiCmdsCommand(editor, [partial])), /partial write/);
  assert.equal(value, 0); assert.equal(editor.history.undos.length, 0);
  partial.undo = () => { throw new Error('cannot undo'); };
  assert.throws(() => executeAtomicCommand(editor, new MultiCmdsCommand(editor, [partial])), /部分更改未能回滚/);
  assert.equal(value, 5); assert.equal(editor.history.undos.length, 0);
});

test('component RPC multi-remove remains one undo step', async () => {
  const editor = editorFixture(), object = node('model'); editor.scene.add(object);
  const [a, b, c] = ['A', 'B', 'C'].map(rotate); object.components = [a, b, c];
  const handlers = createWebMcpComponentRequestHandlers(editor);
  const staged = handlers['webmcp-stage-component-batch']({ changes: ['A', 'B'].map(componentId => ({ operation: 'remove', nodeId: object.uuid, componentId })) });
  assert.equal(staged.ok, true, JSON.stringify(staged));
  const result = await handlers['webmcp-complete-component-batch']({ changes: staged.changes });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.deepEqual(object.components, [c]);
  assert.equal(editor.history.undos.length, 1); editor.history.undo(); assert.deepEqual(object.components, [a, b, c]);
});

test('clone remaps sibling targets, component/options IDs and nested command references', async () => {
  const editor = editorFixture(), group = node('group'), target = node('target'), owner = node('owner'), external = node('external');
  group.add(target, owner); editor.scene.add(group, external);
  owner.components = [{ type: 'Trigger', parameters: { uuid: 'trigger-id', target: target.uuid } }, { type: 'Tooltip', parameters: { uuid: 'tooltip-id', target: { uuid: target.uuid } } }];
  owner.commands = [{ type: 'test', parameters: { uuid: 'command-id', target: external.uuid, options: { 'option-id': { node: target.uuid, component: 'trigger-id' } } } }];
  const handlers = createWebMcpNodeCloneRequestHandlers(editor);
  const staged = handlers['webmcp-stage-node-clone']({ nodeId: group.uuid });
  const result = await handlers['webmcp-complete-node-clone']({ nodeId: group.uuid, expected: staged, proposedName: staged.proposedName });
  assert.equal(result.ok, true, JSON.stringify(result));
  const copied = editor.objectByUuid(result.nodeId), [copiedTarget, copiedOwner] = copied.children;
  assert.notEqual(copiedTarget.uuid, target.uuid);
  assert.equal(copiedOwner.components[0].parameters.target, copiedTarget.uuid);
  assert.equal(copiedOwner.components[1].parameters.target.uuid, copiedTarget.uuid);
  const options = copiedOwner.commands[0].parameters.options;
  assert.equal(Object.hasOwn(options, 'option-id'), false);
  assert.equal(Object.values(options)[0].component, copiedOwner.components[0].parameters.uuid);
  assert.equal(copiedOwner.commands[0].parameters.target, external.uuid);
  editor.history.undo(); assert.equal(copied.parent, null); editor.history.redo(); assert.equal(copied.parent, editor.scene);
});

test('deletion rejects a staged subtree after descendant behavior edits', async () => {
  const editor = editorFixture(), parent = node('parent'), child = node('child'); parent.add(child); editor.scene.add(parent); child.components = [rotate('A')];
  const handlers = createWebMcpNodeDeletionRequestHandlers(editor);
  const staged = handlers['webmcp-stage-node-deletion']({ nodeId: parent.uuid }); child.components[0].parameters.speed.y = 60;
  const result = await handlers['webmcp-complete-node-deletion']({ nodeId: parent.uuid, expected: staged });
  assert.equal(result.ok, false); assert.equal(parent.parent, editor.scene);
  child.components[0].parameters.speed.y = 0; child.commands.push({ parameters: { target: 'new' } });
  assert.notEqual(handlers['webmcp-stage-node-deletion']({ nodeId: parent.uuid }).subtreeVersion, staged.subtreeVersion);
});

test('live entity snapshot reflects unsaved transform and behavior with a new version', async () => {
  const editor = editorFixture(), object = node('model'); editor.scene.add(object);
  editor.metaLoader.json = JSON.stringify({ meta: await editor.metaLoader.getMeta(), events: editor.scene.events });
  const before = await getEntityWebMcpState(editor); assert.equal(before.changed, false);
  object.position.x = 7; object.components.push(rotate('A'));
  const after = await getEntityWebMcpState(editor); assert.equal(after.entityId, 42); assert.equal(after.source, 'live-editor');
  assert.equal(after.changed, true); assert.notEqual(after.entityVersion, before.entityVersion);
  assert.equal(after.meta.children.entities[0].parameters.transform.position.x, 7);
});

test('placement reserves operation before awaiting and rejects replay', async () => {
  const editor = editorFixture(), loading = deferred();
  const pending = withPlacement(editor, { operationId: 'one' }, () => loading.promise);
  await assert.rejects(withPlacement(editor, { operationId: 'one' }, async () => 2), /正在进行/);
  loading.resolve(1); assert.equal(await pending, 1);
  await assert.rejects(withPlacement(editor, { operationId: 'one' }, async () => 3), /已执行/);
});

test('INIT and DESTROY cancel pending loads without touching vendor loader', async () => {
  for (const active of [true, false]) {
    const editor = editorFixture(), check = captureEditorState(editor), loading = deferred();
    const pending = awaitEditorLoad(editor, loading.promise); resetEditorContext(editor, active);
    await assert.rejects(pending, /取消/); assert.throws(check, /会话/); loading.resolve(node('late'));
  }
});

test('resource load detects edits and never publishes resources on failure', async () => {
  globalThis.window = { resources: new Map([['old', { id: 'old' }]]) };
  const editor = editorFixture(), object = node('existing'); editor.scene.add(object);
  const loading = deferred(), oldBuild = WebMcpMetaFactory.prototype.building;
  WebMcpMetaFactory.prototype.building = () => loading.promise;
  try {
    const handlers = createWebMcpResourcePlacementRequestHandlers(editor);
    const pending = handlers['webmcp-complete-resource-placement']({ operationId: 'resource', resource: { id: 2, name: 'model', type: 'polygen', file: { url: 'https://example.test/a.glb' } } });
    object.position.x = 2; loading.resolve(node('loaded'));
    const result = await pending; assert.equal(result.ok, false); assert.equal(editor.scene.children.length, 1);
    assert.deepEqual([...window.resources.keys()], ['old']); assert.deepEqual(editor.data.resources, []); assert.equal(editor.history.undos.length, 0);
  } finally { WebMcpMetaFactory.prototype.building = oldBuild; }
});

test('successful resource insertion stays acknowledged when serialization later fails', async () => {
  globalThis.window = { resources: new Map() };
  const editor = editorFixture(), oldBuild = WebMcpMetaFactory.prototype.building;
  WebMcpMetaFactory.prototype.building = async () => node('loaded');
  editor.metaLoader.getMeta = async () => { throw new Error('refresh failed'); };
  try {
    const result = await createWebMcpResourcePlacementRequestHandlers(editor)['webmcp-complete-resource-placement']({ operationId: 'readback', resource: { id: 2, name: 'model', type: 'polygen', file: { url: 'https://example.test/a.glb' } } });
    assert.equal(result.ok, true); assert.equal(result.readBackVerified, false); assert.equal(editor.scene.children.length, 1); assert.equal(window.resources.has('2'), true);
  } finally { WebMcpMetaFactory.prototype.building = oldBuild; }
});

test('missing resource loading fails explicitly instead of inserting placeholder', async () => {
  const factory = new WebMcpMetaFactory(editorFixture());
  await assert.rejects(factory.getEmpty({ type: 'polygen', parameters: { name: 'missing' } }, new Map()), /占位/);
});

const transform = { position: { x: 0, y: 0, z: 0 }, rotate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
test('scene placement commits normalized signals only after successful insertion', async () => {
  globalThis.window = { resources: new Map() };
  const editor = editorFixture(), verse = { children: { modules: [] } };
  editor.verseLoader = { getVerse: async () => verse, getLoadingStatus: () => false };
  const oldGizmo = WebMcpMetaFactory.prototype.addGizmo; WebMcpMetaFactory.prototype.addGizmo = async () => {};
  try {
    const entity = { id: 11, events: '{"inputs":[{"uuid":"event-new"}],"outputs":[]}', data: { children: { entities: [] } }, resources: [{ id: 20 }] };
    const registry = ensureMetaSignalRegistry(editor); registry.upsert(11, { inputs: [], outputs: [] });
    const result = await completeVerseSceneEntityPlacement(editor, { operationId: 'scene', expectedSceneVersion: createVerseSceneVersion(verse), entity, title: 'placed', transform });
    assert.equal(result.ok, true); assert.equal(editor.scene.children.length, 1); assert.equal(registry.get(11).inputs[0].uuid, 'event-new'); assert.equal(window.resources.has('20'), true);
  } finally { WebMcpMetaFactory.prototype.addGizmo = oldGizmo; }
});

test('failed insertion restores history, selection and leaves signal/resource registries unchanged', async () => {
  globalThis.window = { resources: new Map() };
  const editor = editorFixture(), verse = { children: { modules: [] } };
  editor.verseLoader = { getVerse: async () => verse, getLoadingStatus: () => false };
  const registry = ensureMetaSignalRegistry(editor); registry.upsert(11, { inputs: [], outputs: [] });
  const oldGizmo = WebMcpMetaFactory.prototype.addGizmo; WebMcpMetaFactory.prototype.addGizmo = async () => {};
  editor.addObject = object => { editor.scene.add(object); throw new Error('insert failed'); };
  try {
    const entity = { id: 11, events: { inputs: [{ uuid: 'new' }], outputs: [] }, data: { children: { entities: [] } }, resources: [{ id: 20 }] };
    await assert.rejects(completeVerseSceneEntityPlacement(editor, { expectedSceneVersion: createVerseSceneVersion(verse), entity, title: 'placed', transform }), /insert failed/);
    assert.equal(editor.scene.children.length, 0); assert.equal(editor.history.undos.length, 0); assert.deepEqual(registry.get(11), { inputs: [], outputs: [] }); assert.equal(window.resources.size, 0);
  } finally { WebMcpMetaFactory.prototype.addGizmo = oldGizmo; }
});

test('scene placement rejects user edits or context replacement during awaited gizmo load', async () => {
  for (const change of ['edit', 'init']) {
    globalThis.window = { resources: new Map() };
    const editor = editorFixture(), verse = { children: { modules: [] } }, loading = deferred(), started = deferred();
    editor.verseLoader = { getVerse: async () => verse, getLoadingStatus: () => false };
    const oldGizmo = WebMcpMetaFactory.prototype.addGizmo;
    WebMcpMetaFactory.prototype.addGizmo = () => { started.resolve(); return loading.promise; };
    try {
      const entity = { id: 11, events: { inputs: [], outputs: [] }, data: { children: { entities: [] } }, resources: [{ id: 20 }] };
      const pending = completeVerseSceneEntityPlacement(editor, { expectedSceneVersion: createVerseSceneVersion(verse), entity, title: 'placed', transform });
      await started.promise;
      if (change === 'edit') editor.scene.add(node('user node')); else resetEditorContext(editor);
      loading.resolve(); await assert.rejects(pending, /改变|取消/);
      assert.equal(editor.scene.children.length, change === 'edit' ? 1 : 0); assert.equal(window.resources.size, 0); assert.equal(editor.history.undos.length, 0);
    } finally { WebMcpMetaFactory.prototype.addGizmo = oldGizmo; }
  }
});

test('entity save acknowledgement clears dirty only for the saved version', async () => {
  const editor = editorFixture(), object = node('model'); editor.scene.add(object);
  const saved = await getEntityWebMcpState(editor);
  object.position.x = 8;
  await assert.rejects(markEntitySaved(editor, { expectedEntityVersion: saved.entityVersion }), /又发生了变化/);
  assert.equal(editor.metaLoader.json, null);
  const current = await getEntityWebMcpState(editor);
  const ack = await markEntitySaved(editor, { expectedEntityVersion: current.entityVersion });
  assert.equal(ack.ok, true); assert.equal((await getEntityWebMcpState(editor)).changed, false);
});

test('bridge correlates concurrent request IDs and suppresses previous session responses', async () => {
  const editor = editorFixture(), first = deferred(), handlers = new Map(), responses = [];
  const bridge = { onMessage: (name, handler) => handlers.set(name, handler), postResponse: (payload, requestId) => responses.push({ payload, requestId }), postMessage() {}, destroy() {} };
  setupBridgeHandlers({ bridge, editor, responseActions: new Set(), mapToResponsePayload: () => ({}), getLoaderChanged: async () => false, getLoaderData: async () => ({}), loaderJsonSetter() {}, requestHandlers: {
    'webmcp-slow': () => first.promise, 'webmcp-fast': () => ({ ok: true })
  } });
  handlers.get('INIT')({ config: { hostSessionId: 'one', id: 42 } });
  handlers.get('REQUEST')({ action: 'webmcp-slow', hostSessionId: 'one' }, { id: 'slow-id' });
  handlers.get('REQUEST')({ action: 'webmcp-fast', hostSessionId: 'wrong' }, { id: 'wrong-id' });
  handlers.get('REQUEST')({ action: 'webmcp-fast', hostSessionId: 'one' }, { id: 'fast-id' });
  await Promise.resolve(); assert.deepEqual(responses.map(r => r.requestId), ['fast-id']); assert.equal(responses[0].payload.hostSessionId, 'one');
  handlers.get('INIT')({ config: { hostSessionId: 'two' } });
  first.resolve({ ok: true }); await Promise.resolve(); await Promise.resolve();
  assert.equal(responses.length, 1);
  handlers.get('REQUEST')({ action: 'webmcp-get-capabilities', hostSessionId: 'two' }, { id: 'cap-id' });
  assert.deepEqual(responses[1].payload.capabilities, ['webmcp-slow', 'webmcp-fast']);
  handlers.get('REQUEST')({ action: 'check-unsaved-changes', hostSessionId: 'two' }, { id: 'unsaved-id' });
  handlers.get('REQUEST')({ action: 'save-before-leave', hostSessionId: 'two' }, { id: 'leave-id' });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(responses.slice(2).map(r => [r.requestId, r.payload.hostSessionId]), [['unsaved-id', 'two'], ['leave-id', 'two']]);
});

test('native message bridge pins parent origin and stops sending after destroy', () => {
  const outgoing = [], listeners = new Map(), parent = { postMessage: (data, origin) => outgoing.push({ data, origin }) };
  globalThis.window = { parent, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
  const bridge = new MessageBridge(); let requests = 0;
  bridge.onMessage('REQUEST', () => requests++); bridge.init(); const receive = listeners.get('message');
  receive({ source: parent, origin: 'https://host.test', data: { type: 'INIT', id: 'init', payload: {} } });
  receive({ source: parent, origin: 'https://other.test', data: { type: 'REQUEST', id: 'bad' } });
  receive({ source: {}, origin: 'https://host.test', data: { type: 'REQUEST', id: 'bad2' } });
  receive({ source: parent, origin: 'https://host.test', data: { type: 'REQUEST', id: 'good' } });
  assert.equal(requests, 1); bridge.postResponse({ ok: true }, 'good'); assert.equal(outgoing.at(-1).origin, 'https://host.test');
  const before = outgoing.length; bridge.destroy(); bridge.postResponse({ ok: true }, 'late'); assert.equal(outgoing.length, before); assert.equal(listeners.has('message'), false);
});
