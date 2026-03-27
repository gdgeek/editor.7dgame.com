import * as THREE from 'three';
import { MetaFactory } from './MetaFactory.js';
//import { SceneBuilder } from './SceneBuilder.js'
class MetaLoader {

	/**
	 * @param {object} editor - Editor 实例
	 */
	constructor(editor) {

		this.editor = editor;
		this.json = null;
		this.isLoading = true;
		this.loadingPromises = [];
		// r183: editor.selector is a Selector class instance, not a filter function.
		// Monkey-patch its select() method to add the hidden-object filter.
		const originalSelectorSelect = editor.selector.select.bind( editor.selector );
		editor.selector.select = function ( object ) {
			if ( object && object.userData && object.userData.hidden ) {
				return; // skip hidden objects
			}
			return originalSelectorSelect( object );
		};

		editor.signals.upload.add(() => {
			this.save();
		});

		//const builder = new SceneBuilder(editor)
		editor.renderer = new THREE.WebGLRenderer();
		this.factory = new MetaFactory(editor);

		editor.signals.savingStarted.dispatch();
	}

	/**
	 * @returns {Promise<object>} 序列化后的 meta 数据
	 */
	async getMeta() {
		return this.write(this.editor.scene);
	}

	/**
	 * @param {string} json - JSON 字符串
	 * @returns {boolean} 是否与上次保存的 JSON 不同
	 */
	isChanged(json) {
		if (this.json === null) return false;
		return this.json !== json;
	}

	/**
	 * @returns {Promise<boolean>} 当前场景是否有未保存的变更
	 */
	async changed() {
		const meta = await this.getMeta();
		return this.isChanged(JSON.stringify({  meta, events: this.editor.scene.events }));
	}

	/**
	 * @returns {Promise<void>}
	 */
	async save() {
		if (this.isLoading) {
			console.warn('Cannot save while models are still loading');
			return;
		}

		const meta = await this.getMeta();
		const data = { meta, events: this.editor.scene.events };
		const json = JSON.stringify(data);
		const changed = this.isChanged(json);

		if (changed) {
			this.editor.signals.messageSend.dispatch({
				action: 'save-meta',
				data
			});
			this.json = json;
		} else {
			this.editor.signals.messageSend.dispatch({
				action: 'save-meta-none'
			});
		}
	}

	/**
	 * @returns {boolean} 是否正在加载中
	 */
	getLoadingStatus() {
		return this.isLoading;
	}

	/**
	 * @returns {void}
	 */
	initLoading() {
		this.isLoading = true;
		this.editor.signals.savingStarted.dispatch();
	}

	/**
	 * @param {object} obj1 - 比較対象のオブジェクト 1
	 * @param {object} obj2 - 比較対象のオブジェクト 2
	 * @param {string} [path=''] - 当前属性路径（递归用）
	 * @param {number} [tolerance=0.0001] - 数值比较容差
	 * @returns {void}
	 */
	compareObjectsAndPrintDifferences(obj1, obj2, path = '', tolerance = 0.0001) {

		if (obj1 == null || obj2 == null) {

			console.warn('One of the objects is null');
			return;

		}

		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);

		for (const key of keys1) {

			const val1 = obj1[key];
			const val2 = obj2[key];
			const currentPath = path ? `${path}.${key}` : key;

			if (typeof val1 === 'object' && typeof val2 === 'object') {

				this.compareObjectsAndPrintDifferences(val1, val2, currentPath);

			} else if (typeof val1 === 'number' && typeof val2 === 'number') {

				if (Math.abs(val1 - val2) > tolerance) {

					console.warn(`Difference found at "${key}":`);
					console.warn(`Object 1: ${val1}`);
					console.warn(`Object 2: ${val2}`);

				}

			} else if (val1 !== val2) {

				console.warn(`Difference found at ${currentPath}:`);
				console.warn(`Object 1: ${val1}`);
				console.warn(`Object 2: ${val2}`);

			}

		}

		// Check for keys present in obj2 but not in obj1
		for (const key of keys2) {

			if (!keys1.includes(key)) {

				const currentPath = path ? `${path}.${key}` : key;
				console.warn(`Key ${currentPath} present in Object 2 but not in Object 1`);

			}

		}

	}

	/**
	 * @param {import('three').Object3D} node - 场景节点
	 * @returns {object | null} 序列化后的实体对象，若节点无 type 则返回 null
	 */
	writeEntity(node) {

		if (node.userData.type === undefined) {

			return null;

		}

		const entity = {};

		entity.type = node.userData.type;
		entity.parameters = {};
		entity.parameters.uuid = node.uuid;
		entity.parameters.name = node.name;
		entity.parameters.transform = {};
		entity.parameters.transform.position = {
			x: node.position.x,
			y: node.position.y,
			z: node.position.z
		};
		entity.parameters.transform.rotate = {
			x: (node.rotation.x / Math.PI) * 180,
			y: (node.rotation.y / Math.PI) * 180,
			z: (node.rotation.z / Math.PI) * 180
		};
		entity.parameters.transform.scale = {
			x: node.scale.x,
			y: node.scale.y,
			z: node.scale.z
		};
		//console.log('entity.parameters', entity);
		//entity.parameters.transform.active = true
		entity.parameters.active = node.visible;


		/**
		 * MRPP 扩展属性：组件数组，附加在 THREE.Object3D 实例上。
		 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
		 * @type {Array<{type: string, [key: string]: any}>}
		 */
		// node.components

		/**
		 * MRPP 扩展属性：命令数组，附加在 THREE.Object3D 实例上。
		 * @type {Array<{type: string, [key: string]: any}>}
		 */
		// node.commands

		entity.children = { 'entities': [], 'components': node.components, 'commands': node.commands };
		node.children.forEach((child) => {

			const ce = this.writeEntity(child);
			if (ce != null) {

				entity.children.entities.push(ce);

			}

		});
		const exclude = ['type', 'width'];
		Object.keys(node.userData).forEach(key => {

			if (!exclude.includes(key)) {

				entity.parameters[key] = node.userData[key];

			}

		});
		if (node.userData['width'] && node instanceof THREE.Mesh) {

			const geometry = node.geometry;
			if (geometry instanceof THREE.PlaneGeometry) {

				entity.parameters.width = geometry.parameters.width;

			}

		}


		//console.error(entity)
		return entity;

	}

	/**
	 * @param {import('three').Scene} root - 场景根节点
	 * @returns {Promise<object>} 序列化后的 MetaRoot 数据
	 */
	async write(root) {

		const data = {};
		data.type = 'MetaRoot';
		data.parameters = { 'uuid': root.uuid };
		const entities = [];
		data.children = { 'entities': [], 'addons': [] };
		root.children.forEach((node) => {
			const entity = this.writeEntity(node);
			if (entity != null) {
				entities.push(entity);
			}
		});
		data.children.entities = entities;
		return data;

	}

	/**
	 * @returns {Promise<void>}
	 */
	async clear() {
		this.editor.clear();
	}

	/**
	 * @param {object} meta - 加载的 meta 数据（包含 data、resources、events 等字段）
	 * @returns {Promise<void>}
	 */
	async load(meta) {

		let scene = this.editor.scene;
		if (!scene) {
			scene = new THREE.Scene();
			scene.name = 'Scene';
			this.editor.setScene(scene);
		}

		/**
		 * MRPP 扩展属性：事件对象，附加在 THREE.Scene 实例上。
		 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
		 * @type {{inputs: Array<{title: string, uuid: string}>, outputs: Array<{title: string, uuid: string}>}}
		 */
		if (!meta.events) {

			scene.events = { inputs: [], outputs: [] };

		} else {

			scene.events = meta.events;
			// scene.events = JSON.parse(meta.events);

		}

		this.isLoading = true;
		this.loadingPromises = [];

		this.editor.signals.savingStarted.dispatch();

		this.editor.signals.sceneGraphChanged.dispatch();
		let lights = this.editor.scene.getObjectByName('$lights');
		if (lights == null) {

			lights = new THREE.Group();
			lights.name = '$lights';
			const light1 = new THREE.DirectionalLight(0xffffff, 0.5);
			light1.position.set(- 0.5, 0, 0.7);
			light1.name = 'light1';
			lights.add(light1);
			const light2 = new THREE.AmbientLight(0xffffff, 0.5);

			light2.name = 'light2';
			lights.add(light2);
			const light3 = new THREE.PointLight(0xffffff, 1);
			light3.position.set(0, 0, 0);
			light3.name = 'light3';
			lights.add(light3);
			scene.add(lights);
			this.factory.lockNode(lights);
			this.editor.signals.sceneGraphChanged.dispatch();

		}

		const root = this.editor.scene;


		if (meta.data) {

			const data = meta.data;
			const resources = new Map();
			console.log(meta);
			meta.resources.forEach(r => {
				resources.set(r.id.toString(), r);

			});

			root.uuid = data.parameters.uuid;
			const loadPromise = this.factory.readMeta(root, data, resources, this.editor);
			this.loadingPromises.push(loadPromise);

			Promise.all(this.loadingPromises).then(async () => {
				this.isLoading = false;
				this.editor.signals.savingFinished.dispatch();
				this.editor.signals.sceneGraphChanged.dispatch();

				const metaData = await this.write(root);
				this.json = JSON.stringify({ meta: metaData, events: this.editor.scene.events });
				// console.warn('All models loaded successfully');
			}).catch(error => {
				console.error('Error loading models:', error);
				this.isLoading = false;
				this.editor.signals.savingFinished.dispatch();
			});

			this.editor.signals.sceneGraphChanged.dispatch();

		} else {
			this.isLoading = false;
			this.editor.signals.savingFinished.dispatch();

			const metaData = await this.write(root);
			this.json = JSON.stringify({ meta: metaData, events: this.editor.scene.events });
		}
	}

}

export { MetaLoader };
