import type { MrppEditor } from '../types/mrpp.js';

function initializeGlobalShortcuts( editor: MrppEditor ): void {

	function isEditableTarget( target: EventTarget | null ): boolean {

		if ( ! ( target instanceof Element ) ) return false;
		if ( target.closest( 'input, textarea, select, [contenteditable=""], [contenteditable="true"]' ) ) return true;

		return false;

	}

	function isSaveShortcut( event: KeyboardEvent ): boolean {

		if ( event.isComposing ) return false;

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;

		if ( isCtrlOrCmd === false ) return false;

		const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

		return key === 's' || event.keyCode === 83;

	}

	function isSelectAllShortcut( event: KeyboardEvent ): boolean {

		if ( event.isComposing ) return false;

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		if ( isCtrlOrCmd === false ) return false;

		const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

		return key === 'a' || event.keyCode === 65;

	}

	function handleSaveShortcut( event: KeyboardEvent ): false | void {

		if ( isSaveShortcut( event ) === false ) return;

		if ( typeof event.preventDefault === 'function' ) {

			event.preventDefault();

		}

		if ( typeof event.stopImmediatePropagation === 'function' ) {

			event.stopImmediatePropagation();

		}

		if ( typeof event.stopPropagation === 'function' ) {

			event.stopPropagation();

		}

		event.returnValue = false;

		editor.save();

		return false;

	}

	function handleSelectAllShortcut( event: KeyboardEvent ): false | void {

		if ( isSelectAllShortcut( event ) === false ) return;
		if ( isEditableTarget( event.target ) ) return;

		if ( typeof event.preventDefault === 'function' ) {

			event.preventDefault();

		}

		if ( typeof event.stopImmediatePropagation === 'function' ) {

			event.stopImmediatePropagation();

		}

		if ( typeof event.stopPropagation === 'function' ) {

			event.stopPropagation();

		}

		event.returnValue = false;

		const outlinerElement = document.getElementById( 'outliner' );
		const optionElements = outlinerElement ? Array.from( outlinerElement.querySelectorAll( '.option' ) ) as HTMLElement[] : [];
		const selectedObjects: any[] = [];

		for ( let i = 0; i < optionElements.length; i ++ ) {

			const value = optionElements[ i ].getAttribute( 'value' );
			if ( value === null ) continue;

			const objectId = parseInt( value, 10 );
			if ( isNaN( objectId ) ) continue;

			const object = editor.scene.getObjectById( objectId ) || ( editor.camera && editor.camera.id === objectId ? editor.camera : null );
			if ( ! object || object === editor.scene || object === editor.camera ) continue;
			if ( selectedObjects.indexOf( object ) !== - 1 ) continue;

			selectedObjects.push( object );

		}

		if ( selectedObjects.length === 0 ) {

			const sceneChildren = Array.isArray( editor.scene && editor.scene.children ) ? editor.scene.children : [];

			for ( let i = 0; i < sceneChildren.length; i ++ ) {

				const object = sceneChildren[ i ];
				if ( ! object ) continue;
				if ( object.userData && object.userData.hidden === true ) continue;
				if ( object.name && object.name.charAt( 0 ) === '$' ) continue;

				selectedObjects.push( object );

			}

		}

		editor.selectedObjects.length = 0;

		for ( let i = 0; i < selectedObjects.length; i ++ ) {

			editor.selectedObjects.push( selectedObjects[ i ] );

		}

		editor.selected = selectedObjects.length > 0 ? selectedObjects[ selectedObjects.length - 1 ] : null;
		editor.config.setKey( 'selected', editor.selected ? editor.selected.uuid : null );
		editor.signals.objectSelected.dispatch( editor.selected );

		return false;

	}

	function bindTarget( target: Window | Document | null | undefined ): void {

		if ( target === null || target === undefined || typeof target.addEventListener !== 'function' ) return;

		target.addEventListener( 'keydown', handleSaveShortcut as EventListener, true );
		target.addEventListener( 'keypress', handleSaveShortcut as EventListener, true );
		target.addEventListener( 'keydown', handleSelectAllShortcut as EventListener, true );

	}

	bindTarget( window );
	bindTarget( document );

	try {

		if ( window.parent && window.parent !== window ) {

			bindTarget( window.parent );
			bindTarget( window.parent.document );

		}

		if ( window.top && window.top !== window && window.top !== window.parent ) {

			bindTarget( window.top );
			bindTarget( window.top.document );

		}

	} catch ( error ) {

		// Cross-origin parent windows are not accessible here.

	}

}

export { initializeGlobalShortcuts };
