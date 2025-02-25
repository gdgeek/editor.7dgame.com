import { Command } from '../Command.js';

/**
 * @param editor Editor
 * @param object THREE.Object3D
 * @param command javascript object
 * @constructor
 */
class RemoveCommandCommand extends Command {

	constructor(editor, object, command) {
		super(editor);

		this.type = 'RemoveCommandCommand';
		this.name = 'Remove Command';

		this.object = object;
		this.command = command;
		this.index = -1;
	}

	execute() {
		if (this.object.commands === undefined) return;

		const index = this.object.commands.indexOf(this.command);

		if (index !== -1) {
			this.index = index;
			this.object.commands.splice(index, 1);
			this.editor.signals.commandRemoved.dispatch(this.command);
		}
	}

	undo() {
		if (this.index !== -1) {
			this.object.commands.splice(this.index, 0, this.command);
			this.editor.signals.commandAdded.dispatch(this.command);
		}
	}

	toJSON() {
		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.command = this.command;
		output.index = this.index;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.command = json.command;
		this.index = json.index;
		this.object = this.editor.objectByUuid(json.objectUuid);
	}
}

export { RemoveCommandCommand };
