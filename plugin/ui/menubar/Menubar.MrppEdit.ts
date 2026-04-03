import * as THREE from 'three';
import * as SkeletonUtils from '../../../three.js/examples/jsm/utils/SkeletonUtils.js';

import { UIRow, UIHorizontalRule } from '../../../three.js/editor/js/libs/ui.js';

import { AddObjectCommand } from '../../../three.js/editor/js/commands/AddObjectCommand.js';
import { RemoveObjectCommand } from '../../../three.js/editor/js/commands/RemoveObjectCommand.js';
import { MultiCmdsCommand } from '../../../three.js/editor/js/commands/MultiCmdsCommand.js';
import { MetaFactory } from '../../mrpp/MetaFactory.js';
import { Builder } from '../../mrpp/Builder.js';

// ── helpers ──────────────────────────────────────────────────────────

function hasSkinnedMesh( object: any ): boolean {

	let found = false;
	object.traverse( ( child: any ) => {

		if ( child.isSkinnedMesh ) {

			found = true;

		}

	} );
	return found;

}

function cloneObject( source: any ): any {

	if ( hasSkinnedMesh( source ) ) {

		return SkeletonUtils.clone( source );

	}

	return source.clone();

}

function copyComponentsWithNewUUIDs( source: any, target: any ): void {

	if ( source.components ) {

		target.components = JSON.parse( JSON.stringify( source.components ) );
		target.components.forEach( (component: any) => {

			if ( component.parameters && component.parameters.uuid ) {

				component.parameters.uuid = THREE.MathUtils.generateUUID();

			}

			if ( component.parameters && component.parameters.options ) {

				Object.keys( component.parameters.options ).forEach( key => {

					const newUuid = THREE.MathUtils.generateUUID();
					component.parameters.options[ newUuid ] = component.parameters.options[ key ];
					delete component.parameters.options[ key ];

				} );

			}

		} );

	}

	if ( source.commands ) {

		target.commands = JSON.parse( JSON.stringify( source.commands ) );
		target.commands.forEach( (command: any) => {

			if ( command.parameters && command.parameters.uuid ) {

				command.parameters.uuid = THREE.MathUtils.generateUUID();

			}

			if ( command.parameters && command.parameters.options ) {

				Object.keys( command.parameters.options ).forEach( key => {

					const newUuid = THREE.MathUtils.generateUUID();
					command.parameters.options[ newUuid ] = command.parameters.options[ key ];
					delete command.parameters.options[ key ];

				} );

			}

		} );

	}

}

function copyHierarchyDataWithNewUUIDs( source: any, target: any ): void {

	if ( ! source || ! target ) return;

	if ( source.type ) {

		target.type = source.type;

	}

	if ( source.animations && source.animations.length > 0 ) {

		target.animations = source.animations.map( ( clip: any ) => clip.clone() );

	}

	copyComponentsWithNewUUIDs( source, target );

	const sourceChildren = Array.isArray( source.children ) ? source.children : [];
	const targetChildren = Array.isArray( target.children ) ? target.children : [];
	const childCount = Math.min( sourceChildren.length, targetChildren.length );

	for ( let i = 0; i < childCount; i ++ ) {

		copyHierarchyDataWithNewUUIDs( sourceChildren[ i ], targetChildren[ i ] );

	}

}

function detectReplaceableType( object: any ): string {

	if ( ! object ) return '';

	const typeChecks = [
		{ type: 'polygen', tag: '[polygen]' },
		{ type: 'voxel', tag: '[voxel]' },
		{ type: 'picture', tag: '[picture]' },
		{ type: 'sound', tag: '[sound]', mapped: 'audio' },
		{ type: 'video', tag: '[video]' }
	];

	for ( const check of typeChecks ) {

		const udType = object.userData && object.userData.type &&
			object.userData.type.toLowerCase && object.userData.type.toLowerCase();
		const nameMatch = object.name && object.name.toLowerCase().includes( check.tag );

		if ( udType === check.type || nameMatch ) {

			return check.mapped || check.type;

		}

	}

	return '';

}

// ── main injection ───────────────────────────────────────────────────

function injectMrppEditMenu( editor: any, editMenuOptions: any ): void {

	const strings = editor.strings;
	const factory = new MetaFactory( editor );
	const builder = new Builder();

	// Share the global resources map (created by MrppAdd or here)
	const resources = window.resources || new Map();
	if ( ! window.resources ) {

		window.resources = resources;

	}

	// Track the replaceable type of the currently selected object
	let selectedObjectType = '';

	// Cache selected objects for keyboard shortcut handlers
	let cachedSelectedObjects: any[] = [];

	// Clipboard for copy / paste
	let copiedObjects: any[] = [];
	let contextMenuVisible = false;

	// ── divider (shown only when an object is selected) ──

	const selectionDivider = new UIHorizontalRule();
	selectionDivider.dom.style.display = 'none';
	editMenuOptions.add( selectionDivider );

	// ── Clone ────────────────────────────────────────────

	function cloneSelected() {

		const selectedObjects = editor.getSelectedObjects();
		if ( selectedObjects.length === 0 ) return;

		const clonedObjects: any[] = [];

		for ( let i = 0; i < selectedObjects.length; i ++ ) {

			let object = selectedObjects[ i ];
			if ( object === null || object.parent === null ) continue;

			const original = object;
			object = cloneObject( original );

			copyHierarchyDataWithNewUUIDs( original, object );

			const parent = original.parent;
			const cmd = new AddObjectCommand( editor, object );

			cmd.execute = function () {

				const insertIndex = parent ? parent.children.indexOf( original ) + 1 : undefined;
				editor.addObject( object, parent, insertIndex );
				clonedObjects.push( object );

				if ( clonedObjects.length === selectedObjects.length ) {

					if ( clonedObjects.length > 1 ) {

						editor.clearSelection();
						editor.select( clonedObjects[ 0 ] );

						for ( let j = 1; j < clonedObjects.length; j ++ ) {

							editor.select( clonedObjects[ j ], true );

						}

					} else {

						editor.select( clonedObjects[ 0 ] );

					}

				}

			};

			editor.execute( cmd );

		}

	}

	function deleteSelectedAsBatch() {

		const selectedObjects = editor.getSelectedObjects().filter( function ( object: any ) {

			return object !== null && object.parent !== null;

		} );

		if ( selectedObjects.length === 0 ) return;

		if ( selectedObjects.length === 1 ) {

			editor.execute( new RemoveObjectCommand( editor, selectedObjects[ 0 ] ) );
			return;

		}

		const commands = [];

		for ( let i = selectedObjects.length - 1; i >= 0; i -- ) {

			commands.push( new RemoveObjectCommand( editor, selectedObjects[ i ] ) );

		}

		editor.execute( new MultiCmdsCommand( editor, commands ) );

	}

	const cloneOption = new UIRow();
	cloneOption.setClass( 'option' );
	cloneOption.setTextContent( strings.getKey( 'menubar/edit/clone' ) );
	cloneOption.onClick( function () {

		cloneSelected();

	} );
	cloneOption.dom.style.display = 'none';
	editMenuOptions.add( cloneOption );

	// ── Replace (resource replacement) ──────────────────

	editor.signals.messageReceive.add( async function ( params: any ) {

		if ( params.action !== 'replace-resource' ) return;

		const data = params.data;

		// Save resource locally and globally
		resources.set( data.id.toString(), data );

		if ( ! editor.data.resources ) editor.data.resources = [];

		const existingIndex = editor.data.resources.findIndex( (resource: any) =>
			resource && resource.id == data.id
		);

		if ( existingIndex >= 0 ) {

			editor.data.resources[ existingIndex ] = data;

		} else {

			editor.data.resources.push( data );

		}

		// Build the replacement object
		const raw = builder.resource( data );
		if ( ! raw ) return;

		const node = await factory.building( raw, resources );
		if ( ! node ) return;

		const selected = editor.selected;
		if ( ! selected ) return;

		// Preserve old object properties
		const position = selected.position.clone();
		const rotation = selected.rotation.clone();
		const scale = selected.scale.clone();
		const parent = selected.parent;
		const index = parent ? parent.children.indexOf( selected ) : undefined;
		const uuid = selected.uuid;
		const name = selected.name;
		const visible = selected.visible;

		// Conditionally preserve type-specific userData
		let sortingOrder;
		let loop;

		const selType = selectedObjectType ||
			( selected.userData && selected.userData.type
				? selected.userData.type.toLowerCase()
				: '' );

		if ( selType === 'picture' ) {

			sortingOrder = selected.userData && typeof selected.userData.sortingOrder !== 'undefined'
				? selected.userData.sortingOrder : undefined;

		}

		if ( selType === 'audio' || selType === 'video' ) {

			loop = selected.userData && typeof selected.userData.loop !== 'undefined'
				? selected.userData.loop : undefined;

		}

		const components = selected.components ? [ ...selected.components ] : [];
		const commands = selected.commands ? [ ...selected.commands ] : [];

		// Keep non-hidden children
		const childrenToKeep: any[] = [];
		selected.children.forEach( (child: any) => {

			if ( ! child.userData || child.userData.hidden !== true ) {

				childrenToKeep.push( child );

			}

		} );

		// Remove old object
		editor.execute( new RemoveObjectCommand( editor, selected ) );

		// Apply old properties to new object
		(node as any).position.copy( position );
		(node as any).rotation.copy( rotation );
		(node as any).scale.copy( scale );
		(node as any).uuid = uuid;
		node.name = name;
		node.visible = visible;

		if ( ! node.userData ) node.userData = {};
		if ( typeof sortingOrder !== 'undefined' ) (node.userData as any).sortingOrder = sortingOrder;
		if ( typeof loop !== 'undefined' ) (node.userData as any).loop = loop;

		(node as any).components = components;
		(node as any).commands = commands;

		childrenToKeep.forEach( child => {

			node.add( child );

		} );

		const cmd = new AddObjectCommand( editor, node );
		cmd.execute = function () {

			editor.addObject( node, parent, index );
			editor.select( node );

		};

		editor.execute( cmd );
		editor.showNotification( strings.getKey( 'menubar/replace/success' ), false );

	} );

	const replaceOption = new UIRow();
	replaceOption.setClass( 'option' );
	replaceOption.setTextContent( strings.getKey( 'menubar/replace' ) );
	replaceOption.onClick( function () {

		const selected = editor.selected;
		if ( selected && selectedObjectType ) {

			editor.signals.messageSend.dispatch( {
				action: 'replace-resource',
				data: {
					type: selectedObjectType,
					target: selected.uuid
				}
			} );

		}

	} );
	replaceOption.dom.style.display = 'none';
	editMenuOptions.add( replaceOption );

	// ── Delete ───────────────────────────────────────────

	const deleteOption = new UIRow();
	deleteOption.setClass( 'option' );
	deleteOption.setTextContent( strings.getKey( 'menubar/edit/delete' ) );
	deleteOption.onClick( function () {

		deleteSelectedAsBatch();

	} );
	deleteOption.dom.style.display = 'none';
	editMenuOptions.add( deleteOption );

	// ── Context menu (copy / replace / delete) ──────────

	const contextMenu = document.createElement( 'div' );
	contextMenu.style.position = 'fixed';
	contextMenu.style.display = 'none';
	contextMenu.style.minWidth = '118px';
	contextMenu.style.padding = '8px 0';
	contextMenu.style.background = '#fff';
	contextMenu.style.border = '1px solid rgba(0, 0, 0, 0.08)';
	contextMenu.style.borderRadius = '8px';
	contextMenu.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.16)';
	contextMenu.style.zIndex = '9999';
	contextMenu.style.userSelect = 'none';

	function hideContextMenu(): void {

		contextMenu.style.display = 'none';
		contextMenuVisible = false;

	}

	function createContextMenuItem( label: string, onClick: () => void ): HTMLDivElement {

		const item = document.createElement( 'div' );
		item.textContent = label;
		item.style.padding = '8px 16px';
		item.style.fontSize = '14px';
		item.style.lineHeight = '20px';
		item.style.color = '#444';
		item.style.cursor = 'pointer';

		item.addEventListener( 'mouseenter', function () {

			item.style.background = '#f5f5f5';

		} );

		item.addEventListener( 'mouseleave', function () {

			item.style.background = 'transparent';

		} );

		item.addEventListener( 'click', function ( event ) {

			event.preventDefault();
			event.stopPropagation();
			hideContextMenu();
			onClick();

		} );

		return item;

	}

	const contextCopyItem = createContextMenuItem( strings.getKey( 'menubar/edit/clone' ), function () {

		cloneSelected();

	} );

	const contextReplaceItem = createContextMenuItem( strings.getKey( 'menubar/replace' ), function () {

		replaceOption.dom.click();

	} );

	const contextDeleteItem = createContextMenuItem( strings.getKey( 'menubar/edit/delete' ), function () {

		deleteOption.dom.click();

	} );

	contextMenu.appendChild( contextCopyItem );
	contextMenu.appendChild( contextReplaceItem );
	contextMenu.appendChild( contextDeleteItem );
	document.body.appendChild( contextMenu );

	function updateContextMenuItems(): void {

		const hasSelection = cachedSelectedObjects.length > 0;
		contextCopyItem.style.display = hasSelection ? '' : 'none';
		contextDeleteItem.style.display = hasSelection ? '' : 'none';
		contextReplaceItem.style.display = hasSelection && selectedObjectType ? '' : 'none';

	}

	function showContextMenu( x: number, y: number ): void {

		updateContextMenuItems();

		if ( cachedSelectedObjects.length === 0 ) return;

		contextMenu.style.display = 'block';
		contextMenu.style.left = '0px';
		contextMenu.style.top = '0px';

		const { innerWidth, innerHeight } = window;
		const rect = contextMenu.getBoundingClientRect();
		const left = Math.min( x, Math.max( 8, innerWidth - rect.width - 8 ) );
		const top = Math.min( y, Math.max( 8, innerHeight - rect.height - 8 ) );

		contextMenu.style.left = `${ left }px`;
		contextMenu.style.top = `${ top }px`;
		contextMenuVisible = true;

	}

	function isContextMenuTarget( target: EventTarget | null ): boolean {

		if ( ! ( target instanceof Element ) ) return false;
		if ( target.closest( 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .CodeMirror' ) ) return false;

		return !! target.closest( '#viewport, #sidebar, #resizer' );

	}

	document.addEventListener( 'contextmenu', function ( event ) {

		cachedSelectedObjects = editor.getSelectedObjects();

		if ( cachedSelectedObjects.length === 0 ) {

			hideContextMenu();
			return;

		}

		if ( isContextMenuTarget( event.target ) === false ) return;

		event.preventDefault();
		event.stopPropagation();

		showContextMenu( event.clientX, event.clientY );

	}, true );

	document.addEventListener( 'pointerdown', function ( event ) {

		if ( contextMenuVisible === false ) return;
		if ( event.target instanceof Element && contextMenu.contains( event.target ) ) return;
		hideContextMenu();

	}, true );

	document.addEventListener( 'scroll', function () {

		if ( contextMenuVisible ) hideContextMenu();

	}, true );

	document.addEventListener( 'keydown', function ( event ) {

		if ( event.key === 'Escape' && contextMenuVisible ) {

			hideContextMenu();

		}

	}, true );

	// ── Selection state → show / hide menu items ─────────

	editor.signals.objectSelected.add( function ( object: any ) {

		selectedObjectType = '';
		cachedSelectedObjects = editor.getSelectedObjects();

		if ( ! object ) {

			selectionDivider.dom.style.display = 'none';
			cloneOption.dom.style.display = 'none';
			deleteOption.dom.style.display = 'none';
			replaceOption.dom.style.display = 'none';
			hideContextMenu();
			return;

		}

		selectionDivider.dom.style.display = '';
		cloneOption.dom.style.display = '';
		deleteOption.dom.style.display = '';

		selectedObjectType = detectReplaceableType( object );
		replaceOption.dom.style.display = selectedObjectType ? '' : 'none';
		updateContextMenuItems();

	} );

	// ── Copy / Paste helpers ─────────────────────────────

	function copySelected() {

		const selectedObjects = editor.getSelectedObjects();
		if ( selectedObjects.length === 0 ) return;

		copiedObjects = [];

		for ( let i = 0; i < selectedObjects.length; i ++ ) {

			const object = selectedObjects[ i ];
			if ( object !== null && object.parent !== null ) {

				copiedObjects.push( object );

			}

		}

	}

	function pasteSelected() {

		if ( copiedObjects.length === 0 ) return;

		const newObjects = [];

		for ( let i = 0; i < copiedObjects.length; i ++ ) {

			const copiedObject = copiedObjects[ i ];
			const object = cloneObject( copiedObject );

			copyHierarchyDataWithNewUUIDs( copiedObject, object );

			editor.execute( new AddObjectCommand( editor, object ) );
			newObjects.push( object );

		}

		if ( newObjects.length > 1 ) {

			editor.clearSelection();
			editor.select( newObjects[ 0 ] );

			for ( let i = 1; i < newObjects.length; i ++ ) {

				editor.select( newObjects[ i ], true );

			}

		}

	}

	// ── Keyboard shortcuts (capture phase) ───────────────

	document.addEventListener( 'keydown', function ( event ) {

		const activeElement = document.activeElement;
		const isInputActive = activeElement && (
			activeElement.tagName === 'INPUT' ||
			activeElement.tagName === 'TEXTAREA' ||
			(activeElement as any).isContentEditable
		);

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;

		if ( isCtrlOrCmd ) {

			switch ( event.key.toLowerCase() ) {

				case 'c':
					if ( ! isInputActive ) {

						event.preventDefault();
						copySelected();

					}

					break;

				case 'v':
					if ( ! isInputActive ) {

						event.preventDefault();
						pasteSelected();

					}

					break;

			}

		}

		// Del / Backspace – multi-select delete
		if ( ( event.key === 'Delete' || event.key === 'Backspace' ) && ! isInputActive ) {

			event.preventDefault();
			event.stopPropagation();

			deleteSelectedAsBatch();

		}

	}, true ); // capture phase

}

export { injectMrppEditMenu };
