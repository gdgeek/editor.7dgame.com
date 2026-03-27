import { Command } from '../../three.js/editor/js/Command.js';

class AddComponentCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {import('three').Object3D} object - 目标 3D 对象
	 * @param {object} component - 要添加的组件对象
	 */
	constructor(editor, object, component) {

		super(editor);

		this.type = 'AddComponentCommand';
		this.name = 'Add Component';

		this.object = object;
		this.component = component;

	}

	/** 执行添加组件操作 */
	execute() {

		if (this.object.components === undefined) {

			/**
			 * MRPP 扩展属性：组件数组，附加在 THREE.Object3D 实例上。
			 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
			 * @type {Array<{type: string, [key: string]: any}>}
			 */
			this.object.components = [];

		}

		this.object.components.push(this.component);

		this.editor.signals.componentAdded.dispatch(this.component);

	}

	/** 撤销添加组件操作 */
	undo() {

		if (this.object.components[this.object.uuid] === undefined) return;

		const index = this.object.components.indexOf(this.component);

		if (index !== - 1) {

			this.object.components.splice(index, 1);

		}

		this.editor.signals.componentRemoved.dispatch(this.component);

	}

	/**
	 * 序列化为 JSON。
	 * @returns {object} JSON 表示
	 */
	toJSON() {

		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.component = this.component;

		return output;

	}

	/**
	 * 从 JSON 反序列化。
	 * @param {object} json - JSON 数据
	 */
	fromJSON(json) {

		super.fromJSON(json);

		this.component = json.component;
		this.object = this.editor.objectByUuid(json.objectUuid);

	}

}

export { AddComponentCommand };
