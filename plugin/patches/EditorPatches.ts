import { DialogUtils } from '../utils/DialogUtils.js';
import { Access } from '../access/Access.js';
import type { MrppEditor } from '../types/mrpp.js';

/**
 * Language mapping: URL parameter codes → r183 editor config codes.
 * r183 Strings.js uses short codes: en, zh, ja, ko, fr, fa.
 * Extracted from Editor.js top-level MRPP modification.
 */
const LANGUAGE_MAPPING: Record<string, string> = {
	'zh-CN': 'zh',
	'en-US': 'en',
	'ja-JP': 'ja',
	'zh-TW': 'zh',  // r183 has no zh-tw, fall back to zh
	'th-TH': 'en',  // r183 has no th-th, fall back to en
	'ko-KR': 'ko',
	'fr-FR': 'fr'
};

/**
 * Apply language mapping from URL parameters to editor config.
 * Reads `?language=` from the current URL and sets the corresponding
 * editor config key if a mapping exists.
 *
 * NOTE (r183): Config.js already initialises language from navigator.language
 * using short codes (en/zh/ja/ko/fr/fa). We only need to override when a
 * ?language= URL param is present.
 */
function applyLanguageMapping( editor: MrppEditor ): void {

	const urlParams = new URLSearchParams( window.location.search );
	const lg = urlParams.get( 'language' );

	if ( lg && LANGUAGE_MAPPING[ lg ] ) {

		editor.config.setKey( 'language', LANGUAGE_MAPPING[ lg ] );

	}

	// MRPP: disable autosave by default (r183 defaults to true)
	editor.config.setKey( 'autosave', false );

}

/**
 * Register all MRPP custom signals on editor.signals.
 * Uses the global `signals.Signal` constructor (loaded via script tag).
 *
 * NOTE (r183): savingStarted and savingFinished are now built-in signals in r183.
 * We skip them to avoid overwriting existing Signal instances (and their listeners).
 */
function registerCustomSignals( editor: MrppEditor ): void {

	const Signal = signals.Signal;

	// Upload / release
	editor.signals.upload = new Signal();
	editor.signals.release = new Signal();

	// Saving lifecycle — savingStarted and savingFinished already exist in r183 Editor,
	// only add them if not already present to avoid overwriting built-in signals.
	if ( ! editor.signals.savingStarted ) editor.signals.savingStarted = new Signal();
	if ( ! editor.signals.savingFinished ) editor.signals.savingFinished = new Signal();

	// Multi-object changes
	editor.signals.objectsChanged = new Signal();

	// Component CUD
	editor.signals.componentAdded = new Signal();
	editor.signals.componentChanged = new Signal();
	editor.signals.componentRemoved = new Signal();

	// Event CUD
	editor.signals.eventAdded = new Signal();
	editor.signals.eventChanged = new Signal();
	editor.signals.eventRemoved = new Signal();

	// Command CUD
	editor.signals.commandAdded = new Signal();
	editor.signals.commandChanged = new Signal();
	editor.signals.commandRemoved = new Signal();

	// Ground visibility
	editor.signals.showGroundChanged = new Signal();

	// Messaging
	editor.signals.messageSend = new Signal();
	editor.signals.messageReceive = new Signal();

	// Notifications
	editor.signals.notificationAdded = new Signal();

	// Load completion
	editor.signals.doneLoadObject = new Signal();

	// Multi-select transform
	editor.signals.multipleObjectsTransformChanged = new Signal();

	// Screenshot background changed
	editor.signals.screenshotBackgroundChanged = new Signal();

}

/**
 * Register all MRPP custom properties on the editor instance.
 */
function registerCustomProperties( editor: MrppEditor ): void {

	editor.type = '';
	editor.resources = [];
	editor.selectedObjects = [];
	editor.access = new Access( editor );
	editor.multiSelectGroup = null;
	editor.data = undefined;

}

/**
 * Register all MRPP custom methods on the editor instance.
 */
function registerCustomMethods( editor: MrppEditor ): void {

	/**
	 * Save the current scene. Checks loading status of meta/verse loaders
	 * before dispatching upload signal.
	 */
	editor.save = function (): boolean {

		if ( this.metaLoader && typeof this.metaLoader.getLoadingStatus === 'function' && this.metaLoader.getLoadingStatus() ) {

			console.warn( 'Cannot save while models are still loading' );
			return false;

		}

		if ( this.verseLoader && typeof this.verseLoader.getLoadingStatus === 'function' && this.verseLoader.getLoadingStatus() ) {

			console.warn( 'Cannot save while modules are still loading' );
			return false;

		}

		this.signals.sceneGraphChanged.dispatch();
		this.signals.upload.dispatch();

		return true;

	};

	/**
	 * Show a notification message using DialogUtils.
	 */
	editor.showNotification = function ( message: string, isError?: boolean ): void {

		console.log( '显示通知:', message );

		DialogUtils.showMessage( message, isError );

		this.signals.notificationAdded.dispatch( message );

	};

	/**
	 * Show a confirmation dialog using DialogUtils.
	 */
	editor.showConfirmation = function ( message: string, onConfirm: Function, onCancel: Function | null, event: Event, isError: boolean = false ): void {

		console.log( '显示确认框:', message );

		DialogUtils.showConfirm( message, onConfirm, onCancel, event, isError );

	};

	/**
	 * Get all currently selected objects.
	 * Checks DOM outliner first for accurate multi-select state,
	 * falls back to internal selectedObjects array.
	 */
	editor.getSelectedObjects = function (): any[] {

		const outlinerElement = document.getElementById( 'outliner' );
		if ( outlinerElement ) {

			const activeElements = outlinerElement.querySelectorAll( '.option.active' );

			if ( activeElements.length > 0 ) {

				const selectedObjects: any[] = [];

				for ( let i = 0; i < activeElements.length; i ++ ) {

					const objectId = parseInt( (activeElements[ i ] as HTMLOptionElement).value );
					if ( ! isNaN( objectId ) ) {

						const object = this.scene.getObjectById( objectId ) ||
							( (this.camera as any).id === objectId ? this.camera : null );

						if ( object ) {

							selectedObjects.push( object );

						}

					}

				}

				if ( selectedObjects.length > 0 ) {

					return selectedObjects;

				}

			}

		}

		return this.selectedObjects.slice();

	};

	/**
	 * Clear all selected objects.
	 */
	editor.clearSelection = function (): void {

		this.selectedObjects.length = 0;
		this.selected = null;
		this.signals.objectSelected.dispatch( null );

	};

}

// ─── Monkey-patch methods (Task 1.2) ────────────────────────────────

/**
 * Monkey-patch editor.setScene to initialize commands arrays on all
 * objects in the incoming scene before they are added.
 */
function patchSetScene( editor: MrppEditor ): void {

	const originalSetScene = editor.setScene.bind( editor );

	editor.setScene = function ( scene: any ): any {

		try {

			// Initialize commands array on every object in the scene
			scene.traverse( function ( object: any ) {

				if ( object.commands === undefined ) {

					object.commands = [];

				}

			} );

		} catch ( e ) {

			console.warn( 'MRPP extension error (setScene pre):', e );

		}

		return originalSetScene( scene );

	};

}

/**
 * Monkey-patch editor.addObject to:
 * - Save and restore original object.type (traverse may alter it)
 * - Initialize commands array
 * - Sync resource data between window.resources and editor.resources
 *
 * NOTE (r183): The original addObject already supports parent/index parameters,
 * so we delegate all cases to originalAddObject and only add MRPP pre/post logic.
 */
function patchAddObject( editor: MrppEditor ): void {

	const originalAddObject = editor.addObject.bind( editor );

	editor.addObject = function ( object: any, parent?: any, index?: number ): void {

		let originalType: string | undefined;

		try {

			// Save original type (traverse may change it for helpers)
			originalType = object.type;

			// Initialize commands array
			if ( object.commands === undefined ) {

				object.commands = [];

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (addObject pre):', e );

		}

		// Delegate to original (r183 already handles parent/index natively)
		originalAddObject( object, parent, index );

		try {

			// Restore original type
			if ( typeof originalType !== 'undefined' ) {

				object.type = originalType;

			}

			// Sync resource data
			if ( object.userData && object.userData.resource && window.resources ) {

				const resourceId = object.userData.resource;
				const resourceData = window.resources.get( resourceId.toString() );

				if ( resourceData ) {

					const existingIndex = this.resources.findIndex( function ( res: any ) {

						return res && res.id === parseInt( resourceId );

					} );

					if ( existingIndex >= 0 ) {

						this.resources[ existingIndex ] = resourceData;

					} else {

						this.resources.push( resourceData );

					}

				}

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (addObject post):', e );

		}

	};

}

/**
 * Monkey-patch editor.removeObject to clean up selectedObjects array
 * when an object is removed.
 */
function patchRemoveObject( editor: MrppEditor ): void {

	const originalRemoveObject = editor.removeObject.bind( editor );

	editor.removeObject = function ( object: any ): void {

		originalRemoveObject( object );

		try {

			// Remove from selectedObjects array
			const index = editor.selectedObjects.indexOf( object );
			if ( index !== - 1 ) {

				editor.selectedObjects.splice( index, 1 );

				// If the primary selected object was removed, update it
				if ( editor.selected === object ) {

					editor.selected = editor.selectedObjects.length > 0
						? editor.selectedObjects[ editor.selectedObjects.length - 1 ]
						: null;
					editor.signals.objectSelected.dispatch( editor.selected );

				}

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (removeObject post):', e );

		}

	};

}

/**
 * Monkey-patch editor.select to add multiSelect support.
 * In multiSelect mode, objects are toggled in/out of selectedObjects.
 * In single-select mode, selectedObjects is reset to just the selected object.
 *
 * NOTE (r183): editor.selector is now a Selector class instance (not a function),
 * so the old `this.selector(object)` filter pattern has been removed.
 * r183's editor.select delegates to this.selector.select(object) internally.
 */
function patchSelect( editor: MrppEditor ): void {

	const originalSelect = editor.select.bind( editor );

	editor.select = function ( object: any, multiSelect?: boolean ): void {

		if ( multiSelect ) {

			// Multi-select mode
			if ( object === null ) {

				// If null in multi-select mode, keep current selection
				return;

			}

			const index = this.selectedObjects.indexOf( object );

			if ( index === - 1 ) {

				// Add to selection
				this.selectedObjects.push( object );
				this.selected = object;

			} else {

				// Toggle off - remove from selection
				this.selectedObjects.splice( index, 1 );
				this.selected = this.selectedObjects.length > 0
					? this.selectedObjects[ this.selectedObjects.length - 1 ]
					: null;

			}

			// Set config and dispatch signal (same as original tail)
			let uuid: string | null = null;
			if ( this.selected !== null ) {

				uuid = this.selected.uuid;

			}

			this.config.setKey( 'selected', uuid );
			this.signals.objectSelected.dispatch( this.selected );

		} else {

			// Single-select mode - reset multi-select array
			this.selectedObjects.length = 0;

			if ( object !== null ) {

				this.selectedObjects.push( object );

			}

			// Delegate to original select for single-select behavior
			originalSelect( object );

		}

	};

}

/**
 * Monkey-patch editor.clear to also clear the selectedObjects array.
 */
function patchClear( editor: MrppEditor ): void {

	const originalClear = editor.clear.bind( editor );

	editor.clear = function (): any {

		const result = originalClear();

		try {

			this.selectedObjects.length = 0;

		} catch ( e ) {

			console.warn( 'MRPP extension error (clear post):', e );

		}

		return result;

	};

}

/**
 * Monkey-patch editor.fromJSON to save resources from the JSON data.
 */
function patchFromJSON( editor: MrppEditor ): void {

	const originalFromJSON = editor.fromJSON.bind( editor );

	editor.fromJSON = async function ( json: any ): Promise<void> {

		await originalFromJSON( json );

		try {

			if ( json.resources !== undefined ) {

				this.resources = json.resources;

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (fromJSON post):', e );

		}

	};

}

/**
 * Monkey-patch editor.toJSON to include resources in the output.
 */
function patchToJSON( editor: MrppEditor ): void {

	const originalToJSON = editor.toJSON.bind( editor );

	editor.toJSON = function (): any {

		const result = originalToJSON();

		try {

			result.resources = this.resources;

		} catch ( e ) {

			console.warn( 'MRPP extension error (toJSON post):', e );

		}

		return result;

	};

}

// ─── Main entry point ───────────────────────────────────────────────

/**
 * Apply all MRPP editor patches to the given editor instance.
 * This is the single entry point called from bootstrap modules.
 */
function applyEditorPatches( editor: MrppEditor ): void {

	// 1. Language mapping (must run before strings are used)
	applyLanguageMapping( editor );

	// 2. Custom signals
	registerCustomSignals( editor );

	// 3. Custom properties
	registerCustomProperties( editor );

	// 4. Custom methods
	registerCustomMethods( editor );

	// 5. Monkey-patch existing methods
	patchSetScene( editor );
	patchAddObject( editor );
	patchRemoveObject( editor );
	patchSelect( editor );
	patchClear( editor );
	patchFromJSON( editor );
	patchToJSON( editor );

}

export { applyEditorPatches, LANGUAGE_MAPPING };
