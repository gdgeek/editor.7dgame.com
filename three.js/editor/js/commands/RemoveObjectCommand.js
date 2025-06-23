import { Command } from '../Command.js';

import { ObjectLoader } from 'three';

/**
 * @param editor Editor
 * @param object THREE.Object3D
 * @constructor
 */
class RemoveObjectCommand extends Command {

	constructor( editor, object ) {

		super( editor );

		this.type = 'RemoveObjectCommand';
		this.name = 'Remove Object';

		this.object = object;
		this.parent = ( object !== undefined ) ? object.parent : undefined;
		if ( this.parent !== undefined ) {

			this.index = this.parent.children.indexOf( this.object );

		}

		// 处理多选情况
		this.isInSelection = editor.getSelectedObjects().indexOf(object) !== -1;

	}

	execute() {

		this.editor.removeObject( this.object );
		this.editor.deselect();

	}

	undo() {

		this.parent.children.splice( this.index, 0, this.object );
		this.object.parent = this.parent;
		this.editor.signals.objectAdded.dispatch( this.object );

		// 如果之前是多选的一部分，恢复到选择中
		if (this.isInSelection) {
			this.editor.select(this.object, true);
		}

	}

	redo() {

		this.parent.remove( this.object );
		this.editor.signals.objectRemoved.dispatch( this.object );

	}

	toJSON() {

		const output = super.toJSON( this );

		output.object = this.object.toJSON();
		output.index = this.index;
		output.parentUuid = this.parent.uuid;

		return output;

	}

	fromJSON( json ) {

		super.fromJSON( json );

		this.parent = this.editor.objectByUuid( json.parentUuid );
		if ( this.parent === undefined ) {

			this.parent = this.editor.scene;

		}

		this.index = json.index;

		this.object = this.editor.objectByUuid( json.object.object.uuid );

		if ( this.object === undefined ) {

			const loader = new ObjectLoader();
			this.object = loader.parse( json.object );

		}

	}

}

export { RemoveObjectCommand };
