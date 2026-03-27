import { UIPanel, UIBreak, UIText, UIButton, UIRow, UISelect, UIInput, UIHorizontalRule } from '../../../three.js/editor/js/libs/ui.js';


import { AddComponentCommand } from '../../commands/AddComponentCommand.js';
import { AddScriptCommand } from '../../../three.js/editor/js/commands/AddScriptCommand.js';
import { SetScriptValueCommand } from '../../../three.js/editor/js/commands/SetScriptValueCommand.js';
import { RemoveScriptCommand } from '../../../three.js/editor/js/commands/RemoveScriptCommand.js';
import { ComponentContainer } from '../../mrpp/ComponentContainer.js';
import type { MrppEditor } from '../../types/mrpp.js';

function SidebarMeta( editor: MrppEditor ): InstanceType<typeof UIPanel> {

	const strings = editor.strings;

	const signals = editor.signals;

	editor.signals.messageReceive.add( async function ( message: any ) {

		if ( message.action == 'setup-module' ) {

			const data = message.data;
			const node = (editor as any).objectByUuid( data.uuid );

			if ( node != null ) {

				node.userData.data = JSON.stringify( data.setup );
				signals.objectChanged.dispatch( node );

			}

		}

	} );



	const container = new UIPanel();
	container.setDisplay( 'none' );




	const top = new UIRow();
	container.add( top );


	function update(): void {

		top.clear();
		top.setDisplay( 'none' );
		const object = editor.selected;

		if ( object === null ) {

			return;

		}

		top.setDisplay( 'block' );


		if ( (object as any).userData.custom != 0 ) {

			top.add( new UIText( strings.getKey( 'sidebar/entity' ).toUpperCase() ) );
			top.add( new UIBreak() );

			top.add( new UIBreak() );
			const newComponent = new UIButton( strings.getKey( 'sidebar/entity/button' ) );
			newComponent.onClick( function () {

				editor.signals.messageSend.dispatch( {
					action: 'edit-meta',
					data: { meta_id: (object as any).userData.meta_id }
				} );

			} );
			top.add( newComponent );

		} else {

			top.add( new UIText( 'Meta(prefab)' ).setTextTransform( 'uppercase' ) );
			top.add( new UIBreak() );

			top.add( new UIBreak() );
			const newComponent = new UIButton( 'setup' );
			newComponent.onClick( function () {

				editor.signals.messageSend.dispatch(
					{
						action: 'setup-prefab',
						data: {
							meta_id: (object as any).userData.meta_id,
							uuid: object.uuid,
							data: (object as any).userData.data
						}
					} );

			} );
			top.add( newComponent );

		}

	}

	// signals

	signals.objectSelected.add( function ( object: any ) {

		if ( object !== null && editor.camera !== object ) {

			container.setDisplay( 'block' );

			update();

		} else {

			container.setDisplay( 'none' );

		}

	} );


	return container;

}

export { SidebarMeta };
