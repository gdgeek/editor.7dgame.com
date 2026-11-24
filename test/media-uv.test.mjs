import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyMediaUv } from '../plugin-dist/mrpp/MediaUv.js';

test("trimmed picture UVs preserve shared geometry, reset and never accumulate", () => {
  const geometry = new THREE.PlaneGeometry(1, 2),
    a = new THREE.Mesh(geometry),
    b = new THREE.Mesh(geometry);
  const before = Array.from(b.geometry.attributes.uv.array),
    rect = { x: 0.1, y: 0.25, width: 0.2, height: 0.5 };
  applyMediaUv(a, rect);
  const once = Array.from(a.geometry.attributes.uv.array);
  applyMediaUv(a, rect);
  assert.deepEqual(Array.from(a.geometry.attributes.uv.array), once);
  assert.deepEqual(Array.from(b.geometry.attributes.uv.array), before);
  assert.ok(Math.abs(a.geometry.attributes.uv.getX(0) - 0.1) < 1e-6);
  assert.ok(Math.abs(a.geometry.attributes.uv.getY(0) - 0.75) < 1e-6);
  applyMediaUv(a, null);
  assert.deepEqual(Array.from(a.geometry.attributes.uv.array), before);
});
