import * as THREE from 'three';

class Factory {

	constructor() {
	}

	lockNode(node: THREE.Object3D): void {

		(node as any).userData.hidden = true;
		node.children.forEach(item => {
			this.lockNode(item);
		});

	}

	setTransform(node: THREE.Object3D, transform: { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number }; rotate: { x: number; y: number; z: number } }): void {

		const p = transform.position;
		const s = transform.scale;
		const r = transform.rotate;
		(node as any).position.set(p.x, p.y, p.z);
		(node as any).scale.set(s.x, s.y, s.z);

		(node as any).rotation.set(
			THREE.MathUtils.degToRad(r.x),
			THREE.MathUtils.degToRad(r.y),
			THREE.MathUtils.degToRad(r.z)
		);

	}

	async addAnchor(data: any, _root?: THREE.Object3D): Promise<THREE.Object3D> {

		const node = new THREE.Group();
		node.name = data.parameters?.title || data.parameters?.name || 'Anchor';
		return node;

	}

	getMatrix4(transform: { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number }; rotate: { x: number; y: number; z: number } }): THREE.Matrix4 {

		const p = transform.position;
		const s = transform.scale;
		const r = transform.rotate;
		const rotate = new THREE.Matrix4().makeRotationFromEuler(
			new THREE.Euler(
				THREE.MathUtils.degToRad(r.x),
				THREE.MathUtils.degToRad(r.y),
				THREE.MathUtils.degToRad(r.z),
				'XYZ'
			)
		);
		const scale = new THREE.Matrix4().makeScale(s.x, s.y, s.z);

		rotate.multiply(scale).setPosition(p.x, p.y, p.z);
		return rotate;

	}

}

export { Factory };
