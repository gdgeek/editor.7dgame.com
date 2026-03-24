import * as THREE from 'three';

import { UIPanel, UIRow, UIHorizontalRule } from '../../../three.js/editor/js/libs/ui.js';

import { AddObjectCommand } from '../../../three.js/editor/js/commands/AddObjectCommand.js';
import { MetaFactory } from '../../mrpp/MetaFactory.js';
import { Builder } from '../../mrpp/Builder.js';

function disableElement(element) {
	/*
	element.classList.add('disabled');
	element.style.pointerEvents = 'none';
	element.style.opacity = '0.5';*/
}

function enableElement(element) {
	element.classList.remove('disabled');
	element.style.pointerEvents = 'auto';
	element.style.opacity = '1';
}

function MenubarGoto( editor ) {

	const factory = new MetaFactory(editor);
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

	const scriptOption = new UIRow();
	scriptOption.setClass( 'option' );
	scriptOption.setTextContent( strings.getKey( 'menubar/code/script' ) );

	disableElement( scriptOption.dom );

	scriptOption.onClick( async function () {

		if (editor.metaLoader && editor.metaLoader.getLoadingStatus()) {
			console.warn('Cannot go to script editor while models are still loading');
			return;
		}

		// Script navigation reuses the parent-level global leave guard.
		editor.signals.messageSend.dispatch({
			action: 'goto',
			data: { target: 'blockly.js' }
		});

	} );

	options.add( scriptOption );

	editor.signals.savingStarted.add(function () {
		disableElement( scriptOption.dom );
	});

	editor.signals.savingFinished.add(function () {
		enableElement( scriptOption.dom );
	});

	return container;

}

export { MenubarGoto };
