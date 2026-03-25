
class Factory {

	constructor() {
	}
	lockNode( node ) {

		node.userData.hidden = true;
		node.children.forEach( item => {
			this.lockNode( item );
		} );

	}
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
