import * as THREE from 'three';
import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor } from '../types/mrpp.js';

class MoveMultipleObjectsCommand extends Command {

	objects: THREE.Object3D[];
	oldParents: (THREE.Object3D | null)[];
	oldIndices: number[];
	newParent: THREE.Object3D;
	newIndices: number[];

	constructor(editor: MrppEditor, objects: THREE.Object3D[], newParent: THREE.Object3D, newBefore?: THREE.Object3D) {

		super(editor);

		this.type = 'MoveMultipleObjectsCommand';
		this.name = 'Move Multiple Objects';

		this.objects = objects.slice();
		this.oldParents = [];
		this.oldIndices = [];
		this.newParent = newParent;
		this.newIndices = [];

		// 记录每个对象的原始父级和索引
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object !== undefined && object.parent != null) {
				this.oldParents.push(object.parent);
				this.oldIndices.push(object.parent.children.indexOf(object));
			} else {
				this.oldParents.push(null);
				this.oldIndices.push(-1);
			}
		}

		// 计算新索引
		if (newBefore !== undefined) {
			const baseIndex = newParent.children.indexOf(newBefore);

			for (let i = 0; i < objects.length; i++) {
				this.newIndices.push(baseIndex + i);
			}
		} else {
			const baseIndex = newParent.children.length;

			for (let i = 0; i < objects.length; i++) {
				this.newIndices.push(baseIndex + i);
			}
		}
	}

	execute(): void {
		const reorderOnly = !! ( this.editor.type && this.editor.type.toLowerCase() === 'verse' );
		if ( reorderOnly ) {

			for ( let i = 0; i < this.oldParents.length; i ++ ) {

				if ( this.oldParents[ i ] !== this.newParent ) return;

			}

		}

		// 先从原来的父对象中移除所有选中对象
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object && this.oldParents[i]) {
				this.oldParents[i]!.remove(object);
			}
		}

		// 然后按指定顺序添加到新父对象
		for (let i = 0; i < this.objects.length; i++) {
			const object = this.objects[i];
			if (object) {
				const children = this.newParent.children;
				const adjustedIndex = Math.min(this.newIndices[i], children.length);
				children.splice(adjustedIndex, 0, object);
				(object as any).parent = this.newParent;
				object.dispatchEvent({ type: 'added' } as any);
			}
		}

		this.editor.signals.sceneGraphChanged.dispatch();
	}

	undo(): void {
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
				const children = this.oldParents[i]!.children;
				const index = Math.min(this.oldIndices[i], children.length);
				children.splice(index, 0, object);
				(object as any).parent = this.oldParents[i];
				object.dispatchEvent({ type: 'added' } as any);
			}
		}

		this.editor.signals.sceneGraphChanged.dispatch();
	}

	toJSON(): any {
		const output: any = super.toJSON();

		output.objectUuids = this.objects.map((obj: THREE.Object3D) => obj.uuid);
		output.newParentUuid = this.newParent.uuid;
		output.oldParentUuids = this.oldParents.map((parent: THREE.Object3D | null) => parent ? parent.uuid : null);
		output.newIndices = this.newIndices;
		output.oldIndices = this.oldIndices;

		return output;
	}

	fromJSON(json: any): void {
		super.fromJSON(json);

		this.objects = json.objectUuids.map((uuid: string) => this.editor.objectByUuid(uuid));
		this.oldParents = json.oldParentUuids.map((uuid: string | null) =>
			uuid ? this.editor.objectByUuid(uuid) : null
		);

		// 如果父级未找到，使用场景作为默认值
		this.oldParents = this.oldParents.map((parent: THREE.Object3D | null) => parent || this.editor.scene);

		this.newParent = this.editor.objectByUuid(json.newParentUuid);
		if (this.newParent === undefined) {
			this.newParent = this.editor.scene;
		}

		this.newIndices = json.newIndices;
		this.oldIndices = json.oldIndices;
	}
}

export { MoveMultipleObjectsCommand };
