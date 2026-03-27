import * as THREE from 'three';

class Builder {

	/** 构造 Builder 实例 */
	constructor() {
	}
	/**
	 * 创建基础节点数据结构。
	 * @param {string} type - 节点类型
	 * @param {string} name - 节点名称
	 * @returns {object} 节点数据对象
	 */
	node(type, name) {

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
	/**
	 * 根据资源数据创建对应类型的节点。
	 * @param {object} data - 资源数据（包含 type, name, id, src 等）
	 * @returns {object|null} 节点数据对象，不支持的类型返回 null
	 */
	resource(data) {

		let ret = null;
		switch (data.type.toLowerCase()) {

			case 'voxel':
				ret = this.node('Voxel', data.name + ' [voxel]');
				ret.parameters.isCollider = false;
				break;
			case 'picture':
				ret = this.node('Picture', data.name + ' [picture]');
				ret.parameters.sortingOrder = 0;
				ret.parameters.width = 0.5;
				ret.parameters.isCollider = false;
				break;
			case 'polygen':
				ret = this.node('Polygen', data.name + ' [polygen]');
				ret.parameters.isCollider = false;
				break;
			case 'audio':
				ret = this.node('Sound', data.name + ' [sound]');
				ret.parameters.loop = false;
				ret.parameters.volume = 1;
				ret.parameters.rate = 1;
				ret.parameters.play = false;
				ret.parameters.src = data.src;
				break;
			case 'video':
				ret = this.node('Video', data.name + ' [video]');
				ret.parameters.width = 0.5;
				ret.parameters.loop = false;
				ret.parameters.muted = false;
				ret.parameters.volume = 1;
				ret.parameters.rate = 1;
				ret.parameters.play = false;
				ret.parameters.console = true;
				ret.parameters.src = data.src;
				break;
			case 'particle':
				ret = this.node('Particle', data.name + ' [particle]');
				ret.parameters.width = 0.5;
				if (data.src) {
					ret.parameters.src = data.src;
					const fileExt = data.src.toLowerCase().split('.').pop();
					if (['mp4', 'mov', 'avi', 'webm'].includes(fileExt)) {
						ret.parameters.isVideo = true;
						ret.parameters.loop = true;
						ret.parameters.muted = false;
						ret.parameters.volume = 1;
						ret.parameters.rate = 1;
						ret.parameters.play = false;
					} else if (['mp3', 'wav'].includes(fileExt)) {
						ret.parameters.isAudio = true;
						ret.parameters.loop = true;
						ret.parameters.volume = 1;
						ret.parameters.rate = 1;
						ret.parameters.play = false;
					}
				}
				break;
		}

		if (ret != null) {

			ret.parameters.resource = data.id;

		}

		return ret;

	}
	/**
	 * 创建模块节点。
	 * @param {string} meta_id - 模块 ID
	 * @param {string} [title='Module'] - 模块标题
	 * @returns {object} 模块节点数据
	 */
	module(meta_id, title = 'Module') {

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
	/**
	 * 创建锚点节点。
	 * @param {string} [title='Anchor'] - 锚点标题
	 * @returns {object} 锚点节点数据
	 */
	anchor(title = 'Anchor') {

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
	/**
	 * 创建文本节点。
	 * @param {string} [content='Hello World'] - 文本内容
	 * @returns {object} 文本节点数据
	 */
	text(content = 'Hello World') {

		const ret = this.node('Text', 'Text');
		ret.parameters.text = content;
		// rect stored in meters: 256px * 0.005m/px = 1.28m, 64px * 0.005 = 0.32m
		ret.parameters.rect = { x: 1.28, y: 0.32 };
		ret.parameters.size = 24;
		ret.parameters.color = '#ffffff';
		ret.parameters.align = {
			horizontal: 'center',
			vertical: 'middle'
		};
		ret.parameters.background = {
			enable: true,
			color: '#808080',
			opacity: 0.5
		};
		ret.parameters.follow = false;
		return ret;

	}
	/**
	 * 创建 Phototype 节点。
	 * @param {object} data - 包含 title, data, phototype 的数据对象
	 * @returns {object} Phototype 节点数据
	 */
	phototype(data) {
		const ret = this.node('Phototype', data.title + ' [phototype]');
		ret.parameters.data = data.data || {};
		ret.parameters.phototype = data.phototype || {};
		return ret;
	}
	/**
	 * 创建空实体节点。
	 * @returns {object} 实体节点数据
	 */
	entity() {

		const ret = this.node('Entity', 'Point');
		return ret;

	}

}
export { Builder };
