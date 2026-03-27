import { Command } from '../../three.js/editor/js/Command.js';

class AddEventCommand extends Command {

	/**
	 * @param {object} editor - Editor 实例
	 * @param {object} event - 要添加的事件对象
	 * @param {string} mode - 事件模式（'input' 或 'output'）
	 */
	constructor(editor, event, mode) {

		super(editor);

		this.type = 'AddEventCommand';
		this.name = 'Add Event';
		this.mode = mode;

		this.event = event;

	}

	/** 执行添加事件操作 */
	execute() {

		if (this.editor.scene.events === undefined) {

			/**
			 * MRPP 扩展属性：事件对象，附加在 THREE.Scene 实例上。
			 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
			 * @type {{inputs: Array<{title: string, uuid: string}>, outputs: Array<{title: string, uuid: string}>}}
			 */
			this.editor.scene.events = {};

		}
		if (this.mode === 'input') {
			if (this.editor.scene.events.inputs === undefined) {
				this.editor.scene.events.inputs = [];
			}
			this.editor.scene.events.inputs.push(this.event);
			this.editor.signals.eventAdded.dispatch(this.event);
		}
		if (this.mode === 'output') {
			if (this.editor.scene.events.outputs === undefined) {
				this.editor.scene.events.outputs = [];
			}
			this.editor.scene.events.outputs.push(this.event);
			this.editor.signals.eventAdded.dispatch(this.event);
		}
	}

	/** 撤销添加事件操作 */
	undo() {

		if (this.mode === 'input') {
			if (this.editor.scene.events.inputs === undefined) return;
			const index = this.editor.scene.events.inputs.indexOf(this.event);
			if (index !== - 1) {
				this.editor.scene.events.inputs.splice(index, 1);
				this.editor.signals.eventRemoved.dispatch(this.event);
			}
		} else if (this.mode === 'output') {
			if (this.editor.scene.events.outputs === undefined) return;
			const index = this.editor.scene.events.outputs.indexOf(this.event);
			if (index !== - 1) {
				this.editor.scene.events.outputs.splice(index, 1);
				this.editor.signals.eventRemoved.dispatch(this.event);
			}
		}


	}

	/**
	 * 序列化为 JSON。
	 * @returns {object} JSON 表示
	 */
	toJSON() {

		const output = super.toJSON(this);
		output.event = this.enent;
		output.mode = this.mode;
		return output;

	}

	/**
	 * 从 JSON 反序列化。
	 * @param {object} json - JSON 数据
	 */
	fromJSON(json) {

		super.fromJSON(json);
		this.event = json.event;
		this.mode = json.mode;

	}

}

export { AddEventCommand };
