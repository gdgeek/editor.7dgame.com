import * as THREE from 'three';
import { MetaFactory } from './MetaFactory.js';

class VerseLoader {

	/**
	 * @param {object} editor - Editor 実例
	 */
	constructor(editor) {

		this.editor = editor;
		const types = ['Module'];
		this.types = types;
		this.json = null;
		this.isLoading = true;
		this.loadingPromises = [];

		editor.renderer = new THREE.WebGLRenderer();
		this.factory = new MetaFactory(editor);

		// r183: editor.selector is a Selector class instance, not a filter function.
		// Monkey-patch its select() method to add the hidden/type filter.
		const originalSelectorSelect = editor.selector.select.bind( editor.selector );
		editor.selector.select = function ( object ) {
			if ( object && object.userData && object.userData.hidden ) {
				return; // skip hidden objects
			}
			if ( object && object.type && !types.includes( object.type ) ) {
				return; // only allow specific types in verse mode
			}
			return originalSelectorSelect( object );
		};


		editor.signals.upload.add(() => {
			this.save();
		});

		editor.signals.release.add(() => {
			this.publish();
		});

		editor.signals.savingStarted.dispatch();
	}

	/**
	 * @returns {Promise<object>} 序列化後の verse データ
	 */
	async getVerse() {
		return this.write(this.editor.scene);
	}

	/**
	 * @param {string} json - JSON 文字列
	 * @returns {boolean} 前回保存した JSON と異なるかどうか
	 */
	isChanged(json) {
		if (this.json === null) return false;
		return this.json !== json;
	}

	/**
	 * @returns {Promise<boolean>} 現在のシーンに未保存の変更があるかどうか
	 */
	async changed() {
		const verse = await this.getVerse();
		return this.isChanged(JSON.stringify({ verse }));
	}

	/**
	 * @returns {boolean} ロード中かどうか
	 */
	getLoadingStatus() {
		return this.isLoading;
	}

	/**
	 * @returns {Promise<void>}
	 */
	async save() {
		if (this.isLoading) {
			console.warn('Cannot save while modules are still loading');
			return;
		}

		const verse = await this.getVerse();
		const data = { verse };
		const json = JSON.stringify(data);
		const changed = this.isChanged(json);
		if (changed) {
			this.editor.signals.messageSend.dispatch({
				action: 'save-verse',
				data
			});
			this.json = json;
		} else {
			// console.warn('No changes detected, sending save-verse-none');
			this.editor.signals.messageSend.dispatch({
				action: 'save-verse-none'
			});
		}
	}

	/**
	 * @returns {Promise<void>}
	 */
	async publish() {
		if (this.isLoading) {
			console.warn('Cannot publish while modules are still loading');
			return;
		}

		const verse = await this.getVerse();
		const data = { verse };
		const json = JSON.stringify(data);

		this.editor.signals.messageSend.dispatch({
			action: "release-verse",
			data,
		});
		this.json = json;
	}

	/**
	 * @param {object} obj1 - 比較対象のオブジェクト 1
	 * @param {object} obj2 - 比較対象のオブジェクト 2
	 * @param {string} [path=''] - 現在のプロパティパス（再帰用）
	 * @param {number} [tolerance=0.0001] - 数値比較の許容誤差
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

					console.warn(`Difference found at: "${currentPath}":`);
					console.warn(`Object 1: ${val1}`);
					console.warn(`Object 2: ${val2}`);

				}

			} else if (val1 !== val2) {

				console.warn(`Difference found at, ${currentPath}:`);
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
	 * @param {import('three').Object3D} node - シーンノード
	 * @returns {object | null} シリアライズされたモジュールデータ、対象外の場合は null
	 */
	writeData(node) {

		if (!this.types.includes(node.type)) {

			return null;

		}

		const data = {};

		data.type = node.type;


		data.parameters = {};
		data.parameters.uuid = node.uuid;
		data.parameters.title = node.name;
		data.parameters.transform = {};
		data.parameters.transform.position = {
			x: node.position.x,
			y: node.position.y,
			z: node.position.z
		};
		data.parameters.transform.rotate = {
			x: (node.rotation.x / Math.PI) * 180,
			y: (node.rotation.y / Math.PI) * 180,
			z: (node.rotation.z / Math.PI) * 180
		};
		data.parameters.transform.scale = {
			x: node.scale.x,
			y: node.scale.y,
			z: node.scale.z
		};
		const exclude = ['type', 'draggable', 'custom'];

		Object.keys(node.userData).forEach(key => {
			if (!exclude.includes(key)) {
				data.parameters[key] = node.userData[key];
			}
		});
		//console.error('data.parameters: ', data.parameters);
		//entity.parameters.transform.active = true
		//console.error('node.visible', node.visible);
		data.parameters.active = node.visible;
		return data;

	}

	/**
	 * @param {import('three').Scene} root - シーンルートノード
	 * @returns {Promise<object>} シリアライズされた Verse データ
	 */
	async write(root) {

		const data = {};
		data.type = 'Verse';
		data.parameters = { 'uuid': root.uuid };

		const modules = [];

		root.children.forEach(node => {

			const nd = this.writeData(node);
			if (nd !== null) {

				if (node.type === 'Module') {

					modules.push(nd);

				}

			}


		});
		data.children = { modules };
		return data;

	}

	/**
	 * @param {import('three').Scene} root - シーンルートノード
	 * @param {object} data - verse データオブジェクト
	 * @param {Map<string, object>} resources - リソースマップ
	 * @param {Map<string, object>} metas - メタデータマップ
	 * @returns {Promise<void>}
	 */
	async read(root, data, resources, metas) {
		return new Promise(async (resolve, reject) => {
			try {
		root.uuid = data.parameters.uuid;
				const loadingPromises = [];

		if (data.children.anchors) {
					for (const item of data.children.anchors) {
						const anchorPromise = this.addAnchor(item, root);
						loadingPromises.push(anchorPromise);
					}
		}

		if (data.children.modules) {
					for (const item of data.children.modules) {
						const modulePromise = new Promise(async (moduleResolve) => {
							try {
				const meta = metas.get(item.parameters.meta_id.toString());
				if (!meta) {
					console.warn(`Meta not found for module meta_id=${item.parameters.meta_id}, skipping`);
					moduleResolve();
					return;
				}
				const node = this.factory.addModule(item);
				node.userData.custom = meta.custom;
				root.add(node);
				this.editor.signals.sceneGraphChanged.dispatch();

				if (meta && meta.data && meta.custom !== 0) {
					await this.factory.readMeta(node, meta.data, resources);
					this.editor.signals.sceneGraphChanged.dispatch();
				}

				await this.factory.addGizmo(node);
				this.editor.signals.sceneGraphChanged.dispatch();
								moduleResolve();
							} catch (error) {
								console.error('Error loading module:', error);
								moduleResolve();
							}
						});

						loadingPromises.push(modulePromise);
					}
				}

				await Promise.all(loadingPromises);
				resolve();
			} catch (err) {
				console.error('Error in read method:', err);
				reject(err);
			}
		});
	}

	/**
	 * @returns {Promise<void>}
	 */
	async clear() {
		this.scene.clear();
	}

	/**
	 * @param {object} verse - ロードする verse データ（data、resources、metas フィールドを含む）
	 * @returns {Promise<void>}
	 */
	async load(verse) {
		this.isLoading = true;
		this.loadingPromises = [];

		this.editor.signals.savingStarted.dispatch();

		let scene = this.editor.scene;
		if (scene == null) {
			scene = new THREE.Scene();
			scene.name = 'Scene';
			this.editor.setScene(scene);
		}

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

		if (verse.data !== null) {
			const data = verse.data;
			if (typeof this.data !== 'undefined') {
				await this.removeNode(this.data, data);
			}

			const resources = new Map();
			verse.resources.forEach(item => {
				resources.set(item.id.toString(), item);
			});

			const metas = new Map();
			verse.metas.forEach(item => {
				metas.set(item.id.toString(), item);
			});

			const loadPromise = this.read(root, data, resources, metas);
			this.loadingPromises.push(loadPromise);

			Promise.all(this.loadingPromises).then(async () => {
				this.isLoading = false;
				this.editor.signals.savingFinished.dispatch();

			const copy = await this.write(root);
			this.compareObjectsAndPrintDifferences(data, copy);

			this.editor.signals.sceneGraphChanged.dispatch();
		this.json = JSON.stringify({ verse: await this.write(root) });

				// console.warn('All modules loaded successfully');
			}).catch(error => {
				console.error('Error loading modules:', error);
				this.isLoading = false;
				this.editor.signals.savingFinished.dispatch();
			});
		} else {
			this.isLoading = false;
			this.editor.signals.savingFinished.dispatch();
			this.json = JSON.stringify({ verse: await this.write(root) });
		}
	}

}

export { VerseLoader };
