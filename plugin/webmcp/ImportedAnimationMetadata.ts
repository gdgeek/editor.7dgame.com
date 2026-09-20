import type { AnimationClip, Object3D } from 'three';

// Provenance belongs to the import session, never to serialized userData.
const imported = new WeakMap<Object3D, readonly AnimationClip[]>();
export function markImportedAnimations( object: Object3D, clips: AnimationClip[] ): void {
	imported.set( object, clips );
}
export function getImportedAnimations( object: Object3D ): readonly AnimationClip[] | undefined {
	return imported.get( object );
}
