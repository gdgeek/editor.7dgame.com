import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RotateComponent } from '../../../../plugin/mrpp/components/RotateComponent.ts';
import {
  applyUnityLocalRotationDelta,
  createUnityLocalRotationDelta,
} from '../../../../plugin/mrpp/UnityRotation.ts';

function expectSameOrientation(actual: THREE.Quaternion, expected: THREE.Quaternion): void {
  expect(actual.angleTo(expected)).toBeLessThan(1e-7);
}

function expectExactQuaternion(actual: THREE.Quaternion, expected: THREE.Quaternion): void {
  expect([actual.x, actual.y, actual.z, actual.w]).toEqual([
    expected.x,
    expected.y,
    expected.z,
    expected.w,
  ]);
}

describe('Unity-compatible self rotation', () => {
  it.each([
    { unityY: 15, threeY: -15 },
    { unityY: -15, threeY: 15 },
  ])('maps Unity Y=$unityY to Three.js Y=$threeY', ({ unityY, threeY }) => {
    const actual = createUnityLocalRotationDelta({ x: 0, y: unityY, z: 0 }, 1);
    const expected = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, THREE.MathUtils.degToRad(threeY), 0, 'ZXY')
    );

    expectSameOrientation(actual, expected);
  });

  it('uses ZXY and local post-multiplication from a non-zero initial pose', () => {
    const object = new THREE.Object3D();
    object.rotation.set(
      THREE.MathUtils.degToRad(20),
      THREE.MathUtils.degToRad(-35),
      THREE.MathUtils.degToRad(10),
      'YZX'
    );
    const original = object.quaternion.clone();
    const originalOrder = object.rotation.order;
    const speed = Object.freeze({ x: 30, y: 15, z: -20 });

    applyUnityLocalRotationDelta(object, speed, 0.5);

    const expectedDelta = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(15),
        THREE.MathUtils.degToRad(-7.5),
        THREE.MathUtils.degToRad(10),
        'ZXY'
      )
    );
    expectSameOrientation(object.quaternion, original.multiply(expectedDelta));
    expect(object.rotation.order).toBe(originalOrder);
    expect(speed).toEqual({ x: 30, y: 15, z: -20 });
  });
});

describe('RotateComponent preview lifecycle', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextRequestId: number;

  beforeEach(() => {
    callbacks = new Map();
    nextRequestId = 1;
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const requestId = nextRequestId++;
      callbacks.set(requestId, callback);
      return requestId;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((requestId: number) => {
      callbacks.delete(requestId);
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function runNextFrame(now: number): void {
    const entry = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!entry) throw new Error('No animation frame is pending');
    callbacks.delete(entry[0]);
    entry[1](now);
  }

  function createPreview(speed = Object.freeze({ x: 30, y: 15, z: -20 })) {
    const object = new THREE.Object3D();
    object.rotation.set(
      THREE.MathUtils.degToRad(12),
      THREE.MathUtils.degToRad(-25),
      THREE.MathUtils.degToRad(8),
      'YXZ'
    );
    const component = {
      type: 'Rotate',
      parameters: {
        uuid: 'rotate-test',
        speed,
        isRotating: true,
        action: 'rotate',
      },
    };
    const editor = {
      signals: {
        objectChanged: { dispatch: vi.fn() },
        componentChanged: { dispatch: vi.fn() },
      },
    };

    return {
      component,
      editor,
      object,
      preview: new RotateComponent(editor as any, object, component as any),
    };
  }

  it('previews without reordering the live object or mutating persisted speed', () => {
    const { component, object, preview } = createPreview();
    const initial = object.quaternion.clone();
    const initialOrder = object.rotation.order;

    preview.startPreview();
    runNextFrame(500);

    const expected = initial.multiply(createUnityLocalRotationDelta(component.parameters.speed, 0.5));
    expectSameOrientation(object.quaternion, expected);
    expect(object.rotation.order).toBe(initialOrder);
    expect(component.parameters.speed).toEqual({ x: 30, y: 15, z: -20 });
  });

  it('restores Euler revolutions, order, and quaternion exactly when stopped manually', () => {
    const { object, preview } = createPreview();
    object.rotation.set(
      Math.PI * 2 + 0.3,
      -Math.PI * 2 - 0.4,
      Math.PI * 4 + 0.5,
      'ZYX'
    );
    const initialRotation = object.rotation.clone();
    const initial = object.quaternion.clone();

    preview.startPreview();
    runNextFrame(750);
    preview.stopPreview();

    expectExactQuaternion(object.quaternion, initial);
    expect([
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
      object.rotation.order,
    ]).toEqual([
      initialRotation.x,
      initialRotation.y,
      initialRotation.z,
      initialRotation.order,
    ]);
    expect(object.previewRotate).toBeUndefined();
    expect(callbacks.size).toBe(0);
  });

  it('keeps the eight-second timeout and restores the original pose', () => {
    const { object, preview } = createPreview();
    const initial = object.quaternion.clone();
    const initialOrder = object.rotation.order;

    preview.startPreview();
    runNextFrame(8000);

    expectExactQuaternion(object.quaternion, initial);
    expect(object.rotation.order).toBe(initialOrder);
    expect(object.previewRotate).toBeUndefined();
    expect(callbacks.size).toBe(0);
  });
});
