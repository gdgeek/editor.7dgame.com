/* global THREE */
/** @type {typeof import('three')} */
// eslint-disable-next-line no-unused-vars -- THREE is loaded via import map in the HTML host

class Factory {

	constructor() {
	}

	/**
	 * @param {import('three').Object3D} node
	 * @returns {void}
	 */
	lockNode( node ) {

		node.userData.hidden = true;
		node.children.forEach( item => {
			this.lockNode( item );
		} );

	}
	/**
	 * @param {import('three').Object3D} node
	 * @param {{position: {x: number, y: number, z: number}, scale: {x: number, y: number, z: number}, rotate: {x: number, y: number, z: number}}} transform
	 * @returns {void}
	 */
	setTransform( node, transform ) {
		//alert(JSON.stringify(transform));
		const p = transform.position;
		const s = transform.scale;
		const r = transform.rotate;
		node.position.set( p.x, p.y, p.z );
		node.scale.set( s.x, s.y, s.z );

		node.rotation.set(
			THREE.MathUtils.degToRad( r.x ),
			THREE.MathUtils.degToRad( r.y ),
			THREE.MathUtils.degToRad( r.z )
		);

	}
	/**
	 * @param {{position: {x: number, y: number, z: number}, scale: {x: number, y: number, z: number}, rotate: {x: number, y: number, z: number}}} transform
	 * @returns {import('three').Matrix4}
	 */
	getMatrix4( transform ) {

		const p = transform.position;
		const s = transform.scale;
		const r = transform.rotate;
		const rotate = new THREE.Matrix4().makeRotationFromEuler(
			new THREE.Euler(
				THREE.MathUtils.degToRad( r.x ),
				THREE.MathUtils.degToRad( r.y ),
				THREE.MathUtils.degToRad( r.z ),
				'XYZ'
			)
		);
		const scale = new THREE.Matrix4().makeScale( s.x, s.y, s.z );

		rotate.multiply( scale ).setPosition( p.x, p.y, p.z );
		return rotate;

	}


}

export { Factory };
