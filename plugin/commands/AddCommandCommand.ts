import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppCommand, MrppObject3D } from '../types/mrpp.js';

class AddCommandCommand extends Command {

	declare object: MrppObject3D;
	command: MrppCommand;

	constructor(editor: MrppEditor, object: MrppObject3D, command: MrppCommand) {
		super(editor);

		this.type = 'AddCommandCommand';
		this.name = 'Add Command';

		this.object = object;
		this.command = command;
	}

	execute(): void {
		if (this.object.commands === undefined) {
			this.object.commands = [];
		}

		this.object.commands.push(this.command);
		this.editor.signals.commandAdded.dispatch(this.command);
	}

	undo(): void {
		if (this.object.commands === undefined) return;

		const index = this.object.commands.indexOf(this.command);

		if (index !== -1) {
			this.object.commands.splice(index, 1);
		}

		this.editor.signals.commandRemoved.dispatch(this.command);
	}

	toJSON(): any {
		const output: any = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.command = this.command;

		return output;
	}

	fromJSON(json: any): void {
		super.fromJSON(json);

		this.command = json.command;
		this.object = this.editor.objectByUuid(json.objectUuid);
	}
}

export { AddCommandCommand };
