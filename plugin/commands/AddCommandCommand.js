import { Command } from '../../three.js/editor/js/Command.js';

class AddCommandCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {import('three').Object3D} object - 目标 3D 对象
	 * @param {object} command - 要添加的命令对象
	 */
	constructor(editor, object, command) {
		super(editor);

		this.type = 'AddCommandCommand';
		this.name = 'Add Command';

		this.object = object;
		this.command = command;
	}

	/** 执行添加命令操作 */
	execute() {
		if (this.object.commands === undefined) {
			/**
			 * MRPP 扩展属性：命令数组，附加在 THREE.Object3D 实例上。
			 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
			 * @type {Array<{type: string, [key: string]: any}>}
			 */
			this.object.commands = [];
		}

		this.object.commands.push(this.command);
		this.editor.signals.commandAdded.dispatch(this.command);
	}

	/** 撤销添加命令操作 */
	undo() {
		if (this.object.commands === undefined) return;

		const index = this.object.commands.indexOf(this.command);

		if (index !== -1) {
			this.object.commands.splice(index, 1);
		}

		this.editor.signals.commandRemoved.dispatch(this.command);
	}

	/**
	 * 序列化为 JSON。
	 * @returns {object} JSON 表示
	 */
	toJSON() {
		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.command = this.command;

		return output;
	}

	/**
	 * 从 JSON 反序列化。
	 * @param {object} json - JSON 数据
	 */
	fromJSON(json) {
		super.fromJSON(json);

		this.command = json.command;
		this.object = this.editor.objectByUuid(json.objectUuid);
	}
}

export { AddCommandCommand };
