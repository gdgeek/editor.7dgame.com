import { Command } from '../Command.js';

class SetEventValueCommand extends Command {

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

	getEventList() {

		if (this.editor.scene.events === undefined) return [];
		if (this.mode === 'input') return this.editor.scene.events.inputs || [];
		if (this.mode === 'output') return this.editor.scene.events.outputs || [];

		return [];

	}

	getEventIndex() {

		return this.getEventList().findIndex((item) => item && this.event && item.uuid === this.event.uuid);

	}

	execute() {

		if (this.event === undefined) return;

		this.event[this.attributeName] = this.newValue;
		this.editor.signals.eventChanged.dispatch(this.event);

	}

	undo() {

		if (this.event === undefined) return;

		this.event[this.attributeName] = this.oldValue;
		this.editor.signals.eventChanged.dispatch(this.event);

	}

	update(cmd) {

		this.newValue = cmd.newValue;

	}

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
