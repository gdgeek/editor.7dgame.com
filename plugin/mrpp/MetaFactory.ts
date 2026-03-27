import * as THREE from 'three';

import { GLTFLoader } from '../../three.js/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../three.js/examples/jsm/loaders/DRACOLoader.js';
import { VOXLoader, VOXMesh } from '../../three.js/examples/jsm/loaders/VOXLoader.js';
import { KTX2Loader } from '../../three.js/examples/jsm/loaders/KTX2Loader.js';
import { Factory } from './Factory.js';

import { createTextMesh } from '../utils/TextUtils.js';
import { createMeshFromUrl, getResourceLayout } from '../utils/WebpUtils.js';
import type { MrppEditor, MrppObject3D } from '../types/mrpp.js';

const getResourceFromUrl = async (url: string): Promise<any> => {
	return new Promise((resolve, reject) => {

		fetch(url)
			.then(response => {
				if (!response.ok) {
					reject(new Error('网络响应不正常'));
				}

				return response.json();

			})
			.then(data => {
				resolve(data);
			})
			.catch(error => {
				reject(error);
			});
	});
};


const getUrlParams = (): Record<string, string> => {
	const params: Record<string, string> = {};
	const queryString = window.location.search.slice(1);

	if (queryString) {
		const pairs = queryString.split('&');

		for (const pair of pairs) {
			const [key, value] = pair.split('=');
			if (key) {
				params[decodeURIComponent(key)] = decodeURIComponent(value || '');
			}
		}
	}

	return params;
};

const isHttps = (): boolean => {

	const protocol = window.location.protocol;
	return protocol === 'https:';

};

const convertToHttps = (url: string | undefined | null): string => {

	if (url === undefined || url === null) return '';

	if (isHttps()) {

		if (url.startsWith('http://')) {

			return url.replace('http://', 'https://');

		}

	} else {

		if (url.startsWith('https://')) {

			return url.replace('https://', 'http://');

		}

	}

	return url;

};

class MetaFactory extends Factory {

	editor: MrppEditor;
	ktx2Loader: any;

	constructor(editor: MrppEditor) {

		super();

		this.editor = editor;
		this.ktx2Loader = null;

	}

	async addGizmo(node: THREE.Object3D): Promise<void> {

		return new Promise(resolve => {

			const loader = new GLTFLoader(THREE.DefaultLoadingManager);
			loader.load('/three.js/mesh/unreal-gizmo.glb', (gltf: any) => {

				const mesh = gltf.scene;
				mesh.scale.set(0.1, 0.1, 0.1);
				mesh.rotation.set(Math.PI / 2, Math.PI / 2, 0);
				this.lockNode(gltf.scene);
				node.add(gltf.scene);
				resolve();

			}, undefined, undefined);

		});

	}

	addModule(data: any): THREE.Group {

		const node = new THREE.Group();
		node.name = data.parameters.title;
		(node as any).type = data.type;
		(node as any).uuid = data.parameters.uuid;
		node.visible = data.parameters.active;

		const transform = data.parameters.transform;
		this.setTransform(node, transform);

		const userData: Record<string, any> = {};

		const exclude = ['name', 'title', 'uuid', 'transform', 'active'];

		Object.keys(data.parameters).forEach(key => {

			if (!exclude.includes(key)) {

				userData[key] = data.parameters[key];

			}

		});

		userData.draggable = false;
		node.userData = userData;
		return node;

	}

	async readMeta(root: THREE.Object3D, data: any, resources: Map<string, any>, editor: MrppEditor | null = null): Promise<void> {

		if (data.children) {

			for (let i = 0; i < data.children.entities.length; ++i) {

				if (data.children.entities[i] != null) {

					try {

						const node = await this.building(data.children.entities[i], resources);
						if (node != null) {

							root.add(node);
							if (editor != null) {

								editor.signals.sceneGraphChanged.dispatch();

							}

						}

					} catch (error) {

						console.error(error);

					}

				}

			}

		}

	}

	async loadVoxel(url: string): Promise<THREE.Mesh> {

		url = convertToHttps(url)!;
		return new Promise((resolve, reject) => {

			const loader = new VOXLoader();
			loader.load(
				url,
				(chunks: any) => {
					const chunk = chunks[0];
					const mesh = new VOXMesh(chunk);
					resolve(mesh);
				},
				(_xhr: any) => {
					// 加载进度
				},
				(error: any) => {
					console.error('VOX加载失败:', url, error);
					reject(error);
				}
			);

		});

	}

	setModelTransparency(object: THREE.Object3D, alpha: number): void {
		object.traverse((child: any) => {
			if (child.isMesh) {
				if (child.material) {
					if (Array.isArray(child.material)) {
						for (let i = 0; i < child.material.length; i++) {
							child.material[i] = this.cloneMaterialTransparency(child.material[i], alpha);
						}
					} else {
						child.material = this.cloneMaterialTransparency(child.material, alpha);
					}
				}
			}
		});
	}

	cloneMaterialTransparency(material: THREE.Material, alpha: number): THREE.Material {
		const clonedMaterial = material.clone();

		(clonedMaterial as any).transparent = true;
		(clonedMaterial as any).opacity = alpha;

		if ((clonedMaterial as any).side === THREE.DoubleSide) {
			(clonedMaterial as any).depthWrite = false;
		}
		return clonedMaterial;
	}

	async loadPolygen(url: string, alpha: number = 1): Promise<THREE.Group | null> {

		url = convertToHttps(url)!;
		const self = this;
		return new Promise((resolve, _reject) => {

			const loader = new GLTFLoader(THREE.DefaultLoadingManager);
			const dracoLoader = new DRACOLoader();

			dracoLoader.setDecoderPath('../examples/jsm/libs/draco/gltf/');
			loader.setDRACOLoader(dracoLoader);

			if (this.ktx2Loader === null) {
				this.ktx2Loader = new KTX2Loader();
				this.ktx2Loader.setTranscoderPath('../examples/jsm/libs/basis/');
				if (this.editor && this.editor.renderer) {
					this.ktx2Loader.detectSupport(this.editor.renderer);
				} else {
					console.warn('KTX2Loader 初始化失败，因为没有可用的渲染器上下文');
				}
			}

			if (this.ktx2Loader !== null) {
				loader.setKTX2Loader(this.ktx2Loader);
			}

			try {

				loader.load(
					url,
					function (gltf: any) {

						gltf.scene.children.forEach((item: THREE.Object3D) => {

							self.lockNode(item);

						});

						if (alpha < 1.0) {
							self.setModelTransparency(gltf.scene, alpha);
						}
						if (gltf.animations && gltf.animations.length > 0) {
							gltf.scene.animations = gltf.animations;
						}

						resolve(gltf.scene);


					},
					function (_xhr: any) {
					},
					function (_error: any) {

						resolve(null);
						console.error('An error happened');

					}
				);

			} catch (error) {

				resolve(null);
				console.error(error);

			}

		});

	}

	async getPolygen(data: any, resources: Map<string, any>): Promise<THREE.Group | null> {

		if (resources.has(data.parameters.resource.toString())) {

			const resource = resources.get(data.parameters.resource.toString());

			let animInfo: any = null;
			try {
				const resourceInfo = JSON.parse(resource.info);
				if (resourceInfo && resourceInfo.anim && resourceInfo.anim.length > 0) {
					animInfo = resourceInfo.anim;
				}
			} catch (e) {
				console.error("解析动画信息失败", e);
			}

			const node = await this.loadPolygen(resource.file.url);

			if (node && animInfo) {
				(node.userData as any).animations = animInfo;
			}

			return node;

		}

		return null;

	}

	async getPlane(url: string, width: number, height: number, config: Record<string, any> = {}): Promise<THREE.Mesh> {
		const httpsUrl = convertToHttps(url)!;

		return createMeshFromUrl(httpsUrl, { width, height }, {
			name: 'Plane',
			transparent: false,
			...config
		});
	}

	async getPicture(data: any, resources: Map<string, any>): Promise<THREE.Mesh | null> {
		const layout = getResourceLayout(data, resources);
		if (!layout) return null;
		const { resource, width, height } = layout;

		const imageUrl = (resource as any).image?.url;
		const fileUrl = (resource as any).file?.url;

		const isAlphaRegex = /\.(png|webp)($|\?)/i;

		let chosenUrl = "";
		let isAlpha = false;

		if (fileUrl && isAlphaRegex.test(fileUrl)) {
			chosenUrl = fileUrl;
			isAlpha = true;
		} else {
			chosenUrl = imageUrl || fileUrl;
			if (chosenUrl && isAlphaRegex.test(chosenUrl)) {
				isAlpha = true;
			}
		}

		if (!chosenUrl) return null;

		const mesh = await this.getPlane(chosenUrl, width, height, {
			name: data.parameters.name,
			transparent: isAlpha,
			maxDimension: 1024,
			quality: 0.9
		});

		if (data.parameters.sortingOrder !== undefined) {
			mesh.renderOrder = 0 - data.parameters.sortingOrder;
		}

		return mesh;
	}

	async getVideo(data: any, resources: Map<string, any>): Promise<THREE.Mesh | null> {
		const layout = getResourceLayout(data, resources);
		if (!layout) return null;
		const { resource, width, height } = layout;

		const imageUrl = (resource as any).image?.url;
		const fileUrl = (resource as any).file?.url;

		let finalUrl = "";

		const isVideoRegex = /\.(mp4|mov|avi|webm)($|\?)/i;

		if (imageUrl && !isVideoRegex.test(imageUrl)) {
			finalUrl = imageUrl;
		} else {
			const videoSource = imageUrl || fileUrl;

			if (videoSource) {
				finalUrl = `${videoSource}?ci-process=snapshot&time=0&format=jpg`;
			}
		}

		if (!finalUrl) return null;

		const mesh = await this.getPlane(finalUrl, width, height, {
			name: data.parameters.name,
			transparent: false,
			maxDimension: 512,
			quality: 0.8
		});

		return mesh;
	}

	async getPhototype(data: any): Promise<THREE.Group> {
		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		const params = getUrlParams();

		if (params.a1_api) {
			const info: any = await getResourceFromUrl(params.a1_api + '/v1/phototype/info?type=' + data.parameters.data.type);

			if (info && info.resource && info.resource.file && info.resource.file.url) {
				let alpha = 1;
				if (info.data.alpha) {
					alpha = info.data.alpha;
				}
				const node = await this.loadPolygen(info.resource.file.url, alpha);
				if (node) {
					node.name = "polygen";
					this.setTransform(node, info.data.transform);
					this.lockNode(node);
					entity.add(node);
				}
			}

		}
		return entity;

	}

	async getEntity(data: any, _resources: Map<string, any>): Promise<THREE.Group> {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		return entity;

	}

	async getText(data: any, _resources: Map<string, any>): Promise<THREE.Mesh> {
		const rawParams = data.parameters || {};
		const PIXEL_SCALE = 0.005;
		const defaults = {
			text: 'Text',
			rect: { x: 1.28, y: 0.32 },
			size: 24,
			color: '#ffffff',
			align: { horizontal: 'center', vertical: 'middle' },
			background: { enable: true, color: '#808080', opacity: 0.3 }
		};

		const params = {
			text: rawParams.text ?? defaults.text,
			rectMeters: {
				x: Number(rawParams.rect?.x ?? defaults.rect.x),
				y: Number(rawParams.rect?.y ?? defaults.rect.y)
			},
			size: Number(rawParams.size ?? defaults.size),
			color: (rawParams.color ?? defaults.color).startsWith('#') ? (rawParams.color ?? defaults.color) : '#' + (rawParams.color ?? defaults.color),
			align: rawParams.align ?? defaults.align,
			background: rawParams.background ?? defaults.background
		};

		const M_TO_PX = 1 / PIXEL_SCALE;
		const rectPx = {
			x: Math.max(1, params.rectMeters.x * M_TO_PX),
			y: Math.max(1, params.rectMeters.y * M_TO_PX)
		};

		const meshParams = {
			...params,
			rect: rectPx,
			hAlign: params.align.horizontal,
			vAlign: params.align.vertical,
			backgroundEnable: params.background.enable ?? true,
			backgroundColor: params.background.color ?? '#808080',
			backgroundOpacity: params.background.opacity ?? 0.3
		};

		const plane = createTextMesh(params.text, meshParams);

		plane.name = (rawParams.name || 'Text') + '[text]';
		plane.type = 'Text';
		plane.userData = {
			...rawParams,
			text: params.text,
			rect: params.rectMeters,
			size: params.size,
			color: params.color,
			align: params.align,
			background: params.background
		};

		return plane;
	}

	async getVoxel(data: any, resources: Map<string, any>): Promise<THREE.Mesh | null> {

		if (resources.has(data.parameters.resource.toString())) {

			const resource = resources.get(data.parameters.resource.toString());
			return this.loadVoxel(resource.file.url);

		}

		return null;

	}

	async getSound(data: any, resources: Map<string, any>): Promise<THREE.Group | null> {

		if (resources.has(data.parameters.resource.toString())) {

			const entity = new THREE.Group();
			entity.name = data.parameters.name;
			return entity;

		}

		return null;
	}

	async getEmpty(data: any, _resources: Map<string, any>): Promise<THREE.Group> {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		return entity;

	}

	async getParticle(data: any, resources: Map<string, any>): Promise<THREE.Group | THREE.Mesh | null> {
		if (resources.has(data.parameters.resource.toString())) {
			const resource = resources.get(data.parameters.resource.toString());

			let fileUrl = '';
			if (resource.file && resource.file.url) {
				fileUrl = resource.file.url;
			} else if (resource.image && resource.image.url) {
				fileUrl = resource.image.url;
			}

			const fileExt = fileUrl.toLowerCase().split('.').pop();

			if (['mp4', 'mov', 'avi'].includes(fileExt!)) {
				const info = JSON.parse(resource.info || '{}');
				const size = info.size || { x: 1, y: 1 };
				const width = data.parameters.width || 0.5;
				const height = width * (size.y / size.x);
				return this.getPlane(resource.image ? resource.image.url : fileUrl, width, height);
			}
			else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt!)) {
				const info = JSON.parse(resource.info || '{}');
				const size = info.size || { x: 1, y: 1 };
				const width = data.parameters.width || 0.5;
				const height = width * (size.y / size.x);
				return this.getPlane(fileUrl, width, height);
			}
			else if (['mp3', 'wav'].includes(fileExt!)) {
				const entity = new THREE.Group();
				entity.name = data.parameters.name;
				(entity.userData as any).resourceId = data.parameters.resource;
				(entity.userData as any).resourceType = 'particle';
				(entity.userData as any).audioUrl = fileUrl;
				return entity;
			}
			else {
				console.warn('处理粒子特效为默认类型:', fileUrl);
				const entity = new THREE.Group();
				entity.name = data.parameters.name;
				(entity.userData as any).resourceId = data.parameters.resource;
				(entity.userData as any).resourceType = 'particle';
				return entity;
			}
		}

		return null;
	}

	async building(data: any, resources: Map<string, any>, visited: Set<string> = new Set()): Promise<THREE.Object3D | null> {

		if (data.parameters && data.parameters.uuid) {
			if (visited.has(data.parameters.uuid)) {
				console.warn('Circular reference detected for entity:', data.parameters.uuid);
				return null;
			}
			visited.add(data.parameters.uuid);
		}

		let node: any = null;
		switch (data.type.toLowerCase()) {

			case 'polygen':
				node = await this.getPolygen(data, resources);
				break;
			case 'picture':
				node = await this.getPicture(data, resources);
				break;
			case 'video':
				node = await this.getVideo(data, resources);
				break;
			case 'sound':
				node = await this.getSound(data, resources);
				break;
			case 'voxel':
				node = await this.getVoxel(data, resources);
				break;
			case 'particle':
				node = await this.getParticle(data, resources);
				break;
			case 'text':
				node = await this.getText(data, resources);
				break;
			case 'entity':
				node = await this.getEntity(data, resources);
				break;
			case 'anchor':
				node = await this.addAnchor(data);
				break;
			case 'phototype':
				node = await this.getPhototype(data);
				break;

		}

		if (node == null) {

			node = await this.getEmpty(data, resources);

		}

		(node as any).type = data.type;
		node.name = data.parameters.name;
		(node as any).uuid = data.parameters.uuid;
		this.setTransform(node, data.parameters.transform);
		node.visible = data.parameters.active;

		const userData: Record<string, any> = { 'type': data.type };
		const exclude = ['name', 'uuid', 'transform', 'active'];

		Object.keys(data.parameters).forEach(key => {

			if (!exclude.includes(key)) {

				userData[key] = data.parameters[key];

			}

		});

		(node as MrppObject3D).components = data.children.components || [];
		(node as MrppObject3D).commands = data.children.commands || [];

		node.userData = userData;
		for (let i = 0; i < data.children.entities.length; ++i) {

			const child = await this.building(data.children.entities[i], resources);
			if (child != null) {

				node.add(child);

			}

		}

		return node;

	}

}

export { MetaFactory };
