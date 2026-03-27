import type { MrppEditor } from '../types/mrpp.js';

function initializeGlobalShortcuts( editor: MrppEditor ): void {

	function isSaveShortcut( event: KeyboardEvent ): boolean {

		if ( event.isComposing ) return false;

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;

		if ( isCtrlOrCmd === false ) return false;

		const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

		return key === 's' || event.keyCode === 83;

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

	function bindTarget( target: Window | Document | null | undefined ): void {

		if ( target === null || target === undefined || typeof target.addEventListener !== 'function' ) return;

		target.addEventListener( 'keydown', handleSaveShortcut as EventListener, true );
		target.addEventListener( 'keypress', handleSaveShortcut as EventListener, true );

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
