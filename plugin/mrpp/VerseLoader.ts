import * as THREE from 'three';
import { MetaFactory } from './MetaFactory.js';
import type { MrppEditor } from '../types/mrpp.js';

class VerseLoader {

	editor: MrppEditor;
	types: string[];
	json: string | null;
	isLoading: boolean;
	loadingPromises: Promise<any>[];
	factory: MetaFactory;
	// dynamic property set in load() — typed loosely for editor API interaction
	data: any;

	constructor(editor: MrppEditor) {

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
		// When a hidden child (e.g., GLTF mesh inside a polygen) is clicked,
		// walk up the parent chain to find the nearest selectable entity root.
		// In verse mode, we also bubble up non-Module types to their Module parent.
		const originalSelectorSelect = editor.selector.select.bind( editor.selector );
		editor.selector.select = function ( object: THREE.Object3D ) {
			if ( object && (object as any).userData && (object as any).userData.hidden ) {
				// Walk up parent chain to find a non-hidden ancestor
				let parent = object.parent;
				while ( parent ) {
					if ( !(parent as any).userData?.hidden ) {
						return editor.selector.select( parent );
					}
					parent = parent.parent;
				}
				return; // no selectable ancestor found, skip
			}
			if ( object && object.type && !types.includes( object.type ) ) {
				// Not an allowed type — bubble up to find a Module ancestor
				let parent = object.parent;
				while ( parent ) {
					if ( parent.type && types.includes( parent.type ) ) {
						return originalSelectorSelect( parent );
					}
					parent = parent.parent;
				}
				return; // no Module ancestor found, skip
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

	async getVerse(): Promise<any> {
		return this.write(this.editor.scene);
	}

	isChanged(json: string): boolean {
		if (this.json === null) return false;
		return this.json !== json;
	}

	async changed(): Promise<boolean> {
		const verse = await this.getVerse();
		return this.isChanged(JSON.stringify({ verse }));
	}

	getLoadingStatus(): boolean {
		return this.isLoading;
	}

	async save(): Promise<void> {
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
			this.editor.signals.messageSend.dispatch({
				action: 'save-verse-none'
			});
		}
	}

	async publish(): Promise<void> {
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

	compareObjectsAndPrintDifferences(obj1: any, obj2: any, path: string = '', tolerance: number = 0.0001): void {

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

	writeData(node: THREE.Object3D): any | null {

		if (!this.types.includes(node.type)) {

			return null;

		}

		const data: any = {};

		data.type = node.type;


		data.parameters = {};
		data.parameters.uuid = node.uuid;
		data.parameters.title = node.name;
		data.parameters.transform = {};
		data.parameters.transform.position = {
			x: (node as any).position.x,
			y: (node as any).position.y,
			z: (node as any).position.z
		};
		data.parameters.transform.rotate = {
			x: ((node as any).rotation.x / Math.PI) * 180,
			y: ((node as any).rotation.y / Math.PI) * 180,
			z: ((node as any).rotation.z / Math.PI) * 180
		};
		data.parameters.transform.scale = {
			x: (node as any).scale.x,
			y: (node as any).scale.y,
			z: (node as any).scale.z
		};
		const exclude = ['type', 'draggable', 'custom'];

		Object.keys(node.userData).forEach(key => {
			if (!exclude.includes(key)) {
				data.parameters[key] = (node.userData as any)[key];
			}
		});
		data.parameters.active = node.visible;
		return data;

	}

	async write(root: THREE.Scene): Promise<any> {

		const data: any = {};
		data.type = 'Verse';
		data.parameters = { 'uuid': root.uuid };

		const modules: any[] = [];

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

	async read(root: THREE.Scene, data: any, resources: Map<string, any>, metas: Map<string, any>): Promise<void> {
		return new Promise(async (resolve, reject) => {
			try {
		(root as any).uuid = data.parameters.uuid;
				const loadingPromises: Promise<any>[] = [];

		if (data.children.anchors) {
					for (const item of data.children.anchors) {
						const anchorPromise = this.factory.addAnchor(item);
						loadingPromises.push(anchorPromise);
					}
		}

		if (data.children.modules) {
					for (const item of data.children.modules) {
						const modulePromise = new Promise<void>(async (moduleResolve) => {
							try {
				const meta = metas.get(item.parameters.meta_id.toString());
				if (!meta) {
					console.warn(`Meta not found for module meta_id=${item.parameters.meta_id}, skipping`);
					moduleResolve();
					return;
				}
				const node = this.factory.addModule(item);
				(node as any).userData.custom = (meta as any).custom;
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

	async clear(): Promise<void> {
		this.editor.scene.clear();
	}

	async load(verse: any): Promise<void> {
		this.isLoading = true;
		this.loadingPromises = [];

		this.editor.signals.savingStarted.dispatch();

		let scene: THREE.Scene | null = this.editor.scene;
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
			(light1 as any).position.set(- 0.5, 0, 0.7);
			light1.name = 'light1';
			lights.add(light1);
			const light2 = new THREE.AmbientLight(0xffffff, 0.5);

			light2.name = 'light2';
			lights.add(light2);
			const light3 = new THREE.PointLight(0xffffff, 1);
			(light3 as any).position.set(0, 0, 0);
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
				// removeNode is dynamically provided at runtime by the editor framework
				await (this as any).removeNode(this.data, data);
			}

			const resources = new Map<string, any>();
			verse.resources.forEach((item: any) => {
				resources.set(item.id.toString(), item);
			});

			const metas = new Map<string, any>();
			verse.metas.forEach((item: any) => {
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

			}).catch((error: any) => {
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
