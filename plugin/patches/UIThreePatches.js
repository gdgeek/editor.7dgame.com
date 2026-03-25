import { MoveMultipleObjectsCommand } from '../commands/MoveMultipleObjectsCommand.js';
import { MoveObjectCommand } from '../../three.js/editor/js/commands/MoveObjectCommand.js';
import { UIOutliner } from '../../three.js/editor/js/libs/ui.three.js';

/**
 * Apply MRPP patches to UIOutliner.
 *
 * Two categories of patches:
 *
 * 1. Multi-select API: Adds multi-select methods/properties to UIOutliner
 *    prototype so that Sidebar.Scene.js (and other consumers) can use
 *    getValues(), setValues(), getAnchorValue(), clearSelection(),
 *    addToSelection(), onDblClick(), and the reorderOnly property.
 *    The original r140 UIOutliner only supports single selection.
 *
 * 2. Drag-drop override: Attaches a capturing-phase 'drop' listener on
 *    the outliner DOM element to intercept the original single-object
 *    MoveObjectCommand handler and replace it with multi-object
 *    MoveMultipleObjectsCommand logic.
 *
 * Safety pattern (same as EditorPatches.js):
 * - try/catch isolation for MRPP logic
 * - Falls through to original handler on error
 *
 * @param {object} editor - The Editor instance
 */
function applyUIThreePatches( editor ) {

	// ─── 1. Monkey-patch UIOutliner prototype with multi-select API ──

	patchUIOutlinerPrototype();

	// ─── 2. Patch drag-drop for multi-object moves ──────────────────

	const reorderOnly = !! ( editor.type && editor.type.toLowerCase() === 'verse' );

	/**
	 * Patch the outliner DOM element with a capturing-phase drop handler.
	 */
	function patchOutlinerElement( outlinerDom ) {

		// Guard against double-patching
		if ( outlinerDom._mrppDropPatched ) return;
		outlinerDom._mrppDropPatched = true;

		// Track the current drag source element.
		let currentDragElement = null;

		outlinerDom.addEventListener( 'dragstart', function ( event ) {

			const option = event.target.closest
				? event.target.closest( '.option' )
				: ( event.target.classList && event.target.classList.contains( 'option' ) ? event.target : null );

			if ( option ) {

				currentDragElement = option;

			}

		}, true );

		outlinerDom.addEventListener( 'drag', function ( event ) {

			const option = event.target.closest
				? event.target.closest( '.option' )
				: ( event.target.classList && event.target.classList.contains( 'option' ) ? event.target : null );

			if ( option ) {

				currentDragElement = option;

			}

		}, true );

		// Capture-phase drop handler: intercepts before the original
		// bubble-phase handler from setOptions()
		outlinerDom.addEventListener( 'drop', function ( event ) {

			try {

				const dropTarget = event.target.closest
					? event.target.closest( '.option' )
					: event.target;

				if ( ! dropTarget || ! dropTarget.classList || ! dropTarget.classList.contains( 'option' ) ) return;
				if ( dropTarget === currentDragElement || currentDragElement === undefined ) return;

				// Stop the original drop handler from firing
				event.stopImmediatePropagation();
				event.preventDefault();

				// Remove drag visual classes
				dropTarget.classList.remove( 'dragTop', 'dragBottom', 'drag' );

				handleMultiObjectDrop( dropTarget, event, outlinerDom );

			} catch ( e ) {

				console.warn( 'MRPP extension error (UIThree drop handler):', e );

			}

		}, true ); // true = capture phase

	}

	/**
	 * Handle a drop event with multi-object support.
	 */
	function handleMultiObjectDrop( dropTarget, event, outlinerDom ) {

		const scene = editor.scene;
		const selectedObjects = editor.getSelectedObjects();

		if ( selectedObjects.length === 0 ) return;

		const area = event.offsetY / dropTarget.clientHeight;

		if ( reorderOnly ) {

			const targetObject = scene.getObjectById( parseInt( dropTarget.value, 10 ) );
			if ( targetObject === undefined || targetObject === null ) return;

			const sourceParent = selectedObjects[ 0 ] ? selectedObjects[ 0 ].parent : null;
			if ( sourceParent === null ) return;

			for ( let i = 0; i < selectedObjects.length; i ++ ) {

				if ( selectedObjects[ i ].parent !== sourceParent ) return;

			}

			if ( targetObject.parent !== sourceParent ) return;

			if ( area < 0.5 ) {

				moveMultipleObjects( selectedObjects, sourceParent, targetObject, outlinerDom );

			} else {

				const targetIndex = sourceParent.children.indexOf( targetObject );
				const nextObject = ( targetIndex !== - 1 && targetIndex + 1 < sourceParent.children.length )
					? sourceParent.children[ targetIndex + 1 ]
					: null;
				moveMultipleObjects( selectedObjects, sourceParent, nextObject, outlinerDom );

			}

			return;

		}

		if ( area < 0.25 ) {

			const nextObject = scene.getObjectById( parseInt( dropTarget.value, 10 ) );
			moveMultipleObjects( selectedObjects, nextObject.parent, nextObject, outlinerDom );

		} else if ( area > 0.75 ) {

			let nextObject, parent;

			if ( dropTarget.nextSibling !== null ) {

				nextObject = scene.getObjectById( parseInt( dropTarget.nextSibling.value, 10 ) );
				parent = nextObject.parent;

			} else {

				nextObject = null;
				parent = scene.getObjectById( parseInt( dropTarget.value, 10 ) ).parent;

			}

			moveMultipleObjects( selectedObjects, parent, nextObject, outlinerDom );

		} else {

			const parentObject = scene.getObjectById( parseInt( dropTarget.value, 10 ) );
			moveMultipleObjects( selectedObjects, parentObject, undefined, outlinerDom );

		}

	}

	/**
	 * Move multiple objects using MoveMultipleObjectsCommand.
	 */
	function moveMultipleObjects( objects, newParent, nextObject, outlinerDom ) {

		if ( nextObject === null ) nextObject = undefined;

		for ( let i = 0; i < objects.length; i ++ ) {

			const object = objects[ i ];
			let newParentIsChild = false;

			object.traverse( function ( child ) {

				if ( child === newParent ) newParentIsChild = true;

			} );

			if ( newParentIsChild ) return;

			if ( objects.indexOf( newParent ) !== - 1 ) return;

		}

		const cmd = new MoveMultipleObjectsCommand( editor, objects, newParent, nextObject );
		editor.execute( cmd );

		const changeEvent = new CustomEvent( 'change', {
			bubbles: true,
			cancelable: true
		} );
		outlinerDom.dispatchEvent( changeEvent );

	}

	// ─── Apply to existing outliner if already in DOM ───────────────

	const existingOutliner = document.getElementById( 'outliner' );
	if ( existingOutliner ) {

		patchOutlinerElement( existingOutliner );
		return;

	}

	// ─── Observe DOM for outliner creation ──────────────────────────

	const observer = new MutationObserver( function ( mutations ) {

		for ( let i = 0; i < mutations.length; i ++ ) {

			const addedNodes = mutations[ i ].addedNodes;

			for ( let j = 0; j < addedNodes.length; j ++ ) {

				const node = addedNodes[ j ];
				if ( node.nodeType !== 1 ) continue;

				let outliner = null;

				if ( node.id === 'outliner' ) {

					outliner = node;

				} else if ( node.querySelector ) {

					outliner = node.querySelector( '#outliner' );

				}

				if ( outliner ) {

					patchOutlinerElement( outliner );
					observer.disconnect();
					return;

				}

			}

		}

	} );

	const observeTarget = document.body || document.documentElement;
	if ( observeTarget ) {

		observer.observe( observeTarget, {
			childList: true,
			subtree: true
		} );

	}

}


/**
 * Monkey-patch UIOutliner prototype with multi-select support.
 *
 * The original r140 UIOutliner only supports single selection (getValue/setValue).
 * This patch adds multi-select infrastructure used by Sidebar.Scene.js:
 * - selectedIndices, selectedValues, anchorIndex, reorderOnly properties
 * - Internal helpers: _normalizeValue, _getValueByIndex, _getIndexByValue
 * - Selection management: _applySelectionClasses, _scrollIndexIntoView, _setSelection
 * - Multi-select actions: _toggleIndex, _selectRange
 * - Public API: getValues, setValues, getAnchorValue, clearSelection, addToSelection
 * - Overrides: selectIndex, setOptions (click/drag handlers), setValue
 * - Convenience: onDblClick
 *
 * Guard: only patches once (checks _mrppMultiSelectPatched flag).
 */
function patchUIOutlinerPrototype() {

	if ( UIOutliner.prototype._mrppMultiSelectPatched ) return;
	UIOutliner.prototype._mrppMultiSelectPatched = true;

	// ─── Helper to ensure multi-select state is initialized ─────────

	function ensureMultiSelectState( instance ) {

		if ( instance._mrppMultiSelectInit ) return;
		instance._mrppMultiSelectInit = true;

		if ( instance.selectedIndices === undefined ) instance.selectedIndices = [];
		if ( instance.selectedValues === undefined ) instance.selectedValues = [];
		if ( instance.anchorIndex === undefined ) instance.anchorIndex = - 1;
		if ( instance.reorderOnly === undefined ) instance.reorderOnly = false;

		// Add keyup handler for multi-select (shift+arrow) support.
		// The original r140 keyup handler calls selectIndex() which we
		// also override below, so single-arrow still works. This handler
		// adds shift+arrow range selection.
		instance.dom.addEventListener( 'keyup', function ( event ) {

			if ( ! event.shiftKey ) return; // let original handler deal with non-shift

			let targetIndex = - 1;

			switch ( event.keyCode ) {

				case 38: // up
					targetIndex = instance.selectedIndex - 1;
					break;
				case 40: // down
					targetIndex = instance.selectedIndex + 1;
					break;

			}

			if ( targetIndex < 0 || targetIndex >= instance.options.length ) return;

			// Prevent the original keyup handler from also firing selectIndex
			event.stopImmediatePropagation();

			instance._selectRange( targetIndex, event.ctrlKey || event.metaKey );

			const changeEvent = new CustomEvent( 'change', {
				bubbles: true,
				cancelable: true
			} );
			instance.dom.dispatchEvent( changeEvent );

		} );

	}

	// ─── Prototype methods ──────────────────────────────────────────

	UIOutliner.prototype._normalizeValue = function ( value ) {

		return ( value !== null && value !== undefined ) ? String( value ) : null;

	};

	UIOutliner.prototype._getValueByIndex = function ( index ) {

		if ( index < 0 || index >= this.options.length ) return null;

		return String( this.options[ index ].value );

	};

	UIOutliner.prototype._getIndexByValue = function ( value ) {

		const normalizedValue = this._normalizeValue( value );
		if ( normalizedValue === null ) return - 1;

		for ( let i = 0; i < this.options.length; i ++ ) {

			if ( String( this.options[ i ].value ) === normalizedValue ) return i;

		}

		return - 1;

	};

	UIOutliner.prototype._applySelectionClasses = function () {

		ensureMultiSelectState( this );

		for ( let i = 0; i < this.options.length; i ++ ) {

			this.options[ i ].classList.remove( 'active' );
			this.options[ i ].classList.remove( 'multi-selected' );

		}

		for ( let i = 0; i < this.selectedIndices.length; i ++ ) {

			const index = this.selectedIndices[ i ];
			if ( index < 0 || index >= this.options.length ) continue;
			this.options[ index ].classList.add( 'active' );

			if ( this.selectedIndices.length > 1 ) {

				this.options[ index ].classList.add( 'multi-selected' );

			}

		}

	};

	UIOutliner.prototype._scrollIndexIntoView = function ( index ) {

		if ( index < 0 || index >= this.options.length ) return;

		const element = this.options[ index ];
		const y = element.offsetTop - this.dom.offsetTop;
		const bottomY = y + element.offsetHeight;
		const minScroll = bottomY - this.dom.offsetHeight;

		if ( this.dom.scrollTop > y ) {

			this.dom.scrollTop = y;

		} else if ( this.dom.scrollTop < minScroll ) {

			this.dom.scrollTop = minScroll;

		}

	};

	UIOutliner.prototype._setSelection = function ( indices, primaryIndex, anchorIndex, scrollIntoView ) {

		ensureMultiSelectState( this );

		const uniqueSortedIndices = [];

		for ( let i = 0; i < indices.length; i ++ ) {

			const index = indices[ i ];
			if ( index < 0 || index >= this.options.length ) continue;

			if ( uniqueSortedIndices.indexOf( index ) === - 1 ) {

				uniqueSortedIndices.push( index );

			}

		}

		uniqueSortedIndices.sort( function ( a, b ) { return a - b; } );

		this.selectedIndices = uniqueSortedIndices;
		this.selectedValues = uniqueSortedIndices.map( ( index ) => this._getValueByIndex( index ) );

		if ( uniqueSortedIndices.length === 0 ) {

			this.selectedIndex = - 1;
			this.selectedValue = null;
			this.anchorIndex = - 1;
			this._applySelectionClasses();
			return;

		}

		let resolvedPrimaryIndex = primaryIndex;
		if ( uniqueSortedIndices.indexOf( resolvedPrimaryIndex ) === - 1 ) {

			resolvedPrimaryIndex = uniqueSortedIndices[ uniqueSortedIndices.length - 1 ];

		}

		let resolvedAnchorIndex = anchorIndex;
		if ( uniqueSortedIndices.indexOf( resolvedAnchorIndex ) === - 1 ) {

			resolvedAnchorIndex = resolvedPrimaryIndex;

		}

		this.selectedIndex = resolvedPrimaryIndex;
		this.selectedValue = this._getValueByIndex( resolvedPrimaryIndex );
		this.anchorIndex = resolvedAnchorIndex;

		this._applySelectionClasses();

		if ( scrollIntoView === true ) {

			this._scrollIndexIntoView( resolvedPrimaryIndex );

		}

	};

	UIOutliner.prototype._toggleIndex = function ( index ) {

		ensureMultiSelectState( this );

		const nextSelectedIndices = this.selectedIndices.slice();
		const existingIndex = nextSelectedIndices.indexOf( index );

		if ( existingIndex === - 1 ) {

			nextSelectedIndices.push( index );
			this._setSelection( nextSelectedIndices, index, index, true );
			return;

		}

		nextSelectedIndices.splice( existingIndex, 1 );

		if ( nextSelectedIndices.length === 0 ) {

			this.clearSelection();
			return;

		}

		let nextPrimaryIndex = this.selectedIndex;
		if ( nextPrimaryIndex === index || nextSelectedIndices.indexOf( nextPrimaryIndex ) === - 1 ) {

			nextPrimaryIndex = nextSelectedIndices[ nextSelectedIndices.length - 1 ];

		}

		let nextAnchorIndex = this.anchorIndex;
		if ( nextAnchorIndex === index || nextSelectedIndices.indexOf( nextAnchorIndex ) === - 1 ) {

			nextAnchorIndex = nextPrimaryIndex;

		}

		this._setSelection( nextSelectedIndices, nextPrimaryIndex, nextAnchorIndex, false );

	};

	UIOutliner.prototype._selectRange = function ( targetIndex, appendToSelection ) {

		ensureMultiSelectState( this );

		const anchorIndex = ( this.anchorIndex !== - 1 ) ? this.anchorIndex :
			( this.selectedIndex !== - 1 ? this.selectedIndex : targetIndex );

		const start = Math.min( anchorIndex, targetIndex );
		const end = Math.max( anchorIndex, targetIndex );

		const nextSelectedIndices = appendToSelection ? this.selectedIndices.slice() : [];

		for ( let i = start; i <= end; i ++ ) {

			if ( nextSelectedIndices.indexOf( i ) === - 1 ) {

				nextSelectedIndices.push( i );

			}

		}

		this._setSelection( nextSelectedIndices, targetIndex, anchorIndex, true );

	};

	// ─── Override selectIndex for multi-select event dispatch ────────

	UIOutliner.prototype.selectIndex = function ( index ) {

		ensureMultiSelectState( this );

		if ( index >= 0 && index < this.options.length ) {

			this._setSelection( [ index ], index, index, true );

			const changeEvent = new CustomEvent( 'change', {
				bubbles: true,
				cancelable: true
			} );
			this.dom.dispatchEvent( changeEvent );

		}

	};

	// ─── Override setOptions for multi-select click/drag handlers ────

	UIOutliner.prototype.setOptions = function ( options ) {

		ensureMultiSelectState( this );

		const scope = this;
		const previousSelectedValues = this.getValues();
		const previousPrimaryValue = this.getValue();
		const previousAnchorValue = ( this.anchorIndex !== - 1 ) ? this._getValueByIndex( this.anchorIndex ) : null;

		while ( scope.dom.children.length > 0 ) {

			scope.dom.removeChild( scope.dom.firstChild );

		}

		function onClick( event ) {

			const currentIndex = scope.options.indexOf( this );
			if ( currentIndex === - 1 ) return;

			const toggleSelect = event.ctrlKey || event.metaKey;
			const rangeSelect = event.shiftKey;

			if ( rangeSelect ) {

				scope._selectRange( currentIndex, toggleSelect );

			} else if ( toggleSelect ) {

				scope._toggleIndex( currentIndex );

			} else {

				scope._setSelection( [ currentIndex ], currentIndex, currentIndex, true );

			}

			const changeEvent = new CustomEvent( 'change', {
				bubbles: true,
				cancelable: true
			} );
			scope.dom.dispatchEvent( changeEvent );

		}

		// Drag

		let currentDrag;

		function onDrag() {

			currentDrag = this;

		}

		function onDragStart( event ) {

			event.dataTransfer.setData( 'text', 'foo' );

			const draggedId = String( this.value );
			if ( scope.selectedValues.indexOf( draggedId ) === - 1 ) {

				scope.clearSelection();
				scope.setValue( draggedId );

			}

		}

		function onDragOver( event ) {

			if ( this === currentDrag ) return;

			const area = event.offsetY / this.clientHeight;
			const isReorderOnly = scope.reorderOnly === true;

			this.classList.remove( 'dragTop', 'dragBottom', 'drag' );

			if ( isReorderOnly ) {

				if ( area < 0.5 ) {

					this.classList.add( 'dragTop' );

				} else {

					this.classList.add( 'dragBottom' );

				}

			} else if ( area < 0.25 ) {

				this.classList.add( 'dragTop' );

			} else if ( area > 0.75 ) {

				this.classList.add( 'dragBottom' );

			} else {

				this.classList.add( 'drag' );

			}

		}

		function onDragLeave() {

			if ( this === currentDrag ) return;

			this.classList.remove( 'dragTop', 'dragBottom', 'drag' );

		}

		function onDrop( event ) {

			if ( this === currentDrag || currentDrag === undefined ) return;

			this.classList.remove( 'dragTop', 'dragBottom', 'drag' );

			// Fallback single-object drop logic using MoveObjectCommand.
			// Normally the capture-phase handler in patchOutlinerElement()
			// intercepts this for multi-object moves.

			const scene = scope.scene;
			const object = scene.getObjectById( currentDrag.value );

			const area = event.offsetY / this.clientHeight;

			if ( area < 0.25 ) {

				const nextObject = scene.getObjectById( this.value );
				moveObject( object, nextObject.parent, nextObject );

			} else if ( area > 0.75 ) {

				let nextObject, parent;

				if ( this.nextSibling !== null ) {

					nextObject = scene.getObjectById( this.nextSibling.value );
					parent = nextObject.parent;

				} else {

					nextObject = null;
					parent = scene.getObjectById( this.value ).parent;

				}

				moveObject( object, parent, nextObject );

			} else {

				const parentObject = scene.getObjectById( this.value );
				moveObject( object, parentObject );

			}

		}

		function moveObject( object, newParent, nextObject ) {

			if ( nextObject === null ) nextObject = undefined;

			let newParentIsChild = false;

			object.traverse( function ( child ) {

				if ( child === newParent ) newParentIsChild = true;

			} );

			if ( newParentIsChild ) return;

			const editor = scope.editor;
			editor.execute( new MoveObjectCommand( editor, object, newParent, nextObject ) );

			const changeEvent = document.createEvent( 'HTMLEvents' );
			changeEvent.initEvent( 'change', true, true );
			scope.dom.dispatchEvent( changeEvent );

		}

		//

		scope.options = [];

		for ( let i = 0; i < options.length; i ++ ) {

			const div = options[ i ];
			div.className = 'option';
			scope.dom.appendChild( div );

			scope.options.push( div );

			div.addEventListener( 'click', onClick );

			if ( div.draggable === true ) {

				div.addEventListener( 'drag', onDrag );
				div.addEventListener( 'dragstart', onDragStart );

				div.addEventListener( 'dragover', onDragOver );
				div.addEventListener( 'dragleave', onDragLeave );
				div.addEventListener( 'drop', onDrop );

			}

		}

		if ( previousSelectedValues.length > 0 ) {

			const restoredIndices = [];

			for ( let i = 0; i < previousSelectedValues.length; i ++ ) {

				const index = scope._getIndexByValue( previousSelectedValues[ i ] );
				if ( index !== - 1 && restoredIndices.indexOf( index ) === - 1 ) {

					restoredIndices.push( index );

				}

			}

			const restoredPrimaryIndex = scope._getIndexByValue( previousPrimaryValue );
			const restoredAnchorIndex = scope._getIndexByValue( previousAnchorValue );
			scope._setSelection( restoredIndices, restoredPrimaryIndex, restoredAnchorIndex, false );

		} else {

			scope.clearSelection();

		}

		return scope;

	};

	// ─── Public multi-select API ────────────────────────────────────

	UIOutliner.prototype.getAnchorValue = function () {

		ensureMultiSelectState( this );
		return this._getValueByIndex( this.anchorIndex );

	};

	UIOutliner.prototype.getValues = function () {

		ensureMultiSelectState( this );
		return this.selectedValues.slice();

	};

	UIOutliner.prototype.setValues = function ( values, primaryValue, anchorValue ) {

		ensureMultiSelectState( this );

		const list = Array.isArray( values ) ? values : [];
		const indices = [];

		for ( let i = 0; i < list.length; i ++ ) {

			const index = this._getIndexByValue( list[ i ] );
			if ( index !== - 1 && indices.indexOf( index ) === - 1 ) {

				indices.push( index );

			}

		}

		const primaryIndex = this._getIndexByValue( primaryValue );
		let resolvedAnchorValue = anchorValue;

		if ( resolvedAnchorValue === undefined ) {

			resolvedAnchorValue = this.getAnchorValue();

		}

		const anchorIndex = this._getIndexByValue( resolvedAnchorValue );

		this._setSelection( indices, primaryIndex, anchorIndex, false );

		return this;

	};

	UIOutliner.prototype.clearSelection = function () {

		ensureMultiSelectState( this );

		this.selectedIndices = [];
		this.selectedValues = [];
		this.selectedIndex = - 1;
		this.selectedValue = null;
		this.anchorIndex = - 1;
		this._applySelectionClasses();

		return this;

	};

	UIOutliner.prototype.addToSelection = function ( value, index ) {

		ensureMultiSelectState( this );

		const normalizedValue = this._normalizeValue( value );
		if ( normalizedValue === null ) return this;

		let targetIndex = index;

		if ( targetIndex === undefined ) {

			targetIndex = this._getIndexByValue( normalizedValue );

		}

		if ( targetIndex < 0 || targetIndex >= this.options.length ) return this;

		if ( this.selectedIndices.indexOf( targetIndex ) !== - 1 ) return this;

		const nextSelectedIndices = this.selectedIndices.slice();
		nextSelectedIndices.push( targetIndex );

		const primaryIndex = this.selectedIndex !== - 1 ? this.selectedIndex : targetIndex;
		const anchorIndex = this.anchorIndex !== - 1 ? this.anchorIndex : primaryIndex;

		this._setSelection( nextSelectedIndices, primaryIndex, anchorIndex, false );

		return this;

	};

	// ─── Override setValue to support multiSelect parameter ──────────

	UIOutliner.prototype.setValue = function ( value, multiSelect ) {

		ensureMultiSelectState( this );

		const normalizedValue = this._normalizeValue( value );

		if ( normalizedValue === null ) {

			if ( multiSelect !== true ) {

				this.clearSelection();

			}

			return this;

		}

		const index = this._getIndexByValue( normalizedValue );
		if ( index === - 1 ) {

			if ( multiSelect !== true ) {

				this.clearSelection();

			}

			return this;

		}

		if ( multiSelect === true ) {

			this._toggleIndex( index );

		} else {

			this._setSelection( [ index ], index, index, true );

		}

		return this;

	};

	// ─── onDblClick convenience method ──────────────────────────────

	UIOutliner.prototype.onDblClick = function ( callback ) {

		this.dom.addEventListener( 'dblclick', callback );
		return this;

	};

}

export { applyUIThreePatches };
