import { Command } from '../../three.js/editor/js/Command.js';

class RemoveCommandCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {import('three').Object3D} object - 目标 3D 对象
	 * @param {object} command - 要移除的命令对象
	 */
	constructor(editor, object, command) {
		super(editor);

		this.type = 'RemoveCommandCommand';
		this.name = 'Remove Command';

		this.object = object;
		this.command = command;
		this.index = -1;
	}

	/** 执行移除命令操作 */
	execute() {
		if (this.object.commands === undefined) return;

		const index = this.object.commands.indexOf(this.command);

		if (index !== -1) {
			this.index = index;
			this.object.commands.splice(index, 1);
			this.editor.signals.commandRemoved.dispatch(this.command);
		}
	}

	/** 撤销移除命令操作 */
	undo() {
		if (this.index !== -1) {
			this.object.commands.splice(this.index, 0, this.command);
			this.editor.signals.commandAdded.dispatch(this.command);
		}
	}

	/**
	 * 序列化为 JSON。
	 * @returns {object} JSON 表示
	 */
	toJSON() {
		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.command = this.command;
		output.index = this.index;

		return output;
	}

	/**
	 * 从 JSON 反序列化。
	 * @param {object} json - JSON 数据
	 */
	fromJSON(json) {
		super.fromJSON(json);

		this.command = json.command;
		this.index = json.index;
		this.object = this.editor.objectByUuid(json.objectUuid);
	}
}

export { RemoveCommandCommand };
