/* global signals */
// signals 库通过 <script> 标签加载为全局变量，提供 signals.Signal 构造函数

import { DialogUtils } from '../utils/DialogUtils.js';
import { Access } from '../access/Access.js';

/**
 * Language mapping: URL parameter codes → r183 editor config codes.
 * r183 Strings.js uses short codes: en, zh, ja, ko, fr, fa.
 * Extracted from Editor.js top-level MRPP modification.
 */
const LANGUAGE_MAPPING = {
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
 *
 * @param {object} editor - Editor 实例
 */
function applyLanguageMapping( editor ) {

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
 *
 * @param {object} editor - Editor 实例
 */
function registerCustomSignals( editor ) {

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
 *
 * @param {object} editor - Editor 实例
 */
function registerCustomProperties( editor ) {

	editor.type = '';
	editor.resources = [];
	editor.selectedObjects = [];
	editor.access = new Access( editor );
	editor.multiSelectGroup = null;
	editor.data = undefined;

}

/**
 * Register all MRPP custom methods on the editor instance.
 *
 * @param {object} editor - Editor 实例
 */
function registerCustomMethods( editor ) {

	/**
	 * Save the current scene. Checks loading status of meta/verse loaders
	 * before dispatching upload signal.
	 */
	editor.save = function () {

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
	editor.showNotification = function ( message, isError ) {

		console.log( '显示通知:', message );

		DialogUtils.showMessage( message, isError );

		this.signals.notificationAdded.dispatch( message );

	};

	/**
	 * Show a confirmation dialog using DialogUtils.
	 */
	editor.showConfirmation = function ( message, onConfirm, onCancel, event, isError = false ) {

		console.log( '显示确认框:', message );

		DialogUtils.showConfirm( message, onConfirm, onCancel, event, isError );

	};

	/**
	 * Get all currently selected objects.
	 * Checks DOM outliner first for accurate multi-select state,
	 * falls back to internal selectedObjects array.
	 */
	editor.getSelectedObjects = function () {

		const outlinerElement = document.getElementById( 'outliner' );
		if ( outlinerElement ) {

			const activeElements = outlinerElement.querySelectorAll( '.option.active' );

			if ( activeElements.length > 0 ) {

				const selectedObjects = [];

				for ( let i = 0; i < activeElements.length; i ++ ) {

					const objectId = parseInt( activeElements[ i ].value );
					if ( ! isNaN( objectId ) ) {

						const object = this.scene.getObjectById( objectId ) ||
							( this.camera.id === objectId ? this.camera : null );

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
	editor.clearSelection = function () {

		this.selectedObjects.length = 0;
		this.selected = null;
		this.signals.objectSelected.dispatch( null );

	};

}

// ─── Monkey-patch methods (Task 1.2) ────────────────────────────────

/**
 * Monkey-patch editor.setScene to initialize commands arrays on all
 * objects in the incoming scene before they are added.
 *
 * @param {object} editor - Editor 实例
 */
function patchSetScene( editor ) {

	const originalSetScene = editor.setScene.bind( editor );

	editor.setScene = function ( scene ) {

		try {

			// Initialize commands array on every object in the scene
			scene.traverse( function ( object ) {

				if ( object.commands === undefined ) {

					/**
					 * MRPP 扩展属性：命令数组，附加在 THREE.Object3D 实例上。
					 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
					 * @type {Array<{type: string, [key: string]: any}>}
					 */
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
 *
 * @param {object} editor - Editor 实例
 */
function patchAddObject( editor ) {

	const originalAddObject = editor.addObject.bind( editor );

	editor.addObject = function ( object, parent, index ) {

		try {

			// Save original type (traverse may change it for helpers)
			var originalType = object.type;

			// Initialize commands array
			if ( object.commands === undefined ) {

				/**
				 * MRPP 扩展属性：命令数组，附加在 THREE.Object3D 实例上。
				 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
				 * @type {Array<{type: string, [key: string]: any}>}
				 */
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

				var resourceId = object.userData.resource;
				var resourceData = window.resources.get( resourceId.toString() );

				if ( resourceData ) {

					var existingIndex = this.resources.findIndex( function ( res ) {

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
 *
 * @param {object} editor - Editor 实例
 */
function patchRemoveObject( editor ) {

	const originalRemoveObject = editor.removeObject.bind( editor );

	editor.removeObject = function ( object ) {

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
 *
 * @param {object} editor - Editor 实例
 */
function patchSelect( editor ) {

	const originalSelect = editor.select.bind( editor );

	editor.select = function ( object, multiSelect ) {

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
			let uuid = null;
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
 *
 * @param {object} editor - Editor 实例
 */
function patchClear( editor ) {

	const originalClear = editor.clear.bind( editor );

	editor.clear = function () {

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
 *
 * @param {object} editor - Editor 实例
 */
function patchFromJSON( editor ) {

	const originalFromJSON = editor.fromJSON.bind( editor );

	editor.fromJSON = async function ( json ) {

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
 *
 * @param {object} editor - Editor 实例
 */
function patchToJSON( editor ) {

	const originalToJSON = editor.toJSON.bind( editor );

	editor.toJSON = function () {

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
 *
 * @param {object} editor - The Editor instance created by `new Editor()`
 */
function applyEditorPatches( editor ) {

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
