import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppCommand, MrppObject3D } from '../types/mrpp.js';

class SetCommandValueCommand extends Command {

	declare object: MrppObject3D;
	command: MrppCommand;
	attributeName: string;
	oldValue: any;
	newValue: any;

	constructor(editor: MrppEditor, object: MrppObject3D, command: MrppCommand, attributeName: string, newValue: any) {
		super(editor);

		this.type = 'SetCommandValueCommand';
		this.name = `Set ${attributeName}`;

		this.object = object;
		this.command = command;
		this.attributeName = attributeName;
		this.oldValue = (command !== undefined) ? (command as any)[attributeName] : undefined;
		this.newValue = newValue;
	}

	execute(): void {
		(this.command as any)[this.attributeName] = this.newValue;
		this.editor.signals.commandChanged.dispatch(this.command);
	}

	undo(): void {
		(this.command as any)[this.attributeName] = this.oldValue;
		this.editor.signals.commandChanged.dispatch(this.command);
	}

	toJSON(): any {
		const output: any = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.command = this.command;
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;
	}

	fromJSON(json: any): void {
		super.fromJSON(json);

		this.attributeName = json.attributeName;
		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.object = this.editor.objectByUuid(json.objectUuid);
		this.command = json.command;
	}
}

export { SetCommandValueCommand };
