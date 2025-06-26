import * as THREE from 'three';
import { Command } from '../Command.js';

/**
 * @param editor 编辑器
 * @param objects 被变换的对象数组
 * @param newPositions 新位置映射表 {id: Vector3}
 * @param oldPositions 旧位置映射表 {id: Vector3}
 * @param newRotations 新旋转映射表 {id: Euler}
 * @param oldRotations 旧旋转映射表 {id: Euler}
 * @param newScales 新缩放映射表 {id: Vector3}
 * @param oldScales 旧缩放映射表 {id: Vector3}
 * @constructor
 */
class MultiTransformCommand extends Command {

	constructor(editor, objects, type, name) {
		super(editor);

		this.type = type || 'MultiTransformCommand';
		this.name = name || '多对象变换';

		this.objects = objects.slice(); // 克隆数组
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

		// 存储当前所有对象的变换信息
		this.storeCurrentState();
	}

	storeCurrentState() {
		// 保存当前所有对象的变换信息
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];

			this.oldPositions[object.id] = object.position.clone();
			this.oldRotations[object.id] = object.rotation.clone();
			this.oldScales[object.id] = object.scale.clone();

			// 默认新状态等于旧状态
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

	updateNewState() {
		// 更新新状态为当前对象状态
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];

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

	execute() {
		// 执行时将当前状态保存为新状态
		this.updateNewState();
	}

	undo() {
		// 恢复到原来的状态
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];

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

			// 触发多选组更新信号
			this.editor.signals.multipleObjectsTransformChanged.dispatch(this.multiSelectGroup);
		}

		// 通知对象已更改
		// 使用objectChanged而不是objectsChanged，确保每个对象都触发变更事件
		for (let i = 0; i < this.objects.length; i++) {
			this.editor.signals.objectChanged.dispatch(this.objects[i]);
		}
		this.editor.signals.sceneGraphChanged.dispatch();
	}

	redo() {
		// 恢复到新状态
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];

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

			// 触发多选组更新信号
			this.editor.signals.multipleObjectsTransformChanged.dispatch(this.multiSelectGroup);
		}

		// 通知对象已更改
		// 使用objectChanged而不是objectsChanged，确保每个对象都触发变更事件
		for (let i = 0; i < this.objects.length; i++) {
			this.editor.signals.objectChanged.dispatch(this.objects[i]);
		}
		this.editor.signals.sceneGraphChanged.dispatch();
	}

}

export { MultiTransformCommand };
