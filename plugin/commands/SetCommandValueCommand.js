import { Command } from '../../three.js/editor/js/Command.js';

class SetCommandValueCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {import('three').Object3D} object - 目标 3D 对象
	 * @param {object} command - 命令对象
	 * @param {string} attributeName - 要设置的属性名
	 * @param {*} newValue - 新属性值
	 */
	constructor(editor, object, command, attributeName, newValue) {
		super(editor);

		this.type = 'SetCommandValueCommand';
		this.name = `Set ${attributeName}`;

		this.object = object;
		this.command = command;
		this.attributeName = attributeName;
		this.oldValue = (command !== undefined) ? command[attributeName] : undefined;
		this.newValue = newValue;
	}

	/** 执行设置命令属性值操作 */
	execute() {
		this.command[this.attributeName] = this.newValue;
		this.editor.signals.commandChanged.dispatch(this.command);
	}

	/** 撤销设置命令属性值操作 */
	undo() {
		this.command[this.attributeName] = this.oldValue;
		this.editor.signals.commandChanged.dispatch(this.command);
	}

	/**
	 * 序列化为 JSON。
	 * @returns {object} JSON 表示
	 */
	toJSON() {
		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.command = this.command;
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

		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.object = this.editor.objectByUuid(json.objectUuid);
		this.command = json.command;
	}
}

export { SetCommandValueCommand };
