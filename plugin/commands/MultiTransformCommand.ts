import * as THREE from 'three';
import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor } from '../types/mrpp.js';

class MultiTransformCommand extends Command {

	objects: THREE.Object3D[];
	oldPositions: Record<number, THREE.Vector3>;
	newPositions: Record<number, THREE.Vector3>;
	oldRotations: Record<number, THREE.Euler>;
	newRotations: Record<number, THREE.Euler>;
	oldScales: Record<number, THREE.Vector3>;
	newScales: Record<number, THREE.Vector3>;
	multiSelectGroup: any;
	oldGroupPosition: THREE.Vector3 | null;
	oldGroupRotation: THREE.Euler | null;
	oldGroupScale: THREE.Vector3 | null;
	newGroupPosition: THREE.Vector3 | null;
	newGroupRotation: THREE.Euler | null;
	newGroupScale: THREE.Vector3 | null;

	constructor(editor: MrppEditor, objects: THREE.Object3D[], type?: string, name?: string) {
		super(editor);

		this.type = type || 'MultiTransformCommand';
		this.name = name || '多对象变换';

		this.objects = objects.slice();
		this.oldPositions = {};
		this.newPositions = {};
		this.oldRotations = {};
		this.newRotations = {};
		this.oldScales = {};
		this.newScales = {};

		// 存储多选组的状态
		this.multiSelectGroup = editor.multiSelectGroup;
		this.oldGroupPosition = this.multiSelectGroup ? this.multiSelectGroup.position.clone() : null;
		this.oldGroupRotation = this.multiSelectGroup ? this.multiSelectGroup.rotation.clone() : null;
		this.oldGroupScale = this.multiSelectGroup ? this.multiSelectGroup.scale.clone() : null;
		this.newGroupPosition = null;
		this.newGroupRotation = null;
		this.newGroupScale = null;

		// 存储当前所有对象的变换信息
		this.storeCurrentState();
	}

	storeCurrentState(): void {
		for (let i = 0; i < this.objects.length; i++) {
			const object: any = this.objects[i];

			this.oldPositions[object.id] = object.position.clone();
			this.oldRotations[object.id] = object.rotation.clone();
			this.oldScales[object.id] = object.scale.clone();

			this.newPositions[object.id] = object.position.clone();
			this.newRotations[object.id] = object.rotation.clone();
			this.newScales[object.id] = object.scale.clone();
		}

		if (this.multiSelectGroup) {
			this.newGroupPosition = this.multiSelectGroup.position.clone();
			this.newGroupRotation = this.multiSelectGroup.rotation.clone();
			this.newGroupScale = this.multiSelectGroup.scale.clone();
		}
	}

	updateNewState(): void {
		for (let i = 0; i < this.objects.length; i++) {
			const object: any = this.objects[i];

			this.newPositions[object.id] = object.position.clone();
			this.newRotations[object.id] = object.rotation.clone();
			this.newScales[object.id] = object.scale.clone();
		}

		if (this.multiSelectGroup) {
			this.newGroupPosition = this.multiSelectGroup.position.clone();
			this.newGroupRotation = this.multiSelectGroup.rotation.clone();
			this.newGroupScale = this.multiSelectGroup.scale.clone();
		}
	}

	execute(): void {
		this.updateNewState();
	}

	undo(): void {
		for (let i = 0; i < this.objects.length; i++) {
			const object: any = this.objects[i];

			if (this.oldPositions[object.id]) {
				object.position.copy(this.oldPositions[object.id]);
			}

			if (this.oldRotations[object.id]) {
				object.rotation.copy(this.oldRotations[object.id]);
			}

			if (this.oldScales[object.id]) {
				object.scale.copy(this.oldScales[object.id]);
			}
		}

		// 恢复多选组状态
		if (this.multiSelectGroup) {
			if (this.oldGroupPosition) this.multiSelectGroup.position.copy(this.oldGroupPosition);
			if (this.oldGroupRotation) this.multiSelectGroup.rotation.copy(this.oldGroupRotation);
			if (this.oldGroupScale) this.multiSelectGroup.scale.copy(this.oldGroupScale);

			this.editor.signals.multipleObjectsTransformChanged.dispatch(this.multiSelectGroup);
		}

		for (let i = 0; i < this.objects.length; i++) {
			this.editor.signals.objectChanged.dispatch(this.objects[i]);
		}
		this.editor.signals.sceneGraphChanged.dispatch();
	}

	redo(): void {
		for (let i = 0; i < this.objects.length; i++) {
			const object: any = this.objects[i];

			if (this.newPositions[object.id]) {
				object.position.copy(this.newPositions[object.id]);
			}

			if (this.newRotations[object.id]) {
				object.rotation.copy(this.newRotations[object.id]);
			}

			if (this.newScales[object.id]) {
				object.scale.copy(this.newScales[object.id]);
			}
		}

		// 恢复多选组状态
		if (this.multiSelectGroup) {
			if (this.newGroupPosition) this.multiSelectGroup.position.copy(this.newGroupPosition);
			if (this.newGroupRotation) this.multiSelectGroup.rotation.copy(this.newGroupRotation);
			if (this.newGroupScale) this.multiSelectGroup.scale.copy(this.newGroupScale);

			this.editor.signals.multipleObjectsTransformChanged.dispatch(this.multiSelectGroup);
		}

		for (let i = 0; i < this.objects.length; i++) {
			this.editor.signals.objectChanged.dispatch(this.objects[i]);
		}
		this.editor.signals.sceneGraphChanged.dispatch();
	}

}

export { MultiTransformCommand };
