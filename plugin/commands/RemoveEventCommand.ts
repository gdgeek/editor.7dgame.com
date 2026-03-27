import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppEventIO, MrppScene } from '../types/mrpp.js';

class RemoveEventCommand extends Command {

	event: MrppEventIO;
	mode: string;
	index: number;

	constructor(editor: MrppEditor, event: MrppEventIO, mode: string) {

		super(editor);
		this.mode = mode;
		this.type = 'RemoveEventCommand';
		this.name = 'Remove Event';

		this.event = event;
		this.index = -1;
		if (this.mode === 'input') {
			this.index = (this.editor.scene as MrppScene).events.inputs.findIndex((evt: MrppEventIO) => evt.uuid === this.event.uuid);

		} else if (this.mode === 'output' && (this.editor.scene as MrppScene).events.outputs) {
			this.index = (this.editor.scene as MrppScene).events.outputs.findIndex((evt: MrppEventIO) => evt.uuid === this.event.uuid);
		}

	}

	execute(): void {

		if ((this.editor.scene as MrppScene).events === undefined) return;
		if (this.mode === 'input' && this.index !== -1) {
			(this.editor.scene as MrppScene).events.inputs.splice(this.index, 1);
			this.editor.signals.eventRemoved.dispatch(this.event);
		} else if (this.mode === 'output' && this.index !== -1) {
			(this.editor.scene as MrppScene).events.outputs.splice(this.index, 1);
			this.editor.signals.eventRemoved.dispatch(this.event);
		}
	}

	undo(): void {

		if ((this.editor.scene as MrppScene).events === undefined) {
			(this.editor.scene as any).events = {};
		}
		if (this.mode === 'input') {
			if ((this.editor.scene as MrppScene).events.inputs === undefined) {
				(this.editor.scene as MrppScene).events.inputs = [];
			}
			(this.editor.scene as MrppScene).events.inputs.splice(this.index, 0, this.event);
			this.editor.signals.eventAdded.dispatch(this.event);
		}
		if (this.mode === 'output') {
			if ((this.editor.scene as MrppScene).events.outputs === undefined) {
				(this.editor.scene as MrppScene).events.outputs = [];
			}
			(this.editor.scene as MrppScene).events.outputs.splice(this.index, 0, this.event);
			this.editor.signals.eventAdded.dispatch(this.event);
		}

	}

	toJSON(): any {

		const output: any = super.toJSON();
		output.event = this.event;
		output.mode = this.mode;
		output.index = this.index;

		return output;

	}

	fromJSON(json: any): void {

		super.fromJSON(json);
		this.event = json.event;
		this.mode = json.mode;
		this.index = json.index;
	}

}

export { RemoveEventCommand };
