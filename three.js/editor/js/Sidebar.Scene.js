import * as THREE from 'three';

import { UIPanel, UIBreak, UIRow, UIColor, UISelect, UIText, UINumber } from './libs/ui.js';
import { UIOutliner, UITexture } from './libs/ui.three.js';

function SidebarScene( editor ) {

	const signals = editor.signals;
	const strings = editor.strings;
	const isSceneEditor = !! ( editor.type && editor.type.toLowerCase() === 'verse' );

	const container = new UIPanel();
	container.setBorderTop( '0' );
	container.setPaddingTop( '10px' );

	// outliner

	const nodeStates = new WeakMap();
	const nativeTypes = new Set( [
		'Scene', 'PerspectiveCamera', 'OrthographicCamera',
		'AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'HemisphereLight',
		'Mesh', 'SkinnedMesh', 'Line', 'LineSegments', 'LineLoop', 'Points',
		'Group', 'Object3D', 'Bone', 'Sprite', 'LOD'
	] );

	function hasDisplayableChildren( object ) {

		if ( isSceneEditor ) return false;

		return object.children.some( function ( child ) {

			if ( ! child ) return false;
			if ( child.userData && child.userData.hidden === true ) return false;
			if ( child.name && child.name.charAt( 0 ) === '$' ) return false;

			const childType = child.type || '';

			if ( ! childType || nativeTypes.has( childType ) ) return false;

			return true;

		} );

	}

	function buildOpener( object ) {

		if ( nodeStates.has( object ) === false ) return null;

		const canExpand = hasDisplayableChildren( object );
		const state = nodeStates.get( object );

		const opener = document.createElement( 'span' );
		opener.classList.add( 'opener' );

		if ( canExpand ) {

			opener.classList.add( state ? 'open' : 'closed' );

			opener.addEventListener( 'click', function () {

				nodeStates.set( object, nodeStates.get( object ) === false ); // toggle
				refreshUI();

			} );

		} else {

			opener.classList.add( 'empty' );

		}

		return opener;

	}

	function buildOption( object, draggable ) {

		const option = document.createElement( 'div' );
		option.draggable = draggable;
		option.innerHTML = buildHTML( object );
		option.value = object.id;

		// opener

		if ( nodeStates.has( object ) ) {

			const opener = buildOpener( object );

			if ( opener ) option.insertBefore( opener, option.firstChild );

		}

		return option;

	}

	function getMaterialName( material ) {

		if ( Array.isArray( material ) ) {

			const array = [];

			for ( let i = 0; i < material.length; i ++ ) {

				array.push( material[ i ].name );

			}

			return array.join( ',' );

		}

		return material.name;

	}

	function escapeHTML( html ) {

		return html
			.replace( /&/g, '&amp;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#39;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' );

	}

	function getObjectType( object ) {

		const rawType = ( object.userData && object.userData.type ) || object.type || '';
		const normalizedType = String( rawType ).toLowerCase();
		const customTypeMap = {
			module: 'Module',
			entity: 'Entity',
			point: 'Point',
			text: 'Text',
			polygen: 'Polygen',
			voxel: 'Voxel',
			picture: 'Picture',
			video: 'Video',
			audio: 'Audio',
			sound: 'Audio',
			prototype: 'Prototype'
		};

		if ( isSceneEditor && normalizedType === 'module' ) {

			return 'Entity';

		}

		if ( customTypeMap[ normalizedType ] ) {

			return customTypeMap[ normalizedType ];

		}

		if ( object.isScene ) return 'Scene';
		if ( object.isCamera ) return 'Camera';
		if ( object.isLight ) return 'Light';
		if ( object.isMesh ) return 'Mesh';
		if ( object.isLine ) return 'Line';
		if ( object.isPoints ) return 'Points';

		return 'Object3D';

	}

	function getDisplayName( object ) {

		const name = String( object?.name || '' );
		return name.replace( /\s*\[(polygen|picture|video|sound|audio|text|point|prototype|entity|module)\]\s*$/i, '' );

	}

	function buildHTML( object ) {

		let html = `<span class="type ${ getObjectType( object ) }"></span>${ escapeHTML( getDisplayName( object ) ) }`;

		if ( object.isMesh ) {

			const geometry = object.geometry;
			const material = object.material;

			html += ` <span class="type Geometry"></span> ${ escapeHTML( geometry.name ) }`;
			html += ` <span class="type Material"></span> ${ escapeHTML( getMaterialName( material ) ) }`;

		}

		html += getScript( object.uuid );

		return html;

	}

	function syncOutlinerSelection() {

		const selectedObjects = editor.getSelectedObjects ? editor.getSelectedObjects() : [];

		if ( selectedObjects && selectedObjects.length > 1 ) {

			outliner.setValue( null );

			for ( let i = 0; i < selectedObjects.length; i ++ ) {

				outliner.setValue( selectedObjects[ i ].id, i > 0 );

			}

			return;

		}

		if ( editor.selected !== null ) {

			outliner.setValue( editor.selected.id );

		} else {

			outliner.setValue( null );

		}

	}

	function getScript( uuid ) {

		if ( editor.scripts[ uuid ] === undefined ) return '';

		if ( editor.scripts[ uuid ].length === 0 ) return '';

		return ' <span class="type Script"></span>';

	}

	let ignoreObjectSelectedSignal = false;

	const outliner = new UIOutliner( editor );
	outliner.setId( 'outliner' );
	outliner.reorderOnly = !! ( editor.type && editor.type.toLowerCase() === 'verse' );
	outliner.onChange( function () {

		ignoreObjectSelectedSignal = true;

		const selectedValues = outliner.getValues ? outliner.getValues() : [];

		if ( selectedValues.length > 1 ) {

			const selectedObjects = [];

			for ( let i = 0; i < selectedValues.length; i ++ ) {

				const objectId = parseInt( selectedValues[ i ] );
				if ( isNaN( objectId ) ) continue;

				const object = editor.scene.getObjectById( objectId ) ||
					( editor.camera && editor.camera.id === objectId ? editor.camera : null );

				if ( object && selectedObjects.indexOf( object ) === - 1 ) {

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

		} else {

			editor.selectById( parseInt( outliner.getValue() ) );

		}

		ignoreObjectSelectedSignal = false;

	} );
	outliner.onDblClick( function () {

		editor.focusById( parseInt( outliner.getValue() ) );

	} );
	container.add( outliner );
	container.add( new UIBreak() );

	// background

	const backgroundRow = new UIRow();

	const backgroundType = new UISelect().setOptions( {

		'Default': 'Default',
		'Color': 'Color',
		'Texture': 'Texture',
		'Equirectangular': 'Equirect'

	} ).setWidth( '150px' );
	backgroundType.setValue( 'Default' );
	backgroundType.onChange( function () {

		onBackgroundChanged();
		refreshBackgroundUI();

	} );

	backgroundRow.add( new UIText( strings.getKey( 'sidebar/scene/background' ) ).setClass( 'Label' ) );
	backgroundRow.add( backgroundType );

	const backgroundColor = new UIColor().setValue( '#000000' ).setMarginLeft( '8px' ).onInput( onBackgroundChanged );
	backgroundRow.add( backgroundColor );

	const backgroundTexture = new UITexture( editor ).setMarginLeft( '8px' ).onChange( onBackgroundChanged );
	backgroundTexture.setDisplay( 'none' );
	backgroundRow.add( backgroundTexture );

	const backgroundEquirectangularTexture = new UITexture( editor ).setMarginLeft( '8px' ).onChange( onBackgroundChanged );
	backgroundEquirectangularTexture.setDisplay( 'none' );
	backgroundRow.add( backgroundEquirectangularTexture );

	const backgroundColorSpaceRow = new UIRow();
	backgroundColorSpaceRow.setDisplay( 'none' );
	backgroundColorSpaceRow.setMarginLeft( '120px' );

	const backgroundColorSpace = new UISelect().setOptions( {

		[ THREE.NoColorSpace ]: 'No Color Space',
		[ THREE.LinearSRGBColorSpace ]: 'srgb-linear',
		[ THREE.SRGBColorSpace ]: 'srgb',

	} ).setWidth( '150px' );
	backgroundColorSpace.setValue( THREE.NoColorSpace );
	backgroundColorSpace.onChange( onBackgroundChanged );
	backgroundColorSpaceRow.add( backgroundColorSpace );

	container.add( backgroundRow );
	container.add( backgroundColorSpaceRow );

	const backgroundEquirectRow = new UIRow();
	backgroundEquirectRow.setDisplay( 'none' );
	backgroundEquirectRow.setMarginLeft( '120px' );

	const backgroundBlurriness = new UINumber( 0 ).setWidth( '40px' ).setRange( 0, 1 ).onChange( onBackgroundChanged );
	backgroundEquirectRow.add( backgroundBlurriness );

	const backgroundIntensity = new UINumber( 1 ).setWidth( '40px' ).setRange( 0, Infinity ).onChange( onBackgroundChanged );
	backgroundEquirectRow.add( backgroundIntensity );

	const backgroundRotation = new UINumber( 0 ).setWidth( '40px' ).setRange( - 180, 180 ).setStep( 10 ).setNudge( 0.1 ).setUnit( '°' ).onChange( onBackgroundChanged );
	backgroundEquirectRow.add( backgroundRotation );

	container.add( backgroundEquirectRow );

	function onBackgroundChanged() {

		signals.sceneBackgroundChanged.dispatch(
			backgroundType.getValue(),
			backgroundColor.getHexValue(),
			backgroundTexture.getValue(),
			backgroundEquirectangularTexture.getValue(),
			backgroundColorSpace.getValue(),
			backgroundBlurriness.getValue(),
			backgroundIntensity.getValue(),
			backgroundRotation.getValue()
		);

	}

	function refreshBackgroundUI() {

		const type = backgroundType.getValue();

		backgroundType.setWidth( type === 'Default' ? '150px' : '110px' );
		backgroundColor.setDisplay( type === 'Color' ? '' : 'none' );
		backgroundTexture.setDisplay( type === 'Texture' ? '' : 'none' );
		backgroundEquirectangularTexture.setDisplay( type === 'Equirectangular' ? '' : 'none' );
		backgroundEquirectRow.setDisplay( type === 'Equirectangular' ? '' : 'none' );

		if ( type === 'Texture' || type === 'Equirectangular' ) {

			backgroundColorSpaceRow.setDisplay( '' );

		} else {

			backgroundColorSpaceRow.setDisplay( 'none' );

		}

	}

	// environment

	const environmentRow = new UIRow();

	const environmentType = new UISelect().setOptions( {

		'Default': 'Default',
		'Equirectangular': 'Equirect',
		'None': 'None'

	} ).setWidth( '150px' );
	environmentType.setValue( 'Default' );
	environmentType.onChange( function () {

		onEnvironmentChanged();
		refreshEnvironmentUI();

	} );

	environmentRow.add( new UIText( strings.getKey( 'sidebar/scene/environment' ) ).setClass( 'Label' ) );
	environmentRow.add( environmentType );

	const environmentEquirectangularTexture = new UITexture( editor ).setMarginLeft( '8px' ).onChange( onEnvironmentChanged );
	environmentEquirectangularTexture.setDisplay( 'none' );
	environmentRow.add( environmentEquirectangularTexture );

	container.add( environmentRow );

	function onEnvironmentChanged() {

		signals.sceneEnvironmentChanged.dispatch(
			environmentType.getValue(),
			environmentEquirectangularTexture.getValue()
		);

	}

	function refreshEnvironmentUI() {

		const type = environmentType.getValue();

		environmentType.setWidth( type !== 'Equirectangular' ? '150px' : '110px' );
		environmentEquirectangularTexture.setDisplay( type === 'Equirectangular' ? '' : 'none' );

	}

	// fog

	function onFogChanged() {

		signals.sceneFogChanged.dispatch(
			fogType.getValue(),
			fogColor.getHexValue(),
			fogNear.getValue(),
			fogFar.getValue(),
			fogDensity.getValue()
		);

	}

	function onFogSettingsChanged() {

		signals.sceneFogSettingsChanged.dispatch(
			fogType.getValue(),
			fogColor.getHexValue(),
			fogNear.getValue(),
			fogFar.getValue(),
			fogDensity.getValue()
		);

	}

	const fogTypeRow = new UIRow();
	const fogType = new UISelect().setOptions( {

		'None': 'None',
		'Fog': 'Linear',
		'FogExp2': 'Exponential'

	} ).setWidth( '150px' );
	fogType.onChange( function () {

		onFogChanged();
		refreshFogUI();

	} );

	fogTypeRow.add( new UIText( strings.getKey( 'sidebar/scene/fog' ) ).setClass( 'Label' ) );
	fogTypeRow.add( fogType );

	container.add( fogTypeRow );

	// fog color

	const fogPropertiesRow = new UIRow();
	fogPropertiesRow.setDisplay( 'none' );
	fogPropertiesRow.setMarginLeft( '120px' );
	container.add( fogPropertiesRow );

	const fogColor = new UIColor().setValue( '#aaaaaa' );
	fogColor.onInput( onFogSettingsChanged );
	fogPropertiesRow.add( fogColor );

	// fog near

	const fogNear = new UINumber( 0.1 ).setWidth( '40px' ).setRange( 0, Infinity ).onChange( onFogSettingsChanged );
	fogPropertiesRow.add( fogNear );

	// fog far

	const fogFar = new UINumber( 50 ).setWidth( '40px' ).setRange( 0, Infinity ).onChange( onFogSettingsChanged );
	fogPropertiesRow.add( fogFar );

	// fog density

	const fogDensity = new UINumber( 0.05 ).setWidth( '40px' ).setRange( 0, 0.1 ).setStep( 0.001 ).setPrecision( 3 ).onChange( onFogSettingsChanged );
	fogPropertiesRow.add( fogDensity );

	//

	function refreshUI() {

		const camera = editor.camera;
		const scene = editor.scene;

		const options = [];

		options.push( buildOption( camera, false ) );
		options.push( buildOption( scene, false ) );

		( function addObjects( objects, pad ) {

			for ( let i = 0, l = objects.length; i < l; i ++ ) {

				const object = objects[ i ];

				if ( nodeStates.has( object ) === false ) {

					nodeStates.set( object, false );

				}

				const option = buildOption( object, true );
				option.style.paddingLeft = ( pad * 18 ) + 'px';
				options.push( option );

				if ( isSceneEditor ) continue;

				if ( nodeStates.get( object ) === true ) {

					addObjects( object.children, pad + 1 );

				}

			}

		} )( scene.children, 0 );

		outliner.setOptions( options );
		syncOutlinerSelection();

		backgroundType.setValue( editor.backgroundType );

		switch ( editor.backgroundType ) {

			case 'Color':
				backgroundColor.setHexValue( scene.background.getHex() );
				break;

			case 'Texture':
				backgroundTexture.setValue( scene.background );
				backgroundColorSpace.setValue( scene.background.colorSpace );
				break;

			case 'Equirectangular':
				backgroundEquirectangularTexture.setValue( scene.background );
				backgroundBlurriness.setValue( scene.backgroundBlurriness );
				backgroundIntensity.setValue( scene.backgroundIntensity );
				backgroundColorSpace.setValue( scene.background.colorSpace );
				break;

			default:
				backgroundTexture.setValue( null );
				backgroundEquirectangularTexture.setValue( null );
				backgroundColorSpace.setValue( THREE.NoColorSpace );

		}

		environmentType.setValue( editor.environmentType );

		if ( editor.environmentType === 'Equirectangular' ) {

			environmentEquirectangularTexture.setValue( scene.environment );

		} else {

			environmentEquirectangularTexture.setValue( null );

		}

		if ( scene.fog ) {

			fogColor.setHexValue( scene.fog.color.getHex() );

			if ( scene.fog.isFog ) {

				fogType.setValue( 'Fog' );
				fogNear.setValue( scene.fog.near );
				fogFar.setValue( scene.fog.far );

			} else if ( scene.fog.isFogExp2 ) {

				fogType.setValue( 'FogExp2' );
				fogDensity.setValue( scene.fog.density );

			}

		} else {

			fogType.setValue( 'None' );

		}

		refreshBackgroundUI();
		refreshEnvironmentUI();
		refreshFogUI();

	}

	function refreshFogUI() {

		const type = fogType.getValue();

		fogPropertiesRow.setDisplay( type === 'None' ? 'none' : '' );
		fogNear.setDisplay( type === 'Fog' ? '' : 'none' );
		fogFar.setDisplay( type === 'Fog' ? '' : 'none' );
		fogDensity.setDisplay( type === 'FogExp2' ? '' : 'none' );

	}

	refreshUI();

	// events

	signals.editorCleared.add( refreshUI );

	signals.sceneGraphChanged.add( refreshUI );

	signals.objectChanged.add( function ( object ) {

		const options = outliner.options;

		for ( let i = 0; i < options.length; i ++ ) {

			const option = options[ i ];

			if ( option.value === object.id ) {

				option.innerHTML = buildHTML( object );

				const openerElement = buildOpener( object );

				if ( openerElement ) {

					option.insertBefore( openerElement, option.firstChild );

				}

				return;

			}

		}

	} );

	signals.scriptAdded.add( function () {

		if ( editor.selected !== null ) signals.objectChanged.dispatch( editor.selected );

	} );

	signals.scriptRemoved.add( function () {

		if ( editor.selected !== null ) signals.objectChanged.dispatch( editor.selected );

	} );


	signals.objectSelected.add( function ( object ) {

		if ( ignoreObjectSelectedSignal === true ) return;

		if ( object !== null && object.parent !== null ) {

			let needsRefresh = false;
			let parent = object.parent;

			while ( parent !== editor.scene ) {

				if ( nodeStates.get( parent ) !== true ) {

					nodeStates.set( parent, true );
					needsRefresh = true;

				}

				parent = parent.parent;

			}

			if ( needsRefresh ) refreshUI();

			syncOutlinerSelection();

		} else {

			syncOutlinerSelection();

		}

	} );

	signals.sceneBackgroundChanged.add( function () {

		if ( environmentType.getValue() === 'Background' ) {

			onEnvironmentChanged();
			refreshEnvironmentUI();

		}

	} );

	return container;

}

export { SidebarScene };
