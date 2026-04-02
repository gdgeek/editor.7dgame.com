import * as THREE from 'three';

import { UIPanel, UIDiv, UIRow, UIInput, UIButton, UIColor, UICheckbox, UIText, UINumber, UISelect } from './libs/ui.js';
import { UIBoolean } from './libs/ui.three.js';

import { SetValueCommand } from './commands/SetValueCommand.js';
import { SetPositionCommand } from './commands/SetPositionCommand.js';
import { SetRotationCommand } from './commands/SetRotationCommand.js';
import { SetScaleCommand } from './commands/SetScaleCommand.js';
import { SetColorCommand } from './commands/SetColorCommand.js';
import { SetShadowValueCommand } from './commands/SetShadowValueCommand.js';

function getLocalizedObjectType( object, editor ) {

	const strings = editor.strings;
	const rawType = ( object.userData && object.userData.type ) || object.type || '';
	const normalizedType = String( rawType ).toLowerCase();
	const normalizedName = String( object && object.name ? object.name : '' ).trim();
	const isPointLikeName = /^Point(?:\s*\(\d+\))?$/i.test( normalizedName );
	const isSceneEntity = !! ( editor.type && editor.type.toLowerCase() === 'verse' && object && object.userData && object.userData.meta_id != null );

	if ( isPointLikeName && ! isSceneEntity ) {

		const localizedPointType = strings.getKey( 'sidebar/object/type_value/point' );
		if ( localizedPointType !== '???' ) return localizedPointType;

	}

	if ( editor.type && editor.type.toLowerCase() === 'verse' && normalizedType === 'module' ) {

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

	const translationKey = typeKeyMap[ normalizedType ];
	if ( translationKey ) {

		const localizedType = strings.getKey( translationKey );
		if ( localizedType !== '???' ) return localizedType;

	}

	return rawType;

}

function sanitizeObjectName( name ) {

	return String( name || '' ).replace( /\s*\[(polygen|picture|video|sound|audio|text|point|prototype|entity|module)\]\s*$/i, '' );

}

function isMediaType( object ) {

	if ( object.userData && object.userData.type ) {

		const type = String( object.userData.type ).toLowerCase();
		if ( type === 'video' || type === 'sound' || type === 'audio' ) return true;

	}

	if ( object.name ) {

		const name = String( object.name ).toLowerCase();
		if (
			name.includes( '[video]' ) ||
			name.includes( '[sound]' ) ||
			name.endsWith( '.mp4' ) ||
			name.endsWith( '.mp3' ) ||
			name.endsWith( '.wav' ) ||
			name.endsWith( '.ogg' )
		) return true;

	}

	return false;

}

function isPictureType( object ) {

	if ( ! object ) return false;

	if ( object.userData && object.userData.type ) {

		const type = String( object.userData.type ).toLowerCase();
		if ( type === 'picture' ) return true;

	}

	if ( object.name ) {

		const name = String( object.name ).toLowerCase();
		if (
			name.includes( '[picture]' ) ||
			name.includes( '[photo]' ) ||
			name.endsWith( '.png' ) ||
			name.endsWith( '.jpg' ) ||
			name.endsWith( '.jpeg' ) ||
			name.endsWith( '.webp' )
		) return true;

	}

	return false;

}

function getSceneEntitySignalGroups( object, editor ) {

	const emptySignals = { inputs: [], outputs: [] };
	if ( ! object || ! object.userData || object.userData.meta_id == null ) return emptySignals;

	const directMetaEvents = object.metaEvents || object.userData.meta_events;
	if ( directMetaEvents ) return directMetaEvents;

	const metaId = String( object.userData.meta_id );
	const metaEventsById = editor.data && editor.data.metaEventsById;

	if ( metaEventsById ) {

		if ( typeof metaEventsById.get === 'function' ) {

			return metaEventsById.get( metaId ) || emptySignals;

		}

		return metaEventsById[ metaId ] || emptySignals;

	}

	return emptySignals;

}

function getSignalLabelList( list ) {

	if ( ! Array.isArray( list ) || list.length === 0 ) return [];

	return list.map( function ( item, index ) {

		if ( typeof item === 'string' ) return item;
		return String( item.title ?? item.name ?? item.label ?? item.uuid ?? ( index + 1 ) );

	} );

}

function getSignalPlaceholderLabel( strings, mode ) {

	const baseKey = mode === 'input' ? 'sidebar/entities/signals_input' : 'sidebar/entities/signals_output';
	const baseLabel = strings.getKey( baseKey );

	if ( baseLabel === '输入信号' ) return '查看输入信号';
	if ( baseLabel === '输出信号' ) return '查看输出信号';
	if ( baseLabel === '輸入信號' ) return '查看輸入信號';
	if ( baseLabel === '輸出信號' ) return '查看輸出信號';
	if ( baseLabel === 'Input Signals' ) return 'View Input Signals';
	if ( baseLabel === 'Output Signals' ) return 'View Output Signals';

	return mode === 'input' ? '查看输入信号' : '查看输出信号';

}

function styleIconButton( button ) {

	button.dom.style.display = 'inline-flex';
	button.dom.style.alignItems = 'center';
	button.dom.style.justifyContent = 'center';
	button.dom.style.padding = '0';

}

function styleActionIcon( icon ) {

	icon.style.width = '15px';
	icon.style.height = '15px';
	icon.style.display = 'block';
	icon.style.margin = '0 auto';

}

function styleTextActionButton( button, width ) {

	button.dom.style.display = 'inline-flex';
	button.dom.style.alignItems = 'center';
	button.dom.style.justifyContent = 'flex-start';
	button.dom.style.boxSizing = 'border-box';
	button.dom.style.height = '24px';
	button.dom.style.padding = '0 8px';
	button.dom.style.borderRadius = '4px';
	button.dom.style.backgroundColor = '#ddd';
	button.dom.style.color = '#666';
	button.dom.style.fontSize = '12px';
	button.dom.style.textTransform = 'none';
	button.dom.style.whiteSpace = 'nowrap';

	if ( width ) {

		button.dom.style.width = width;

	}

}

function createTextActionButtonControl( label, width, onClick ) {

	const wrapper = new UIDiv();
	wrapper.dom.style.display = 'inline-flex';
	wrapper.dom.style.alignItems = 'center';

	const button = document.createElement( 'div' );
	button.className = 'Button';
	button.textContent = label;
	button.style.display = 'inline-flex';
	button.style.alignItems = 'center';
	button.style.justifyContent = 'flex-start';
	button.style.boxSizing = 'border-box';
	button.style.height = '24px';
	button.style.padding = '0 8px';
	button.style.borderRadius = '4px';
	button.style.backgroundColor = '#ddd';
	button.style.color = '#666';
	button.style.fontSize = '12px';
	button.style.textTransform = 'none';
	button.style.whiteSpace = 'nowrap';
	button.style.cursor = 'pointer';
	button.style.userSelect = 'none';
	button.style.lineHeight = '24px';
	button.style.flex = '0 0 auto';
	button.style.minWidth = width || '60px';
	button.style.border = '1px solid #d8d8d8';
	if ( width ) {

		button.style.width = width;

	}

	button.addEventListener( 'click', onClick );
	wrapper.dom.appendChild( button );

	return {
		wrapper,
		button,
		setLabel( value ) {

			button.textContent = value;

		}
	};

}

function resetObjectPanelScroll( container ) {

	const scrollTargets = [
		container.dom,
		container.dom.parentElement,
		container.dom.closest( '#objectTab' ),
		container.dom.closest( '.Panels' )
	].filter( Boolean );

	requestAnimationFrame( function () {

		for ( let i = 0; i < scrollTargets.length; i ++ ) {

			scrollTargets[ i ].scrollTop = 0;

		}

	} );

}

function cleanupLegacyTransformArtifacts( container ) {

	const artifactSelectors = [ '.transform-area-overlay' ];

	for ( let i = 0; i < artifactSelectors.length; i ++ ) {

		const nodes = container.dom.querySelectorAll( artifactSelectors[ i ] );
		nodes.forEach( function ( node ) {

			node.remove();

		} );

	}

	Array.from( container.dom.children ).forEach( function ( child ) {

		const element = /** @type {HTMLElement} */ ( child );
		if (
			element.classList.contains( 'Panel' ) &&
			element.childElementCount === 0 &&
			element.textContent.trim() === '' &&
			element.style.height === '14px'
		) {

			element.remove();

		}

	} );

}

function SidebarObject( editor ) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop( '0' );
	container.setPaddingTop( '20px' );
	container.setDisplay( 'none' );
	container.dom.style.position = 'relative';

	const clipboard = { position: null, rotation: null, scale: null };
	const singlePropertyClipboard = { position: null, rotation: null, scale: null };
	const eventListeners = [];
	let signalPopup = null;
	let signalPopupMode = '';
	let signalPopupOutsideHandler = null;
	let signalPopupResizeHandler = null;
	let currentInputSignalLabels = [];
	let currentOutputSignalLabels = [];

	function removeAllEventListeners() {

		for ( let i = 0; i < eventListeners.length; i ++ ) {

			const listener = eventListeners[ i ];
			listener.element.removeEventListener( listener.type, listener.callback );

		}

		eventListeners.length = 0;

	}

	function addEventListenerWithRef( element, type, callback ) {

		element.addEventListener( type, callback );
		eventListeners.push( { element, type, callback } );

	}

	function hideSignalPopup() {

		if ( signalPopup && signalPopup.parentNode ) {

			signalPopup.parentNode.removeChild( signalPopup );

		}

		signalPopup = null;
		signalPopupMode = '';

		if ( signalPopupOutsideHandler ) {

			document.removeEventListener( 'mousedown', signalPopupOutsideHandler, true );
			signalPopupOutsideHandler = null;

		}

		if ( signalPopupResizeHandler ) {

			window.removeEventListener( 'resize', signalPopupResizeHandler );
			window.removeEventListener( 'scroll', signalPopupResizeHandler, true );
			signalPopupResizeHandler = null;

		}

	}

	function showSignalPopup( anchor, title, labels, mode ) {

		if ( signalPopup && signalPopupMode === mode ) {

			hideSignalPopup();
			return;

		}

		hideSignalPopup();

		const popup = document.createElement( 'div' );
		popup.style.position = 'fixed';
		popup.style.zIndex = '1000';
		popup.style.minWidth = Math.max( anchor.getBoundingClientRect().width, 160 ) + 'px';
		popup.style.maxWidth = '220px';
		popup.style.background = '#ffffff';
		popup.style.borderRadius = '10px';
		popup.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.16)';
		popup.style.padding = '8px 0';
		popup.style.boxSizing = 'border-box';

		const header = document.createElement( 'div' );
		header.textContent = title;
		header.style.padding = '2px 12px 8px';
		header.style.fontSize = '12px';
		header.style.color = '#777';
		header.style.fontWeight = 'bold';
		popup.appendChild( header );

		const values = Array.isArray( labels ) ? labels : [];
		if ( values.length === 0 ) {

			const empty = document.createElement( 'div' );
			empty.textContent = '-';
			empty.style.padding = '6px 12px';
			empty.style.fontSize = '12px';
			empty.style.color = '#999';
			popup.appendChild( empty );

		} else {

			for ( let i = 0; i < values.length; i ++ ) {

				const item = document.createElement( 'div' );
				item.textContent = values[ i ];
				item.style.padding = '6px 12px';
				item.style.fontSize = '12px';
				item.style.color = '#333';
				item.style.whiteSpace = 'nowrap';
				popup.appendChild( item );

			}

		}

		document.body.appendChild( popup );

		const positionPopup = function () {

			const rect = anchor.getBoundingClientRect();
			const popupRect = popup.getBoundingClientRect();
			let left = rect.left;
			let top = rect.bottom + 6;

			if ( left + popupRect.width > window.innerWidth - 8 ) {

				left = window.innerWidth - popupRect.width - 8;

			}

			if ( top + popupRect.height > window.innerHeight - 8 ) {

				top = rect.top - popupRect.height - 6;

			}

			popup.style.left = Math.max( 8, left ) + 'px';
			popup.style.top = Math.max( 8, top ) + 'px';

		};

		positionPopup();

		signalPopup = popup;
		signalPopupMode = mode;

		signalPopupOutsideHandler = function ( event ) {

			if ( ! popup.contains( event.target ) && ! anchor.contains( event.target ) ) {

				hideSignalPopup();

			}

		};

		signalPopupResizeHandler = function () {

			hideSignalPopup();

		};

		document.addEventListener( 'mousedown', signalPopupOutsideHandler, true );
		window.addEventListener( 'resize', signalPopupResizeHandler );
		window.addEventListener( 'scroll', signalPopupResizeHandler, true );

	}

	const objectTypeRow = new UIRow();
	const objectType = new UIText();
	const objectEditEntityControl = createTextActionButtonControl( strings.getKey( 'sidebar/object/edit_entity' ), '', function () {

		const object = editor.selected;
		if ( ! object || ! object.userData || object.userData.meta_id == null ) return;

		editor.signals.messageSend.dispatch( {
			action: 'edit-meta',
			data: { meta_id: object.userData.meta_id, uuid: object.uuid }
		} );

	} );
	const objectEditEntityButton = objectEditEntityControl.wrapper
		.setMarginLeft( '8px' )
		.setDisplay( 'none' );
	objectTypeRow.add( new UIText( strings.getKey( 'sidebar/object/type' ) ).setWidth( '90px' ) );
	objectTypeRow.add( objectType );
	objectTypeRow.add( objectEditEntityButton );
	container.add( objectTypeRow );

	const objectNameRow = new UIRow();
	const objectName = new UIInput().setWidth( '150px' ).setFontSize( '12px' ).onChange( function () {

		editor.execute( new SetValueCommand( editor, editor.selected, 'name', sanitizeObjectName( objectName.getValue() ) ) );

	} );
	objectNameRow.add( new UIText( strings.getKey( 'sidebar/object/name' ) ).setWidth( '90px' ) );
	objectNameRow.add( objectName );
	container.add( objectNameRow );

	function createPropertyClipboardButtons( propertyName, getValues, applyCommand, copyMessage, pasteMessage, resetAction ) {

		const copyButton = new UIButton( '' ).setWidth( '26px' ).onClick( function () {

			if ( editor.selected === null ) return;
			const data = getValues();
			singlePropertyClipboard[ propertyName ] = data;
			clipboard[ propertyName ] = data;
			editor.showNotification( copyMessage );

		} );
		copyButton.dom.title = strings.getKey( 'sidebar/material/copy' );
		styleIconButton( copyButton );
		const copyIcon = document.createElement( 'img' );
		copyIcon.src = 'images/copy.png';
		styleActionIcon( copyIcon );
		copyButton.dom.appendChild( copyIcon );

		const pasteButton = new UIButton( '' ).setMarginLeft( '2px' ).setWidth( '26px' ).onClick( function () {

			if ( editor.selected === null ) return;
			const data = singlePropertyClipboard[ propertyName ] || clipboard[ propertyName ];
			if ( data === null ) return;
			applyCommand( data );
			editor.showNotification( pasteMessage );

		} );
		pasteButton.dom.title = strings.getKey( 'sidebar/material/paste' );
		styleIconButton( pasteButton );
		const pasteIcon = document.createElement( 'img' );
		pasteIcon.src = 'images/paste.png';
		styleActionIcon( pasteIcon );
		pasteButton.dom.appendChild( pasteIcon );

		const resetButton = new UIButton( '' ).setMarginLeft( '2px' ).setWidth( '26px' ).onClick( function () {

			if ( editor.selected === null ) return;
			resetAction();

		} );
		resetButton.dom.title = 'Reset';
		styleIconButton( resetButton );
		const resetIcon = document.createElement( 'span' );
		resetIcon.textContent = '↺';
		resetIcon.style.display = 'block';
		resetIcon.style.margin = '0 auto';
		resetIcon.style.fontSize = '15px';
		resetIcon.style.lineHeight = '1';
		resetIcon.style.color = '#888';
		resetButton.dom.appendChild( resetIcon );

		copyButton.dom.style.display = 'none';
		pasteButton.dom.style.display = 'none';
		resetButton.dom.style.display = 'none';

		return { copyButton, pasteButton, resetButton };

	}

	const objectTransformAxisHeaderRow = new UIRow();
	objectTransformAxisHeaderRow.setMarginTop( '4px' );
	objectTransformAxisHeaderRow.setMarginBottom( '4px' );
	const objectTransformLabelText = strings.getKey( 'sidebar/object/transform' ) !== '???'
		? strings.getKey( 'sidebar/object/transform' )
		: '变换';
	const objectTransformAxisLabel = new UIText( objectTransformLabelText ).setWidth( '90px' );
	const objectTransformAxisX = new UIText( 'X' ).setWidth( '40px' ).setTextAlign( 'center' );
	const objectTransformAxisY = new UIText( 'Y' ).setWidth( '40px' ).setTextAlign( 'center' );
	const objectTransformAxisZ = new UIText( 'Z' ).setWidth( '40px' ).setTextAlign( 'center' );
	objectTransformAxisX.dom.style.color = '#ff4466';
	objectTransformAxisY.dom.style.color = '#4caf50';
	objectTransformAxisZ.dom.style.color = '#4488ff';
	objectTransformAxisX.dom.style.fontSize = '11px';
	objectTransformAxisY.dom.style.fontSize = '11px';
	objectTransformAxisZ.dom.style.fontSize = '11px';
	objectTransformAxisHeaderRow.add( objectTransformAxisLabel, objectTransformAxisX, objectTransformAxisY, objectTransformAxisZ );
	container.add( objectTransformAxisHeaderRow );

	const objectPositionRow = new UIRow();
	const objectPositionX = new UINumber().setPrecision( 3 ).setWidth( '40px' ).onChange( update );
	const objectPositionY = new UINumber().setPrecision( 3 ).setWidth( '40px' ).onChange( update );
	const objectPositionZ = new UINumber().setPrecision( 3 ).setWidth( '40px' ).onChange( update );
	const positionButtons = createPropertyClipboardButtons(
		'position',
		() => new THREE.Vector3( objectPositionX.getValue(), objectPositionY.getValue(), objectPositionZ.getValue() ),
		( data ) => editor.execute( new SetPositionCommand( editor, editor.selected, data.clone() ) ),
		strings.getKey( 'sidebar/multi_objects/copy_position_success' ),
		strings.getKey( 'sidebar/multi_objects/paste_position_success' ),
		() => {

			editor.execute( new SetPositionCommand( editor, editor.selected, new THREE.Vector3( 0, 0, 0 ) ) );
			editor.showNotification( strings.getKey( 'sidebar/object/position' ) + strings.getKey( 'sidebar/object/haveReset' ) );

		}
	);
	objectPositionRow.dom.addEventListener( 'mouseenter', function () {

		positionButtons.copyButton.dom.style.display = 'inline-flex';
		positionButtons.pasteButton.dom.style.display = 'inline-flex';
		positionButtons.resetButton.dom.style.display = 'inline-flex';

	} );
	objectPositionRow.dom.addEventListener( 'mouseleave', function () {

		positionButtons.copyButton.dom.style.display = 'none';
		positionButtons.pasteButton.dom.style.display = 'none';
		positionButtons.resetButton.dom.style.display = 'none';

	} );
	objectPositionRow.add( new UIText( strings.getKey( 'sidebar/object/position' ) ).setWidth( '90px' ) );
	objectPositionRow.add( objectPositionX, objectPositionY, objectPositionZ );
	objectPositionRow.add( positionButtons.copyButton, positionButtons.pasteButton, positionButtons.resetButton );
	container.add( objectPositionRow );

	const objectRotationRow = new UIRow();
	const objectRotationX = new UINumber().setStep( 10 ).setNudge( 0.1 ).setUnit( '°' ).setWidth( '40px' ).onChange( update );
	const objectRotationY = new UINumber().setStep( 10 ).setNudge( 0.1 ).setUnit( '°' ).setWidth( '40px' ).onChange( update );
	const objectRotationZ = new UINumber().setStep( 10 ).setNudge( 0.1 ).setUnit( '°' ).setWidth( '40px' ).onChange( update );
	const rotationButtons = createPropertyClipboardButtons(
		'rotation',
		() => new THREE.Euler(
			objectRotationX.getValue() * THREE.MathUtils.DEG2RAD,
			objectRotationY.getValue() * THREE.MathUtils.DEG2RAD,
			objectRotationZ.getValue() * THREE.MathUtils.DEG2RAD
		),
		( data ) => editor.execute( new SetRotationCommand( editor, editor.selected, data.clone() ) ),
		strings.getKey( 'sidebar/multi_objects/copy_rotation_success' ),
		strings.getKey( 'sidebar/multi_objects/paste_rotation_success' ),
		() => {

			editor.execute( new SetRotationCommand( editor, editor.selected, new THREE.Euler( 0, 0, 0 ) ) );
			editor.showNotification( strings.getKey( 'sidebar/object/rotation' ) + strings.getKey( 'sidebar/object/haveReset' ) );

		}
	);
	objectRotationRow.dom.addEventListener( 'mouseenter', function () {

		rotationButtons.copyButton.dom.style.display = 'inline-flex';
		rotationButtons.pasteButton.dom.style.display = 'inline-flex';
		rotationButtons.resetButton.dom.style.display = 'inline-flex';

	} );
	objectRotationRow.dom.addEventListener( 'mouseleave', function () {

		rotationButtons.copyButton.dom.style.display = 'none';
		rotationButtons.pasteButton.dom.style.display = 'none';
		rotationButtons.resetButton.dom.style.display = 'none';

	} );
	objectRotationRow.add( new UIText( strings.getKey( 'sidebar/object/rotation' ) ).setWidth( '90px' ) );
	objectRotationRow.add( objectRotationX, objectRotationY, objectRotationZ );
	objectRotationRow.add( rotationButtons.copyButton, rotationButtons.pasteButton, rotationButtons.resetButton );
	container.add( objectRotationRow );

	const objectScaleRow = new UIRow();
	const objectScaleX = new UINumber( 1 ).setPrecision( 3 ).setWidth( '40px' ).onChange( update );
	const objectScaleY = new UINumber( 1 ).setPrecision( 3 ).setWidth( '40px' ).onChange( update );
	const objectScaleZ = new UINumber( 1 ).setPrecision( 3 ).setWidth( '40px' ).onChange( update );
	const scaleButtons = createPropertyClipboardButtons(
		'scale',
		() => new THREE.Vector3( objectScaleX.getValue(), objectScaleY.getValue(), objectScaleZ.getValue() ),
		( data ) => editor.execute( new SetScaleCommand( editor, editor.selected, data.clone() ) ),
		strings.getKey( 'sidebar/multi_objects/copy_scale_success' ),
		strings.getKey( 'sidebar/multi_objects/paste_scale_success' ),
		() => {

			editor.execute( new SetScaleCommand( editor, editor.selected, new THREE.Vector3( 1, 1, 1 ) ) );
			editor.showNotification( strings.getKey( 'sidebar/object/scale' ) + strings.getKey( 'sidebar/object/haveReset' ) );

		}
	);
	objectScaleRow.dom.addEventListener( 'mouseenter', function () {

		scaleButtons.copyButton.dom.style.display = 'inline-flex';
		scaleButtons.pasteButton.dom.style.display = 'inline-flex';
		scaleButtons.resetButton.dom.style.display = 'inline-flex';

	} );
	objectScaleRow.dom.addEventListener( 'mouseleave', function () {

		scaleButtons.copyButton.dom.style.display = 'none';
		scaleButtons.pasteButton.dom.style.display = 'none';
		scaleButtons.resetButton.dom.style.display = 'none';

	} );
	objectScaleRow.add( new UIText( strings.getKey( 'sidebar/object/scale' ) ).setWidth( '90px' ) );
	objectScaleRow.add( objectScaleX, objectScaleY, objectScaleZ );
	objectScaleRow.add( scaleButtons.copyButton, scaleButtons.pasteButton, scaleButtons.resetButton );
	objectScaleRow.setMarginBottom( '8px' );
	container.add( objectScaleRow );

	const objectResetRow = new UIRow();
	objectResetRow.setMarginTop( '4px' );
	objectResetRow.setDisplay( '' );
	objectResetRow.dom.style.position = 'relative';
	objectResetRow.dom.style.zIndex = '2';
	objectResetRow.dom.style.display = 'grid';
	objectResetRow.dom.style.gridTemplateColumns = '90px minmax(0, 1fr)';
	objectResetRow.dom.style.columnGap = '0';
	objectResetRow.dom.style.rowGap = '4px';
	objectResetRow.dom.style.alignItems = 'start';
	objectResetRow.dom.style.clear = 'both';
	const resetPositionButton = new UIButton( strings.getKey( 'sidebar/object/resetPosition' ) ).setWidth( '56px' ).onClick( function () {

		if ( editor.selected === null ) return;
		editor.execute( new SetPositionCommand( editor, editor.selected, new THREE.Vector3( 0, 0, 0 ) ) );
		editor.showNotification( strings.getKey( 'sidebar/object/position' ) + strings.getKey( 'sidebar/object/haveReset' ) );

	} );
	const resetRotationButton = new UIButton( strings.getKey( 'sidebar/object/resetRotation' ) ).setWidth( '56px' ).onClick( function () {

		if ( editor.selected === null ) return;
		editor.execute( new SetRotationCommand( editor, editor.selected, new THREE.Euler( 0, 0, 0 ) ) );
		editor.showNotification( strings.getKey( 'sidebar/object/rotation' ) + strings.getKey( 'sidebar/object/haveReset' ) );

	} );
	const resetScaleButton = new UIButton( strings.getKey( 'sidebar/object/resetScale' ) ).setWidth( '56px' ).onClick( function () {

		if ( editor.selected === null ) return;
		editor.execute( new SetScaleCommand( editor, editor.selected, new THREE.Vector3( 1, 1, 1 ) ) );
		editor.showNotification( strings.getKey( 'sidebar/object/scale' ) + strings.getKey( 'sidebar/object/haveReset' ) );

	} );
	const resetLabelText = strings.getKey( 'sidebar/object/reset' );
	const objectResetLabel = new UIText( resetLabelText === '???' ? '重置' : resetLabelText ).setWidth( '90px' );
	const objectResetButtons = new UIDiv();
	objectResetButtons.dom.style.display = 'flex';
	objectResetButtons.dom.style.gap = '2px';
	objectResetButtons.dom.style.flexWrap = 'wrap';
	objectResetButtons.dom.style.width = '100%';
	objectResetButtons.dom.style.flex = '1 1 auto';
	objectResetButtons.dom.style.minWidth = '0';
	resetPositionButton.dom.style.fontSize = '11px';
	resetRotationButton.dom.style.fontSize = '11px';
	resetScaleButton.dom.style.fontSize = '11px';
	objectResetButtons.add( resetPositionButton, resetRotationButton, resetScaleButton );
	objectResetRow.add( objectResetLabel, objectResetButtons );

	const transformActionsRow = new UIRow();
	transformActionsRow.dom.style.zIndex = '3';
	const transformCopyButton = new UIButton( '' ).setWidth( '26px' ).onClick( function () {

		if ( editor.selected === null ) return;
		clipboard.position = new THREE.Vector3( objectPositionX.getValue(), objectPositionY.getValue(), objectPositionZ.getValue() );
		clipboard.rotation = new THREE.Euler(
			objectRotationX.getValue() * THREE.MathUtils.DEG2RAD,
			objectRotationY.getValue() * THREE.MathUtils.DEG2RAD,
			objectRotationZ.getValue() * THREE.MathUtils.DEG2RAD
		);
		clipboard.scale = new THREE.Vector3( objectScaleX.getValue(), objectScaleY.getValue(), objectScaleZ.getValue() );
		editor.showNotification( strings.getKey( 'sidebar/multi_objects/copy_transform_success' ) );

	} );
	transformCopyButton.dom.title = strings.getKey( 'sidebar/multi_objects/copy_transform' );
	styleIconButton( transformCopyButton );
	const transformCopyIcon = document.createElement( 'img' );
	transformCopyIcon.src = 'images/copy.png';
	styleActionIcon( transformCopyIcon );
	transformCopyButton.dom.appendChild( transformCopyIcon );

	const transformPasteButton = new UIButton( '' ).setMarginLeft( '2px' ).setWidth( '26px' ).onClick( function () {

		if ( editor.selected === null ) return;
		if ( clipboard.position !== null ) editor.execute( new SetPositionCommand( editor, editor.selected, clipboard.position.clone() ) );
		if ( clipboard.rotation !== null ) editor.execute( new SetRotationCommand( editor, editor.selected, clipboard.rotation.clone() ) );
		if ( clipboard.scale !== null ) editor.execute( new SetScaleCommand( editor, editor.selected, clipboard.scale.clone() ) );
		editor.showNotification( strings.getKey( 'sidebar/multi_objects/paste_transform_success' ) );

	} );
	transformPasteButton.dom.title = strings.getKey( 'sidebar/multi_objects/paste_transform' );
	styleIconButton( transformPasteButton );
	const transformPasteIcon = document.createElement( 'img' );
	transformPasteIcon.src = 'images/paste.png';
	styleActionIcon( transformPasteIcon );
	transformPasteButton.dom.appendChild( transformPasteIcon );
	const transformResetButton = new UIButton( '' ).setMarginLeft( '2px' ).setWidth( '26px' ).onClick( function () {

		if ( editor.selected === null ) return;
		editor.execute( new SetPositionCommand( editor, editor.selected, new THREE.Vector3( 0, 0, 0 ) ) );
		editor.execute( new SetRotationCommand( editor, editor.selected, new THREE.Euler( 0, 0, 0 ) ) );
		editor.execute( new SetScaleCommand( editor, editor.selected, new THREE.Vector3( 1, 1, 1 ) ) );
		editor.showNotification( strings.getKey( 'sidebar/object/haveReset' ) );

	} );
	transformResetButton.dom.title = 'Reset Transform';
	styleIconButton( transformResetButton );
	const transformResetIcon = document.createElement( 'span' );
	transformResetIcon.textContent = '↺';
	transformResetIcon.style.display = 'block';
	transformResetIcon.style.margin = '0 auto';
	transformResetIcon.style.fontSize = '15px';
	transformResetIcon.style.lineHeight = '1';
	transformResetIcon.style.color = '#888';
	transformResetButton.dom.appendChild( transformResetIcon );
	transformActionsRow.add( transformCopyButton, transformPasteButton, transformResetButton );
	transformActionsRow.setDisplay( 'none' );
	container.add( transformActionsRow );
	container.add( objectResetRow );

	const createTransformBorder = function () {

		const oldBorder = container.dom.querySelector( '.transform-border' );
		if ( oldBorder ) oldBorder.remove();

		const transformBorder = document.createElement( 'div' );
		transformBorder.className = 'transform-border';
		transformBorder.style.position = 'absolute';
		transformBorder.style.border = '1px dashed #888';
		transformBorder.style.borderRadius = '4px';
		transformBorder.style.pointerEvents = 'none';
		transformBorder.style.display = 'none';
		transformBorder.style.zIndex = '0';
		container.dom.appendChild( transformBorder );

		return transformBorder;

	};

	let transformBorder = createTransformBorder();
	let spacerRow = null;

	const clearTransformHoverArtifacts = function () {

		removeAllEventListeners();
		const overlay = container.dom.querySelector( '.transform-area-overlay' );
		if ( overlay ) overlay.remove();
		const legacyHoverArea = container.dom.querySelector( '.transform-hover-area' );
		if ( legacyHoverArea ) legacyHoverArea.remove();

	};

	const updateBorderPosition = function () {

		if ( ! objectPositionRow.dom || ! objectScaleRow.dom ) return;

		const labelWidth = 90;
		const paddingLeft = 5;
		const dataAreaLeft = labelWidth + paddingLeft;
		const posInputX = objectPositionX.dom;
		const posInputZ = objectPositionZ.dom;
		const dataAreaWidth = posInputZ.offsetLeft + posInputZ.offsetWidth - posInputX.offsetLeft;
		const posRowTop = objectPositionRow.dom.offsetTop;
		const scaleRowBottom = objectScaleRow.dom.offsetTop + objectScaleRow.dom.offsetHeight;

		transformBorder.style.top = ( posRowTop - 5 ) + 'px';
		transformBorder.style.left = dataAreaLeft + 'px';
		transformBorder.style.width = dataAreaWidth + 'px';
		transformBorder.style.height = ( scaleRowBottom - posRowTop + 10 ) + 'px';

		const buttonWidth = transformCopyButton.dom.offsetWidth + transformPasteButton.dom.offsetWidth + transformResetButton.dom.offsetWidth + 4;
		const buttonLeft = dataAreaLeft + ( dataAreaWidth - buttonWidth ) / 2;
		const buttonTop = scaleRowBottom + 5;

		transformActionsRow.dom.style.position = 'absolute';
		transformActionsRow.dom.style.left = buttonLeft + 'px';
		transformActionsRow.dom.style.top = buttonTop + 'px';
		transformActionsRow.dom.style.zIndex = '3';

	};

	const getSpacerRow = function () {

		if ( ! spacerRow ) {

			spacerRow = new UIPanel();
			spacerRow.setDisplay( 'none' );
			spacerRow.dom.style.border = 'none';
			spacerRow.dom.style.marginTop = '0';
			spacerRow.dom.style.marginBottom = '0';
			spacerRow.dom.style.height = '10px';

		}

		if ( objectVisibleRow && objectVisibleRow.dom.parentElement === container.dom ) {

			if ( spacerRow.dom.parentElement !== container.dom || spacerRow.dom.nextSibling !== objectVisibleRow.dom ) {

				container.dom.insertBefore( spacerRow.dom, objectVisibleRow.dom );

			}

		} else if ( spacerRow.dom.parentElement !== container.dom ) {

			container.add( spacerRow );

		}

		return spacerRow;

	};

	function showTransformActions() {

		transformActionsRow.setDisplay( '' );
		transformCopyButton.dom.style.display = 'inline-flex';
		transformPasteButton.dom.style.display = 'inline-flex';
		transformResetButton.dom.style.display = 'inline-flex';
		transformBorder.style.display = 'none';
		updateBorderPosition();
		getSpacerRow().setDisplay( '' );

	}

	function hideTransformActions() {

		clearTransformHoverArtifacts();
		transformActionsRow.setDisplay( 'none' );
		transformBorder.style.display = 'none';
		if ( spacerRow ) spacerRow.setDisplay( 'none' );

	}

	const createHoverArea = function () {

		const oldHoverArea = container.dom.querySelector( '.transform-area-overlay' );
		if ( oldHoverArea ) oldHoverArea.remove();

		removeAllEventListeners();

		if ( ! objectPositionRow.dom || ! objectScaleRow.dom ) return;

		const labelWidth = 90;
		const paddingLeft = 5;
		const dataAreaLeft = labelWidth + paddingLeft;
		const posInputX = objectPositionX.dom;
		const posInputZ = objectPositionZ.dom;
		const dataAreaWidth = posInputZ.offsetLeft + posInputZ.offsetWidth - posInputX.offsetLeft;

		let isMouseInRelevantArea = false;
		let hideTimeout = null;

		const isInButtonArea = function ( event ) {

			const rect = transformActionsRow.dom.getBoundingClientRect();
			return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;

		};

		const safeShowTransformActions = function () {

			if ( hideTimeout ) {

				clearTimeout( hideTimeout );
				hideTimeout = null;

			}

			isMouseInRelevantArea = true;
			showTransformActions();

		};

		const safeHideTransformActions = function () {

			if ( hideTimeout ) clearTimeout( hideTimeout );

			hideTimeout = setTimeout( function () {

				if ( ! isMouseInRelevantArea ) hideTransformActions();
				hideTimeout = null;

			}, 200 );

		};

		const transformAreaOverlay = document.createElement( 'div' );
		transformAreaOverlay.className = 'transform-area-overlay';
		transformAreaOverlay.style.position = 'absolute';
		transformAreaOverlay.style.zIndex = '1';
		transformAreaOverlay.style.pointerEvents = 'none';

		const updateOverlayPosition = function () {

			transformAreaOverlay.style.top = ( objectPositionRow.dom.offsetTop - 5 ) + 'px';
			transformAreaOverlay.style.left = dataAreaLeft + 'px';
			transformAreaOverlay.style.width = dataAreaWidth + 'px';
			transformAreaOverlay.style.height = ( objectScaleRow.dom.offsetTop + objectScaleRow.dom.offsetHeight - objectPositionRow.dom.offsetTop + 10 ) + 'px';

		};

		updateOverlayPosition();
		container.dom.appendChild( transformAreaOverlay );

		addEventListenerWithRef( container.dom, 'scroll', function () {

			updateOverlayPosition();
			if ( transformActionsRow.dom.style.display !== 'none' ) updateBorderPosition();

		} );

		const handleGlobalMouseMove = function ( event ) {

			const overlayRect = transformAreaOverlay.getBoundingClientRect();
			const inOverlayArea = event.clientX >= overlayRect.left && event.clientX <= overlayRect.right && event.clientY >= overlayRect.top && event.clientY <= overlayRect.bottom;
			const inButtonArea = isInButtonArea( event );

			isMouseInRelevantArea =
				inOverlayArea ||
				inButtonArea ||
				transformActionsRow.dom.contains( event.target ) ||
				transformCopyButton.dom.contains( event.target ) ||
				transformPasteButton.dom.contains( event.target ) ||
				transformResetButton.dom.contains( event.target );

			if ( isMouseInRelevantArea ) {

				safeShowTransformActions();

			} else if ( transformActionsRow.dom.style.display !== 'none' ) {

				safeHideTransformActions();

			}

		};

		addEventListenerWithRef( document, 'mousemove', handleGlobalMouseMove );
		addEventListenerWithRef( transformCopyButton.dom, 'mouseenter', function () { isMouseInRelevantArea = true; safeShowTransformActions(); } );
		addEventListenerWithRef( transformPasteButton.dom, 'mouseenter', function () { isMouseInRelevantArea = true; safeShowTransformActions(); } );
		addEventListenerWithRef( transformResetButton.dom, 'mouseenter', function () { isMouseInRelevantArea = true; safeShowTransformActions(); } );
		addEventListenerWithRef( transformActionsRow.dom, 'mouseenter', function () { isMouseInRelevantArea = true; safeShowTransformActions(); } );
		addEventListenerWithRef( document, 'click', function ( event ) {

			if ( transformCopyButton.dom.contains( event.target ) || transformPasteButton.dom.contains( event.target ) || transformResetButton.dom.contains( event.target ) ) {

				setTimeout( function () {

					isMouseInRelevantArea = false;
					hideTransformActions();

				}, 800 );

			}

		} );

	};

	const objectFovRow = new UIRow();
	const objectFov = new UINumber().onChange( update );
	objectFovRow.add( new UIText( strings.getKey( 'sidebar/object/fov' ) ).setWidth( '90px' ) );
	objectFovRow.add( objectFov );
	container.add( objectFovRow );

	const objectLeftRow = new UIRow();
	const objectLeft = new UINumber().onChange( update );
	objectLeftRow.add( new UIText( strings.getKey( 'sidebar/object/left' ) ).setWidth( '90px' ) );
	objectLeftRow.add( objectLeft );
	container.add( objectLeftRow );

	const objectRightRow = new UIRow();
	const objectRight = new UINumber().onChange( update );
	objectRightRow.add( new UIText( strings.getKey( 'sidebar/object/right' ) ).setWidth( '90px' ) );
	objectRightRow.add( objectRight );
	container.add( objectRightRow );

	const objectTopRow = new UIRow();
	const objectTop = new UINumber().onChange( update );
	objectTopRow.add( new UIText( strings.getKey( 'sidebar/object/top' ) ).setWidth( '90px' ) );
	objectTopRow.add( objectTop );
	container.add( objectTopRow );

	const objectBottomRow = new UIRow();
	const objectBottom = new UINumber().onChange( update );
	objectBottomRow.add( new UIText( strings.getKey( 'sidebar/object/bottom' ) ).setWidth( '90px' ) );
	objectBottomRow.add( objectBottom );
	container.add( objectBottomRow );

	const objectNearRow = new UIRow();
	const objectNear = new UINumber().onChange( update );
	objectNearRow.add( new UIText( strings.getKey( 'sidebar/object/near' ) ).setWidth( '90px' ) );
	objectNearRow.add( objectNear );
	container.add( objectNearRow );

	const objectFarRow = new UIRow();
	const objectFar = new UINumber().onChange( update );
	objectFarRow.add( new UIText( strings.getKey( 'sidebar/object/far' ) ).setWidth( '90px' ) );
	objectFarRow.add( objectFar );
	container.add( objectFarRow );

	const objectIntensityRow = new UIRow();
	const objectIntensity = new UINumber().onChange( update );
	objectIntensityRow.add( new UIText( strings.getKey( 'sidebar/object/intensity' ) ).setWidth( '90px' ) );
	objectIntensityRow.add( objectIntensity );
	container.add( objectIntensityRow );

	const objectColorRow = new UIRow();
	const objectColor = new UIColor().onInput( update );
	objectColorRow.add( new UIText( strings.getKey( 'sidebar/object/color' ) ).setWidth( '90px' ) );
	objectColorRow.add( objectColor );
	container.add( objectColorRow );

	const objectGroundColorRow = new UIRow();
	const objectGroundColor = new UIColor().onInput( update );
	objectGroundColorRow.add( new UIText( strings.getKey( 'sidebar/object/groundcolor' ) ).setWidth( '90px' ) );
	objectGroundColorRow.add( objectGroundColor );
	container.add( objectGroundColorRow );

	const objectDistanceRow = new UIRow();
	const objectDistance = new UINumber().setRange( 0, Infinity ).onChange( update );
	objectDistanceRow.add( new UIText( strings.getKey( 'sidebar/object/distance' ) ).setWidth( '90px' ) );
	objectDistanceRow.add( objectDistance );
	container.add( objectDistanceRow );

	const objectAngleRow = new UIRow();
	const objectAngle = new UINumber().setPrecision( 3 ).setRange( 0, Math.PI / 2 ).onChange( update );
	objectAngleRow.add( new UIText( strings.getKey( 'sidebar/object/angle' ) ).setWidth( '90px' ) );
	objectAngleRow.add( objectAngle );
	container.add( objectAngleRow );

	const objectPenumbraRow = new UIRow();
	const objectPenumbra = new UINumber().setRange( 0, 1 ).onChange( update );
	objectPenumbraRow.add( new UIText( strings.getKey( 'sidebar/object/penumbra' ) ).setWidth( '90px' ) );
	objectPenumbraRow.add( objectPenumbra );

	const objectDecayRow = new UIRow();
	const objectDecay = new UINumber().setRange( 0, Infinity ).onChange( update );
	objectDecayRow.add( new UIText( strings.getKey( 'sidebar/object/decay' ) ).setWidth( '90px' ) );
	objectDecayRow.add( objectDecay );

	const objectShadowRow = new UIRow();
	objectShadowRow.add( new UIText( strings.getKey( 'sidebar/object/shadow' ) ).setWidth( '90px' ) );
	const objectCastShadow = new UIBoolean( false, strings.getKey( 'sidebar/object/cast' ) ).onChange( update );
	objectShadowRow.add( objectCastShadow );
	const objectReceiveShadow = new UIBoolean( false, strings.getKey( 'sidebar/object/receive' ) ).onChange( update );
	objectShadowRow.add( objectReceiveShadow );

	const objectShadowIntensityRow = new UIRow();
	objectShadowIntensityRow.add( new UIText( strings.getKey( 'sidebar/object/shadowIntensity' ) ).setWidth( '90px' ) );
	const objectShadowIntensity = new UINumber( 0 ).setRange( 0, 1 ).onChange( update );
	objectShadowIntensityRow.add( objectShadowIntensity );

	const objectShadowBiasRow = new UIRow();
	objectShadowBiasRow.add( new UIText( strings.getKey( 'sidebar/object/shadowBias' ) ).setWidth( '90px' ) );
	const objectShadowBias = new UINumber( 0 ).setPrecision( 5 ).setStep( 0.0001 ).setNudge( 0.00001 ).onChange( update );
	objectShadowBiasRow.add( objectShadowBias );

	const objectShadowNormalBiasRow = new UIRow();
	objectShadowNormalBiasRow.add( new UIText( strings.getKey( 'sidebar/object/shadowNormalBias' ) ).setWidth( '90px' ) );
	const objectShadowNormalBias = new UINumber( 0 ).onChange( update );
	objectShadowNormalBiasRow.add( objectShadowNormalBias );

	const objectShadowRadiusRow = new UIRow();
	objectShadowRadiusRow.add( new UIText( strings.getKey( 'sidebar/object/shadowRadius' ) ).setWidth( '90px' ) );
	const objectShadowRadius = new UINumber( 1 ).onChange( update );
	objectShadowRadiusRow.add( objectShadowRadius );

	const objectVisibleRow = new UIRow();
	const objectVisible = new UICheckbox().onChange( update );
	objectVisibleRow.add( new UIText( strings.getKey( 'sidebar/object/visible' ) ).setWidth( '90px' ) );
	objectVisibleRow.add( objectVisible );
	if ( objectResetRow.dom.parentElement ) {

		objectResetRow.dom.parentElement.removeChild( objectResetRow.dom );

	}
	objectResetRow.setDisplay( 'none' );
	container.add( objectVisibleRow );

	const objectLoopRow = new UIRow();
	const objectLoop = new UICheckbox().onChange( update );
	objectLoopRow.add( new UIText( strings.getKey( 'sidebar/object/loop' ) ).setWidth( '90px' ) );
	objectLoopRow.add( objectLoop );
	container.add( objectLoopRow );

	const objectSortingRow = new UIRow();
	const objectSorting = new UISelect().onChange( update );
	objectSorting.setOptions( Object.fromEntries( [ 0, 1, 2 ].map( i => [ i, String( i ) ] ) ) );
	objectSortingRow.add( new UIText( strings.getKey( 'sidebar/object/sortingOrder' ) ).setWidth( '90px' ) );
	objectSortingRow.add( objectSorting );
	container.add( objectSortingRow );

	const objectInputSignalsRow = new UIRow();
	const objectInputSignalsControl = createTextActionButtonControl(
		getSignalPlaceholderLabel( strings, 'input' ),
		'150px',
		function () {

			showSignalPopup(
				objectInputSignalsControl.button,
				strings.getKey( 'sidebar/events/inputs' ),
				currentInputSignalLabels,
				'input'
			);

		}
	);
	objectInputSignalsRow.add( new UIText( strings.getKey( 'sidebar/events/inputs' ) ).setWidth( '90px' ) );
	objectInputSignalsRow.add( objectInputSignalsControl.wrapper );
	objectInputSignalsRow.setDisplay( 'none' );
	container.add( objectInputSignalsRow );

	const objectOutputSignalsRow = new UIRow();
	const objectOutputSignalsControl = createTextActionButtonControl(
		getSignalPlaceholderLabel( strings, 'output' ),
		'150px',
		function () {

			showSignalPopup(
				objectOutputSignalsControl.button,
				strings.getKey( 'sidebar/events/outputs' ),
				currentOutputSignalLabels,
				'output'
			);

		}
	);
	objectOutputSignalsRow.add( new UIText( strings.getKey( 'sidebar/events/outputs' ) ).setWidth( '90px' ) );
	objectOutputSignalsRow.add( objectOutputSignalsControl.wrapper );
	objectOutputSignalsRow.setDisplay( 'none' );
	container.add( objectOutputSignalsRow );

	const objectFrustumCulledRow = new UIRow();
	const objectFrustumCulled = new UICheckbox().onChange( update );
	objectFrustumCulledRow.add( new UIText( strings.getKey( 'sidebar/object/frustumcull' ) ).setWidth( '90px' ) );
	objectFrustumCulledRow.add( objectFrustumCulled );

	const objectRenderOrderRow = new UIRow();
	const objectRenderOrder = new UINumber().setWidth( '50px' ).onChange( update );
	objectRenderOrderRow.add( new UIText( strings.getKey( 'sidebar/object/renderorder' ) ).setWidth( '90px' ) );
	objectRenderOrderRow.add( objectRenderOrder );

	const objectUUIDRow = new UIRow();
	const objectUUID = new UIInput().setWidth( '150px' ).setFontSize( '12px' ).setDisabled( true );
	objectUUIDRow.add( new UIText( strings.getKey( 'sidebar/object/uuid' ) ).setWidth( '90px' ) );
	objectUUIDRow.add( objectUUID );
	container.add( objectUUIDRow );

	function update() {

		const object = editor.selected;
		if ( object === null ) return;

		const newPosition = new THREE.Vector3( objectPositionX.getValue(), objectPositionY.getValue(), objectPositionZ.getValue() );
		if ( object.position.distanceTo( newPosition ) >= 0.01 ) editor.execute( new SetPositionCommand( editor, object, newPosition ) );

		const newRotation = new THREE.Euler(
			objectRotationX.getValue() * THREE.MathUtils.DEG2RAD,
			objectRotationY.getValue() * THREE.MathUtils.DEG2RAD,
			objectRotationZ.getValue() * THREE.MathUtils.DEG2RAD
		);
		if ( new THREE.Vector3().setFromEuler( object.rotation ).distanceTo( new THREE.Vector3().setFromEuler( newRotation ) ) >= 0.01 ) {

			editor.execute( new SetRotationCommand( editor, object, newRotation ) );

		}

		const newScale = new THREE.Vector3( objectScaleX.getValue(), objectScaleY.getValue(), objectScaleZ.getValue() );
		if ( object.scale.distanceTo( newScale ) >= 0.01 ) editor.execute( new SetScaleCommand( editor, object, newScale ) );

		if ( object.fov !== undefined && Math.abs( object.fov - objectFov.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'fov', objectFov.getValue() ) );
			object.updateProjectionMatrix();

		}

		if ( object.left !== undefined && Math.abs( object.left - objectLeft.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'left', objectLeft.getValue() ) );
			object.updateProjectionMatrix();

		}

		if ( object.right !== undefined && Math.abs( object.right - objectRight.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'right', objectRight.getValue() ) );
			object.updateProjectionMatrix();

		}

		if ( object.top !== undefined && Math.abs( object.top - objectTop.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'top', objectTop.getValue() ) );
			object.updateProjectionMatrix();

		}

		if ( object.bottom !== undefined && Math.abs( object.bottom - objectBottom.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'bottom', objectBottom.getValue() ) );
			object.updateProjectionMatrix();

		}

		if ( object.near !== undefined && Math.abs( object.near - objectNear.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'near', objectNear.getValue() ) );
			if ( object.isOrthographicCamera ) object.updateProjectionMatrix();

		}

		if ( object.far !== undefined && Math.abs( object.far - objectFar.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'far', objectFar.getValue() ) );
			if ( object.isOrthographicCamera ) object.updateProjectionMatrix();

		}

		if ( object.intensity !== undefined && Math.abs( object.intensity - objectIntensity.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'intensity', objectIntensity.getValue() ) );

		}

		if ( object.color !== undefined && object.color.getHex() !== objectColor.getHexValue() ) {

			editor.execute( new SetColorCommand( editor, object, 'color', objectColor.getHexValue() ) );

		}

		if ( object.groundColor !== undefined && object.groundColor.getHex() !== objectGroundColor.getHexValue() ) {

			editor.execute( new SetColorCommand( editor, object, 'groundColor', objectGroundColor.getHexValue() ) );

		}

		if ( object.distance !== undefined && Math.abs( object.distance - objectDistance.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'distance', objectDistance.getValue() ) );

		}

		if ( object.angle !== undefined && Math.abs( object.angle - objectAngle.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'angle', objectAngle.getValue() ) );

		}

		if ( object.penumbra !== undefined && Math.abs( object.penumbra - objectPenumbra.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'penumbra', objectPenumbra.getValue() ) );

		}

		if ( object.decay !== undefined && Math.abs( object.decay - objectDecay.getValue() ) >= 0.01 ) {

			editor.execute( new SetValueCommand( editor, object, 'decay', objectDecay.getValue() ) );

		}

		if ( object.visible !== objectVisible.getValue() ) {

			editor.execute( new SetValueCommand( editor, object, 'visible', objectVisible.getValue() ) );

		}

		if ( object.frustumCulled !== objectFrustumCulled.getValue() ) {

			editor.execute( new SetValueCommand( editor, object, 'frustumCulled', objectFrustumCulled.getValue() ) );

		}

		if ( object.renderOrder !== objectRenderOrder.getValue() ) {

			editor.execute( new SetValueCommand( editor, object, 'renderOrder', objectRenderOrder.getValue() ) );

		}

		if ( object.castShadow !== undefined && object.castShadow !== objectCastShadow.getValue() ) {

			editor.execute( new SetValueCommand( editor, object, 'castShadow', objectCastShadow.getValue() ) );

		}

		if ( object.receiveShadow !== objectReceiveShadow.getValue() ) {

			if ( object.material !== undefined ) object.material.needsUpdate = true;
			editor.execute( new SetValueCommand( editor, object, 'receiveShadow', objectReceiveShadow.getValue() ) );

		}

		if ( object.shadow !== undefined ) {

			if ( object.shadow.intensity !== objectShadowIntensity.getValue() ) editor.execute( new SetShadowValueCommand( editor, object, 'intensity', objectShadowIntensity.getValue() ) );
			if ( object.shadow.bias !== objectShadowBias.getValue() ) editor.execute( new SetShadowValueCommand( editor, object, 'bias', objectShadowBias.getValue() ) );
			if ( object.shadow.normalBias !== objectShadowNormalBias.getValue() ) editor.execute( new SetShadowValueCommand( editor, object, 'normalBias', objectShadowNormalBias.getValue() ) );
			if ( object.shadow.radius !== objectShadowRadius.getValue() ) editor.execute( new SetShadowValueCommand( editor, object, 'radius', objectShadowRadius.getValue() ) );

		}

		if ( isPictureType( object ) ) {

			const selectedSorting = parseInt( objectSorting.getValue(), 10 ) || 0;
			const currentSorting = object.userData && object.userData.sortingOrder !== undefined ? Number( object.userData.sortingOrder ) : 0;
			if ( currentSorting !== selectedSorting ) {

				const userData = JSON.parse( JSON.stringify( object.userData || {} ) );
				userData.sortingOrder = selectedSorting;
				object.renderOrder = 0 - userData.sortingOrder;
				editor.execute( new SetValueCommand( editor, object, 'userData', userData ) );
				editor.signals.objectChanged.dispatch( object );

			}

		}

		if ( isMediaType( object ) ) {

			const currentLoop = !! ( object.userData && object.userData.loop );
			if ( currentLoop !== objectLoop.getValue() ) {

				const userData = JSON.parse( JSON.stringify( object.userData || {} ) );
				userData.loop = objectLoop.getValue();
				editor.execute( new SetValueCommand( editor, object, 'userData', userData ) );

			}

		}

	}

	function updateRows( object ) {

		cleanupLegacyTransformArtifacts( container );

		objectTypeRow.setDisplay( '' );
		objectNameRow.setDisplay( '' );
		objectTransformAxisHeaderRow.setDisplay( '' );
		objectPositionRow.setDisplay( '' );
		objectUUIDRow.setDisplay( '' );
		objectResetRow.setDisplay( 'none' );
		objectResetRow.dom.style.display = 'none';
		hideTransformActions();

		const isSceneEntity = editor.type && editor.type.toLowerCase() === 'verse' && object && object.userData && object.userData.meta_id != null;
		objectEditEntityButton.setDisplay( isSceneEntity ? 'inline-flex' : 'none' );
		objectUUIDRow.setDisplay( 'none' );

		const properties = {
			fov: objectFovRow,
			left: objectLeftRow,
			right: objectRightRow,
			top: objectTopRow,
			bottom: objectBottomRow,
			near: objectNearRow,
			far: objectFarRow,
			intensity: objectIntensityRow,
			color: objectColorRow,
			groundColor: objectGroundColorRow,
			distance: objectDistanceRow,
			angle: objectAngleRow,
			penumbra: objectPenumbraRow,
			decay: objectDecayRow,
			castShadow: objectShadowRow,
			receiveShadow: objectShadowRow,
			shadow: [ objectShadowIntensityRow, objectShadowBiasRow, objectShadowNormalBiasRow, objectShadowRadiusRow ]
		};

		for ( const property in properties ) {

			const uiElement = properties[ property ];

			if ( Array.isArray( uiElement ) ) {

				for ( let i = 0; i < uiElement.length; i ++ ) {

					uiElement[ i ].setDisplay( object[ property ] !== undefined ? '' : 'none' );

				}

			} else {

				uiElement.setDisplay( object[ property ] !== undefined ? '' : 'none' );

			}

		}

		objectLoopRow.setDisplay( isMediaType( object ) ? '' : 'none' );
		objectSortingRow.setDisplay( isPictureType( object ) ? '' : 'none' );
		objectInputSignalsRow.setDisplay( isSceneEntity ? '' : 'none' );
		objectOutputSignalsRow.setDisplay( isSceneEntity ? '' : 'none' );
		if ( ! isSceneEntity ) hideSignalPopup();

		if ( object && object.type && typeof object.type === 'string' && object.type.toLowerCase() === 'module' ) {

			objectVisibleRow.setDisplay( 'none' );

		} else {

			objectVisibleRow.setDisplay( '' );

		}

		if ( object.isLight ) objectReceiveShadow.setDisplay( 'none' );
		if ( object.isAmbientLight || object.isHemisphereLight ) objectShadowRow.setDisplay( 'none' );

	}

	function updateTransformRows( object ) {

		if ( object.isLight || ( object.isObject3D && object.userData.targetInverse ) ) {

			objectTransformAxisHeaderRow.setDisplay( 'none' );
			objectRotationRow.setDisplay( 'none' );
			objectScaleRow.setDisplay( 'none' );
			objectResetRow.setDisplay( 'none' );
			objectResetRow.dom.style.display = 'none';
			hideTransformActions();

		} else {

			objectTransformAxisHeaderRow.setDisplay( '' );
			objectRotationRow.setDisplay( '' );
			objectScaleRow.setDisplay( '' );
			objectResetRow.setDisplay( 'none' );
			objectResetRow.dom.style.display = 'none';
			clearTransformHoverArtifacts();
			requestAnimationFrame( function () {

				updateBorderPosition();
				showTransformActions();

			} );

		}

	}

	signals.objectSelected.add( function ( object ) {

		if ( object !== null ) {

			const selectedObjects = editor.getSelectedObjects ? editor.getSelectedObjects() : [];
			if ( selectedObjects.length > 1 ) {

				container.setDisplay( 'none' );

			} else {

				container.setDisplay( 'block' );
				updateRows( object );
				updateUI( object );
				resetObjectPanelScroll( container );

			}

		} else {

			container.setDisplay( 'none' );
			hideTransformActions();
			hideSignalPopup();

		}

	} );

	signals.objectChanged.add( function ( object ) {

		if ( object !== editor.selected ) return;
		updateUI( object );

	} );

	signals.refreshSidebarObject3D.add( function ( object ) {

		if ( object !== editor.selected ) return;
		updateUI( object );

	} );

	function updateUI( object ) {

		objectType.setValue( getLocalizedObjectType( object, editor ) );
		objectUUID.setValue( object.uuid );
		objectName.setValue( sanitizeObjectName( object.name ) );

		objectPositionX.setValue( object.position.x );
		objectPositionY.setValue( object.position.y );
		objectPositionZ.setValue( object.position.z );

		objectRotationX.setValue( object.rotation.x * THREE.MathUtils.RAD2DEG );
		objectRotationY.setValue( object.rotation.y * THREE.MathUtils.RAD2DEG );
		objectRotationZ.setValue( object.rotation.z * THREE.MathUtils.RAD2DEG );

		objectScaleX.setValue( object.scale.x );
		objectScaleY.setValue( object.scale.y );
		objectScaleZ.setValue( object.scale.z );

		if ( object.fov !== undefined ) objectFov.setValue( object.fov );
		if ( object.left !== undefined ) objectLeft.setValue( object.left );
		if ( object.right !== undefined ) objectRight.setValue( object.right );
		if ( object.top !== undefined ) objectTop.setValue( object.top );
		if ( object.bottom !== undefined ) objectBottom.setValue( object.bottom );
		if ( object.near !== undefined ) objectNear.setValue( object.near );
		if ( object.far !== undefined ) objectFar.setValue( object.far );
		if ( object.intensity !== undefined ) objectIntensity.setValue( object.intensity );
		if ( object.color !== undefined ) objectColor.setHexValue( object.color.getHexString() );
		if ( object.groundColor !== undefined ) objectGroundColor.setHexValue( object.groundColor.getHexString() );
		if ( object.distance !== undefined ) objectDistance.setValue( object.distance );
		if ( object.angle !== undefined ) objectAngle.setValue( object.angle );
		if ( object.penumbra !== undefined ) objectPenumbra.setValue( object.penumbra );
		if ( object.decay !== undefined ) objectDecay.setValue( object.decay );
		if ( object.castShadow !== undefined ) objectCastShadow.setValue( object.castShadow );
		if ( object.receiveShadow !== undefined ) objectReceiveShadow.setValue( object.receiveShadow );

		if ( object.shadow !== undefined ) {

			objectShadowIntensity.setValue( object.shadow.intensity );
			objectShadowBias.setValue( object.shadow.bias );
			objectShadowNormalBias.setValue( object.shadow.normalBias );
			objectShadowRadius.setValue( object.shadow.radius );

		}

		objectVisible.setValue( object.visible );
		objectFrustumCulled.setValue( object.frustumCulled );
		objectRenderOrder.setValue( object.renderOrder );

		try {

			const sortingVal = object.userData && object.userData.sortingOrder !== undefined ? object.userData.sortingOrder : 0;
			objectSorting.setValue( String( sortingVal ) );

		} catch ( error ) {

			objectSorting.setValue( '0' );

		}

		if ( isMediaType( object ) ) {

			objectLoop.setValue( !! ( object.userData && object.userData.loop ) );

		}

		const isSceneEntity = editor.type && editor.type.toLowerCase() === 'verse' && object && object.userData && object.userData.meta_id != null;
		if ( isSceneEntity ) {

			const metaEvents = getSceneEntitySignalGroups( object, editor );
			const inputs = Array.isArray( metaEvents && metaEvents.inputs ) ? metaEvents.inputs : [];
			const outputs = Array.isArray( metaEvents && metaEvents.outputs ) ? metaEvents.outputs : [];

			currentInputSignalLabels = getSignalLabelList( inputs );
			currentOutputSignalLabels = getSignalLabelList( outputs );
			objectInputSignalsControl.setLabel( getSignalPlaceholderLabel( strings, 'input' ) );
			objectOutputSignalsControl.setLabel( getSignalPlaceholderLabel( strings, 'output' ) );

		} else {

			currentInputSignalLabels = [];
			currentOutputSignalLabels = [];
			objectInputSignalsControl.setLabel( getSignalPlaceholderLabel( strings, 'input' ) );
			objectOutputSignalsControl.setLabel( getSignalPlaceholderLabel( strings, 'output' ) );
			hideSignalPopup();

		}

		updateTransformRows( object );

	}

	signals.sceneGraphChanged.add( function () {

		if ( editor.selected !== null ) {

			updateUI( editor.selected );

		}

	} );

	return container;

}

export { SidebarObject };
