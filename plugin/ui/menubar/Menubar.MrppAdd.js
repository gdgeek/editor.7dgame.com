import { UIRow, UIHorizontalRule } from '../../../three.js/editor/js/libs/ui.js';

import { AddObjectCommand } from '../../../three.js/editor/js/commands/AddObjectCommand.js';
import { MetaFactory } from '../../mrpp/MetaFactory.js';
import { Builder } from '../../mrpp/Builder.js';

/**
 * Injects MRPP-specific menu items into the Add menu.
 *
 * - Meta mode: entity / text / resource-type menu items,
 *   loadResource / loadPhototype / messageReceive handling
 * - Verse mode: meta menu item, add-module message handling
 * - Manages window.resources global resource mapping
 *
 * @param {object} editor  – the Editor instance (already patched)
 * @param {object} addMenuOptions – the UIPanel `options` container of the Add menu
 */
function injectMrppAddMenu( editor, addMenuOptions ) {

	const factory = new MetaFactory( editor );
	const builder = new Builder();
	const strings = editor.strings;

	// Expose resources globally so other modules can access them
	const resources = new Map();
	window.resources = resources;

	// Map of resource-type → UIRow for visibility toggling
	const resourceMenuItems = new Map();

	if ( editor.type.toLowerCase() === 'meta' ) {

		_injectMetaMode( editor, addMenuOptions, factory, builder, strings, resources, resourceMenuItems );

	} else if ( editor.type.toLowerCase() === 'verse' ) {

		_injectVerseMode( editor, addMenuOptions, factory, builder, strings, resources );

	}

}

// ── Meta mode ────────────────────────────────────────────────────────

function _injectMetaMode( editor, options, factory, builder, strings, resources, resourceMenuItems ) {

	// --- helpers ---

	const updateResourceMenuItems = function ( availableTypes ) {

		if ( ! availableTypes || ! Array.isArray( availableTypes ) ) return;

		// Hide all resource menu items first
		resourceMenuItems.forEach( ( menuItem ) => {

			menuItem.dom.style.display = 'none';

		} );

		// Show available ones
		availableTypes.forEach( type => {

			const menuItem = resourceMenuItems.get( type );
			if ( menuItem ) {

				menuItem.dom.style.display = 'block';

			}

		} );

	};

	const loadResource = async function ( data ) {

		// Save resource to local and global collections
		resources.set( data.id.toString(), data );

		if ( ! editor.data.resources ) editor.data.resources = [];

		// Update or add resource
		const existingIndex = editor.data.resources.findIndex( resource =>
			resource && resource.id == data.id
		);

		if ( existingIndex >= 0 ) {

			editor.data.resources[ existingIndex ] = data;

		} else {

			editor.data.resources.push( data );

		}

		// Create object from resource
		const raw = builder.resource( data );
		if ( raw ) {

			const node = await factory.building( raw, resources );
			if ( node ) {

				editor.execute( new AddObjectCommand( editor, node ) );

			}

		}

	};

	const loadResourceBatch = async function ( items ) {

		if ( ! Array.isArray( items ) || items.length === 0 ) return;

		for ( const item of items ) {

			if ( ! item ) continue;
			await loadResource( item );

		}

	};

	const loadPhototype = async function ( data ) {

		const node = await factory.building( builder.phototype( data ), resources );
		editor.execute( new AddObjectCommand( editor, node ) );
		console.log( '加载phototype:', data );

	};

	// --- signal handler ---

	editor.signals.messageReceive.add( async function ( params ) {

		switch ( params.action ) {

			case 'load-resource':
				if ( Array.isArray( params.data ) ) {

					await loadResourceBatch( params.data );

				} else if ( params.data && Array.isArray( params.data.resources ) ) {

					await loadResourceBatch( params.data.resources );

				} else if ( params.data ) {

					await loadResource( params.data );

				}

				break;

			case 'load-resources':
				if ( params.data && Array.isArray( params.data.resources ) ) {

					await loadResourceBatch( params.data.resources );

				} else if ( Array.isArray( params.data ) ) {

					await loadResourceBatch( params.data );

				}

				break;

			case 'available-resource-types':
				updateResourceMenuItems( params.data );
				break;

			case 'load-phototype':
				loadPhototype( params.data );
				break;

		}

	} );

	// --- menu items ---

	// Entity (Point)
	let option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/point' ) );
	option.onClick( async function () {

		const node = await factory.building( builder.entity(), resources );
		editor.execute( new AddObjectCommand( editor, node ) );

	} );
	options.add( option );

	// Text
	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/text' ) );
	option.onClick( async function () {

		const node = await factory.building( builder.text(), resources );
		editor.execute( new AddObjectCommand( editor, node ) );

	} );
	options.add( option );

	// Resource-type menu items (hidden by default, shown via available-resource-types)
	const createResourceMenuItem = function ( resourceType ) {

		const menuItem = new UIRow();
		menuItem.setClass( 'option' );
		menuItem.setTextContent( strings.getKey( 'menubar/add/' + resourceType ) );
		menuItem.onClick( async function () {

			editor.signals.messageSend.dispatch( {
				action: 'load-resource',
				data: { type: resourceType }
			} );

		} );
		resourceMenuItems.set( resourceType, menuItem );
		return menuItem;

	};

	const allPossibleResourceTypes = [ '-', 'voxel', 'polygen', 'picture', 'video', 'audio', 'particle', '-', 'phototype' ];
	allPossibleResourceTypes.forEach( type => {

		if ( type === '-' ) {

			options.add( new UIHorizontalRule() );
			return;

		}

		const menuItem = createResourceMenuItem( type );
		menuItem.dom.style.display = 'none'; // hidden by default
		options.add( menuItem );

	} );

	// Request available resource types
	editor.signals.messageSend.dispatch( {
		action: 'get-available-resource-types'
	} );

	// If editor already has available resource types, update immediately
	if ( editor.availableResourceTypes ) {

		updateResourceMenuItems( editor.availableResourceTypes );

	}

}

// ── Verse mode ───────────────────────────────────────────────────────

function _injectVerseMode( editor, options, factory, builder, strings, resources ) {

	// Signal handler for add-module
	editor.signals.messageReceive.add( async function ( params ) {

		if ( params.action === 'add-module' ) {

			const data = params.data.data;
			const setup = params.data.setup;
			const title = params.data.title;

			if ( data.resources ) {

				data.resources.forEach( resource => {

					resources.set( resource.id.toString(), resource );

				} );

			}

			const node = factory.addModule( builder.module( data.id, title ) );

			node.userData.data = JSON.stringify( setup );
			node.userData.custom = data.custom;

			if ( data && data.data ) {

				await factory.readMeta( node, data.data, resources, editor );

			}

			await factory.addGizmo( node );
			editor.execute( new AddObjectCommand( editor, node ) );

		}

	} );

	// Meta menu item (adds a meta scene to the verse)
	const option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/meta' ) );
	option.onClick( async function () {

		editor.signals.messageSend.dispatch( {
			action: 'add-meta'
		} );

	} );
	options.add( option );

}

export { injectMrppAddMenu };
