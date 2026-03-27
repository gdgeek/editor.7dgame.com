import * as THREE from 'three';

// ── Object3D 扩展属性 ──
export interface MrppComponent {
	type: string;
	parameters: { uuid: string; [key: string]: any };
}

export interface MrppCommand {
	type: string;
	parameters: { uuid: string; action: string; [key: string]: any };
}

export interface MrppEventIO {
	title: string;
	uuid: string;
}

export interface MrppObject3D extends THREE.Object3D {
	components: MrppComponent[];
	commands: MrppCommand[];
}

export interface MrppScene extends THREE.Scene {
	events: { inputs: MrppEventIO[]; outputs: MrppEventIO[] };
}

// ── Editor 扩展接口 ──
export interface MrppEditor {
	type: string;
	resources: any[];
	selectedObjects: any[];
	access: import('../access/Access.js').Access;
	multiSelectGroup: any;
	data: any;
	metaLoader?: any;
	verseLoader?: any;
	scene: MrppScene;
	camera: THREE.Camera;
	selected: THREE.Object3D | null;
	config: { getKey(key: string): any; setKey(key: string, value: any): void };
	signals: Record<string, any>;
	strings: { getKey(key: string): string };
	selector: { select(object: THREE.Object3D): void };
	renderer: THREE.WebGLRenderer;
	// 方法
	save(): boolean;
	showNotification(message: string, isError?: boolean): void;
	showConfirmation(message: string, onConfirm: Function, onCancel: Function | null, event: Event, isError?: boolean): void;
	getSelectedObjects(): THREE.Object3D[];
	clearSelection(): void;
	execute(command: any): void;
	addObject(object: THREE.Object3D, parent?: THREE.Object3D, index?: number): void;
	removeObject(object: THREE.Object3D): void;
	select(object: THREE.Object3D | null, multiSelect?: boolean): void;
	clear(): void;
	setScene(scene: THREE.Scene): void;
	fromJSON(json: any): Promise<void>;
	toJSON(): any;
	storage: { init(cb: Function): void; get(cb: Function): void; set(data: any): void; clear(): void };
	loader: { loadItemList(items: any): void; loadFiles(files: any): void };
	[key: string]: any;
}

// ── 全局变量声明 ──
declare global {
	// signals 库通过 <script> 标签加载
	const signals: {
		Signal: new () => {
			add(listener: Function): void;
			dispatch(...args: any[]): void;
			remove(listener: Function): void;
		};
	};
	// 部分文件通过全局 THREE 访问（未 import）
	// 迁移后这些文件应改为 import，此声明作为过渡
	var THREE: typeof import('three');
	interface Window {
		editor: MrppEditor;
		resources: Map<string, any>;
	}
}
