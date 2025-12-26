import * as THREE from 'three';

import { GLTFLoader } from '../../../examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../../examples/jsm/loaders/DRACOLoader.js';
import { VOXLoader, VOXMesh } from '../../../examples/jsm/loaders/VOXLoader.js';
import { KTX2Loader } from '../../../examples/jsm/loaders/KTX2Loader.js';
//import { Editor } from './js/Editor.js';
import { Factory } from './Factory.js';

import { createTextMesh } from '../utils/TextUtils.js';
import { createMeshFromUrl,getResourceLayout } from '../utils/WebpUtils.js';

const getResourceFromUrl = async (url) => {
	return new Promise((resolve, reject) => {

		fetch(url)
			.then(response => {
				if (!response.ok) {
					reject(new Error('网络响应不正常'));
					//throw new Error('网络响应不正常');
				}

				return response.json(); // 如果返回的是JSON数据

			})
			.then(data => {
				resolve(data);
				console.log('获取到的数据:', data);
				// 在这里处理你的数据
			})
			.catch(error => {
				reject(error);
				console.error('请求出错:', error);
			});
	});
}


const getUrlParams = () => {
	const params = {};
	// 获取URL中的查询字符串部分（例如 ?id=123&name=test）
	const queryString = window.location.search.slice(1); // 去除开头的问号 "?"

	if (queryString) {
		// 按 "&" 分割成键值对数组
		const pairs = queryString.split('&');

		for (const pair of pairs) {
			// 按 "=" 分割键和值
			const [key, value] = pair.split('=');
			// 解码特殊字符（如空格、中文等）
			if (key) {
				params[decodeURIComponent(key)] = decodeURIComponent(value || '');
			}
		}
	}

	return params;
}

// 检查当前页面是否使用 HTTPS
const isHttps = () => {

	const protocol = window.location.protocol;
	const isHttps = protocol === 'https:';
	console.log(isHttps ? '这个网页是使用HTTPS' : '这个网页不是使用HTTPS');
	return isHttps;

};

// 将 URL 转换为 HTTPS 或 HTTP
const convertToHttps = (url) => {

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

	constructor(editor) {

		super();

		this.editor = editor;
		this.ktx2Loader = null;



	}
	async addGizmo(node) {

		return new Promise(resolve => {

			const loader = new GLTFLoader(THREE.DefaultLoadingManager);
			loader.load('/three.js/mesh/unreal-gizmo.glb', gltf => {

				const mesh = gltf.scene;//.children[0]
				mesh.scale.set(0.1, 0.1, 0.1);
				mesh.rotation.set(Math.PI / 2, Math.PI / 2, 0);
				this.lockNode(gltf.scene);
				node.add(gltf.scene);
				resolve();

			});

		});

	}

	addModule(data) {

		const node = new THREE.Group();
		node.name = data.parameters.title;
		console.error('addMetaData', data);
		node.type = data.type;
		node.uuid = data.parameters.uuid;
		node.visible = data.parameters.active;

		const transform = data.parameters.transform;
		this.setTransform(node, transform);

		const userData = {};

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
	async readMeta(root, data, resources, editor = null) {

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


	async loadVoxel(url) {

		url = convertToHttps(url);
		return new Promise((resolve, reject) => {

			const loader = new VOXLoader();
			loader.load(
				url,
				function (chunks) {

					const chunk = chunks[0];
					const mesh = new VOXMesh(chunk);

					//mesh.scale.set(0.005, 0.005, 0.005)
					resolve(mesh);

				}
			);

		}, function (xhr) {

			console.log((xhr.loaded / xhr.total) * 100 + '% loaded!');

		}, function (error) {

			reject(error);
			alert(error);
			console.error('An error happened');

		}
		);

	}

	// 添加设置模型透明度的辅助方法
	setModelTransparency(object, alpha) {
		object.traverse((child) => {
			if (child.isMesh) {
				if (child.material) {
					if (Array.isArray(child.material)) {
						for (let i = 0; i < child.material.length; i++) {
							child.material[i] = this.cloneMaterialTransparency(child.material[i], alpha);
						}
					} else {
						// 处理单个材质
						child.material = this.cloneMaterialTransparency(child.material, alpha);
					}
				}
			}
		});
	}

	// 设置单个材质透明度的辅助方法
	cloneMaterialTransparency(material, alpha) {
		// 克隆材质以避免影响其他使用相同材质的对象
		const clonedMaterial = material.clone();

		// 设置透明度
		clonedMaterial.transparent = true;
		clonedMaterial.opacity = alpha;

		// 如果是双面材质，确保透明度正确显示
		if (clonedMaterial.side === THREE.DoubleSide) {
			clonedMaterial.depthWrite = false;
		}
		return clonedMaterial;
	}
	async loadPolygen(url, alpha = 1) {

		url = convertToHttps(url);
		const self = this;
		return new Promise((resolve, reject) => {

			const loader = new GLTFLoader(THREE.DefaultLoadingManager);
			const dracoLoader = new DRACOLoader();

			dracoLoader.setDecoderPath('./draco/');
			loader.setDRACOLoader(dracoLoader);

			// 如果 KTX2Loader 未初始化，则进行初始化
			if (this.ktx2Loader === null) {
				this.ktx2Loader = new KTX2Loader();
				this.ktx2Loader.setTranscoderPath('./basis/');
				if (this.editor && this.editor.renderer) {
					this.ktx2Loader.detectSupport(this.editor.renderer);
				} else {
					console.warn('KTX2Loader 初始化失败，因为没有可用的渲染器上下文');
				}
			}

			// 如果 KTX2Loader 已初始化，则将其设置到 GLTFLoader
			if (this.ktx2Loader !== null) {
				loader.setKTX2Loader(this.ktx2Loader);
			}

			try {

				loader.load(
					url,
					function (gltf) {

						gltf.scene.children.forEach(item => {

							self.lockNode(item);

						});

						if(alpha < 1.0){
							// 设置模型半透明
							self.setModelTransparency(gltf.scene, alpha);
						}
						// 保存模型动画
						if (gltf.animations && gltf.animations.length > 0) {
							gltf.scene.animations = gltf.animations;
						}

						resolve(gltf.scene);


					},
					function (xhr) {
						//console.log((xhr.loaded / xhr.total) * 100 + '% loaded!')
					},
					function (error) {

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
	async getPolygen(data, resources) {


		if (resources.has(data.parameters.resource.toString())) {


			const resource = resources.get(data.parameters.resource.toString());

			console.log("polygen", resource.info);

			// 解析动画信息
			let animInfo = null;
			try {
				const resourceInfo = JSON.parse(resource.info);
				if (resourceInfo && resourceInfo.anim && resourceInfo.anim.length > 0) {
					animInfo = resourceInfo.anim;
				}
			} catch (e) {
				console.error("解析动画信息失败", e);
			}

			const node = await this.loadPolygen(resource.file.url);

			// 将动画信息保存到模型中
			if (node && animInfo) {
				node.userData.animations = animInfo;
			}

			return node;

		}

		return null;

	}

	async getPlane(url, width, height, config = {}) {
		const httpsUrl = convertToHttps(url);
		
		return await createMeshFromUrl(httpsUrl, { width, height }, {
			name: 'Plane',
			transparent: false, 
			...config 
		});
	}

	async getPicture(data, resources) {
		const layout = getResourceLayout(data, resources);
		if (!layout) return null;
		const { resource, width, height } = layout;

		// 逻辑：
		// 1. 优先检查 原文件(file.url) 是否是透明格式。
		//    如果是 -> 强制使用原文件 (解决旧数据转成jpg丢失透明度的问题)。
		// 2. 如果原文件不是透明格式 -> 优先使用缩略图(image.url)，没有则用原文件。
		const imageUrl = resource.image?.url;
		const fileUrl = resource.file?.url;

		const isAlphaRegex = /\.(png|webp)($|\?)/i;

		let chosenUrl = "";
		let isAlpha = false;

		if (fileUrl && isAlphaRegex.test(fileUrl)) {
			// Case A: 原图是 PNG/WebP，必须用原图以保留透明通道
			chosenUrl = fileUrl;
			isAlpha = true;
		} else {
			// Case B: 原图是不透明的 (jpg)，或者没有原图
			// 优先用缩略图 (imageUrl)，如果缩略图本身是 png 也可以开启透明
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

	async getVideo(data, resources) {
		const layout = getResourceLayout(data, resources);
		if (!layout) return null;
		const { resource, width, height } = layout;
		
		// 逻辑：
		// 1. 如果 image.url 存在且是图片格式 -> 说明是旧数据或已上传的封面，直接用，不加参数。
		// 2. 否则 -> 说明 image.url 是视频路径或不存在，取 file.url，并拼接腾讯云截图参数。
		const imageUrl = resource.image?.url;
		const fileUrl = resource.file?.url;

		let finalUrl = "";
		let isVideoSource = false;

		const isVideoRegex = /\.(mp4|mov|avi|webm)($|\?)/i;

		if (imageUrl && !isVideoRegex.test(imageUrl)) {
			// Case A: 以前上传的静态封面 (jpg/png)，直接用
			finalUrl = imageUrl;
		} else {
			// Case B: 新数据 (mp4)，或者是视频源，需要云端截图
			// 优先用 image.url (如果它是mp4)，否则用 file.url
			const videoSource = imageUrl || fileUrl;
			
			if (videoSource) {
				// 拼接参数
				finalUrl = `${videoSource}?ci-process=snapshot&time=0&format=jpg`;
				isVideoSource = true;
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

	async getPhototype(data) {
		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		const params = getUrlParams();

		if (params.a1_api) {
			const info = await getResourceFromUrl(params.a1_api + '/v1/phototype/info?type=' + data.parameters.data.type);

			if (info && info.resource && info.resource.file && info.resource.file.url) {
				let alpha =1;
				if (info.data.alpha) {
					alpha = info.data.alpha;
				}
				const node = await this.loadPolygen(info.resource.file.url, alpha);
				node.name = "polygen";
				this.setTransform(node, info.data.transform);
				//让node这个节点在编辑器里面不显示
				this.lockNode(node)
				//node.userData.hidden = true;
				entity.add(node);
			}
			/*
			if (info && info.title) {
			//在屏幕某个坐标上写一个固定大小的字，

				const node =  this.createTextMesh(info.title);
				entity.add(node);
				this.setTransform(node, info.data.transform);
			}*/

		}
		return entity;


		/*
			const params =  await getUrlParams();
			if (params.a1_api) {

				const back = await getResourceFromUrl(params.a1_api + '/v1/phototype/info?type=' + data.parameters.data.type);
			//	alert(JSON.stringify(back.data))
				if (back && back.resource && back.resource.file && back.resource.file.url) {
					const node = await this.loadPolygen(back.resource.file.url);

					this.setTransform(node, back.data.transform);
					node.scale.set( 0.1, 1, 0.2 );

					console.error("scale", node.scale);
					console.error("phototype", node);
					return node;
				}
			}
			return null;
	*/

	}
	async getEntity(data, resources) {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		return entity;

	}
	async getText(data, resources) {
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
		
		// 调用外部工具生成文本 Mesh
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


	async getVoxel(data, resources) {


		if (resources.has(data.parameters.resource.toString())) {

			const resource = resources.get(data.parameters.resource.toString());
			return await this.loadVoxel(resource.file.url);

		}

		return null;

	}
	async getSound(data, resources) {

		if (resources.has(data.parameters.resource.toString())) {

			const entity = new THREE.Group();
			entity.name = data.parameters.name;
			return entity;

		}

		return null;
	}

	async getEmpty(data, resources) {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		return entity;

	}

	async getParticle(data, resources) {
		// 检查资源是否存在
		if (resources.has(data.parameters.resource.toString())) {
			const resource = resources.get(data.parameters.resource.toString());

			// 获取文件URL
			let fileUrl = '';
			if (resource.file && resource.file.url) {
				fileUrl = resource.file.url;
			} else if (resource.image && resource.image.url) {
				fileUrl = resource.image.url;
			}

			// 获取文件扩展名
			const fileExt = fileUrl.toLowerCase().split('.').pop();

			// 根据扩展名选择不同的处理方式
			if (['mp4', 'mov', 'avi'].includes(fileExt)) {
				// 处理为视频
				console.log('处理粒子特效为视频类型:', fileUrl);
				const info = JSON.parse(resource.info || '{}');
				const size = info.size || { x: 1, y: 1 };
				const width = data.parameters.width || 0.5;
				const height = width * (size.y / size.x);
				return await this.getPlane(resource.image ? resource.image.url : fileUrl, width, height);
			}
			else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
				// 处理为图片
				console.log('处理粒子特效为图片类型:', fileUrl);
				const info = JSON.parse(resource.info || '{}');
				const size = info.size || { x: 1, y: 1 };
				const width = data.parameters.width || 0.5;
				const height = width * (size.y / size.x);
				return await this.getPlane(fileUrl, width, height);
			}
			else if (['mp3', 'wav'].includes(fileExt)) {
				// 处理为音频
				console.log('处理粒子特效为音频类型:', fileUrl);
				const entity = new THREE.Group();
				entity.name = data.parameters.name;
				entity.userData.resourceId = data.parameters.resource;
				entity.userData.resourceType = 'particle';
				entity.userData.audioUrl = fileUrl;
				return entity;
			}
			else {
				// 默认处理
				console.log('处理粒子特效为默认类型:', fileUrl);
				const entity = new THREE.Group();
				entity.name = data.parameters.name;
				entity.userData.resourceId = data.parameters.resource;
				entity.userData.resourceType = 'particle';
				return entity;
			}
		}

		return null;
	}

	async building(data, resources, visited = new Set()) {

		// 防止循环引用导致的堆栈溢出
		if (data.parameters && data.parameters.uuid) {
			if (visited.has(data.parameters.uuid)) {
				console.warn('Circular reference detected for entity:', data.parameters.uuid);
				return null;
			}
			visited.add(data.parameters.uuid);
		}
		console.log('building: ', data.parameters);
		let node = null;
		switch (data.type.toLowerCase()) {

			case 'polygen':
				node = await this.getPolygen(data, resources);//resource
				break;
			case 'picture':
				node = await this.getPicture(data, resources);//resource
				break;
			case 'video':
				node = await this.getVideo(data, resources);//resource
				break;
			case 'sound':
				node = await this.getSound(data, resources);//resource
				break;
			case 'voxel':
				node = await this.getVoxel(data, resources);//resource
				break;
			case 'particle':
				node = await this.getParticle(data, resources);//resource
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

		node.type = data.type;
		node.name = data.parameters.name;
		node.uuid = data.parameters.uuid;
		this.setTransform(node, data.parameters.transform);
		node.visible = data.parameters.active;

		const userData = { 'type': data.type };
		const exclude = ['name', 'uuid', 'transform', 'active'];

		Object.keys(data.parameters).forEach(key => {

			if (!exclude.includes(key)) {

				userData[key] = data.parameters[key];

			}

		});

		// 设置components和commands
		node.components = data.children.components || [];
		node.commands = data.children.commands || [];

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
