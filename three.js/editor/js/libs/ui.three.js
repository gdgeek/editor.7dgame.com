import * as THREE from 'three';

import { RGBELoader } from '../../../examples/jsm/loaders/RGBELoader.js';
import { TGALoader } from '../../../examples/jsm/loaders/TGALoader.js';

import { UIElement, UISpan, UIDiv, UIRow, UIButton, UICheckbox, UIText, UINumber } from './ui.js';
import { MoveObjectCommand } from '../commands/MoveObjectCommand.js';
// --- MRPP MODIFICATION START ---
import { MoveMultipleObjectsCommand } from '../../../../plugin/commands/MoveMultipleObjectsCommand.js';
// --- MRPP MODIFICATION END ---

class UITexture extends UISpan {

	constructor( mapping ) {

		super();

		const scope = this;

		const form = document.createElement( 'form' );

		const input = document.createElement( 'input' );
		input.type = 'file';
		input.addEventListener( 'change', function ( event ) {

			loadFile( event.target.files[ 0 ] );

		} );
		form.appendChild( input );

		const canvas = document.createElement( 'canvas' );
		canvas.width = 32;
		canvas.height = 16;
		canvas.style.cursor = 'pointer';
		canvas.style.marginRight = '5px';
		canvas.style.border = '1px solid #888';
		canvas.addEventListener( 'click', function () {

			input.click();

		} );
		canvas.addEventListener( 'drop', function ( event ) {

			event.preventDefault();
			event.stopPropagation();
			loadFile( event.dataTransfer.files[ 0 ] );

		} );
		this.dom.appendChild( canvas );

		function loadFile( file ) {

			const extension = file.name.split( '.' ).pop().toLowerCase();
			const reader = new FileReader();

			if ( extension === 'hdr' || extension === 'pic' ) {

				reader.addEventListener( 'load', function ( event ) {

					// assuming RGBE/Radiance HDR iamge format

					const loader = new RGBELoader();
					loader.load( event.target.result, function ( hdrTexture ) {

						hdrTexture.sourceFile = file.name;
						hdrTexture.isHDRTexture = true;

						scope.setValue( hdrTexture );

						if ( scope.onChangeCallback ) scope.onChangeCallback( hdrTexture );

					} );

				} );

				reader.readAsDataURL( file );

			} else if ( extension === 'tga' ) {

				reader.addEventListener( 'load', function ( event ) {

					const canvas = new TGALoader().parse( event.target.result );

					const texture = new THREE.CanvasTexture( canvas, mapping );
					texture.sourceFile = file.name;

					scope.setValue( texture );

					if ( scope.onChangeCallback ) scope.onChangeCallback( texture );

				}, false );

				reader.readAsArrayBuffer( file );

			} else if ( file.type.match( 'image.*' ) ) {

				reader.addEventListener( 'load', function ( event ) {

					const image = document.createElement( 'img' );
					image.addEventListener( 'load', function () {

						const texture = new THREE.Texture( this, mapping );
						texture.sourceFile = file.name;
						texture.needsUpdate = true;

						scope.setValue( texture );

						if ( scope.onChangeCallback ) scope.onChangeCallback( texture );

					}, false );

					image.src = event.target.result;

				}, false );

				reader.readAsDataURL( file );

			}

			form.reset();

		}

		this.texture = null;
		this.onChangeCallback = null;

	}

	getValue() {

		return this.texture;

	}

	setValue( texture ) {

		const canvas = this.dom.children[ 0 ];
		const context = canvas.getContext( '2d' );

		// Seems like context can be null if the canvas is not visible
		if ( context ) {

			// Always clear the context before set new texture, because new texture may has transparency
			context.clearRect( 0, 0, canvas.width, canvas.height );

		}

		if ( texture !== null ) {

			const image = texture.image;

			if ( image !== undefined && image.width > 0 ) {

				canvas.title = texture.sourceFile;
				const scale = canvas.width / image.width;

				if ( image.data === undefined ) {

					context.drawImage( image, 0, 0, image.width * scale, image.height * scale );

				} else {

					const canvas2 = renderToCanvas( texture );
					context.drawImage( canvas2, 0, 0, image.width * scale, image.height * scale );

				}

			} else {

				canvas.title = texture.sourceFile + ' (error)';

			}

		} else {

			canvas.title = 'empty';

		}

		this.texture = texture;

	}

	setEncoding( encoding ) {

		const texture = this.getValue();

		if ( texture !== null ) {

			texture.encoding = encoding;

		}

		return this;

	}

	onChange( callback ) {

		this.onChangeCallback = callback;

		return this;

	}

}

class UICubeTexture extends UIElement {

	constructor() {

		const container = new UIDiv();

		super( container.dom );

		this.cubeTexture = null;
		this.onChangeCallback = null;

		this.textures = [];

		const scope = this;

		const pRow = new UIRow();
		const nRow = new UIRow();

		pRow.add( new UIText( 'P:' ).setWidth( '35px' ) );
		nRow.add( new UIText( 'N:' ).setWidth( '35px' ) );

		const posXTexture = new UITexture().onChange( onTextureChanged );
		const negXTexture = new UITexture().onChange( onTextureChanged );
		const posYTexture = new UITexture().onChange( onTextureChanged );
		const negYTexture = new UITexture().onChange( onTextureChanged );
		const posZTexture = new UITexture().onChange( onTextureChanged );
		const negZTexture = new UITexture().onChange( onTextureChanged );

		this.textures.push( posXTexture, negXTexture, posYTexture, negYTexture, posZTexture, negZTexture );

		pRow.add( posXTexture );
		pRow.add( posYTexture );
		pRow.add( posZTexture );

		nRow.add( negXTexture );
		nRow.add( negYTexture );
		nRow.add( negZTexture );

		container.add( pRow, nRow );

		function onTextureChanged() {

			const images = [];

			for ( let i = 0; i < scope.textures.length; i ++ ) {

				const texture = scope.textures[ i ].getValue();

				if ( texture !== null ) {

					images.push( texture.isHDRTexture ? texture : texture.image );

				}

			}

			if ( images.length === 6 ) {

				const cubeTexture = new THREE.CubeTexture( images );
				cubeTexture.needsUpdate = true;

				if ( images[ 0 ].isHDRTexture ) cubeTexture.isHDRTexture = true;

				scope.cubeTexture = cubeTexture;

				if ( scope.onChangeCallback ) scope.onChangeCallback( cubeTexture );

			}

		}

	}

	setEncoding( encoding ) {

		const cubeTexture = this.getValue();
		if ( cubeTexture !== null ) {

			cubeTexture.encoding = encoding;

		}

		return this;

	}

	getValue() {

		return this.cubeTexture;

	}

	setValue( cubeTexture ) {

		this.cubeTexture = cubeTexture;

		if ( cubeTexture !== null ) {

			const images = cubeTexture.image;

			if ( Array.isArray( images ) === true && images.length === 6 ) {

				for ( let i = 0; i < images.length; i ++ ) {

					const image = images[ i ];

					const texture = new THREE.Texture( image );
					this.textures[ i ].setValue( texture );

				}

			}

		} else {

			const textures = this.textures;

			for ( let i = 0; i < textures.length; i ++ ) {

				textures[ i ].setValue( null );

			}

		}

		return this;

	}

	onChange( callback ) {

		this.onChangeCallback = callback;

		return this;

	}

}

class UIOutliner extends UIDiv {

	constructor( editor ) {

		super();

		this.dom.className = 'Outliner';
		this.dom.tabIndex = 0;	// keyup event is ignored without setting tabIndex

		const scope = this;

		// hack
		this.scene = editor.scene;

		// Prevent native scroll behavior
		this.dom.addEventListener( 'keydown', function ( event ) {

			switch ( event.keyCode ) {

				case 38: // up
				case 40: // down
					event.preventDefault();
					event.stopPropagation();
					break;

			}

		} );

		// Keybindings to support arrow navigation
		this.dom.addEventListener( 'keyup', function ( event ) {

			let targetIndex = - 1;

			switch ( event.keyCode ) {

				case 38: // up
					targetIndex = scope.selectedIndex - 1;
					break;
				case 40: // down
					targetIndex = scope.selectedIndex + 1;
					break;

			}

			if ( targetIndex < 0 || targetIndex >= scope.options.length ) return;

			if ( event.shiftKey ) {

				scope._selectRange( targetIndex, event.ctrlKey || event.metaKey );

			} else {

				scope._setSelection( [ targetIndex ], targetIndex, targetIndex, true );

			}

			const changeEvent = new CustomEvent( 'change', {
				bubbles: true,
				cancelable: true
			} );
			scope.dom.dispatchEvent( changeEvent );

		} );

		this.editor = editor;

		this.options = [];
		this.selectedIndex = - 1;
		this.selectedValue = null;
		this.selectedIndices = [];
		this.selectedValues = [];
		this.anchorIndex = - 1;
		this.reorderOnly = false;

	}

	_normalizeValue( value ) {

		return ( value !== null && value !== undefined ) ? String( value ) : null;

	}

	_getValueByIndex( index ) {

		if ( index < 0 || index >= this.options.length ) return null;

		return String( this.options[ index ].value );

	}

	_getIndexByValue( value ) {

		const normalizedValue = this._normalizeValue( value );
		if ( normalizedValue === null ) return - 1;

		for ( let i = 0; i < this.options.length; i ++ ) {

			if ( String( this.options[ i ].value ) === normalizedValue ) return i;

		}

		return - 1;

	}

	_applySelectionClasses() {

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

	}

	_scrollIndexIntoView( index ) {

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

	}

	_setSelection( indices, primaryIndex, anchorIndex, scrollIntoView ) {

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

	}

	_toggleIndex( index ) {

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

	}

	_selectRange( targetIndex, appendToSelection ) {

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

	}

	selectIndex( index ) {

		if ( index >= 0 && index < this.options.length ) {

			this._setSelection( [ index ], index, index, true );

			const changeEvent = new CustomEvent( 'change', {
				bubbles: true,
				cancelable: true
			} );
			this.dom.dispatchEvent( changeEvent );

		}

	}

	setOptions( options ) {

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
			if ( scope.selectedValues.indexOf( draggedId ) === -1 ) {

				scope.clearSelection();
				scope.setValue( draggedId );

			}
		}

		function onDragOver( event ) {

			if ( this === currentDrag ) return;

			const area = event.offsetY / this.clientHeight;
			const reorderOnly = scope.reorderOnly === true;

			this.classList.remove( 'dragTop', 'dragBottom', 'drag' );

			if ( reorderOnly ) {

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

			const scene = scope.scene;

			const selectedValues = scope.getValues();
			const selectedObjects = selectedValues.map( ( id ) => scene.getObjectById( parseInt( id, 10 ) ) ).filter( Boolean );

			if ( selectedObjects.length === 0 ) return;

			const area = event.offsetY / this.clientHeight;
			const reorderOnly = scope.reorderOnly === true;

			if ( reorderOnly ) {

				const targetObject = scene.getObjectById( parseInt( this.value, 10 ) );
				if ( targetObject === undefined || targetObject === null ) return;

				const sourceParent = selectedObjects[ 0 ] ? selectedObjects[ 0 ].parent : null;
				if ( sourceParent === null ) return;

				for ( let i = 0; i < selectedObjects.length; i ++ ) {

					if ( selectedObjects[ i ].parent !== sourceParent ) return;

				}

				if ( targetObject.parent !== sourceParent ) return;

				if ( area < 0.5 ) {

					moveMultipleObjects( selectedObjects, sourceParent, targetObject );

				} else {

					const targetIndex = sourceParent.children.indexOf( targetObject );
					const nextObject = ( targetIndex !== -1 && targetIndex + 1 < sourceParent.children.length ) ? sourceParent.children[ targetIndex + 1 ] : null;
					moveMultipleObjects( selectedObjects, sourceParent, nextObject );

				}

				return;

			}

			if ( area < 0.25 ) {

				const nextObject = scene.getObjectById( parseInt( this.value, 10 ) );
				moveMultipleObjects( selectedObjects, nextObject.parent, nextObject );

			} else if ( area > 0.75 ) {

				let nextObject, parent;

				if ( this.nextSibling !== null ) {

					nextObject = scene.getObjectById( parseInt( this.nextSibling.value, 10 ) );
					parent = nextObject.parent;

				} else {

					nextObject = null;
					parent = scene.getObjectById( parseInt( this.value, 10 ) ).parent;

				}

				moveMultipleObjects( selectedObjects, parent, nextObject );

			} else {

				const parentObject = scene.getObjectById( parseInt( this.value, 10 ) );
				moveMultipleObjects( selectedObjects, parentObject );

			}
		}

		function moveMultipleObjects( objects, newParent, nextObject ) {

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

			const editor = scope.editor;
			const cmd = new MoveMultipleObjectsCommand( editor, objects, newParent, nextObject );
			editor.execute( cmd );

			const changeEvent = new CustomEvent( 'change', {
				bubbles: true,
				cancelable: true
			} );
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
				div.addEventListener( 'dragstart', onDragStart ); // Firefox needs this

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

	}

	getValue() {

		return this.selectedValue;

	}

	getAnchorValue() {

		return this._getValueByIndex( this.anchorIndex );

	}

	getValues() {

		return this.selectedValues.slice();

	}

	setValues( values, primaryValue, anchorValue ) {

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

	}

	clearSelection() {

		this.selectedIndices = [];
		this.selectedValues = [];
		this.selectedIndex = -1;
		this.selectedValue = null;
		this.anchorIndex = -1;
		this._applySelectionClasses();

		return this;

	}

	addToSelection( value, index ) {

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
	}

	setValue( value, multiSelect ) {

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

	}

}

class UIPoints extends UISpan {

	constructor() {

		super();

		this.dom.style.display = 'inline-block';

		this.pointsList = new UIDiv();
		this.add( this.pointsList );

		this.pointsUI = [];
		this.lastPointIdx = 0;
		this.onChangeCallback = null;

		// TODO Remove this bind() stuff

		this.update = function () {

			if ( this.onChangeCallback !== null ) {

				this.onChangeCallback();

			}

		}.bind( this );

	}

	onChange( callback ) {

		this.onChangeCallback = callback;

		return this;

	}

	clear() {

		for ( let i = 0; i < this.pointsUI.length; ++ i ) {

			if ( this.pointsUI[ i ] ) {

				this.deletePointRow( i, true );

			}

		}

		this.lastPointIdx = 0;

	}

	deletePointRow( idx, dontUpdate ) {

		if ( ! this.pointsUI[ idx ] ) return;

		this.pointsList.remove( this.pointsUI[ idx ].row );

		this.pointsUI.splice( idx, 1 );

		if ( dontUpdate !== true ) {

			this.update();

		}

		this.lastPointIdx --;

	}

}

class UIPoints2 extends UIPoints {

	constructor() {

		super();

		const row = new UIRow();
		this.add( row );

		const addPointButton = new UIButton( '+' );
		addPointButton.onClick( () => {

			if ( this.pointsUI.length === 0 ) {

				this.pointsList.add( this.createPointRow( 0, 0 ) );

			} else {

				const point = this.pointsUI[ this.pointsUI.length - 1 ];

				this.pointsList.add( this.createPointRow( point.x.getValue(), point.y.getValue() ) );

			}

			this.update();

		} );
		row.add( addPointButton );

	}

	getValue() {

		const points = [];

		let count = 0;

		for ( let i = 0; i < this.pointsUI.length; i ++ ) {

			const pointUI = this.pointsUI[ i ];

			if ( ! pointUI ) continue;

			points.push( new THREE.Vector2( pointUI.x.getValue(), pointUI.y.getValue() ) );
			++ count;
			pointUI.lbl.setValue( count );

		}

		return points;

	}

	setValue( points ) {

		this.clear();

		for ( let i = 0; i < points.length; i ++ ) {

			const point = points[ i ];
			this.pointsList.add( this.createPointRow( point.x, point.y ) );

		}

		this.update();
		return this;

	}

	createPointRow( x, y ) {

		const pointRow = new UIDiv();
		const lbl = new UIText( this.lastPointIdx + 1 ).setWidth( '20px' );
		const txtX = new UINumber( x ).setWidth( '30px' ).onChange( this.update );
		const txtY = new UINumber( y ).setWidth( '30px' ).onChange( this.update );

		const scope = this;
		const btn = new UIButton( '-' ).onClick( function () {

			if ( scope.isEditing ) return;

			const idx = scope.pointsList.getIndexOfChild( pointRow );
			scope.deletePointRow( idx );

		} );

		this.pointsUI.push( { row: pointRow, lbl: lbl, x: txtX, y: txtY } );
		++ this.lastPointIdx;
		pointRow.add( lbl, txtX, txtY, btn );

		return pointRow;

	}

}

class UIPoints3 extends UIPoints {

	constructor() {

		super();

		const row = new UIRow();
		this.add( row );

		const addPointButton = new UIButton( '+' );
		addPointButton.onClick( () => {

			if ( this.pointsUI.length === 0 ) {

				this.pointsList.add( this.createPointRow( 0, 0, 0 ) );

			} else {

				const point = this.pointsUI[ this.pointsUI.length - 1 ];

				this.pointsList.add( this.createPointRow( point.x.getValue(), point.y.getValue(), point.z.getValue() ) );

			}

			this.update();

		} );
		row.add( addPointButton );

	}

	getValue() {

		const points = [];
		let count = 0;

		for ( let i = 0; i < this.pointsUI.length; i ++ ) {

			const pointUI = this.pointsUI[ i ];

			if ( ! pointUI ) continue;

			points.push( new THREE.Vector3( pointUI.x.getValue(), pointUI.y.getValue(), pointUI.z.getValue() ) );
			++ count;
			pointUI.lbl.setValue( count );

		}

		return points;

	}

	setValue( points ) {

		this.clear();

		for ( let i = 0; i < points.length; i ++ ) {

			const point = points[ i ];
			this.pointsList.add( this.createPointRow( point.x, point.y, point.z ) );

		}

		this.update();
		return this;

	}

	createPointRow( x, y, z ) {

		const pointRow = new UIDiv();
		const lbl = new UIText( this.lastPointIdx + 1 ).setWidth( '20px' );
		const txtX = new UINumber( x ).setWidth( '30px' ).onChange( this.update );
		const txtY = new UINumber( y ).setWidth( '30px' ).onChange( this.update );
		const txtZ = new UINumber( z ).setWidth( '30px' ).onChange( this.update );

		const scope = this;
		const btn = new UIButton( '-' ).onClick( function () {

			if ( scope.isEditing ) return;

			const idx = scope.pointsList.getIndexOfChild( pointRow );
			scope.deletePointRow( idx );

		} );

		this.pointsUI.push( { row: pointRow, lbl: lbl, x: txtX, y: txtY, z: txtZ } );
		++ this.lastPointIdx;
		pointRow.add( lbl, txtX, txtY, txtZ, btn );

		return pointRow;

	}

}

class UIBoolean extends UISpan {

	constructor( boolean, text ) {

		super();

		this.setMarginRight( '4px' );

		this.checkbox = new UICheckbox( boolean );
		this.text = new UIText( text ).setMarginLeft( '3px' );

		this.add( this.checkbox );
		this.add( this.text );

	}

	getValue() {

		return this.checkbox.getValue();

	}

	setValue( value ) {

		return this.checkbox.setValue( value );

	}

}

let renderer;

function renderToCanvas( texture ) {

	if ( renderer === undefined ) {

		renderer = new THREE.WebGLRenderer();
		renderer.outputEncoding = THREE.sRGBEncoding;

	}

	const image = texture.image;

	renderer.setSize( image.width, image.height, false );

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

	const material = new THREE.MeshBasicMaterial( { map: texture } );
	const quad = new THREE.PlaneGeometry( 2, 2 );
	const mesh = new THREE.Mesh( quad, material );
	scene.add( mesh );

	renderer.render( scene, camera );

	return renderer.domElement;

}

export { UITexture, UICubeTexture, UIOutliner, UIPoints, UIPoints2, UIPoints3, UIBoolean };
