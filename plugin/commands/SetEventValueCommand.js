import { Command } from '../../three.js/editor/js/Command.js';

class SetEventValueCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {object} event - 事件对象
	 * @param {string} mode - 事件模式（'input' 或 'output'）
	 * @param {string} attributeName - 要设置的属性名
	 * @param {*} newValue - 新属性值
	 */
	constructor(editor, event, mode, attributeName, newValue) {

		super(editor);

		this.type = 'SetEventValueCommand';
		this.name = `Set Event.${attributeName}`;
		this.updatable = true;

		this.object = editor.scene;
		this.script = event;
		this.event = event;
		this.mode = mode;
		this.attributeName = attributeName;
		this.oldValue = event !== undefined ? event[attributeName] : undefined;
		this.newValue = newValue;
		this.index = this.getEventIndex();

	}

	/**
	 * 获取当前模式对应的事件列表。
	 * @returns {Array<object>} 事件列表
	 */
	getEventList() {

		if (this.editor.scene.events === undefined) return [];
		if (this.mode === 'input') return this.editor.scene.events.inputs || [];
		if (this.mode === 'output') return this.editor.scene.events.outputs || [];

		return [];

	}

	/**
	 * 获取当前事件在列表中的索引。
	 * @returns {number} 事件索引
	 */
	getEventIndex() {

		return this.getEventList().findIndex((item) => item && this.event && item.uuid === this.event.uuid);

	}

	/** 执行设置事件属性值操作 */
	execute() {

		if (this.event === undefined) return;

		this.event[this.attributeName] = this.newValue;
		this.editor.signals.eventChanged.dispatch(this.event);

	}

	/** 撤销设置事件属性值操作 */
	undo() {

		if (this.event === undefined) return;

		this.event[this.attributeName] = this.oldValue;
		this.editor.signals.eventChanged.dispatch(this.event);

	}

	/**
	 * 合并可更新命令的新值。
	 * @param {SetEventValueCommand} cmd - 新的命令实例
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

		output.mode = this.mode;
		output.index = this.index;
		output.eventUuid = this.event ? this.event.uuid : null;
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

		this.mode = json.mode;
		this.index = json.index;
		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;

		const list = this.getEventList();
		this.event = list.find((item) => item && item.uuid === json.eventUuid) || list[json.index];
		this.object = this.editor.scene;
		this.script = this.event;

	}

}

export { SetEventValueCommand };
