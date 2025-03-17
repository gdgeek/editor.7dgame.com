import * as THREE from 'three';

import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';

import { AddObjectCommand } from './commands/AddObjectCommand.js';
import { MetaFactory } from './mrpp/MetaFactory.js';
import { Builder } from './mrpp/Builder.js';
import { DialogUtils } from './utils/DialogUtils.js';

function MenubarGoto( editor ) {


	const factory = new MetaFactory();
	const builder = new Builder();
	const strings = editor.strings;

	const resources = new Map();
	const container = new UIPanel();
	editor.signals.messageReceive.add( async function ( params ) {

		if ( params.action === 'resource' ) {
			resources.set( params.data.id.toString(), params.data );
			const data = builder.resource( params.data );
			if ( data != null ) {

				const node = await factory.building( data, resources );
				if ( node != null ) {
					editor.execute( new AddObjectCommand( editor, node ) );
				}

			}

		}

	} );
	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/code' ) );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	// Blockly

	const option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/code/script' ) );
	option.onClick( async function (event) {

		const changed = (editor.verseLoader && await editor.verseLoader.changed()) || (editor.metaLoader && await editor.metaLoader.changed());


		if(changed){
			// const userConfirmed = confirm('确认再没保存的情况下进行离开编辑器?');
            // if (!userConfirmed) return;


			DialogUtils.showConfirm('场景发生了修改，确认在没保存的情况下进行离开编辑器?', function() {
				// 用户点击确认按钮
				const data = {
					action: 'goto',
					data: { 'target': 'blockly.js' }
				};
				editor.signals.messageSend.dispatch( data );
			}, null, event.parent);
			return;
		}

		const data = {
			action: 'goto',
			data: { 'target': 'blockly.js' }
		};
		editor.signals.messageSend.dispatch( data );

	} );
	options.add( option );
	return container;

}

export { MenubarGoto };
