import * as THREE from 'three';

import { GLTFLoader } from '../../../examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../../examples/jsm/loaders/DRACOLoader.js';
import { VOXLoader, VOXMesh } from '../../../examples/jsm/loaders/VOXLoader.js';
import { KTX2Loader } from '../../../examples/jsm/loaders/KTX2Loader.js';
//import { Editor } from './js/Editor.js';
import { Factory } from './Factory.js';
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

	async getPlane(url, width, height) {

		url = convertToHttps(url);
		return new Promise(resolve => {

			const geometry = new THREE.PlaneGeometry(width, height);
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

		});

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


 		return node;
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
		const PIXEL_SCALE = 0.005; // 统一的比例常量：1px = 5mm
		// 1. 默认值设置 (单位：米)
		// 默认 1.28m x 0.32m (对应 256px x 64px)
		const defaults = {
			text: 'Text',
			rect: { x: 1.28, y: 0.32 }, 
			size: 24,
			color: '#ffffff',
			align: { horizontal: 'center', vertical: 'middle' },
			background: { enable: true, color: '#808080', opacity: 0.3 }
		};

		// 2. 合并参数
		const params = {
			text: rawParams.text ?? defaults.text,
			rectMeters: {
				x: Number(rawParams.rect?.x ?? defaults.rect.x),
				y: Number(rawParams.rect?.y ?? defaults.rect.y)
			},
			size: Number(rawParams.size ?? defaults.size),
			color: (() => {
				const c = rawParams.color ?? defaults.color;
				return c.startsWith('#') ? c : '#' + c;
			})(),
			align: rawParams.align ?? defaults.align,
			background: rawParams.background ?? defaults.background
		};

		// 3. 单位转换：米 -> 像素 (供 Canvas 绘图使用)
		// 必须保证 rectPx 至少为 1px
		const M_TO_PX = 1 / PIXEL_SCALE;
		const rectPx = {
			x: Math.max(1, params.rectMeters.x * M_TO_PX),
			y: Math.max(1, params.rectMeters.y * M_TO_PX)
		};

		// 4. 创建 Mesh
		const meshParams = {
			...params,
			rect: rectPx,
			hAlign: params.align.horizontal,
			vAlign: params.align.vertical,
			backgroundEnable: params.background.enable ?? true,
			backgroundColor: params.background.color ?? '#808080',
			backgroundOpacity: params.background.opacity ?? 0.3
		};
		
		const plane = await this.createTextMesh(params.text, meshParams);

		// 5. 设置对象属性
		plane.name = (rawParams.name || 'Text') + '[text]';
		plane.type = 'Text';

		// 6. 回写 userData
		plane.userData = {
			...rawParams,
			text: params.text,
			rect: params.rectMeters, // 存米
			size: params.size,
			color: params.color, 
			align: params.align,
			background: params.background
		};

		return plane;
	}

	// 文本网格生成核心逻辑
	// 辅助方法：绘制圆角矩形路径
	roundRect(ctx, x, y, width, height, radius) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
	}

	createTextMesh(text, params = {}) {
		// 1. 基础参数 (逻辑像素)
		const baseWidth = Math.max(1, params.rect?.x || 256);
		const baseHeight = Math.max(1, params.rect?.y || 64);
		const baseFontSize = params.size || 24;
		
		const color = params.color || '#ffffff';
		const hAlign = params.hAlign || 'center';
		const vAlign = params.vAlign || 'middle';
		const backgroundEnable = params.backgroundEnable !== undefined ? params.backgroundEnable : true;
		const backgroundColor = params.backgroundColor || '#808080';
		const backgroundOpacity = params.backgroundOpacity !== undefined ? params.backgroundOpacity : 0.3;
		
		const PIXEL_SCALE = 0.005; // 物理单位转换: 1逻辑像素 = 0.005米

		// 2. 高清渲染倍率 (解决文字模糊的关键)
		// 放大 4 倍绘制，相当于 Retina 屏幕效果
		const SCALE_FACTOR = 4; 

		// 3. 计算实际 Canvas 尺寸 (物理像素)
		const canvasWidth = Math.round(baseWidth * SCALE_FACTOR);
		const canvasHeight = Math.round(baseHeight * SCALE_FACTOR);
		const scaledFontSize = baseFontSize * SCALE_FACTOR;
		const padding = 4 * SCALE_FACTOR; // 边距也放大

		// 创建 Canvas
		const canvas = document.createElement('canvas');
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		const ctx = canvas.getContext('2d');

		// 清空画布
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		// 绘制半透明背景（带圆角）- 仅在启用时绘制
		if (backgroundEnable) {
			const cornerRadius = 8 * SCALE_FACTOR; // 圆角半径随放大因子缩放
			// 转换颜色格式（#RRGGBB -> rgba）
			const bgColor = backgroundColor.startsWith('#') ? backgroundColor.substring(1) : backgroundColor;
			const r = parseInt(bgColor.substring(0, 2), 16);
			const g = parseInt(bgColor.substring(2, 4), 16);
			const b = parseInt(bgColor.substring(4, 6), 16);
			ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${backgroundOpacity})`;
			this.roundRect(ctx, 0, 0, canvasWidth, canvasHeight, cornerRadius);
			ctx.fill();
		}

		// 设置字体 (使用放大后的字号)
		// 增加 'Arial' 作为备选，确保跨平台兼容
		ctx.font = `${scaledFontSize}px 'Arial Unicode MS', Arial, sans-serif`; 
		ctx.fillStyle = color;
		ctx.textBaseline = 'middle'; 

		// 4. 水平对齐 (基于放大后的宽度计算)
		let x = 0;
		if (hAlign === 'left') {
			ctx.textAlign = 'left';
			x = padding;
		} else if (hAlign === 'right') {
			ctx.textAlign = 'right';
			x = canvasWidth - padding;
		} else {
			ctx.textAlign = 'center';
			x = canvasWidth / 2;
		}

		// 5. 文本自动换行处理 (Unity TMP 风格混合模式)
		const textStr = String(text || '');
		const paragraphs = textStr.split('\n');
		const lines = [];

		if (textStr) {
			paragraphs.forEach(paragraph => {
				if (paragraph.length === 0) {
					lines.push('');
					return;
				}

				let currentLine = '';
				for (let i = 0; i < paragraph.length; i++) {
					const char = paragraph[i];
					const testLine = currentLine + char;
					const metrics = ctx.measureText(testLine);
					const maxLineWidth = canvasWidth - (padding * 2);

					if (metrics.width > maxLineWidth && i > 0) {
						// 尝试按词换行
						const lastSpaceIndex = currentLine.lastIndexOf(' ');
						if (lastSpaceIndex > -1 && lastSpaceIndex < currentLine.length - 1) {
							lines.push(currentLine.substring(0, lastSpaceIndex));
							currentLine = currentLine.substring(lastSpaceIndex + 1) + char;
						} else {
							// 强制换行 (中文或长单词)
							lines.push(currentLine);
							currentLine = char;
						}
					} else {
						currentLine = testLine;
					}
				}
				lines.push(currentLine);
			});
		}

		// 6. 垂直对齐 (基于放大后的高度计算)
		const lineHeight = scaledFontSize * 1.2; // 1.2倍行高更舒适
		const totalTextHeight = lines.length * lineHeight;
		const halfLine = lineHeight / 2; // 基线修正

		let startY = 0;

		if (vAlign === 'top') {
			startY = padding + halfLine;
		} else if (vAlign === 'bottom') {
			startY = canvasHeight - totalTextHeight + halfLine - padding;
		} else {
			// Middle
			startY = (canvasHeight - totalTextHeight) / 2 + halfLine;
		}

		// 越界保护
		if (totalTextHeight > canvasHeight && vAlign !== 'bottom') {
			startY = padding + halfLine;
		}

		// 绘制文本
		// 改为逐字符绘制：仅绘制完全位于文本内容区域（去掉 padding）的字符，
		// 避免出现半个字符被裁切显示的问题。
		const contentLeft = padding;
		const contentRight = canvasWidth - padding;
		const contentTop = padding;
		const contentBottom = canvasHeight - padding;

		// 每行逐字符绘制（测量位置并判断字符边界是否完全在内容区域内）
		lines.forEach((line, index) => {
			const y = startY + (index * lineHeight);

			// 预先测量整行宽度（缩减重复测量）
			const lineMetrics = ctx.measureText(line);
			const lineWidth = lineMetrics.width;

			// 计算此行的起始 X（相对于画布左上角）
			let lineXStart;
			if (hAlign === 'left') {
				lineXStart = contentLeft;
			} else if (hAlign === 'right') {
				lineXStart = contentRight - lineWidth;
			} else {
				lineXStart = (canvasWidth - lineWidth) / 2;
			}

			// 逐字符绘制
			// 使用左对齐绘制单字符，手动计算字符位置
			ctx.textAlign = 'left';
			for (let i = 0; i < line.length; i++) {
				const ch = line[i];
				const substr = line.substring(0, i);
				const offset = ctx.measureText(substr).width;
				const chWidth = ctx.measureText(ch).width;

				const chLeft = lineXStart + offset;
				const chRight = chLeft + chWidth;

				// 使用 measureText 的 actualBoundingBoxAscent/Descent 来计算字符的精确上下边界
				const chMetrics = ctx.measureText(ch);
				// 回退值以防浏览器不支持这些属性
				const ascent = chMetrics.actualBoundingBoxAscent || (scaledFontSize * 0.8);
				const descent = chMetrics.actualBoundingBoxDescent || (scaledFontSize * 0.2);
				const chTop = y - ascent;
				const chBottom = y + descent;

				// 放宽一点容差，避免微小测量误差导致整行被排除
				const EPS = 0.5;

				// 仅当字符完全位于内容区域内时才绘制（允许小容差）
				if (chLeft + EPS >= contentLeft && chRight - EPS <= contentRight && chTop + EPS >= contentTop && chBottom - EPS <= contentBottom) {
					ctx.fillText(ch, chLeft, y);
				}
			}
		});

		// 7. 生成纹理
		const texture = new THREE.CanvasTexture(canvas);
		texture.encoding = THREE.sRGBEncoding;
		
		// 优化纹理设置
		texture.minFilter = THREE.LinearMipmapLinearFilter; // 使用 Mipmap 防止远处闪烁
		texture.magFilter = THREE.LinearFilter;
		texture.generateMipmaps = true; 
		
		// 开启各向异性过滤 (Anisotropy)，让侧面观看更清晰
		const maxAnisotropy = this.editor?.renderer?.capabilities?.getMaxAnisotropy() || 4;
		texture.anisotropy = maxAnisotropy;
		
		texture.needsUpdate = true;

		// 8. 创建几何体
		// 【重要】：几何体尺寸使用 baseWidth * PIXEL_SCALE，保持物理尺寸不变
		// 无论纹理多大，贴图都会自动缩放适配这个物理尺寸
		const geometry = new THREE.PlaneGeometry(baseWidth * PIXEL_SCALE, baseHeight * PIXEL_SCALE);

		const material = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: true,
			side: THREE.DoubleSide,
			alphaTest: 0.01 // 降低 alphaTest 阈值，避免边缘锯齿
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.type = 'Text';

		return mesh;
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
	async getVideo(data, resources) {

		if (data.parameters.resource == undefined) {

			return null;

		}

		const resource = resources.get(data.parameters.resource.toString());
		const info = JSON.parse(resource.info);
		const size = info.size;
		const width = data.parameters.width;
		const height = width * (size.y / size.x);
		return await this.getPlane(resource.image.url, width, height);

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
