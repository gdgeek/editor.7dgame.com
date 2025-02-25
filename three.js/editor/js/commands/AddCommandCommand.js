import { Command } from '../Command.js';

/**
 * @param editor Editor
 * @param object THREE.Object3D
 * @param command javascript object
 * @constructor
 */
class AddCommandCommand extends Command {

	constructor(editor, object, command) {
		super(editor);

		this.type = 'AddCommandCommand';
		this.name = 'Add Command';

		this.object = object;
		this.command = command;
	}

	execute() {
		if (this.object.commands === undefined) {
			this.object.commands = [];
		}

		this.object.commands.push(this.command);
		this.editor.signals.commandAdded.dispatch(this.command);
	}

	undo() {
		if (this.object.commands === undefined) return;

		const index = this.object.commands.indexOf(this.command);

		if (index !== -1) {
			this.object.commands.splice(index, 1);
		}

		this.editor.signals.commandRemoved.dispatch(this.command);
	}

	toJSON() {
		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.command = this.command;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.command = json.command;
		this.object = this.editor.objectByUuid(json.objectUuid);
	}
}

export { AddCommandCommand };
