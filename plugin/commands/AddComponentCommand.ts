import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppComponent, MrppObject3D } from '../types/mrpp.js';

class AddComponentCommand extends Command {

	declare object: MrppObject3D;
	component: MrppComponent;

	constructor(editor: MrppEditor, object: MrppObject3D, component: MrppComponent) {

		super(editor);

		this.type = 'AddComponentCommand';
		this.name = 'Add Component';

		this.object = object;
		this.component = component;

	}

	execute(): void {

		if (this.object.components === undefined) {
			this.object.components = [];
		}

		this.object.components.push(this.component);

		this.editor.signals.componentAdded.dispatch(this.component);

	}

	undo(): void {

		if ((this.object as any).components[this.object.uuid] === undefined) return;

		const index = this.object.components.indexOf(this.component);

		if (index !== - 1) {

			this.object.components.splice(index, 1);

		}

		this.editor.signals.componentRemoved.dispatch(this.component);

	}

	toJSON(): any {

		const output: any = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.component = this.component;

		return output;

	}

	fromJSON(json: any): void {

		super.fromJSON(json);

		this.component = json.component;
		this.object = this.editor.objectByUuid(json.objectUuid);

	}

}

export { AddComponentCommand };
