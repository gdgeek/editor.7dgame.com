import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppComponent, MrppObject3D } from '../types/mrpp.js';

class SetComponentValueCommand extends Command {

	declare object: MrppObject3D;
	component: MrppComponent;
	attributeName: string;
	oldValue: any;
	newValue: any;

	constructor(editor: MrppEditor, object: MrppObject3D, component: MrppComponent, attributeName: string, newValue: any) {

		super(editor);

		this.type = 'SetComponentValueCommand';
		this.name = `Set Component.${attributeName}`;
		this.updatable = true;

		this.object = object;
		this.component = component;

		this.attributeName = attributeName;
		this.oldValue = (component !== undefined) ? (component as any)[this.attributeName] : undefined;
		this.newValue = newValue;

	}

	execute(): void {

		(this.component as any)[this.attributeName] = this.newValue;

		this.editor.signals.componentChanged.dispatch(this.component);

	}

	undo(): void {

		(this.component as any)[this.attributeName] = this.oldValue;

		this.editor.signals.componentChanged.dispatch(this.component);

	}

	update(cmd: SetComponentValueCommand): void {

		this.newValue = cmd.newValue;

	}

	toJSON(): any {

		const output: any = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.index = this.object.components.indexOf(this.component);
		output.attributeName = this.attributeName;
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;

	}

	fromJSON(json: any): void {

		super.fromJSON(json);

		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.attributeName = json.attributeName;
		this.object = this.editor.objectByUuid(json.objectUuid);
		this.component = (this.object as MrppObject3D).components[json.index];

	}

}

export { SetComponentValueCommand };
