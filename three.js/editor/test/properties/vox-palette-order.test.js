import { describe, expect, it } from 'vitest';
import { VOXLoader, VOXMesh } from '../../../examples/jsm/loaders/VOXLoader.js';

function uint32(...values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

function chunk(id, content, children = new Uint8Array()) {
  return new Uint8Array([
    ...new TextEncoder().encode(id),
    ...uint32(content.length, children.length),
    ...content,
    ...children,
  ]);
}

function model(colorIndex = 1) {
  return [
    ...chunk('SIZE', uint32(1, 1, 1)),
    ...chunk('XYZI', new Uint8Array([...uint32(1), 0, 0, 0, colorIndex])),
  ];
}

function vox(children, version = 200) {
  return new Uint8Array([
    ...new TextEncoder().encode('VOX '), ...uint32(version),
    ...chunk('MAIN', new Uint8Array(), new Uint8Array(children)),
  ]).buffer;
}

const red = 0xff0000ff;
const blue = 0xffff0000;
const rgba = chunk('RGBA', uint32(red, blue, ...Array(254).fill(0)));

describe('VOX shared palette ordering', () => {
  it.each([150, 200])('loads a palette before SIZE in VOX %s', (version) => {
    const { chunks } = new VOXLoader().parse(vox([...rgba, ...model()], version));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].size).toEqual({ x: 1, y: 1, z: 1 });
    expect(Array.from(chunks[0].data)).toEqual([0, 0, 0, 1]);
    expect(chunks[0].palette[1]).toBe(red);
    const mesh = new VOXMesh(chunks[0]);
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(Array.from(mesh.geometry.getAttribute('color').array.slice(0, 3))).toEqual([1, 0, 0]);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it.each(['before', 'between', 'after'])('shares the palette across models when RGBA is %s them', (position) => {
    const models = [model(1), model(2)];
    const children = position === 'before' ? [...rgba, ...models.flat()]
      : position === 'between' ? [...models[0], ...rgba, ...models[1]]
        : [...models.flat(), ...rgba];
    const { chunks } = new VOXLoader().parse(vox(children));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].palette).toBe(chunks[1].palette);
    expect(chunks[0].palette[1]).toBe(red);
    expect(chunks[1].palette[2]).toBe(blue);
  });

  it('keeps the default palette when RGBA is absent', () => {
    const { chunks } = new VOXLoader().parse(vox(model()));
    expect(chunks[0].palette[1]).toBe(0xffffffff);
  });
});
