import * as THREE from 'three';
import { MetaFactory } from './MetaFactory.js';
import type { MrppEditor, MrppObject3D, MrppScene } from '../types/mrpp.js';

class MetaLoader {

	editor: MrppEditor;
	json: string | null;
	isLoading: boolean;
	loadingPromises: Promise<any>[];
	factory: MetaFactory;

	constructor(editor: MrppEditor) {

		this.editor = editor;
		this.json = null;
		this.isLoading = true;
		this.loadingPromises = [];
		// r183: editor.selector is a Selector class instance, not a filter function.
		// Monkey-patch its select() method to add the hidden-object filter.
		const originalSelectorSelect = editor.selector.select.bind( editor.selector );
		editor.selector.select = function ( object: THREE.Object3D ) {
			if ( object && (object as any).userData && (object as any).userData.hidden ) {
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

	async getMeta(): Promise<any> {
		return this.write(this.editor.scene);
	}

	isChanged(json: string): boolean {
		if (this.json === null) return false;
		return this.json !== json;
	}

	async changed(): Promise<boolean> {
		const meta = await this.getMeta();
		return this.isChanged(JSON.stringify({  meta, events: (this.editor.scene as MrppScene).events }));
	}

	async save(): Promise<void> {
		if (this.isLoading) {
			console.warn('Cannot save while models are still loading');
			return;
		}

		const meta = await this.getMeta();
		const data = { meta, events: (this.editor.scene as MrppScene).events };
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

	getLoadingStatus(): boolean {
		return this.isLoading;
	}

	initLoading(): void {
		this.isLoading = true;
		this.editor.signals.savingStarted.dispatch();
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

	writeEntity(node: THREE.Object3D): any | null {

		if ((node as any).userData.type === undefined) {

			return null;

		}

		const entity: any = {};

		entity.type = (node as any).userData.type;
		entity.parameters = {};
		entity.parameters.uuid = node.uuid;
		entity.parameters.name = node.name;
		entity.parameters.transform = {};
		entity.parameters.transform.position = {
			x: (node as any).position.x,
			y: (node as any).position.y,
			z: (node as any).position.z
		};
		entity.parameters.transform.rotate = {
			x: ((node as any).rotation.x / Math.PI) * 180,
			y: ((node as any).rotation.y / Math.PI) * 180,
			z: ((node as any).rotation.z / Math.PI) * 180
		};
		entity.parameters.transform.scale = {
			x: (node as any).scale.x,
			y: (node as any).scale.y,
			z: (node as any).scale.z
		};
		entity.parameters.active = node.visible;

		entity.children = { 'entities': [] as any[], 'components': (node as MrppObject3D).components, 'commands': (node as MrppObject3D).commands };
		node.children.forEach((child) => {

			const ce = this.writeEntity(child);
			if (ce != null) {

				entity.children.entities.push(ce);

			}

		});
		const exclude = ['type', 'width'];
		Object.keys((node as any).userData).forEach(key => {

			if (!exclude.includes(key)) {

				entity.parameters[key] = (node as any).userData[key];

			}

		});
		if ((node as any).userData['width'] && node instanceof THREE.Mesh) {

			const geometry = (node as any).geometry;
			if (geometry instanceof THREE.PlaneGeometry) {

				entity.parameters.width = (geometry as any).parameters.width;

			}

		}

		return entity;

	}

	async write(root: THREE.Scene): Promise<any> {

		const data: any = {};
		data.type = 'MetaRoot';
		data.parameters = { 'uuid': root.uuid };
		const entities: any[] = [];
		data.children = { 'entities': [] as any[], 'addons': [] as any[] };
		root.children.forEach((node) => {
			const entity = this.writeEntity(node);
			if (entity != null) {
				entities.push(entity);
			}
		});
		data.children.entities = entities;
		return data;

	}

	async clear(): Promise<void> {
		this.editor.clear();
	}

	async load(meta: any): Promise<void> {

		let scene: THREE.Scene | null = this.editor.scene;
		if (!scene) {
			scene = new THREE.Scene();
			scene.name = 'Scene';
			this.editor.setScene(scene);
		}

		if (!meta.events) {

			(scene as MrppScene).events = { inputs: [], outputs: [] };

		} else {

			(scene as MrppScene).events = meta.events;

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


		if (meta.data) {

			const data = meta.data;
			const resources = new Map<string, any>();
			console.log(meta);
			meta.resources.forEach((r: any) => {
				resources.set(r.id.toString(), r);

			});

			(root as any).uuid = data.parameters.uuid;
			const loadPromise = this.factory.readMeta(root, data, resources, this.editor);
			this.loadingPromises.push(loadPromise);

			Promise.all(this.loadingPromises).then(async () => {
				this.isLoading = false;
				this.editor.signals.savingFinished.dispatch();
				this.editor.signals.sceneGraphChanged.dispatch();

				const metaData = await this.write(root);
				this.json = JSON.stringify({ meta: metaData, events: (this.editor.scene as MrppScene).events });
			}).catch((error: any) => {
				console.error('Error loading models:', error);
				this.isLoading = false;
				this.editor.signals.savingFinished.dispatch();
			});

			this.editor.signals.sceneGraphChanged.dispatch();

		} else {
			this.isLoading = false;
			this.editor.signals.savingFinished.dispatch();

			const metaData = await this.write(root);
			this.json = JSON.stringify({ meta: metaData, events: (this.editor.scene as MrppScene).events });
		}
	}

}

export { MetaLoader };
