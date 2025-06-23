import { Command } from '../Command.js';

/**
 * @param editor Editor
 * @param objects Array<THREE.Object3D> 选中的对象数组
 * @param newParent THREE.Object3D 新的父级对象
 * @param newBefore THREE.Object3D 在此对象之前插入（可选）
 * @constructor
 */
class MoveMultipleObjectsCommand extends Command {

	constructor( editor, objects, newParent, newBefore ) {

		super( editor );

		this.type = 'MoveMultipleObjectsCommand';
		this.name = 'Move Multiple Objects';

		this.objects = objects.slice(); // 复制数组
		this.oldParents = [];
		this.oldIndices = [];
		this.newParent = newParent;
		this.newIndices = [];

		// 记录每个对象的原始父级和索引
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object !== undefined && object.parent !== undefined) {
				this.oldParents.push(object.parent);
				this.oldIndices.push(object.parent.children.indexOf(object));
			} else {
				// 如果对象没有父级，跳过它
				this.oldParents.push(null);
				this.oldIndices.push(-1);
			}
		}

		// 计算新索引
		if (newBefore !== undefined) {
			const baseIndex = newParent.children.indexOf(newBefore);

			// 为每个对象计算新索引，它们会依次排列
			for (let i = 0; i < objects.length; i++) {
				this.newIndices.push(baseIndex + i);
			}
		} else {
			// 如果没有指定newBefore，所有对象将添加到末尾
			const baseIndex = newParent.children.length;

			for (let i = 0; i < objects.length; i++) {
				this.newIndices.push(baseIndex + i);
			}
		}
	}

	execute() {
		// 先从原来的父对象中移除所有选中对象
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object && this.oldParents[i]) {
				this.oldParents[i].remove(object);
			}
		}

		// 然后按指定顺序添加到新父对象
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object) {
				// 添加到指定位置
				const children = this.newParent.children;
				// 考虑到可能有多个对象插入，索引位置可能会变化
				const adjustedIndex = Math.min(this.newIndices[i], children.length);
				children.splice(adjustedIndex, 0, object);
				object.parent = this.newParent;
				object.dispatchEvent({ type: 'added' });
			}
		}

		this.editor.signals.sceneGraphChanged.dispatch();
	}

	undo() {
		// 从新父对象中移除所有选中对象
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object) {
				this.newParent.remove(object);
			}
		}

		// 恢复到原始位置
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object && this.oldParents[i]) {
				const children = this.oldParents[i].children;
				const index = Math.min(this.oldIndices[i], children.length);
				children.splice(index, 0, object);
				object.parent = this.oldParents[i];
				object.dispatchEvent({ type: 'added' });
			}
		}

		this.editor.signals.sceneGraphChanged.dispatch();
	}

	toJSON() {
		const output = super.toJSON(this);

		output.objectUuids = this.objects.map(obj => obj.uuid);
		output.newParentUuid = this.newParent.uuid;
		output.oldParentUuids = this.oldParents.map(parent => parent ? parent.uuid : null);
		output.newIndices = this.newIndices;
		output.oldIndices = this.oldIndices;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.objects = json.objectUuids.map(uuid => this.editor.objectByUuid(uuid));
		this.oldParents = json.oldParentUuids.map(uuid =>
			uuid ? this.editor.objectByUuid(uuid) : null
		);

		// 如果父级未找到，使用场景作为默认值
		this.oldParents = this.oldParents.map(parent => parent || this.editor.scene);

		this.newParent = this.editor.objectByUuid(json.newParentUuid);
		if (this.newParent === undefined) {
			this.newParent = this.editor.scene;
		}

		this.newIndices = json.newIndices;
		this.oldIndices = json.oldIndices;
	}
}

export { MoveMultipleObjectsCommand };
