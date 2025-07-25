


class Builder {

	constructor() {
	}
	node( type, name ) {

		return {
			type: type,
			children: {
				components: [],
				entities: []
			},
			parameters: {
				name: name,
				transform: {
					position: { x: 0, y: 0, z: 0 },
					scale: { x: 1, y: 1, z: 1 },
					rotate: { x: 0, y: 0, z: 0 }
				},
				uuid: THREE.MathUtils.generateUUID(),
				active: true,
			}
		};

	}
	resource( data ) {

		let ret = null;
		switch ( data.type.toLowerCase() ) {

			case 'voxel':
				ret = this.node( 'Voxel', data.name + ' [voxel]' );
				break;
			case 'picture':
				ret = this.node( 'Picture', data.name + ' [picture]' );
				ret.parameters.width = 0.5;
				break;
			case 'polygen':
				ret = this.node( 'Polygen', data.name + ' [polygen]' );
				break;
			case 'audio':
				ret = this.node( 'Sound', data.name + ' [sound]' );
				break;
			case 'video':
				ret = this.node( 'Video', data.name + ' [video]' );
				ret.parameters.width = 0.5;
				ret.parameters.loop = false;
				ret.parameters.muted = false;
				ret.parameters.volume = 1;
				ret.parameters.play = true;
				ret.parameters.console = true;
				break;
			case 'particle':
				ret = this.node( 'Particle', data.name + ' [particle]' );
				ret.parameters.width = 0.5; // 添加宽度参数，用于图片和视频渲染
				break;
		}

		if ( ret != null ) {

			ret.parameters.resource = data.id;

		}

		return ret;

	}
	module( meta_id, title = 'Module' ) {

		return {
			type: 'Module',
			children: {},
			parameters: {
				meta_id: meta_id,
				title: title,
				transform: {
					position: { x: 0, y: 0, z: 0 },
					scale: { x: 1, y: 1, z: 1 },
					rotate: { x: 0, y: 0, z: 0 }
				},
				uuid: THREE.MathUtils.generateUUID(),
				active: true,
			}
		};

	}
	anchor( title = 'Anchor' ) {

		return {
			type: 'Anchor',
			children: {},
			parameters: {
				title: title,
				transform: {
					position: { x: 0, y: 0, z: 0 },
					scale: { x: 1, y: 1, z: 1 },
					rotate: { x: 0, y: 0, z: 0 }
				},
				uuid: THREE.MathUtils.generateUUID(),
				active: true,
			}
		};

	}
	text( content = 'Hello World' ) {

		const ret = this.node( 'Text', 'Text' );
		ret.parameters.text = content;
		return ret;

	}
	entity() {

		const ret = this.node( 'Entity', 'Point' );
		return ret;

	}

}
export { Builder };
