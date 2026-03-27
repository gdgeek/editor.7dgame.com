import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppEventIO, MrppScene } from '../types/mrpp.js';

class SetEventValueCommand extends Command {

	object: any;
	script: MrppEventIO | undefined;
	event: MrppEventIO | undefined;
	mode: string;
	attributeName: string;
	oldValue: any;
	newValue: any;
	index: number;

	constructor(editor: MrppEditor, event: MrppEventIO | undefined, mode: string, attributeName: string, newValue: any) {

		super(editor);

		this.type = 'SetEventValueCommand';
		this.name = `Set Event.${attributeName}`;
		this.updatable = true;

		this.object = editor.scene;
		this.script = event;
		this.event = event;
		this.mode = mode;
		this.attributeName = attributeName;
		this.oldValue = event !== undefined ? (event as any)[attributeName] : undefined;
		this.newValue = newValue;
		this.index = this.getEventIndex();

	}

	getEventList(): MrppEventIO[] {

		if ((this.editor.scene as MrppScene).events === undefined) return [];
		if (this.mode === 'input') return (this.editor.scene as MrppScene).events.inputs || [];
		if (this.mode === 'output') return (this.editor.scene as MrppScene).events.outputs || [];

		return [];

	}

	getEventIndex(): number {

		return this.getEventList().findIndex((item: MrppEventIO) => item && this.event && item.uuid === this.event.uuid);

	}

	execute(): void {

		if (this.event === undefined) return;

		(this.event as any)[this.attributeName] = this.newValue;
		this.editor.signals.eventChanged.dispatch(this.event);

	}

	undo(): void {

		if (this.event === undefined) return;

		(this.event as any)[this.attributeName] = this.oldValue;
		this.editor.signals.eventChanged.dispatch(this.event);

	}

	update(cmd: SetEventValueCommand): void {

		this.newValue = cmd.newValue;

	}

	toJSON(): any {

		const output: any = super.toJSON();

		output.mode = this.mode;
		output.index = this.index;
		output.eventUuid = this.event ? this.event.uuid : null;
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;

	}

	fromJSON(json: any): void {

		super.fromJSON(json);

		this.mode = json.mode;
		this.index = json.index;
		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;

		const list = this.getEventList();
		this.event = list.find((item: MrppEventIO) => item && item.uuid === json.eventUuid) || list[json.index];
		this.object = this.editor.scene;
		this.script = this.event;

	}

}

export { SetEventValueCommand };
