import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EditorLoadProgress } from "../plugin-dist/mrpp/EditorLoadProgress.js";
import { MetaFactory } from "../plugin-dist/mrpp/MetaFactory.js";
import { MetaLoader } from "../plugin-dist/mrpp/MetaLoader.js";
import { VerseLoader } from "../plugin-dist/mrpp/VerseLoader.js";
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("parallel tasks report real completions and an outstanding item, including errors", async () => {
  const progress = new EditorLoadProgress(2),
    a = deferred(),
    b = deferred();
  const pa = progress.track("model", "A", () => a.promise);
  const pb = progress.track("model", "B", () => b.promise);
  assert.equal(progress.snapshot().completed, 0);
  b.resolve();
  await pb;
  assert.deepEqual(progress.snapshot(), {
    phase: "assets",
    completed: 1,
    total: 2,
    failed: 0,
    currentKind: "model",
    currentItem: "A",
  });
  a.resolve();
  await pa;
  progress.finish();
  assert.equal(progress.snapshot().phase, "finishing");
  progress.ready();
  assert.equal(progress.snapshot().phase, "ready");
  const failure = new EditorLoadProgress(1);
  await assert.rejects(
    failure.track("model", "broken", async () => {
      throw Error("failed");
    }),
  );
  failure.finish();
  failure.ready();
  assert.equal(failure.snapshot().phase, "error");
  assert.equal(failure.completed, 0);
});
test("actual entity factory updates progress between models and counts only successful loads", async () => {
  const first = deferred(),
    second = deferred(),
    progress = new EditorLoadProgress(2),
    root = new THREE.Group();
  const factory = {
    building: (item) =>
      item.parameters.title === "A" ? first.promise : second.promise,
  };
  const data = {
    children: {
      entities: [
        { parameters: { title: "A" } },
        null,
        { parameters: { title: "B" } },
      ],
    },
  };
  const loaded = MetaFactory.prototype.readMeta.call(
    factory,
    root,
    data,
    new Map(),
    null,
    progress,
  );
  assert.equal(progress.snapshot().currentItem, "A");
  first.resolve(new THREE.Group());
  await tick();
  assert.equal(progress.snapshot().completed, 1);
  assert.equal(progress.snapshot().currentItem, "B");
  second.resolve(new THREE.Group());
  await loaded;
  assert.equal(progress.completed, 2);
  assert.equal(root.children.length, 2);
});
test("entity loader reports finishing until snapshot completes and isolates replacement loads", async () => {
  const write = deferred(),
    signals = new Proxy({}, { get: () => ({ dispatch() {} }) });
  const loader = Object.assign(Object.create(MetaLoader.prototype), {
    editor: { scene: new THREE.Scene(), signals, setScene() {} },
    factory: { lockNode() {} },
    write: () => write.promise,
  });
  const load = loader.load({ data: null });
  assert.equal(loader.getLoadingProgress().phase, "finishing");
  assert.equal(loader.getLoadingStatus(), true);
  write.resolve({});
  await load;
  assert.equal(loader.getLoadingProgress().phase, "ready");
  assert.equal(loader.getLoadingStatus(), false);
  const old = deferred();
  loader.write = () => old.promise;
  const earlier = loader.load({ data: null });
  loader.write = async () => ({ new: true });
  await loader.load({ data: null });
  old.resolve({ old: true });
  await earlier;
  assert.match(loader.json, /new/);
  assert.equal(loader.getLoadingProgress().phase, "ready");
});

test("scene modules advance independently of spatial background and preserve failure state", async () => {
  const a = deferred(),
    b = deferred(),
    progress = new EditorLoadProgress(2),
    root = new THREE.Scene();
  const loader = Object.assign(Object.create(VerseLoader.prototype), {
    editor: { signals: { sceneGraphChanged: { dispatch() {} } } },
    factory: {
      addModule: (item) => {
        const n = new THREE.Group();
        n.name = item.parameters.title;
        return n;
      },
      addGizmo: (node) => (node.name === "A" ? a.promise : b.promise),
    },
  });
  const item = (title) => ({ parameters: { title, meta_id: 1 } });
  const loaded = loader.read(
    root,
    {
      parameters: { uuid: root.uuid },
      children: { modules: [item("A"), item("B")] },
    },
    new Map(),
    new Map([["1", { custom: 0 }]]),
    progress,
  );
  b.resolve();
  await tick();
  assert.equal(progress.completed, 1);
  assert.equal(progress.snapshot().currentItem, "A");
  a.resolve();
  await loaded;
  assert.equal(progress.completed, 2);
  const broken = new EditorLoadProgress(1);
  await loader.read(
    root,
    {
      parameters: { uuid: root.uuid },
      children: { modules: [item("missing")] },
    },
    new Map(),
    new Map(),
    broken,
  );
  assert.equal(broken.phase, "error");
  assert.equal(broken.completed, 0);
});
