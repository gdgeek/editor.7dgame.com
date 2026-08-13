import * as THREE from 'three';

/** Rotation speed persisted by MRPP, in Unity degrees per second. */
interface UnityRotationSpeed {
  readonly x?: unknown;
  readonly y?: unknown;
  readonly z?: unknown;
}

function finiteNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Builds the Three.js local-space delta that matches the project's Unity
 * Transform.Rotate(Vector3) coordinate convention.
 *
 * Persisted speed is deliberately left untouched. The handedness conversion
 * is applied only while constructing the Three.js preview quaternion.
 */
function createUnityLocalRotationDelta(
  speed: UnityRotationSpeed | null | undefined,
  deltaSeconds: number
): THREE.Quaternion {
  const delta = Math.max(0, finiteNumber(deltaSeconds));
  const deltaEuler = new THREE.Euler(
    THREE.MathUtils.degToRad(finiteNumber(speed?.x)) * delta,
    THREE.MathUtils.degToRad(-finiteNumber(speed?.y)) * delta,
    THREE.MathUtils.degToRad(-finiteNumber(speed?.z)) * delta,
    'ZXY'
  );

  return new THREE.Quaternion().setFromEuler(deltaEuler);
}

/** Applies a Unity-compatible incremental rotation around the object's local axes. */
function applyUnityLocalRotationDelta(
  object: THREE.Object3D,
  speed: UnityRotationSpeed | null | undefined,
  deltaSeconds: number
): void {
  object.quaternion.multiply(createUnityLocalRotationDelta(speed, deltaSeconds));
}

export {
  applyUnityLocalRotationDelta,
  createUnityLocalRotationDelta,
  type UnityRotationSpeed,
};
