import { Command } from '../Command.js';

/**
 * @param editor Editor
 * @param object THREE.Object3D
 * @param command Command
 * @param attributeName string
 * @param newValue number, string, boolean or object
 * @constructor
 */
class SetCommandValueCommand extends Command {

	constructor(editor, object, command, attributeName, newValue) {
		super(editor);

		this.type = 'SetCommandValueCommand';
		this.name = `Set ${attributeName}`;

		this.object = object;
		this.command = command;
		this.attributeName = attributeName;
		this.oldValue = (command !== undefined) ? command[attributeName] : undefined;
		this.newValue = newValue;
	}

	execute() {
		this.command[this.attributeName] = this.newValue;
		this.editor.signals.commandChanged.dispatch(this.command);
	}

	undo() {
		this.command[this.attributeName] = this.oldValue;
		this.editor.signals.commandChanged.dispatch(this.command);
	}

	toJSON() {
		const output = super.toJSON(this);

		output.objectUuid = this.object.uuid;
		output.command = this.command;
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.object = this.editor.objectByUuid(json.objectUuid);
		this.command = json.command;
	}
}

export { SetCommandValueCommand };
