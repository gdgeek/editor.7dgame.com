import * as THREE from 'three';

export function applyMediaBlend( object: THREE.Object3D, mode: unknown ): void {

	const material = ( object as THREE.Mesh ).material;
	if ( ! material ) return;
	for ( const item of Array.isArray( material ) ? material : [ material ] ) {

		item.blending = mode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
		item.transparent = true;
		item.depthWrite = mode !== 'additive';
		item.needsUpdate = true;

	}

}
