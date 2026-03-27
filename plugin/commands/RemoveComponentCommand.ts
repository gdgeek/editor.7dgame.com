import { Command } from '../../three.js/editor/js/Command.js';
import type { MrppEditor, MrppComponent, MrppObject3D } from '../types/mrpp.js';

class RemoveComponentCommand extends Command {

	declare object: MrppObject3D;
	component: MrppComponent;
	index: number;

	constructor(editor: MrppEditor, object: MrppObject3D, component: MrppComponent) {

		super(editor);

		this.type = 'RemoveComponentCommand';
		this.name = 'Remove Component';

		this.object = object;
		this.component = component;
		if (this.object && this.component) {
			this.index = this.object.components.indexOf(this.component);
		} else {
			this.index = -1;
		}

	}

	execute(): void {

		if (this.object.components === undefined) return;

		if (this.index !== - 1) {

			this.object.components.splice(this.index, 1);

		}

		this.editor.signals.componentRemoved.dispatch(this.component);

	}

	undo(): void {

		if (this.object.components === undefined) {
			this.object.components = [];
		}

		this.object.components.splice(this.index, 0, this.component);

		this.editor.signals.componentAdded.dispatch(this.component);

	}

	toJSON(): any {

		const output: any = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.component = this.component;
		output.index = this.index;

		return output;

	}

	fromJSON(json: any): void {

		super.fromJSON(json);

		this.component = json.component;
		this.index = json.index;
		this.object = this.editor.objectByUuid(json.objectUuid);

	}

}

export { RemoveComponentCommand };
