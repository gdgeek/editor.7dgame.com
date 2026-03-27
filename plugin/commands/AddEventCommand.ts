import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppEventIO, MrppScene } from '../types/mrpp.js';

class AddEventCommand extends Command {

	event: MrppEventIO;
	mode: string;

	constructor(editor: MrppEditor, event: MrppEventIO, mode: string) {

		super(editor);

		this.type = 'AddEventCommand';
		this.name = 'Add Event';
		this.mode = mode;

		this.event = event;

	}

	execute(): void {

		if ((this.editor.scene as MrppScene).events === undefined) {
			(this.editor.scene as any).events = {};
		}
		if (this.mode === 'input') {
			if ((this.editor.scene as MrppScene).events.inputs === undefined) {
				(this.editor.scene as MrppScene).events.inputs = [];
			}
			(this.editor.scene as MrppScene).events.inputs.push(this.event);
			this.editor.signals.eventAdded.dispatch(this.event);
		}
		if (this.mode === 'output') {
			if ((this.editor.scene as MrppScene).events.outputs === undefined) {
				(this.editor.scene as MrppScene).events.outputs = [];
			}
			(this.editor.scene as MrppScene).events.outputs.push(this.event);
			this.editor.signals.eventAdded.dispatch(this.event);
		}
	}

	undo(): void {

		if (this.mode === 'input') {
			if ((this.editor.scene as MrppScene).events.inputs === undefined) return;
			const index = (this.editor.scene as MrppScene).events.inputs.indexOf(this.event);
			if (index !== - 1) {
				(this.editor.scene as MrppScene).events.inputs.splice(index, 1);
				this.editor.signals.eventRemoved.dispatch(this.event);
			}
		} else if (this.mode === 'output') {
			if ((this.editor.scene as MrppScene).events.outputs === undefined) return;
			const index = (this.editor.scene as MrppScene).events.outputs.indexOf(this.event);
			if (index !== - 1) {
				(this.editor.scene as MrppScene).events.outputs.splice(index, 1);
				this.editor.signals.eventRemoved.dispatch(this.event);
			}
		}

	}

	toJSON(): any {

		const output: any = super.toJSON();
		output.event = this.event;
		output.mode = this.mode;
		return output;

	}

	fromJSON(json: any): void {

		super.fromJSON(json);
		this.event = json.event;
		this.mode = json.mode;

	}

}

export { AddEventCommand };
