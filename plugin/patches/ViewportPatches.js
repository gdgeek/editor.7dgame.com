import * as THREE from 'three';
import { MultiTransformCommand } from '../commands/MultiTransformCommand.js';

/**
 * Enhanced bounding box computation that handles skinned meshes,
 * hidden objects, and empty geometries more robustly than the
 * default THREE.Box3.setFromObject.
 *
 * Extracted from Viewport.js MRPP modification.
 *
 * @param {THREE.Object3D} object
 * @returns {THREE.Box3}
 */
function computeEnhancedBoundingBox( object ) {

	const boundingBox = new THREE.Box3();

	object.updateWorldMatrix( true, true );

	function processObject( obj ) {

		if ( obj.visible === false ) return;

		const geometry = obj.geometry;

		if ( geometry !== undefined ) {

			if ( geometry.boundingBox === null ) {

				geometry.computeBoundingBox();

			}

			if ( geometry.attributes && geometry.attributes.position ) {

				const position = geometry.attributes.position;
				const vector = new THREE.Vector3();

				for ( let i = 0; i < position.count; i ++ ) {

					vector.fromBufferAttribute( position, i );
					vector.applyMatrix4( obj.matrixWorld );
					boundingBox.expandByPoint( vector );

				}

			}

			if ( obj.isSkinnedMesh ) {

				const skeleton = obj.skeleton;
				if ( skeleton ) {

					for ( let i = 0; i < skeleton.bones.length; i ++ ) {

						const bone = skeleton.bones[ i ];
						const bonePoint = new THREE.Vector3().setFromMatrixPosition( bone.matrixWorld );
						boundingBox.expandByPoint( bonePoint );

					}

				}

			}

		}

		if ( obj.children && obj.children.length > 0 ) {

			for ( let i = 0; i < obj.children.length; i ++ ) {

				processObject( obj.children[ i ] );

			}

		}

	}

	processObject( object );

	if ( boundingBox.isEmpty() ) {

		boundingBox.set(
			new THREE.Vector3( - 0.05, - 0.05, - 0.05 ),
			new THREE.Vector3( 0.05, 0.05, 0.05 )
		);
		boundingBox.applyMatrix4( object.matrixWorld );

	}

	return boundingBox;

}

/**
 * Compute the union bounding box of multiple objects.
 *
 * @param {THREE.Object3D[]} objects
 * @returns {THREE.Box3}
 */
function computeMultiSelectionBoundingBox( objects ) {

	const boundingBox = new THREE.Box3();

	for ( let i = 0; i < objects.length; i ++ ) {

		if ( objects[ i ] ) {

			const objectBox = computeEnhancedBoundingBox( objects[ i ] );
			boundingBox.union( objectBox );

		}

	}

	return boundingBox;

}


/**
 * Apply all MRPP viewport patches to the given editor instance.
 *
 * Extracts multi-select transform logic that was previously inlined in
 * Viewport.js (MultiTransformCommand import, multiSelectGroup management,
 * multi-selection bounding box computation, transform callbacks).
 *
 * Strategy: Because Viewport.js is a closure-based function and its
 * TransformControls event handlers are internal, we inject the multi-select
 * logic via signal listeners and by exposing helper functions/state on the
 * editor instance. The Viewport.js original code handles single-select;
 * our signal listeners layer multi-select behavior on top.
 *
 * Safety pattern (same as EditorPatches.js):
 * - try/catch isolation for MRPP logic
 * - All state stored on editor._viewportPatch namespace
 *
 * @param {object} editor - The Editor instance
 */
function applyViewportPatches( editor ) {

	// ─── Internal state namespace ───────────────────────────────────

	const state = {
		multipleObjectsTransformOnDown: [],
		preventAutoMove: false,
		multiSelectionCenter: new THREE.Vector3(),
		currentTransformMode: 'translate' // tracks active TransformControls mode
	};

	editor._viewportPatch = state;

	// ─── Create multiSelectGroup ────────────────────────────────────

	const multiSelectGroup = new THREE.Group();
	multiSelectGroup.name = '多选临时组';
	multiSelectGroup.visible = false;
	editor.sceneHelpers.add( multiSelectGroup );

	// Expose on editor so other components (Sidebar.MultipleObjects etc.) can access
	editor.multiSelectGroup = multiSelectGroup;

	// ─── Expose utility functions on editor ─────────────────────────

	/**
	 * Compute an enhanced bounding box for a single object.
	 * Used by Viewport.js and other components.
	 */
	editor.computeEnhancedBoundingBox = computeEnhancedBoundingBox;

	/**
	 * Compute the union bounding box of multiple objects.
	 */
	editor.computeMultiSelectionBoundingBox = computeMultiSelectionBoundingBox;

	// ─── Helper: update multi-selection transforms ──────────────────

	function updateMultiSelectionTransforms( forceUpdateCenter ) {

		const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
		if ( selectedObjects.length === 0 ) return;

		if ( forceUpdateCenter || state.multiSelectionCenter.lengthSq() === 0 ) {

			const bbox = computeMultiSelectionBoundingBox( selectedObjects );
			bbox.getCenter( state.multiSelectionCenter );

			multiSelectGroup.position.copy( state.multiSelectionCenter );

		}

		for ( let i = 0; i < selectedObjects.length; i ++ ) {

			const obj = selectedObjects[ i ];
			if ( obj ) {

				obj.userData.offsetFromCenter = obj.position.clone().sub( state.multiSelectionCenter );

			}

		}

	}

	// ─── Signal: objectSelected — multi-select setup ────────────────

	editor.signals.objectSelected.add( function ( object ) {

		try {

			if ( object !== null && object !== editor.scene && object !== editor.camera ) {

				const selectedObjects = editor.getSelectedObjects();

				if ( selectedObjects.length > 1 ) {

					// Multi-select mode
					multiSelectGroup.userData.selectedObjects = [ ...selectedObjects ];

					// Clear and show the group
					while ( multiSelectGroup.children.length > 0 ) {

						multiSelectGroup.remove( multiSelectGroup.children[ 0 ] );

					}

					multiSelectGroup.visible = true;

					// Reset center and auto-move flag
					state.multiSelectionCenter.set( 0, 0, 0 );
					state.preventAutoMove = false;

					// Compute center and offsets
					updateMultiSelectionTransforms( true );

					// Reset group rotation and scale
					multiSelectGroup.rotation.set( 0, 0, 0 );
					multiSelectGroup.scale.set( 1, 1, 1 );

					// Set up transform callbacks on the group
					multiSelectGroup.userData.onPositionChange = function () {

						const objects = multiSelectGroup.userData.selectedObjects || [];
						if ( objects.length === 0 ) return;

						for ( let i = 0; i < objects.length; i ++ ) {

							const obj = objects[ i ];
							if ( obj && obj.userData.offsetFromCenter ) {

								const newPos = multiSelectGroup.position.clone().add( obj.userData.offsetFromCenter );
								obj.position.copy( newPos );

							}

						}

					};

					multiSelectGroup.userData.onRotationChange = function () {

						const objects = multiSelectGroup.userData.selectedObjects || [];
						if ( objects.length === 0 ) return;

						const groupWorldMatrix = new THREE.Matrix4();
						groupWorldMatrix.makeRotationFromEuler( multiSelectGroup.rotation );

						for ( let i = 0; i < objects.length; i ++ ) {

							const obj = objects[ i ];
							if ( obj && obj.userData.offsetFromCenter ) {

								const offset = obj.userData.offsetFromCenter.clone();
								offset.applyMatrix4( groupWorldMatrix );

								const newPos = multiSelectGroup.position.clone().add( offset );
								obj.position.copy( newPos );
								obj.rotation.copy( multiSelectGroup.rotation );

							}

						}

					};

					multiSelectGroup.userData.onScaleChange = function () {

						const objects = multiSelectGroup.userData.selectedObjects || [];
						if ( objects.length === 0 ) return;

						for ( let i = 0; i < objects.length; i ++ ) {

							const obj = objects[ i ];
							if ( obj && obj.userData.offsetFromCenter ) {

								const scaledOffset = obj.userData.offsetFromCenter.clone()
									.multiply( multiSelectGroup.scale );

								const newPos = multiSelectGroup.position.clone().add( scaledOffset );
								obj.position.copy( newPos );
								obj.scale.copy( multiSelectGroup.scale );

							}

						}

					};

				} else {

					// Single-select mode
					multiSelectGroup.visible = false;
					state.multiSelectionCenter.set( 0, 0, 0 );

				}

			} else {

				// No selection
				multiSelectGroup.visible = false;
				state.multiSelectionCenter.set( 0, 0, 0 );

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (objectSelected - viewport patch):', e );

		}

	} );

	// ─── Signal: objectChanged — multiSelectGroup handler ───────────
	//
	// In r183 Viewport.js, TransformControls fires 'objectChange' event which
	// dispatches signals.objectChanged. We intercept it here for multiSelectGroup.

	// Track the active transform mode so objectChanged handler can apply
	// only the relevant callback (r183: transformModeChanged signal is reliable).
	editor.signals.transformModeChanged.add( function ( mode ) {

		state.currentTransformMode = mode;

	} );

	editor.signals.objectChanged.add( function ( object ) {

		try {

			if ( object === multiSelectGroup ) {

				const selectedObjects = multiSelectGroup.userData.selectedObjects || [];

				if ( selectedObjects.length > 0 && multiSelectGroup.userData ) {

					// Apply only the callback matching the current transform mode
					// to avoid incorrectly propagating stale rotation/scale/position.
					const mode = state.currentTransformMode;

					if ( mode === 'translate' && multiSelectGroup.userData.onPositionChange ) {

						multiSelectGroup.userData.onPositionChange();

					} else if ( mode === 'rotate' && multiSelectGroup.userData.onRotationChange ) {

						multiSelectGroup.userData.onRotationChange();

					} else if ( mode === 'scale' && multiSelectGroup.userData.onScaleChange ) {

						multiSelectGroup.userData.onScaleChange();

					}

					editor.signals.multipleObjectsTransformChanged.dispatch( multiSelectGroup );

				}

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (objectChanged - viewport patch):', e );

		}

	} );

	// ─── Signal: multipleObjectsTransformChanged — bbox update ──────

	editor.signals.multipleObjectsTransformChanged.add( function ( object ) {

		try {

			if ( object === multiSelectGroup ) {

				const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
				if ( selectedObjects.length > 0 ) {

					// The bounding box and selectionBox are internal to Viewport.js.
					// We dispatch a render request via sceneGraphChanged so the
					// viewport re-renders with updated object positions.
					editor.signals.sceneGraphChanged.dispatch();

				}

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (multipleObjectsTransformChanged - viewport patch):', e );

		}

	} );


	// ─── Expose transform event handlers for Viewport integration ───
	//
	// These functions encapsulate the multi-select branches of the
	// TransformControls 'objectChange', 'mouseDown', and 'mouseUp' handlers.
	// They are stored on editor._viewportPatch so that Viewport.js
	// (once cleaned up) can delegate to them, or they can be wired
	// via signal listeners.

	/**
	 * Handle TransformControls 'objectChange' event for multi-select mode.
	 * Called when the transformControls object is the multiSelectGroup.
	 * (r183: event renamed from 'change' to 'objectChange')
	 *
	 * @param {object} transformControls - The TransformControls instance
	 * @param {THREE.Box3} box - The selection bounding box
	 * @param {object} signals - editor.signals
	 */
	state.handleMultiSelectChange = function ( transformControls, box, signals ) {

		const object = transformControls.object;
		if ( object !== multiSelectGroup ) return false;

		const selectedObjects = editor.getSelectedObjects();
		const mode = transformControls.getMode();

		if ( mode === 'translate' && object.userData.onPositionChange ) {

			object.userData.onPositionChange();

		} else if ( mode === 'rotate' && object.userData.onRotationChange ) {

			object.userData.onRotationChange();

		} else if ( mode === 'scale' && object.userData.onScaleChange ) {

			object.userData.onScaleChange();

		}

		box.copy( computeMultiSelectionBoundingBox( selectedObjects ) );

		signals.refreshSidebarObject3D.dispatch( object );
		signals.multipleObjectsTransformChanged.dispatch( object );

		return true; // handled

	};

	/**
	 * Handle TransformControls 'mouseDown' event for multi-select mode.
	 * Saves the original transforms of all selected objects.
	 *
	 * @param {object} transformControls - The TransformControls instance
	 * @returns {boolean} true if handled (multi-select mode)
	 */
	state.handleMultiSelectMouseDown = function ( transformControls ) {

		const object = transformControls.object;
		if ( object !== multiSelectGroup ) return false;

		state.multipleObjectsTransformOnDown = [];
		const selectedObjects = multiSelectGroup.userData.selectedObjects || [];

		state.preventAutoMove = true;

		multiSelectGroup.userData.originalTransform = {
			position: multiSelectGroup.position.clone(),
			rotation: multiSelectGroup.rotation.clone(),
			scale: multiSelectGroup.scale.clone()
		};

		for ( let i = 0; i < selectedObjects.length; i ++ ) {

			const obj = selectedObjects[ i ];
			if ( obj ) {

				state.multipleObjectsTransformOnDown.push( {
					object: obj,
					position: obj.position.clone(),
					rotation: obj.rotation.clone(),
					scale: obj.scale.clone()
				} );

			}

		}

		return true; // handled

	};

	/**
	 * Handle TransformControls 'mouseUp' event for multi-select mode.
	 * Creates and executes a MultiTransformCommand for undo/redo support.
	 *
	 * @param {object} transformControls - The TransformControls instance
	 * @param {object} SetPositionCommand - Fallback command class
	 * @param {object} SetRotationCommand - Fallback command class
	 * @param {object} SetScaleCommand - Fallback command class
	 * @returns {boolean} true if handled (multi-select mode)
	 */
	state.handleMultiSelectMouseUp = function ( transformControls, SetPositionCommand, SetRotationCommand, SetScaleCommand ) {

		const object = transformControls.object;
		if ( object !== multiSelectGroup ) return false;

		const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
		if ( selectedObjects.length === 0 || state.multipleObjectsTransformOnDown.length === 0 ) {

			return true;

		}

		try {

			// Create a MultiTransformCommand
			const multiCommand = new MultiTransformCommand( editor, selectedObjects );

			const mode = transformControls.getMode();
			switch ( mode ) {

				case 'translate':
					multiCommand.type = 'MultiPositionCommand';
					multiCommand.name = '多对象位置变换';
					break;
				case 'rotate':
					multiCommand.type = 'MultiRotationCommand';
					multiCommand.name = '多对象旋转变换';
					break;
				case 'scale':
					multiCommand.type = 'MultiScaleCommand';
					multiCommand.name = '多对象缩放变换';
					break;

			}

			// Set initial and final state for each object
			for ( let i = 0; i < state.multipleObjectsTransformOnDown.length; i ++ ) {

				const data = state.multipleObjectsTransformOnDown[ i ];
				const obj = data.object;
				if ( obj ) {

					multiCommand.oldPositions[ obj.id ] = data.position;
					multiCommand.oldRotations[ obj.id ] = data.rotation;
					multiCommand.oldScales[ obj.id ] = data.scale;

					multiCommand.newPositions[ obj.id ] = obj.position.clone();
					multiCommand.newRotations[ obj.id ] = obj.rotation.clone();
					multiCommand.newScales[ obj.id ] = obj.scale.clone();

				}

			}

			// Store group state
			const tmpGroup = multiSelectGroup.userData.originalTransform || {};
			multiCommand.oldGroupPosition = tmpGroup.position || multiSelectGroup.position.clone();
			multiCommand.oldGroupRotation = tmpGroup.rotation || multiSelectGroup.rotation.clone();
			multiCommand.oldGroupScale = tmpGroup.scale || multiSelectGroup.scale.clone();

			multiCommand.newGroupPosition = multiSelectGroup.position.clone();
			multiCommand.newGroupRotation = multiSelectGroup.rotation.clone();
			multiCommand.newGroupScale = multiSelectGroup.scale.clone();

			editor.execute( multiCommand );

		} catch ( e ) {

			console.warn( 'MRPP extension error (mouseUp multi-select command):', e );

			// Fallback to individual commands
			switch ( transformControls.getMode() ) {

				case 'translate':
					for ( let i = 0; i < state.multipleObjectsTransformOnDown.length; i ++ ) {

						const data = state.multipleObjectsTransformOnDown[ i ];
						const obj = data.object;
						if ( obj && ! data.position.equals( obj.position ) ) {

							editor.execute( new SetPositionCommand( editor, obj, obj.position, data.position ) );

						}

					}

					break;

				case 'rotate':
					for ( let i = 0; i < state.multipleObjectsTransformOnDown.length; i ++ ) {

						const data = state.multipleObjectsTransformOnDown[ i ];
						const obj = data.object;
						if ( obj && ! data.rotation.equals( obj.rotation ) ) {

							editor.execute( new SetRotationCommand( editor, obj, obj.rotation, data.rotation ) );

						}

					}

					break;

				case 'scale':
					for ( let i = 0; i < state.multipleObjectsTransformOnDown.length; i ++ ) {

						const data = state.multipleObjectsTransformOnDown[ i ];
						const obj = data.object;
						if ( obj && ! data.scale.equals( obj.scale ) ) {

							editor.execute( new SetScaleCommand( editor, obj, obj.scale, data.scale ) );

						}

					}

					break;

			}

		}

		// Clear stored transform data
		state.multipleObjectsTransformOnDown = [];

		// Update offsets without recalculating center
		if ( state.preventAutoMove ) {

			const currentSelected = multiSelectGroup.userData.selectedObjects || [];
			for ( let i = 0; i < currentSelected.length; i ++ ) {

				const obj = currentSelected[ i ];
				if ( obj ) {

					obj.userData.offsetFromCenter = obj.position.clone().sub( multiSelectGroup.position );

				}

			}

		}

		// Refresh multi-select state
		editor.signals.multipleObjectsTransformChanged.dispatch( multiSelectGroup );

		return true; // handled

	};

	// Expose the multiSelectGroup reference for Viewport.js integration
	state.multiSelectGroup = multiSelectGroup;

}

export { applyViewportPatches, computeEnhancedBoundingBox, computeMultiSelectionBoundingBox };
