import { describe, expect, it } from 'vitest';
import {
  createOutlinerFilter,
  hasDisplayableDescendant,
} from '../../js/OutlinerFilter.js';

let nextId = 1;

function object3d({ name = '', type = 'Object3D', userData = {}, components = [], children = [] } = {}) {
  return { id: nextId++, name, type, userData, components, children };
}

function editorFor(sceneChildren) {
  const scene = object3d({ type: 'Scene', children: sceneChildren });
  const camera = object3d({ type: 'PerspectiveCamera' });
  return { scene, camera };
}

const nativeTypes = new Set(['Group', 'Object3D', 'Mesh']);

describe('outliner native filtering', () => {
  it('keeps the parent path for a matching object nested under native wrappers', () => {
    const target = object3d({ name: 'Deep Robot', type: 'Polygen' });
    const wrapper = object3d({ type: 'Group', children: [object3d({ type: 'Object3D', children: [target] })] });
    const editor = editorFor([wrapper]);
    const filter = createOutlinerFilter(editor, 'robot', '');

    expect(filter.active).toBe(true);
    expect(filter.matchesSubtree(wrapper)).toBe(true);
    expect(filter.matchesSubtree(target)).toBe(true);
  });

  it('prunes hidden and internal subtrees even when a descendant would match', () => {
    const hiddenTarget = object3d({ name: 'Secret Robot', type: 'Polygen' });
    const hiddenWrapper = object3d({
      name: '$internal',
      type: 'Group',
      userData: { hidden: true },
      children: [hiddenTarget],
    });
    const visibleRoot = object3d({ type: 'Group', children: [hiddenWrapper] });
    const editor = editorFor([visibleRoot]);
    const filter = createOutlinerFilter(editor, 'robot', '');

    expect(filter.matchesSubtree(hiddenWrapper)).toBe(false);
    expect(filter.matchesSubtree(visibleRoot)).toBe(false);
  });

  it('supports component filters through multiple hierarchy levels', () => {
    const target = object3d({ type: 'Entity', components: [{ type: 'Tooltip' }] });
    const root = object3d({ type: 'Group', children: [object3d({ type: 'Group', children: [target] })] });
    const editor = editorFor([root]);
    const filter = createOutlinerFilter(editor, '', 'component:tooltip');

    expect(filter.matchesSubtree(root)).toBe(true);
  });

  it('finds displayable descendants through native wrappers but not hidden wrappers', () => {
    const businessObject = object3d({ type: 'Polygen' });
    const nativeWrapper = object3d({ type: 'Group', children: [businessObject] });
    const hiddenWrapper = object3d({ type: 'Group', userData: { hidden: true }, children: [businessObject] });

    expect(hasDisplayableDescendant(nativeWrapper, nativeTypes)).toBe(true);
    expect(hasDisplayableDescendant(hiddenWrapper, nativeTypes)).toBe(false);
  });
});
