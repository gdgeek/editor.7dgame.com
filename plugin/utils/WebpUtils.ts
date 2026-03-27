import * as THREE from 'three';

interface MeshSize {
	width: number;
	height: number;
}

interface MeshConfig {
	name?: string;
	maxDimension?: number;
	quality?: number;
	transparent?: boolean;
}

// 创建白板 Mesh (用于加载失败兜底)
const createFallbackMesh = (width: number, height: number): THREE.Mesh => new THREE.Mesh(new THREE.PlaneGeometry(width, height));

// 绘制 Canvas 并生成纹理
async function createWebPMesh(source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; width: number; height: number }, size: MeshSize, config: MeshConfig): Promise<THREE.Mesh> {
	const { name = 'Plane', maxDimension = 1024, quality = 0.8, transparent = false } = config;

	return new Promise((resolve) => {
		// 1. 智能缩放计算
		let w = source.videoWidth || source.width || 512;
		let h = source.videoHeight || source.height || 512;

		if (w > maxDimension || h > maxDimension) {
			const aspect = w / h;
			if (w > h) { w = maxDimension; h = maxDimension / aspect; }
			else       { h = maxDimension; w = maxDimension * aspect; }
		}

		// 取整防止渲染伪影
		w = Math.floor(w);
		h = Math.floor(h);

		// 2. 绘制 Canvas
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d', { alpha: transparent })!;
		ctx.drawImage(source, 0, 0, w, h);

		// 3. 生成 WebP 纹理
		const loader = new THREE.TextureLoader();
		loader.load(
			canvas.toDataURL('image/webp', quality),
			(texture: THREE.Texture) => {
				// 配置纹理
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.minFilter = THREE.LinearMipmapLinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.generateMipmaps = true;
				texture.format = THREE.RGBAFormat;
				texture.needsUpdate = true;

				const material = new THREE.MeshBasicMaterial({
					color: 0xffffff,
					side: THREE.DoubleSide,
					map: texture,
					transparent: transparent,
					alphaTest: transparent ? 0.01 : 0,
					depthWrite: !transparent,
					opacity: 1.0,
					blending: THREE.NormalBlending
				});

				const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.width, size.height), material);
				mesh.name = name;
				resolve(mesh);
			},
			undefined as unknown as (event: ProgressEvent) => void,
			(err: unknown) => {
				console.warn('WebP Texture error:', err);
				resolve(createFallbackMesh(size.width, size.height));
			}
		);
	});
}

// 统一入口
export async function createMeshFromUrl(url: string, size: MeshSize, options: MeshConfig = {}): Promise<THREE.Mesh> {
	try {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = url;

		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = reject;
		});

		return await createWebPMesh(img, size, options);

	} catch (err) {
		console.warn(`Mesh load failed: ${url}`, err);
		return createFallbackMesh(size.width, size.height);
	}
}

// 获取布局信息
export function getResourceLayout(data: { parameters: { resource?: unknown; width?: number; [key: string]: unknown } }, resources: Map<string, { info?: string; [key: string]: unknown }>): { resource: { info?: string; [key: string]: unknown }; width: number; height: number } | null {
	const resId = data.parameters.resource?.toString();
	if (!resId || !resources.has(resId)) return null;

	const resource = resources.get(resId)!;

	// 安全解析 info，并提供默认值
	let info: { size?: { x?: number; y?: number } } = {};
	try { info = JSON.parse(resource.info || '{}'); } catch { /* ignore parse errors */ }

	// 解构并处理默认值，防止除以0
	const { x = 1, y = 1 } = info.size || {};
	const safeX = x === 0 ? 1 : x;

	// 计算物理宽高
	const width = data.parameters.width || 0.5;
	const height = width * (y / safeX);

	return { resource, width, height };
}
