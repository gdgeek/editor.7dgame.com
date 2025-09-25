import * as THREE from 'three';

import { GLTFLoader } from '../../../examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../../examples/jsm/loaders/DRACOLoader.js';
import { VOXLoader, VOXMesh } from '../../../examples/jsm/loaders/VOXLoader.js';
import { KTX2Loader } from '../../../examples/jsm/loaders/KTX2Loader.js';

import { Factory } from './Factory.js';


// 检查当前页面是否使用 HTTPS
const isHttps = () => {

	const protocol = window.location.protocol;
	const isHttps = protocol === 'https:';
	console.log( isHttps ? '这个网页是使用HTTPS' : '这个网页不是使用HTTPS' );
	return isHttps;

};

// 将 URL 转换为 HTTPS 或 HTTP
const convertToHttps = ( url ) => {

	if ( url === undefined || url === null ) return '';

	if ( isHttps() ) {

		if ( url.startsWith( 'http://' ) ) {

			return url.replace( 'http://', 'https://' );

		}

	} else {

		if ( url.startsWith( 'https://' ) ) {

			return url.replace( 'https://', 'http://' );

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
	async addGizmo( node ) {

		return new Promise( resolve => {

			const loader = new GLTFLoader( THREE.DefaultLoadingManager );
			loader.load( '/three.js/mesh/unreal-gizmo.glb', gltf => {

				const mesh = gltf.scene;//.children[0]
				mesh.scale.set( 0.1, 0.1, 0.1 );
				mesh.rotation.set( Math.PI / 2, Math.PI / 2, 0 );
				this.lockNode( gltf.scene );
				node.add( gltf.scene );
				resolve();

			} );

		} );

	}

	addModule( data ) {

		const node = new THREE.Group();
		node.name = data.parameters.title;
		console.error( 'addMetaData', data );
		node.type = data.type;
		node.uuid = data.parameters.uuid;
		node.visible = data.parameters.active;

		const transform = data.parameters.transform;
		this.setTransform( node, transform );

		const userData = {};

		const exclude = [ 'name', 'title', 'uuid', 'transform', 'active' ];

		Object.keys( data.parameters ).forEach( key => {

			if ( ! exclude.includes( key ) ) {

				userData[ key ] = data.parameters[ key ];

			}

		} );

		userData.draggable = false;
		node.userData = userData;
		return node;

	}
	async readMeta( root, data, resources, editor = null ) {

		//alert(resources.size)
		if ( data.children ) {

			for ( let i = 0; i < data.children.entities.length; ++ i ) {

				if ( data.children.entities[ i ] != null ) {

					try {

						const node = await this.building( data.children.entities[ i ], resources );
						if ( node != null ) {

							root.add( node );
							if ( editor != null ) {

								editor.signals.sceneGraphChanged.dispatch();

							}

						}

					} catch ( error ) {

						console.error( error );

					}

				}

			}

		}

	}


	async loadVoxel( url ) {

		url = convertToHttps( url );
		return new Promise( ( resolve, reject ) => {

			const loader = new VOXLoader();
			loader.load(
				url,
				function ( chunks ) {

					const chunk = chunks[ 0 ];
					const mesh = new VOXMesh( chunk );

					//mesh.scale.set(0.005, 0.005, 0.005)
					resolve( mesh );

				}
			);

		}, function ( xhr ) {

			console.log( ( xhr.loaded / xhr.total ) * 100 + '% loaded!' );

		}, function ( error ) {

			reject( error );
			alert( error );
			console.error( 'An error happened' );

		}
		);

	}

	async loadPolygen( url ) {

		url = convertToHttps( url );
		const self = this;
		return new Promise( ( resolve, reject ) => {

			const loader = new GLTFLoader( THREE.DefaultLoadingManager );
			const dracoLoader = new DRACOLoader();

			dracoLoader.setDecoderPath( './draco/' );
			loader.setDRACOLoader(dracoLoader);

			// 如果 KTX2Loader 未初始化，则进行初始化
			if ( this.ktx2Loader === null ) {
				this.ktx2Loader = new KTX2Loader();
				this.ktx2Loader.setTranscoderPath( './basis/' );
				if ( this.editor && this.editor.renderer ) {
					this.ktx2Loader.detectSupport( this.editor.renderer );
				} else {
					console.warn( 'KTX2Loader 初始化失败，因为没有可用的渲染器上下文' );
				}
			}

			// 如果 KTX2Loader 已初始化，则将其设置到 GLTFLoader
			if ( this.ktx2Loader !== null ) {
				loader.setKTX2Loader( this.ktx2Loader );
			}

			try {

				loader.load(
					url,
					function ( gltf ) {

						gltf.scene.children.forEach( item => {

							self.lockNode( item );

						} );

						// 保存模型动画
						if (gltf.animations && gltf.animations.length > 0) {
							gltf.scene.animations = gltf.animations;
						}

						resolve( gltf.scene );

					},
					function ( xhr ) {
						//console.log((xhr.loaded / xhr.total) * 100 + '% loaded!')
					},
					function ( error ) {

						resolve( null );
						console.error( 'An error happened' );

					}
				);

			} catch ( error ) {

				resolve( null );
				console.error( error );

			}

		} );

	}
	async getPolygen( data, resources ) {


		if ( resources.has( data.parameters.resource.toString() ) ) {


			const resource = resources.get( data.parameters.resource.toString() );

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

			const node = await this.loadPolygen( resource.file.url );

			// 将动画信息保存到模型中
			if (node && animInfo) {
				node.userData.animations = animInfo;
			}

			return node;

		}

		return null;

	}

	async getPlane( url, width, height ) {

		url = convertToHttps( url );
		return new Promise( resolve => {

			const geometry = new THREE.PlaneGeometry( width, height );
			const loader = new THREE.TextureLoader();

			loader.load( url, texture => {
				// 完整的纹理配置
				texture.premultiplyAlpha = false;
				texture.encoding = THREE.sRGBEncoding;
				texture.format = THREE.RGBAFormat; // 明确指定RGBA格式
				texture.needsUpdate = true;

				// 基于 URL 后缀判断是否可能有透明通道
				const lowerUrl = (url || '').toLowerCase();
				const isAlphaImage = lowerUrl.endsWith('.png') || lowerUrl.endsWith('.webp');

				const material = new THREE.MeshBasicMaterial( {
					color: 0xffffff,
					side: THREE.DoubleSide,
					map: texture,
					transparent: isAlphaImage || true, // 允许透明（PNG会用到）
					alphaTest: isAlphaImage ? 0.01 : 0.0,
					depthWrite: false, // 透明材质通常不写入深度
					opacity: 1.0,
					blending: THREE.NormalBlending
				} );


				const mesh = new THREE.Mesh( geometry, material );
				if ( isAlphaImage ) {
					material.depthTest = false;
				} else {
					material.depthTest = true;
				}

				resolve( mesh );

			}, function ( error ) {

				console.error('Texture loading error:', error);
				resolve( new THREE.Mesh( geometry ) );

			} );

		} );

	}

	async getPicture( data, resources ) {

		const resource = resources.get( data.parameters.resource.toString() );
		if ( ! resource ) return null;
		// 根据文件扩展名选择合适的 URL
		const fileUrl = resource.file && resource.file.url ? resource.file.url : '';
		const imageUrl = resource.image && resource.image.url ? resource.image.url : '';

		const lowerFile = fileUrl.toLowerCase();

		let chosenUrl = imageUrl; // 默认使用缩略图

		if (lowerFile.endsWith('.png') || lowerFile.endsWith('.webp')) {
			// png 或 webp 使用源文件
			chosenUrl = fileUrl;
		} else if (lowerFile.endsWith('.jpg') || lowerFile.endsWith('.jpeg')) {
			// jpg/jpeg 使用缩略图
			chosenUrl = imageUrl;
		} else {
			// 其他格式（比如 gif、webp，但未在前面匹配），如果原始文件存在且是 png/webp 仍然使用源文件
			if (lowerFile.endsWith('.png') || lowerFile.endsWith('.webp')) {
				chosenUrl = fileUrl;
			}
		}

		// 解析尺寸，防止 info 为空
		let info = {};
		try { info = JSON.parse( resource.info || '{}' ); } catch ( e ) { console.warn( 'parse resource.info failed', e ); }
		const size = info.size || { x: 1, y: 1 };
		const width = data.parameters.width || 0.5;
		const height = width * ( size.y / size.x );

		const node = await this.getPlane( chosenUrl, width, height );
		if (data.parameters.sortingOrder !== undefined) {
			node.renderOrder = 0-data.parameters.sortingOrder;
			console.log('应用已有的 renderOrder:', node.renderOrder);
		}
		// 调试信息
		/* console.log( 'Picture info:', {
			chosenUrl: chosenUrl,
			originalFile: fileUrl,
			thumbnail: imageUrl,
			size: size,
			width: width,
			height: height,
			texture: node && node.material ? node.material.map : null,
			sortingOrder: data.parameters.sortingOrder


		} ); */

		return node;

	}
	async getPhototype( data, resources ) {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		console.error('getPhototype', data);
		return entity;

	}
	async getEntity( data, resources ) {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		return entity;

	}
	async getText( data, resources ) {
		// 获取文本内容，如果不存在则使用默认文本
		const text = data.parameters.text || 'Hello World';
		console.error("text", data);

		// 使用createTextMesh方法创建文本网格
		const plane = this.createTextMesh(text);
		plane.name = data.parameters.name + '[text]';

		// 确保userData中包含text属性
		if (!plane.userData) plane.userData = {};
		plane.userData.text = text;

		return plane;
	}

	// 创建文本网格的辅助方法
	createTextMesh(text) {
		// 创建一个动态画布来绘制文本
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		const fontSize = 16; // 字体大小

		// 设置画布大小和字体
		context.font = `${fontSize}px Arial`;
		const textWidth = context.measureText(text).width;

		// 设置画布尺寸，给文本周围留出一些空间
		canvas.width = textWidth + 10;
		canvas.height = fontSize + 10;

		// 清除画布并设置背景色
		context.fillStyle = '#8888ff';
		context.fillRect(0, 0, canvas.width, canvas.height);

		// 绘制文本
		context.fillStyle = '#ffffff';
		context.font = `${fontSize}px Arial`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(text, canvas.width / 2, canvas.height / 2);

		// 创建纹理
		const texture = new THREE.CanvasTexture(canvas);

		// 创建平面几何体，比例与画布相同
		const aspectRatio = canvas.width / canvas.height;
		const geometry = new THREE.PlaneGeometry(0.5 * aspectRatio, 0.5);

		// 创建材质
		const material = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: true,
			side: THREE.DoubleSide
		});

		// 创建网格
		const plane = new THREE.Mesh(geometry, material);

		// 保存原始文本，以便后续更新
		plane.userData._textContent = text;

		return plane;
	}
	async getVoxel( data, resources ) {


		if ( resources.has( data.parameters.resource.toString() ) ) {

			const resource = resources.get( data.parameters.resource.toString() );
			return await this.loadVoxel( resource.file.url );

		}

		return null;

	}
	async getSound( data, resources ) {

		if ( resources.has( data.parameters.resource.toString() ) ) {

			const entity = new THREE.Group();
			entity.name = data.parameters.name;
			return entity;

		}

		return null;
	}

	async getEmpty( data, resources ) {

		const entity = new THREE.Group();
		entity.name = data.parameters.name;
		return entity;

	}
	async getVideo( data, resources ) {

		if ( data.parameters.resource == undefined ) {

			return null;

		}

		const resource = resources.get( data.parameters.resource.toString() );
		const info = JSON.parse( resource.info );
		const size = info.size;
		const width = data.parameters.width;
		const height = width * ( size.y / size.x );
		return await this.getPlane( resource.image.url, width, height );

	}

	async getParticle( data, resources ) {
		// 检查资源是否存在
		if ( resources.has( data.parameters.resource.toString() ) ) {
			const resource = resources.get( data.parameters.resource.toString() );

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

	async building( data, resources, visited = new Set() ) {

		// 防止循环引用导致的堆栈溢出
		if (data.parameters && data.parameters.uuid) {
			if (visited.has(data.parameters.uuid)) {
				console.warn('Circular reference detected for entity:', data.parameters.uuid);
				return null;
			}
			visited.add(data.parameters.uuid);
		}
		console.log( 'building: ', data.parameters );
		let node = null;
		switch ( data.type.toLowerCase() ) {

			case 'polygen':
				node = await this.getPolygen( data, resources );//resource
				break;
			case 'picture':
				node = await this.getPicture( data, resources );//resource
				break;
			case 'video':
				node = await this.getVideo( data, resources );//resource
				break;
			case 'sound':
				node = await this.getSound( data, resources );//resource
				break;
			case 'voxel':
				node = await this.getVoxel( data, resources );//resource
				break;
			case 'particle':
				node = await this.getParticle( data, resources );//resource
				break;
			case 'text':
				node = await this.getText( data, resources );
				break;
			case 'entity':
				node = await this.getEntity( data, resources );
				break;
			case 'anchor':
				node = await this.addAnchor( data );
				break;
			case 'phototype':
				node = await this.getPhototype( data, resources );
				break;

		}

		if ( node == null ) {

			node = await this.getEmpty( data, resources );

		}

		node.type = data.type;
		node.name = data.parameters.name;
		node.uuid = data.parameters.uuid;
		this.setTransform( node, data.parameters.transform );
		node.visible = data.parameters.active;

		const userData = { 'type': data.type };
		const exclude = [ 'name', 'uuid', 'transform', 'active' ];

		Object.keys( data.parameters ).forEach( key => {

			if ( ! exclude.includes( key ) ) {

				userData[ key ] = data.parameters[ key ];

			}

		} );

		// 设置components和commands
		node.components = data.children.components || [];
		node.commands = data.children.commands || [];

		node.userData = userData;
		for ( let i = 0; i < data.children.entities.length; ++ i ) {

			const child = await this.building( data.children.entities[ i ], resources );
			if ( child != null ) {

				node.add( child );

			}

		}

		return node;

	}

}

export { MetaFactory };
