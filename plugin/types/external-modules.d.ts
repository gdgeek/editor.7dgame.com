// ── 外部模块声明 ──
// three.js r183 本地构建不包含 .d.ts 文件，需要手动声明模块类型
// 这些声明允许 tsc 编译通过，同时保持运行时行为不变

// three.js 主模块
declare module 'three' {
	export class Object3D {
		uuid: string;
		name: string;
		type: string;
		parent: Object3D | null;
		children: Object3D[];
		position: Vector3;
		rotation: Euler;
		scale: Vector3;
		matrix: Matrix4;
		matrixWorld: Matrix4;
		visible: boolean;
		userData: Record<string, any>;
		traverse(callback: (object: Object3D) => void): void;
		getObjectById(id: number): Object3D | undefined;
		getObjectByName(name: string): Object3D | undefined;
		add(...objects: Object3D[]): this;
		remove(...objects: Object3D[]): this;
		clear(): this;
		clone(recursive?: boolean): this;
		copy(source: Object3D, recursive?: boolean): this;
		lookAt(x: number | Vector3, y?: number, z?: number): void;
		[key: string]: any;
	}

	export class Scene extends Object3D {
		background: any;
		environment: any;
		fog: any;
		isScene: true;
	}

	export class Camera extends Object3D {
		matrixWorldInverse: Matrix4;
		projectionMatrix: Matrix4;
		projectionMatrixInverse: Matrix4;
		isCamera: true;
	}

	export class PerspectiveCamera extends Camera {
		fov: number;
		aspect: number;
		near: number;
		far: number;
		zoom: number;
		updateProjectionMatrix(): void;
	}

	export class Vector3 {
		x: number;
		y: number;
		z: number;
		constructor(x?: number, y?: number, z?: number);
		set(x: number, y: number, z: number): this;
		copy(v: Vector3): this;
		clone(): Vector3;
		add(v: Vector3): this;
		sub(v: Vector3): this;
		multiplyScalar(s: number): this;
		normalize(): this;
		length(): number;
		distanceTo(v: Vector3): number;
		equals(v: Vector3): boolean;
		toArray(array?: number[], offset?: number): number[];
		fromArray(array: number[], offset?: number): this;
		[key: string]: any;
	}

	export class Euler {
		x: number;
		y: number;
		z: number;
		order: string;
		constructor(x?: number, y?: number, z?: number, order?: string);
		set(x: number, y: number, z: number, order?: string): this;
		copy(euler: Euler): this;
		clone(): Euler;
		[key: string]: any;
	}

	export class Matrix4 {
		elements: number[];
		constructor();
		set(...values: number[]): this;
		identity(): this;
		copy(m: Matrix4): this;
		clone(): Matrix4;
		[key: string]: any;
	}

	export class Color {
		r: number;
		g: number;
		b: number;
		constructor(r?: number | string, g?: number, b?: number);
		set(value: any): this;
		getHex(): number;
		getHexString(): string;
		[key: string]: any;
	}

	export class Mesh extends Object3D {
		geometry: any;
		material: any;
		isMesh: true;
		constructor(geometry?: any, material?: any);
	}

	export class Group extends Object3D {
		isGroup: true;
	}

	export class Box3 {
		min: Vector3;
		max: Vector3;
		constructor(min?: Vector3, max?: Vector3);
		setFromObject(object: Object3D): this;
		getCenter(target: Vector3): Vector3;
		getSize(target: Vector3): Vector3;
		expandByObject(object: Object3D): this;
		isEmpty(): boolean;
		[key: string]: any;
	}

	export class Raycaster {
		ray: any;
		near: number;
		far: number;
		constructor(origin?: Vector3, direction?: Vector3, near?: number, far?: number);
		setFromCamera(coords: { x: number; y: number }, camera: Camera): void;
		intersectObject(object: Object3D, recursive?: boolean): any[];
		intersectObjects(objects: Object3D[], recursive?: boolean): any[];
		[key: string]: any;
	}

	export class WebGLRenderer {
		domElement: HTMLCanvasElement;
		constructor(parameters?: any);
		setSize(width: number, height: number, updateStyle?: boolean): void;
		setPixelRatio(value: number): void;
		render(scene: Scene, camera: Camera): void;
		dispose(): void;
		[key: string]: any;
	}

	export class TextureLoader {
		constructor(manager?: any);
		load(url: string, onLoad?: Function, onProgress?: Function, onError?: Function): any;
		[key: string]: any;
	}

	export class FileLoader {
		crossOrigin: string;
		constructor(manager?: any);
		load(url: string, onLoad?: Function, onProgress?: Function, onError?: Function): any;
		[key: string]: any;
	}

	export class AnimationMixer {
		constructor(root: Object3D);
		clipAction(clip: any): any;
		update(deltaTime: number): void;
		[key: string]: any;
	}

	export class AnimationClip {
		name: string;
		duration: number;
		tracks: any[];
		static parse(json: any): AnimationClip;
		[key: string]: any;
	}

	export class Texture {
		image: any;
		needsUpdate: boolean;
		[key: string]: any;
	}

	export class Material {
		name: string;
		uuid: string;
		type: string;
		[key: string]: any;
	}

	export class MeshStandardMaterial extends Material {
		color: Color;
		map: Texture | null;
		[key: string]: any;
	}

	export class MeshBasicMaterial extends Material {
		color: Color;
		map: Texture | null;
		side: number;
		transparent: boolean;
		constructor(parameters?: any);
		[key: string]: any;
	}

	export class SpriteMaterial extends Material {
		map: Texture | null;
		color: Color;
		[key: string]: any;
	}

	export class Sprite extends Object3D {
		material: SpriteMaterial;
		center: { x: number; y: number };
		[key: string]: any;
	}

	export class CanvasTexture extends Texture {
		constructor(canvas: HTMLCanvasElement, ...args: any[]);
		[key: string]: any;
	}

	export class VideoTexture extends Texture {
		constructor(video: HTMLVideoElement, ...args: any[]);
		[key: string]: any;
	}

	export const DefaultLoadingManager: any;

	export class AmbientLight extends Object3D {
		color: Color;
		intensity: number;
		constructor(color?: any, intensity?: number);
		[key: string]: any;
	}

	export class DirectionalLight extends Object3D {
		color: Color;
		intensity: number;
		constructor(color?: any, intensity?: number);
		[key: string]: any;
	}

	export class PointLight extends Object3D {
		color: Color;
		intensity: number;
		distance: number;
		constructor(color?: any, intensity?: number, distance?: number, decay?: number);
		[key: string]: any;
	}

	export class HemisphereLight extends Object3D {
		color: Color;
		groundColor: Color;
		intensity: number;
		[key: string]: any;
	}

	export class GridHelper extends Object3D {
		constructor(size?: number, divisions?: number, color1?: any, color2?: any);
		material: any;
		[key: string]: any;
	}

	export class BufferGeometry {
		attributes: any;
		index: any;
		[key: string]: any;
	}

	export class PlaneGeometry extends BufferGeometry {
		constructor(width?: number, height?: number, widthSegments?: number, heightSegments?: number);
	}

	export class BoxGeometry extends BufferGeometry {
		constructor(width?: number, height?: number, depth?: number);
	}

	export class SphereGeometry extends BufferGeometry {
		constructor(radius?: number, widthSegments?: number, heightSegments?: number);
	}

	export class CylinderGeometry extends BufferGeometry {
		constructor(radiusTop?: number, radiusBottom?: number, height?: number, radialSegments?: number);
	}

	// Constants
	export const SRGBColorSpace: string;
	export const LinearMipmapLinearFilter: number;
	export const LinearFilter: number;
	export const RGBAFormat: number;
	export const DoubleSide: number;
	export const NormalBlending: number;
	export const AlwaysDepth: number;
	export const DEG2RAD: number;
	export const RAD2DEG: number;

	// Math utilities
	export namespace MathUtils {
		function generateUUID(): string;
		function clamp(value: number, min: number, max: number): number;
		function degToRad(degrees: number): number;
		function radToDeg(radians: number): number;
		const DEG2RAD: number;
		const RAD2DEG: number;
	}
}


// ── 通配符模块声明 ──
// three.js editor 和 examples 中的 JS 文件不在迁移范围内
// 使用通配符声明允许从这些路径 import 而不产生 TS7016 错误
// 所有从这些模块导入的值类型为 any

declare module '*.js' {
	const value: any;
	export default value;
	export const Command: any;
	export const SetValueCommand: any;
	export const AddObjectCommand: any;
	export const RemoveObjectCommand: any;
	export const MoveObjectCommand: any;
	export const MultiCmdsCommand: any;
	export const SetPositionCommand: any;
	export const SetRotationCommand: any;
	export const SetScaleCommand: any;
	export const AddScriptCommand: any;
	export const SetScriptValueCommand: any;
	export const RemoveScriptCommand: any;
	export const UIPanel: any;
	export const UIRow: any;
	export const UIText: any;
	export const UIInput: any;
	export const UISelect: any;
	export const UIButton: any;
	export const UIBreak: any;
	export const UINumber: any;
	export const UICheckbox: any;
	export const UITextArea: any;
	export const UIHorizontalRule: any;
	export const UIOutliner: any;
	export const UIBoolean: any;
	export const GLTFLoader: any;
	export const DRACOLoader: any;
	export const VOXLoader: any;
	export const VOXMesh: any;
	export const KTX2Loader: any;
}


// ── 通配符模块声明 ──
// three.js editor 和 examples 中的 JS 文件不在迁移范围内
// 使用通配符声明允许从这些路径 import 而不产生 TS7016 错误
// 所有从这些模块导入的值类型为 any

declare module '*.js' {
	const value: any;
	export default value;
	export const Command: any;
	export const SetValueCommand: any;
	export const AddObjectCommand: any;
	export const RemoveObjectCommand: any;
	export const MoveObjectCommand: any;
	export const MultiCmdsCommand: any;
	export const SetPositionCommand: any;
	export const SetRotationCommand: any;
	export const SetScaleCommand: any;
	export const AddScriptCommand: any;
	export const SetScriptValueCommand: any;
	export const RemoveScriptCommand: any;
	export const UIPanel: any;
	export const UIRow: any;
	export const UIText: any;
	export const UIInput: any;
	export const UISelect: any;
	export const UIButton: any;
	export const UIBreak: any;
	export const UINumber: any;
	export const UICheckbox: any;
	export const UITextArea: any;
	export const UIHorizontalRule: any;
	export const UIOutliner: any;
	export const UIBoolean: any;
	export const GLTFLoader: any;
	export const DRACOLoader: any;
	export const VOXLoader: any;
	export const VOXMesh: any;
	export const KTX2Loader: any;
	export function clone(source: any): any;
	export function retarget(target: any, source: any, options?: any): void;
	export function mergeGeometries(geometries: any[], useGroups?: boolean): any;
}
