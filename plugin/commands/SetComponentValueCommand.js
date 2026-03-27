import { Command } from '../../three.js/editor/js/Command.js';

class SetComponentValueCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {import('three').Object3D} object - 目标 3D 对象
	 * @param {object} component - 组件对象
	 * @param {string} attributeName - 要设置的属性名
	 * @param {*} newValue - 新属性值
	 */
	constructor(editor, object, component, attributeName, newValue) {

		super(editor);

		this.type = 'SetComponentValueCommand';
		this.name = `Set Component.${attributeName}`;
		this.updatable = true;

		this.object = object;
		this.component = component;

		this.attributeName = attributeName;
		this.oldValue = (component !== undefined) ? component[this.attributeName] : undefined;
		this.newValue = newValue;

	}

	/** 执行设置组件属性值操作 */
	execute() {

		this.component[this.attributeName] = this.newValue;

		this.editor.signals.componentChanged.dispatch(this.component);

	}

	/** 撤销设置组件属性值操作 */
	undo() {

		this.component[this.attributeName] = this.oldValue;

		this.editor.signals.componentChanged.dispatch(this.component);

	}

	/**
	 * 合并可更新命令的新值。
	 * @param {SetComponentValueCommand} cmd - 新的命令实例
	 */
	update(cmd) {

		this.newValue = cmd.newValue;

	}

	/**
	 * 序列化为 JSON。
	 * @returns {object} JSON 表示
	 */
	toJSON() {

		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.index = this.object.components.indexOf(this.component);
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;

	}

	/**
	 * 从 JSON 反序列化。
	 * @param {object} json - JSON 数据
	 */
	fromJSON(json) {

		super.fromJSON(json);

		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.attributeName = json.attributeName;
		this.object = this.editor.objectByUuid(json.objectUuid);
		this.component = this.object.components[json.index];

	}

}

export { SetComponentValueCommand };
