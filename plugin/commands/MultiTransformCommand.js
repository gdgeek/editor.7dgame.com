import * as THREE from 'three';
import { Command } from '../../three.js/editor/js/Command.js';

class MultiTransformCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {Array<import('three').Object3D>} objects - 被变换的对象数组
	 * @param {string} [type] - 命令类型标识
	 * @param {string} [name] - 命令显示名称
	 */
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

	/** 保存当前所有对象的变换信息 */
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

	/** 更新新状态为当前对象状态 */
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

	/** 执行变换操作（保存当前状态为新状态） */
	execute() {
		// 执行时将当前状态保存为新状态
		this.updateNewState();
	}

	/** 撤销变换操作（恢复到原来的状态） */
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

	/** 重做变换操作（恢复到新状态） */
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
