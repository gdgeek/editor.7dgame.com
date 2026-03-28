import * as THREE from 'three';

import { UIRow, UIButton, UIText, UICheckbox, UISelect, UIPanel } from '../../../three.js/editor/js/libs/ui.js';

import { SetPositionCommand } from '../../../three.js/editor/js/commands/SetPositionCommand.js';
import { SetRotationCommand } from '../../../three.js/editor/js/commands/SetRotationCommand.js';
import { SetScaleCommand } from '../../../three.js/editor/js/commands/SetScaleCommand.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';
import { ABILITIES } from '../../access/Access.js';

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Returns a localized display name for the object type.
 * Falls back to the raw type string if no translation is found.
 */
function getLocalizedObjectType( object: any, editor: any ): string {

	const strings = editor.strings;
	const rawType = ( object.userData && object.userData.type ) || object.type || '';
	const normalizedType = rawType.toLowerCase();

	if (
		editor.type &&
		editor.type.toLowerCase() === 'verse' &&
		normalizedType === 'module'
	) {

		return strings.getKey( 'sidebar/object/type_value/entity' );

	}

	const typeKeyMap = {
		scene: 'sidebar/object/type_value/scene',
		group: 'sidebar/object/type_value/group',
		object3d: 'sidebar/object/type_value/object3d',
		mesh: 'sidebar/object/type_value/mesh',
		line: 'sidebar/object/type_value/line',
		linesegments: 'sidebar/object/type_value/linesegments',
		points: 'sidebar/object/type_value/points',
		sprite: 'sidebar/object/type_value/sprite',
		camera: 'sidebar/object/type_value/camera',
		perspectivecamera: 'sidebar/object/type_value/perspectivecamera',
		orthographiccamera: 'sidebar/object/type_value/orthographiccamera',
		light: 'sidebar/object/type_value/light',
		ambientlight: 'sidebar/object/type_value/ambientlight',
		directionallight: 'sidebar/object/type_value/directionallight',
		hemispherelight: 'sidebar/object/type_value/hemispherelight',
		pointlight: 'sidebar/object/type_value/pointlight',
		spotlight: 'sidebar/object/type_value/spotlight',
		module: 'sidebar/object/type_value/module',
		entity: 'sidebar/object/type_value/entity',
		point: 'sidebar/object/type_value/point',
		text: 'sidebar/object/type_value/text',
		polygen: 'sidebar/object/type_value/polygen',
		picture: 'sidebar/object/type_value/picture',
		video: 'sidebar/object/type_value/video',
		audio: 'sidebar/object/type_value/audio',
		sound: 'sidebar/object/type_value/audio',
		prototype: 'sidebar/object/type_value/prototype',
		voxel: 'sidebar/object/type_value/voxel',
		phototype: 'sidebar/object/type_value/phototype',
		prefab: 'sidebar/object/type_value/prefab'
	};

	const translationKey = (typeKeyMap as any)[ normalizedType ];

	if ( translationKey ) {

		const localizedType = strings.getKey( translationKey );
		if ( localizedType !== '???' ) return localizedType;

	}

	return rawType;

}

function isMediaType( object: any ): boolean {

	if ( object.userData && object.userData.type ) {

		const type = object.userData.type.toLowerCase();
		if ( type === 'video' || type === 'sound' ) return true;

	}

	if ( object.name ) {

		const name = object.name.toLowerCase();
		if ( name.includes( '[video]' ) || name.includes( '[sound]' ) ) return true;

	}

	return false;

}

function isPictureType( object: any ): boolean {

	if ( ! object ) return false;

	try {

		if ( object.userData && object.userData.type ) {

			const type = object.userData.type.toLowerCase();
			if ( type === 'picture' ) return true;

		}

		if ( object.name ) {

			const name = object.name.toLowerCase();
			if ( name.includes( '[picture]' ) || name.includes( '[photo]' ) ) return true;

		}

	} catch ( e ) {

		// ignore

	}

	return false;

}

// ── icon-button styling helpers ──────────────────────────────────────

function styleIconButton( button: any ): void {

	button.dom.style.display = 'inline-flex';
	button.dom.style.alignItems = 'center';
	button.dom.style.justifyContent = 'center';
	button.dom.style.padding = '0';

}

function styleActionIcon( icon: HTMLElement ): void {

	icon.style.width = '13px';
	icon.style.height = '13px';
	icon.style.display = 'block';
	icon.style.margin = '0 auto';

}

// ── main injection ───────────────────────────────────────────────────

function injectSidebarObjectExtensions( editor: any, sidebarObjectContainer: HTMLElement ): void {

	const strings = editor.strings;
	const signals = editor.signals;

	// ── Inject CSS for hiding MRPP-unwanted rows ─────────────────────
	if ( ! document.getElementById( 'mrpp-hidden-style' ) ) {

		const hiddenStyle = document.createElement( 'style' );
		hiddenStyle.id = 'mrpp-hidden-style';
		hiddenStyle.textContent = '.mrpp-hidden { display: none !important; }';
		document.head.appendChild( hiddenStyle );

	}

	// ── clipboard state ──────────────────────────────────────────────

	const clipboard: Record<string, any> = { position: null, rotation: null, scale: null };
	const singlePropertyClipboard: Record<string, any> = { position: null, rotation: null, scale: null };

	// Event-listener bookkeeping so we can tear down on re-select
	const eventListeners: any[] = [];

	function removeAllEventListeners() {

		for ( const listener of eventListeners ) {

			listener.element.removeEventListener( listener.type, listener.callback );

		}

		eventListeners.length = 0;

	}

	function addEventListenerWithRef( element: any, type: any, callback: any ) {

		element.addEventListener( type, callback );
		eventListeners.push( { element, type, callback } );

	}

	// ── locate existing rows inside the container ────────────────────
	// The original Sidebar.Object already created position / rotation / scale
	// rows with UINumber inputs. We find them by querying the DOM so we can
	// attach copy/paste buttons and the hover-border effect.

	const allRows = sidebarObjectContainer.querySelectorAll( '.Row' );

	// We identify rows by their label text content.
	function findRowByLabel( labelText: any ) {

		for ( let i = 0; i < allRows.length; i ++ ) {

			const spans = allRows[ i ].querySelectorAll( 'span' );
			for ( let j = 0; j < spans.length; j ++ ) {

				if ( spans[ j ].textContent.trim() === labelText.trim() ) {

					return allRows[ i ];

				}

			}

		}

		return null;

	}

	const positionLabel = strings.getKey( 'sidebar/object/position' );
	const rotationLabel = strings.getKey( 'sidebar/object/rotation' );
	const scaleLabel = strings.getKey( 'sidebar/object/scale' );

	const objectPositionRow = findRowByLabel( positionLabel );
	const objectRotationRow = findRowByLabel( rotationLabel );
	const objectScaleRow = findRowByLabel( scaleLabel );

	// Collect the UINumber input elements inside each row
	function getNumberInputs( row: any ) {

		if ( ! row ) return [];
		return Array.from( row.querySelectorAll( 'input[type="number"]' ) );

	}

	const posInputs = getNumberInputs( objectPositionRow );
	const rotInputs = getNumberInputs( objectRotationRow );
	const scaleInputs = getNumberInputs( objectScaleRow );

	// ── helper: create copy/paste button pair for a single property ──

	function createCopyPasteButtons( propertyName: any, getValues: any, applyCommand: any ) {

		const copyBtn = new UIButton( '' ).setWidth( '24px' );
		copyBtn.dom.title = '复制';
		styleIconButton( copyBtn );

		const copyIcon = document.createElement( 'img' );
		copyIcon.src = 'images/copy.png';
		styleActionIcon( copyIcon );
		copyBtn.dom.appendChild( copyIcon );

		const pasteBtn = new UIButton( '' ).setMarginLeft( '2px' ).setWidth( '24px' );
		pasteBtn.dom.title = '粘贴';
		styleIconButton( pasteBtn );

		const pasteIcon = document.createElement( 'img' );
		pasteIcon.src = 'images/paste.png';
		styleActionIcon( pasteIcon );
		pasteBtn.dom.appendChild( pasteIcon );

		copyBtn.onClick( function () {

			if ( editor.selected !== null ) {

				const data = getValues();
				(singlePropertyClipboard as any)[ propertyName ] = data;
				(clipboard as any)[ propertyName ] = data;
				editor.showNotification( propertyName === 'position' ? '位置数据复制成功'
					: propertyName === 'rotation' ? '旋转数据复制成功'
						: '缩放数据复制成功' );

			}

		} );

		pasteBtn.onClick( function () {

			if ( editor.selected !== null ) {

				const data = (singlePropertyClipboard as any)[ propertyName ] || (clipboard as any)[ propertyName ];
				if ( data !== null ) {

					applyCommand( data );
					editor.showNotification( propertyName === 'position' ? '位置数据粘贴成功'
						: propertyName === 'rotation' ? '旋转数据粘贴成功'
							: '缩放数据粘贴成功' );

				}

			}

		} );

		// Hidden by default – shown on row hover
		copyBtn.dom.style.display = 'none';
		pasteBtn.dom.style.display = 'none';

		return { copyBtn, pasteBtn };

	}

	// ── position copy/paste ──────────────────────────────────────────

	if ( objectPositionRow ) {

		const { copyBtn, pasteBtn } = createCopyPasteButtons(
			'position',
			() => new THREE.Vector3(
				parseFloat( (posInputs as any)[ 0 ].value ) || 0,
				parseFloat( (posInputs as any)[ 1 ].value ) || 0,
				parseFloat( (posInputs as any)[ 2 ].value ) || 0
			),
			( data: any ) => editor.execute( new SetPositionCommand( editor, editor.selected, data.clone() ) )
		);

		objectPositionRow.appendChild( copyBtn.dom );
		objectPositionRow.appendChild( pasteBtn.dom );

		objectPositionRow.addEventListener( 'mouseenter', function () {

			copyBtn.dom.style.display = 'inline-flex';
			pasteBtn.dom.style.display = 'inline-flex';

		} );

		objectPositionRow.addEventListener( 'mouseleave', function () {

			copyBtn.dom.style.display = 'none';
			pasteBtn.dom.style.display = 'none';

		} );

	}

	// ── rotation copy/paste ──────────────────────────────────────────

	if ( objectRotationRow ) {

		const { copyBtn, pasteBtn } = createCopyPasteButtons(
			'rotation',
			() => new THREE.Euler(
				( parseFloat( (rotInputs as any)[ 0 ].value ) || 0 ) * THREE.MathUtils.DEG2RAD,
				( parseFloat( (rotInputs as any)[ 1 ].value ) || 0 ) * THREE.MathUtils.DEG2RAD,
				( parseFloat( (rotInputs as any)[ 2 ].value ) || 0 ) * THREE.MathUtils.DEG2RAD
			),
			( data: any ) => editor.execute( new SetRotationCommand( editor, editor.selected, data.clone() ) )
		);

		objectRotationRow.appendChild( copyBtn.dom );
		objectRotationRow.appendChild( pasteBtn.dom );

		objectRotationRow.addEventListener( 'mouseenter', function () {

			copyBtn.dom.style.display = 'inline-flex';
			pasteBtn.dom.style.display = 'inline-flex';

		} );

		objectRotationRow.addEventListener( 'mouseleave', function () {

			copyBtn.dom.style.display = 'none';
			pasteBtn.dom.style.display = 'none';

		} );

	}

	// ── scale copy/paste ─────────────────────────────────────────────

	if ( objectScaleRow ) {

		const { copyBtn, pasteBtn } = createCopyPasteButtons(
			'scale',
			() => new THREE.Vector3(
				parseFloat( (scaleInputs as any)[ 0 ].value ) || 0,
				parseFloat( (scaleInputs as any)[ 1 ].value ) || 0,
				parseFloat( (scaleInputs as any)[ 2 ].value ) || 0
			),
			( data: any ) => editor.execute( new SetScaleCommand( editor, editor.selected, data.clone() ) )
		);

		objectScaleRow.appendChild( copyBtn.dom );
		objectScaleRow.appendChild( pasteBtn.dom );

		objectScaleRow.addEventListener( 'mouseenter', function () {

			copyBtn.dom.style.display = 'inline-flex';
			pasteBtn.dom.style.display = 'inline-flex';

		} );

		objectScaleRow.addEventListener( 'mouseleave', function () {

			copyBtn.dom.style.display = 'none';
			pasteBtn.dom.style.display = 'none';

		} );

		// Add bottom margin to scale row
		(objectScaleRow as any).style.marginBottom = '8px';

	}

	// ── reset position / rotation / scale buttons ───────────────────

	const objectResetRow = new UIRow();

	const resetPositionButton = new UIButton( strings.getKey( 'sidebar/object/resetPosition' ) )
		.setWidth( '80px' )
		.onClick( function () {

			if ( editor.selected !== null ) {

				editor.execute( new SetPositionCommand( editor, editor.selected, new THREE.Vector3( 0, 0, 0 ) ) );
				editor.showNotification( strings.getKey( 'sidebar/object/position' ) + strings.getKey( 'sidebar/object/haveReset' ) );

			}

		} );

	const resetRotationButton = new UIButton( strings.getKey( 'sidebar/object/resetRotation' ) )
		.setWidth( '80px' )
		.onClick( function () {

			if ( editor.selected !== null ) {

				editor.execute( new SetRotationCommand( editor, editor.selected, new THREE.Euler( 0, 0, 0 ) ) );
				editor.showNotification( strings.getKey( 'sidebar/object/rotation' ) + strings.getKey( 'sidebar/object/haveReset' ) );

			}

		} );

	const resetScaleButton = new UIButton( strings.getKey( 'sidebar/object/resetScale' ) )
		.setWidth( '80px' )
		.onClick( function () {

			if ( editor.selected !== null ) {

				editor.execute( new SetScaleCommand( editor, editor.selected, new THREE.Vector3( 1, 1, 1 ) ) );
				editor.showNotification( strings.getKey( 'sidebar/object/scale' ) + strings.getKey( 'sidebar/object/haveReset' ) );

			}

		} );

	objectResetRow.add( resetPositionButton );
	objectResetRow.add( resetRotationButton );
	objectResetRow.add( resetScaleButton );

	// Insert the reset row after the scale row
	if ( objectScaleRow && objectScaleRow.nextSibling ) {

		sidebarObjectContainer.insertBefore( objectResetRow.dom, objectScaleRow.nextSibling );

	} else {

		sidebarObjectContainer.appendChild( objectResetRow.dom );

	}

	// ── transform copy-all / paste-all row ───────────────────────────

	const transformActionsRow = new UIRow();

	const transformCopyButton = new UIButton( '' ).setWidth( '24px' );
	transformCopyButton.dom.title = '复制全部数据';
	styleIconButton( transformCopyButton );

	const transformCopyIcon = document.createElement( 'img' );
	transformCopyIcon.src = 'images/copy.png';
	styleActionIcon( transformCopyIcon );
	transformCopyButton.dom.appendChild( transformCopyIcon );

	transformCopyButton.onClick( function () {

		if ( editor.selected !== null ) {

			clipboard.position = new THREE.Vector3(
				parseFloat( (posInputs as any)[ 0 ].value ) || 0,
				parseFloat( (posInputs as any)[ 1 ].value ) || 0,
				parseFloat( (posInputs as any)[ 2 ].value ) || 0
			);
			clipboard.rotation = new THREE.Euler(
				( parseFloat( (rotInputs as any)[ 0 ].value ) || 0 ) * THREE.MathUtils.DEG2RAD,
				( parseFloat( (rotInputs as any)[ 1 ].value ) || 0 ) * THREE.MathUtils.DEG2RAD,
				( parseFloat( (rotInputs as any)[ 2 ].value ) || 0 ) * THREE.MathUtils.DEG2RAD
			);
			clipboard.scale = new THREE.Vector3(
				parseFloat( (scaleInputs as any)[ 0 ].value ) || 0,
				parseFloat( (scaleInputs as any)[ 1 ].value ) || 0,
				parseFloat( (scaleInputs as any)[ 2 ].value ) || 0
			);
			editor.showNotification( '全部数据复制成功' );

		}

	} );

	const transformPasteButton = new UIButton( '' ).setMarginLeft( '2px' ).setWidth( '24px' );
	transformPasteButton.dom.title = '粘贴全部数据';
	styleIconButton( transformPasteButton );

	const transformPasteIcon = document.createElement( 'img' );
	transformPasteIcon.src = 'images/paste.png';
	styleActionIcon( transformPasteIcon );
	transformPasteButton.dom.appendChild( transformPasteIcon );

	transformPasteButton.onClick( function () {

		if ( editor.selected !== null ) {

			if ( clipboard.position !== null ) {

				editor.execute( new SetPositionCommand( editor, editor.selected, (clipboard.position as any).clone() ) );

			}

			if ( clipboard.rotation !== null ) {

				editor.execute( new SetRotationCommand( editor, editor.selected, (clipboard.rotation as any).clone() ) );

			}

			if ( clipboard.scale !== null ) {

				editor.execute( new SetScaleCommand( editor, editor.selected, (clipboard.scale as any).clone() ) );

			}

			editor.showNotification( '全部数据粘贴成功' );

		}

	} );

	transformActionsRow.add( transformCopyButton );
	transformActionsRow.add( transformPasteButton );
	transformActionsRow.setDisplay( 'none' );

	// Insert after the reset row
	if ( objectResetRow.dom.nextSibling ) {

		sidebarObjectContainer.insertBefore( transformActionsRow.dom, objectResetRow.dom.nextSibling );

	} else {

		sidebarObjectContainer.appendChild( transformActionsRow.dom );

	}

	// ── hover border effect ──────────────────────────────────────────

	// Make the container position relative so we can position the border absolutely
	sidebarObjectContainer.style.position = 'relative';

	function createTransformBorder() {

		const oldBorder = sidebarObjectContainer.querySelector( '.transform-border' );
		if ( oldBorder ) sidebarObjectContainer.removeChild( oldBorder );

		const border = document.createElement( 'div' );
		border.className = 'transform-border';
		border.style.position = 'absolute';
		border.style.border = '1px dashed #888';
		border.style.borderRadius = '4px';
		border.style.pointerEvents = 'none';
		border.style.display = 'none';
		border.style.zIndex = '0';
		sidebarObjectContainer.appendChild( border );
		return border;

	}

	let transformBorder = createTransformBorder();
	let spacerRow: any = null;

	function updateBorderPosition() {

		if ( ! objectPositionRow || ! objectScaleRow ) return;

		const scrollTop = sidebarObjectContainer.scrollTop || 0;
		const scrollLeft = sidebarObjectContainer.scrollLeft || 0;
		const labelWidth = 90;
		const paddingLeft = 5;
		const dataAreaLeft = labelWidth + paddingLeft;

		const posInputX = posInputs[ 0 ];
		const posInputZ = posInputs[ 2 ];

		if ( ! posInputX || ! posInputZ ) return;

		const posRowTop = (objectPositionRow as any).offsetTop;
		const scaleRowBottom = (objectScaleRow as any).offsetTop + (objectScaleRow as any).offsetHeight;
		const dataAreaWidth = (posInputZ as any).offsetLeft + (posInputZ as any).offsetWidth - (posInputX as any).offsetLeft;

		transformBorder.style.top = ( posRowTop - scrollTop - 5 ) + 'px';
		transformBorder.style.left = ( dataAreaLeft - scrollLeft ) + 'px';
		transformBorder.style.width = dataAreaWidth + 'px';
		transformBorder.style.height = ( scaleRowBottom - posRowTop + 10 ) + 'px';

		const buttonWidth = transformCopyButton.dom.offsetWidth + transformPasteButton.dom.offsetWidth + 2;
		const buttonLeft = dataAreaLeft + ( dataAreaWidth - buttonWidth ) / 2;

		transformActionsRow.dom.style.position = 'absolute';
		transformActionsRow.dom.style.left = ( buttonLeft - scrollLeft ) + 'px';
		transformActionsRow.dom.style.top = ( scaleRowBottom - scrollTop + 5 ) + 'px';

	}

	function getSpacerRow() {

		if ( ! spacerRow ) {

			spacerRow = new UIPanel();
			spacerRow.setDisplay( 'none' );
			spacerRow.dom.style.border = 'none';
			spacerRow.dom.style.marginTop = '0';
			spacerRow.dom.style.marginBottom = '0';
			spacerRow.dom.style.height = '14px';

			if ( sidebarObjectContainer.contains( objectResetRow.dom ) ) {

				sidebarObjectContainer.insertBefore( spacerRow.dom, objectResetRow.dom );

			} else {

				sidebarObjectContainer.appendChild( spacerRow.dom );

			}

		}

		return spacerRow;

	}

	function showTransformActions() {

		transformActionsRow.setDisplay( '' );
		transformBorder.style.display = 'block';
		updateBorderPosition();
		getSpacerRow().setDisplay( '' );

	}

	function hideTransformActions() {

		transformActionsRow.setDisplay( 'none' );
		transformBorder.style.display = 'none';
		if ( spacerRow ) spacerRow.setDisplay( 'none' );

	}

	function createHoverArea() {

		const oldHoverArea = sidebarObjectContainer.querySelector( '.transform-area-overlay' );
		if ( oldHoverArea ) sidebarObjectContainer.removeChild( oldHoverArea );

		removeAllEventListeners();

		if ( ! objectPositionRow || ! objectScaleRow ) return;

		const labelWidth = 90;
		const paddingLeft = 5;
		const dataAreaLeft = labelWidth + paddingLeft;
		const posInputX = posInputs[ 0 ];
		const posInputZ = posInputs[ 2 ];

		if ( ! posInputX || ! posInputZ ) return;

		const dataAreaWidth = (posInputZ as any).offsetLeft + (posInputZ as any).offsetWidth - (posInputX as any).offsetLeft;

		let isMouseInRelevantArea = false;
		let hideTimeout: any = null;

		function isInButtonArea( event: any ) {

			const rect = transformActionsRow.dom.getBoundingClientRect();
			return (
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom
			);

		}

		function safeShowTransformActions() {

			if ( hideTimeout ) { clearTimeout( hideTimeout ); hideTimeout = null; }
			isMouseInRelevantArea = true;
			showTransformActions();

		}

		function safeHideTransformActions() {

			if ( hideTimeout ) clearTimeout( hideTimeout );
			hideTimeout = setTimeout( function () {

				if ( ! isMouseInRelevantArea ) hideTransformActions();
				hideTimeout = null;

			}, 200 );

		}

		// Transparent overlay for hit-testing
		const overlay = document.createElement( 'div' );
		overlay.className = 'transform-area-overlay';
		overlay.style.position = 'absolute';

		function updateOverlayPosition() {

			const scrollTop = sidebarObjectContainer.scrollTop || 0;
			const scrollLeft = sidebarObjectContainer.scrollLeft || 0;
			overlay.style.top = ( (objectPositionRow as any).offsetTop - scrollTop - 5 ) + 'px';
			overlay.style.left = ( dataAreaLeft - scrollLeft ) + 'px';
			overlay.style.width = dataAreaWidth + 'px';
			overlay.style.height = (
				(objectScaleRow as any).offsetTop + (objectScaleRow as any).offsetHeight - (objectPositionRow as any).offsetTop + 10
			) + 'px';

		}

		updateOverlayPosition();
		overlay.style.zIndex = '1';
		overlay.style.pointerEvents = 'none';
		sidebarObjectContainer.appendChild( overlay );

		addEventListenerWithRef( sidebarObjectContainer, 'scroll', function () {

			updateOverlayPosition();
			if ( transformActionsRow.dom.style.display !== 'none' ) updateBorderPosition();

		} );

		addEventListenerWithRef( document, 'mousemove', function ( event: any ) {

			const overlayRect = overlay.getBoundingClientRect();
			const inOverlayArea =
				event.clientX >= overlayRect.left &&
				event.clientX <= overlayRect.right &&
				event.clientY >= overlayRect.top &&
				event.clientY <= overlayRect.bottom;

			const inButtonArea = isInButtonArea( event );

			isMouseInRelevantArea =
				inOverlayArea ||
				inButtonArea ||
				transformActionsRow.dom.contains( event.target ) ||
				transformCopyButton.dom.contains( event.target ) ||
				transformPasteButton.dom.contains( event.target );

			if ( isMouseInRelevantArea ) {

				safeShowTransformActions();

			} else if ( transformActionsRow.dom.style.display !== 'none' ) {

				safeHideTransformActions();

			}

		} );

		addEventListenerWithRef( transformCopyButton.dom, 'mouseenter', function () {

			isMouseInRelevantArea = true;
			safeShowTransformActions();

		} );

		addEventListenerWithRef( transformPasteButton.dom, 'mouseenter', function () {

			isMouseInRelevantArea = true;
			safeShowTransformActions();

		} );

		addEventListenerWithRef( transformActionsRow.dom, 'mouseenter', function () {

			isMouseInRelevantArea = true;
			safeShowTransformActions();

		} );

		addEventListenerWithRef( document, 'click', function ( event: any ) {

			if (
				transformCopyButton.dom.contains( event.target ) ||
				transformPasteButton.dom.contains( event.target )
			) {

				setTimeout( function () {

					isMouseInRelevantArea = false;
					hideTransformActions();

				}, 200 );

			}

		} );

	}

	// Re-create hover area when object selection changes
	signals.objectSelected.add( function () {

		setTimeout( function () {

			createHoverArea();
			transformBorder = createTransformBorder();

		}, 100 );

	} );

	// ── edit entity button ───────────────────────────────────────────

	// Find the type row and insert the edit-entity row after it
	const objectTypeRow = findRowByLabel( strings.getKey( 'sidebar/object/type' ) );

	const objectEditEntityRow = new UIRow().setDisplay( 'none' );
	const objectEditEntityButton = new UIButton( strings.getKey( 'sidebar/object/edit_entity' ) )
		.setDisplay( 'none' )
		.onClick( function () {

			const object = editor.selected;
			if ( ! object || ! object.userData || object.userData.meta_id == null ) return;
			editor.signals.messageSend.dispatch( {
				action: 'edit-meta',
				data: { meta_id: object.userData.meta_id, uuid: object.uuid }
			} );

		} );

	objectEditEntityRow.add( objectEditEntityButton );

	// ── loop checkbox ────────────────────────────────────────────────

	const objectLoopRow = new UIRow();
	const objectLoop = new UICheckbox();

	objectLoopRow.add( new UIText( strings.getKey( 'sidebar/object/loop' ) ).setWidth( '90px' ) );
	objectLoopRow.add( objectLoop );

	// ── sortingOrder selector ────────────────────────────────────────

	const objectSortingRow = new UIRow();
	const objectSorting = new UISelect();

	objectSorting.setOptions(
		Object.fromEntries( [ 0, 1, 2 ].map( i => [ i, String( i ) ] ) )
	);

	objectSortingRow.add( new UIText( strings.getKey( 'sidebar/object/sortingOrder' ) ).setWidth( '90px' ) );
	objectSortingRow.add( objectSorting );

	// ── find the visible row and insert loop / sorting / edit-entity around it ──

	const visibleLabel = strings.getKey( 'sidebar/object/visible' );
	const objectVisibleRow = findRowByLabel( visibleLabel );

	if ( objectVisibleRow ) {

		// Insert loop row after visible row
		if ( objectVisibleRow.nextSibling ) {

			sidebarObjectContainer.insertBefore( objectLoopRow.dom, objectVisibleRow.nextSibling );

		} else {

			sidebarObjectContainer.appendChild( objectLoopRow.dom );

		}

		// Insert sorting row after loop row
		if ( objectLoopRow.dom.nextSibling ) {

			sidebarObjectContainer.insertBefore( objectSortingRow.dom, objectLoopRow.dom.nextSibling );

		} else {

			sidebarObjectContainer.appendChild( objectSortingRow.dom );

		}

	}

	// Find the UUID row and insert edit-entity row after it
	const uuidLabel = strings.getKey( 'sidebar/object/uuid' );
	const objectUUIDRow = findRowByLabel( uuidLabel );

	if ( objectUUIDRow ) {

		if ( objectUUIDRow.nextSibling ) {

			sidebarObjectContainer.insertBefore( objectEditEntityRow.dom, objectUUIDRow.nextSibling );

		} else {

			sidebarObjectContainer.appendChild( objectEditEntityRow.dom );

		}

	}

	// ── wire up onChange for loop and sorting to trigger the original update ──

	objectLoop.onChange( function () {

		const object = editor.selected;
		if ( ! object ) return;

		if ( isMediaType( object ) ) {

			if ( object.userData.loop !== objectLoop.getValue() ) {

				const userData = JSON.parse( JSON.stringify( object.userData ) );
				userData.loop = objectLoop.getValue();
				editor.execute( new SetValueCommand( editor, object, 'userData', userData ) );

			}

		}

	} );

	objectSorting.onChange( function () {

		const object = editor.selected;
		if ( ! object ) return;

		if ( isPictureType( object ) ) {

			const selectedSorting = parseInt( objectSorting.getValue(), 10 ) || 0;
			const currentSorting = ( object.userData && object.userData.sortingOrder !== undefined )
				? Number( object.userData.sortingOrder ) : 0;

			if ( currentSorting !== selectedSorting ) {

				const userData = JSON.parse( JSON.stringify( object.userData || {} ) );
				userData.sortingOrder = selectedSorting;
				object.renderOrder = 0 - userData.sortingOrder;
				editor.execute( new SetValueCommand( editor, object, 'userData', userData ) );
				signals.objectChanged.dispatch( object );

			}

		}

	} );

	// ── extend updateRows: show/hide loop, sorting, visible, type/userData access ──

	signals.objectSelected.add( function ( object: any ) {

		if ( object !== null ) {

			const selectedObjects = editor.getSelectedObjects();

			if ( selectedObjects.length <= 1 ) {

				// Single-select: apply MRPP row visibility rules
				applyMrppRowVisibility( object );
				applyMrppUIValues( object );

			}

		}

	} );

	signals.objectChanged.add( function ( object: any ) {

		if ( object !== editor.selected ) return;
		applyMrppUIValues( object );

	} );

	signals.refreshSidebarObject3D.add( function ( object: any ) {

		if ( object !== editor.selected ) return;
		applyMrppUIValues( object );

	} );

	function applyMrppRowVisibility( object: any ) {

		// Loop row: only for media types
		const isMedia = isMediaType( object );
		objectLoopRow.setDisplay( isMedia ? '' : 'none' );

		// Sorting row: only for picture types
		const isPicture = isPictureType( object );
		objectSortingRow.setDisplay( isPicture ? '' : 'none' );

		// Hide visible row for Module type
		if ( objectVisibleRow && object && object.type && typeof object.type === 'string' && object.type.toLowerCase() === 'module' ) {

			(objectVisibleRow as any).style.display = 'none';

		} else if ( objectVisibleRow ) {

			(objectVisibleRow as any).style.display = '';

		}

		// Access permission: show/hide type and userData rows
		if ( objectTypeRow ) {

			(objectTypeRow as any).style.display = editor.access.can( ABILITIES.UI_ADVANCED ) ? '' : 'none';

		}

		// Find userData row by label
		const userDataLabel = strings.getKey( 'sidebar/object/userdata' );
		const objectUserDataRow = findRowByLabel( userDataLabel );

		if ( objectUserDataRow ) {

			(objectUserDataRow as any).style.display = editor.access.can( ABILITIES.UI_ADVANCED ) ? '' : 'none';

		}

		// ── Hide r183 rows not needed in MRPP mode ──────────────────
		// Use CSS class with !important to prevent r183's own objectSelected
		// handler from re-showing these rows after our handler hides them.

		console.log( '[MRPP] allRows count:', allRows.length );
		console.log( '[MRPP] shadow key:', strings.getKey( 'sidebar/object/shadow' ) );
		const shadowTest = findRowByLabel( strings.getKey( 'sidebar/object/shadow' ) );
		console.log( '[MRPP] shadowRow found:', !!shadowTest, shadowTest );

		// UUID row
		const uuidRow = findRowByLabel( strings.getKey( 'sidebar/object/uuid' ) );
		if ( uuidRow ) uuidRow.classList.add( 'mrpp-hidden' );

		// Shadow row and sub-rows
		const shadowRow = findRowByLabel( strings.getKey( 'sidebar/object/shadow' ) );
		if ( shadowRow ) shadowRow.classList.add( 'mrpp-hidden' );

		const shadowIntensityRow = findRowByLabel( strings.getKey( 'sidebar/object/shadowIntensity' ) );
		if ( shadowIntensityRow ) shadowIntensityRow.classList.add( 'mrpp-hidden' );

		const shadowBiasRow = findRowByLabel( strings.getKey( 'sidebar/object/shadowBias' ) );
		if ( shadowBiasRow ) shadowBiasRow.classList.add( 'mrpp-hidden' );

		const shadowNormalBiasRow = findRowByLabel( strings.getKey( 'sidebar/object/shadowNormalBias' ) );
		if ( shadowNormalBiasRow ) shadowNormalBiasRow.classList.add( 'mrpp-hidden' );

		const shadowRadiusRow = findRowByLabel( strings.getKey( 'sidebar/object/shadowRadius' ) );
		if ( shadowRadiusRow ) shadowRadiusRow.classList.add( 'mrpp-hidden' );

		// frustumCulled row
		const frustumCulledRow = findRowByLabel( strings.getKey( 'sidebar/object/frustumcull' ) );
		if ( frustumCulledRow ) frustumCulledRow.classList.add( 'mrpp-hidden' );

		// renderOrder row
		const renderOrderRow = findRowByLabel( strings.getKey( 'sidebar/object/renderorder' ) );
		if ( renderOrderRow ) renderOrderRow.classList.add( 'mrpp-hidden' );

		// Export JSON button (last button in the container)
		const buttons = sidebarObjectContainer.querySelectorAll( 'button' );
		if ( buttons.length > 0 ) {

			const lastButton = buttons[ buttons.length - 1 ];
			if ( lastButton && lastButton.textContent.includes( strings.getKey( 'sidebar/object/export' ) ) ) {

				lastButton.classList.add( 'mrpp-hidden' );

			}

		}

	}

	function applyMrppUIValues( object: any ) {

		// Localized type — use setTimeout(0) to ensure this runs AFTER
		// r183's own updateUI handler, which sets objectType to object.type
		const typeLabel = strings.getKey( 'sidebar/object/type' );
		const typeRow = findRowByLabel( typeLabel );

		if ( typeRow ) {

			setTimeout( function () {

				// The second span in the type row is the value display
				const spans = typeRow.querySelectorAll( 'span' );
				for ( let i = 0; i < spans.length; i ++ ) {

					if ( spans[ i ].textContent.trim() !== typeLabel.trim() ) {

						spans[ i ].textContent = getLocalizedObjectType( object, editor );
						break;

					}

				}

			}, 0 );

		}

		// Edit entity button visibility
		const showEditEntityButton =
			editor.type &&
			editor.type.toLowerCase() === 'verse' &&
			object &&
			typeof object.type === 'string' &&
			object.type.toLowerCase() === 'module' &&
			object.userData &&
			object.userData.custom != 0 &&
			object.userData.meta_id != null;

		objectEditEntityButton.setDisplay( showEditEntityButton ? '' : 'none' );
		objectEditEntityRow.setDisplay( showEditEntityButton ? '' : 'none' );

		// Sync sortingOrder value
		try {

			const sortingVal = ( object.userData && object.userData.sortingOrder !== undefined )
				? object.userData.sortingOrder : 0;
			objectSorting.setValue( String( sortingVal ) );

		} catch ( e ) {

			objectSorting.setValue( '0' );

		}

		// Sync loop value
		if ( isMediaType( object ) ) {

			if ( object.userData && object.userData.loop !== undefined ) {

				objectLoop.setValue( object.userData.loop );

			} else {

				objectLoop.setValue( false );

			}

		}

	}

}

// ── JSON Tree Viewer ─────────────────────────────────────────────────

/**
 * Inject a read-only visual JSON tree viewer to replace the plain textarea
 * used for userData display. The textarea is hidden; the tree viewer is
 * inserted next to the label and kept in sync via objectSelected /
 * objectChanged signals.
 *
 * Does NOT depend on a pre-existing container reference — it searches
 * document-wide on each objectSelected so it works regardless of when
 * the DOM is ready.
 */
function injectUserDataJsonViewer( editor: any ): void {

	const strings = editor.strings;
	const signals = editor.signals;

	// Inject viewer styles once
	if ( ! document.getElementById( 'mrpp-json-viewer-style' ) ) {

		const style = document.createElement( 'style' );
		style.id = 'mrpp-json-viewer-style';
		style.textContent = `
.mrpp-json-viewer {
	font-family: monospace;
	font-size: 11px;
	line-height: 1.6;
	border-radius: 3px;
	padding: 4px 6px;
	max-height: 200px;
	overflow-y: auto;
	width: 150px;
	box-sizing: border-box;
	user-select: text;
	/* light mode */
	color: #333;
	background: #f5f5f5;
	border: 1px solid #ccc;
}
.mrpp-json-viewer .jv-toggle {
	cursor: pointer;
	font-size: 10px;
	margin-right: 2px;
	user-select: none;
	color: #999;
}
.mrpp-json-viewer .jv-key   { color: #0070c1; }
.mrpp-json-viewer .jv-str   { color: #a31515; }
.mrpp-json-viewer .jv-num   { color: #098658; }
.mrpp-json-viewer .jv-bool  { color: #0000ff; }
.mrpp-json-viewer .jv-null  { color: #0000ff; }
.mrpp-json-viewer .jv-brace { color: #555; }
.mrpp-json-viewer .jv-children { margin-left: 12px; }
.mrpp-json-viewer .jv-collapsed { display: none; }
.mrpp-json-viewer .jv-line { display: flex; flex-wrap: nowrap; white-space: nowrap; }
@media (prefers-color-scheme: dark) {
	.mrpp-json-viewer {
		color: #ccc;
		background: #1e1e1e;
		border-color: #444;
	}
	.mrpp-json-viewer .jv-toggle { color: #888; }
	.mrpp-json-viewer .jv-key   { color: #9cdcfe; }
	.mrpp-json-viewer .jv-str   { color: #ce9178; }
	.mrpp-json-viewer .jv-num   { color: #b5cea8; }
	.mrpp-json-viewer .jv-bool  { color: #569cd6; }
	.mrpp-json-viewer .jv-null  { color: #569cd6; }
	.mrpp-json-viewer .jv-brace { color: #888; }
}
		`;
		document.head.appendChild( style );

	}

	// ── Build tree DOM ───────────────────────────────────────────────

	function escapeHtml( s: string ): string {

		return s.replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' );

	}

	function buildNode( value: any, depth: number ): HTMLElement {

		const wrapper = document.createElement( 'span' );

		if ( value === null ) {

			const n = document.createElement( 'span' );
			n.className = 'jv-null';
			n.textContent = 'null';
			wrapper.appendChild( n );
			return wrapper;

		}

		if ( typeof value === 'boolean' ) {

			const n = document.createElement( 'span' );
			n.className = 'jv-bool';
			n.textContent = String( value );
			wrapper.appendChild( n );
			return wrapper;

		}

		if ( typeof value === 'number' ) {

			const n = document.createElement( 'span' );
			n.className = 'jv-num';
			n.textContent = String( value );
			wrapper.appendChild( n );
			return wrapper;

		}

		if ( typeof value === 'string' ) {

			const n = document.createElement( 'span' );
			n.className = 'jv-str';
			n.textContent = '"' + escapeHtml( value ) + '"';
			wrapper.appendChild( n );
			return wrapper;

		}

		if ( Array.isArray( value ) ) {

			if ( value.length === 0 ) {

				const n = document.createElement( 'span' );
				n.className = 'jv-brace';
				n.textContent = '[]';
				wrapper.appendChild( n );
				return wrapper;

			}

			const toggle = document.createElement( 'span' );
			toggle.className = 'jv-toggle';
			toggle.textContent = '▸';

			const open = document.createElement( 'span' );
			open.className = 'jv-brace';
			open.textContent = '[';

			const children = document.createElement( 'div' );
			children.className = 'jv-children jv-collapsed';

			value.forEach( ( item: any, idx: number ) => {

				const line = document.createElement( 'div' );
				line.className = 'jv-line';
				const keySpan = document.createElement( 'span' );
				keySpan.className = 'jv-key';
				keySpan.textContent = idx + ': ';
				line.appendChild( keySpan );
				line.appendChild( buildNode( item, depth + 1 ) );
				children.appendChild( line );

			} );

			const close = document.createElement( 'span' );
			close.className = 'jv-brace';
			close.textContent = ']';

			toggle.addEventListener( 'click', function () {

				const collapsed = children.classList.toggle( 'jv-collapsed' );
				toggle.textContent = collapsed ? '▸' : '▾';

			} );

			wrapper.appendChild( toggle );
			wrapper.appendChild( open );
			wrapper.appendChild( children );
			wrapper.appendChild( close );
			return wrapper;

		}

		if ( typeof value === 'object' ) {

			const keys = Object.keys( value );

			if ( keys.length === 0 ) {

				const n = document.createElement( 'span' );
				n.className = 'jv-brace';
				n.textContent = '{}';
				wrapper.appendChild( n );
				return wrapper;

			}

			const toggle = document.createElement( 'span' );
			toggle.className = 'jv-toggle';
			toggle.textContent = '▸';

			const open = document.createElement( 'span' );
			open.className = 'jv-brace';
			open.textContent = '{';

			const children = document.createElement( 'div' );
			children.className = 'jv-children jv-collapsed';

			keys.forEach( ( key: string ) => {

				const line = document.createElement( 'div' );
				line.className = 'jv-line';
				const keySpan = document.createElement( 'span' );
				keySpan.className = 'jv-key';
				keySpan.textContent = '"' + key + '": ';
				line.appendChild( keySpan );
				line.appendChild( buildNode( value[ key ], depth + 1 ) );
				children.appendChild( line );

			} );

			const close = document.createElement( 'span' );
			close.className = 'jv-brace';
			close.textContent = '}';

			toggle.addEventListener( 'click', function () {

				const collapsed = children.classList.toggle( 'jv-collapsed' );
				toggle.textContent = collapsed ? '▸' : '▾';

			} );

			wrapper.appendChild( toggle );
			wrapper.appendChild( open );
			wrapper.appendChild( children );
			wrapper.appendChild( close );
			return wrapper;

		}

		// fallback
		wrapper.textContent = String( value );
		return wrapper;

	}

	// ── Find the userData row ────────────────────────────────────────

	const userDataLabel = strings.getKey( 'sidebar/object/userdata' );

	function findUserDataRow(): Element | null {

		const rows = document.querySelectorAll( '.Row' );
		for ( let i = 0; i < rows.length; i ++ ) {

			const spans = rows[ i ].querySelectorAll( 'span' );
			for ( let j = 0; j < spans.length; j ++ ) {

				if ( spans[ j ].textContent!.trim() === userDataLabel.trim() ) return rows[ i ];

			}

		}

		return null;

	}

	// ── Create the viewer element ────────────────────────────────────

	const viewer = document.createElement( 'div' );
	viewer.className = 'mrpp-json-viewer';

	function renderViewer( data: any ): void {

		while ( viewer.firstChild ) viewer.removeChild( viewer.firstChild );

		if ( data === null || data === undefined || Object.keys( data ).length === 0 ) {

			const empty = document.createElement( 'span' );
			empty.className = 'jv-brace';
			empty.textContent = '{}';
			viewer.appendChild( empty );
			return;

		}

		viewer.appendChild( buildNode( data, 0 ) );

	}

	// ── Inject viewer into the row, hide textarea ────────────────────

	function injectIntoRow(): void {

		const row = findUserDataRow();
		if ( ! row ) return;

		// Already injected?
		if ( row.contains( viewer ) ) return;

		// Hide the original textarea
		const textarea = row.querySelector( 'textarea' );
		if ( textarea ) ( textarea as HTMLElement ).style.display = 'none';

		row.appendChild( viewer );

	}

	// ── Sync on selection / change ───────────────────────────────────

	function syncViewer( object: any ): void {

		injectIntoRow();
		renderViewer( object ? object.userData : null );

	}

	signals.objectSelected.add( function ( object: any ) {

		setTimeout( function () { syncViewer( object ); }, 0 );

	} );

	signals.objectChanged.add( function ( object: any ) {

		if ( object !== editor.selected ) return;
		syncViewer( object );

	} );

	signals.refreshSidebarObject3D.add( function ( object: any ) {

		if ( object !== editor.selected ) return;
		syncViewer( object );

	} );

	// Initial inject attempt (in case an object is already selected)
	setTimeout( injectIntoRow, 200 );

}

export { injectSidebarObjectExtensions, injectUserDataJsonViewer, getLocalizedObjectType };
