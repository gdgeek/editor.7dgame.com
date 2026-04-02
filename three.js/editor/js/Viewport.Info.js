import { UIPanel, UIBreak, UIText } from './libs/ui.js';

function ViewportInfo( editor ) {

	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UIPanel();
	container.setId( 'info' );
	container.setPosition( 'absolute' );
	container.setLeft( '10px' );
	container.setBottom( '10px' );
	container.setFontSize( '12px' );
	container.setColor( '#fff' );
	container.setTextTransform( 'none' );

	const objectsLabelText = new UIText( strings.getKey( 'viewport/info/objects' ) ).setWidth( '48px' ).setTextAlign( 'left' ).setMarginRight( '6px' );
	const verticesLabelText = new UIText( strings.getKey( 'viewport/info/vertices' ) ).setWidth( '48px' ).setTextAlign( 'left' ).setMarginRight( '6px' );
	const trianglesLabelText = new UIText( strings.getKey( 'viewport/info/triangles' ) ).setWidth( '48px' ).setTextAlign( 'left' ).setMarginRight( '6px' );
	const frametimeLabelText = new UIText( strings.getKey( 'viewport/info/rendertime' ) ).setWidth( '48px' ).setTextAlign( 'left' ).setMarginRight( '6px' );
	const samplesLabelText = new UIText( strings.getKey( 'viewport/info/samples' ) ).setWidth( '48px' ).setTextAlign( 'left' ).setMarginRight( '6px' ).setHidden( true );

	const objectsText = new UIText( '0' ).setTextAlign( 'left' ).setWidth( '90px' );
	const verticesText = new UIText( '0' ).setTextAlign( 'left' ).setWidth( '90px' );
	const trianglesText = new UIText( '0' ).setTextAlign( 'left' ).setWidth( '90px' );
	const frametimeText = new UIText( '0' ).setTextAlign( 'left' ).setWidth( '90px' );
	const samplesText = new UIText( '0' ).setTextAlign( 'left' ).setWidth( '90px' ).setHidden( true );

	container.add( objectsLabelText, objectsText, new UIBreak() );
	container.add( verticesLabelText, verticesText, new UIBreak() );
	container.add( trianglesLabelText, trianglesText, new UIBreak() );
	container.add( frametimeLabelText, frametimeText, new UIBreak() );
	container.add( samplesLabelText, samplesText, new UIBreak() );

	signals.objectAdded.add( update );
	signals.objectRemoved.add( update );
	signals.objectChanged.add( update );
	signals.geometryChanged.add( update );
	signals.sceneGraphChanged.add( update );
	signals.sceneRendered.add( updateFrametime );
	signals.objectSelected.add( update );

	//

	const pluralRules = new Intl.PluralRules( editor.config.getKey( 'language' ) );

	//

	function collectStats( root ) {

		let objects = 0;
		let vertices = 0;
		let triangles = 0;

		if ( ! root ) return { objects, vertices, triangles };

		root.traverseVisible( function ( object ) {

			objects ++;

			if ( object.isMesh || object.isPoints ) {

				const geometry = object.geometry;
				if ( ! geometry || ! geometry.attributes ) return;

				const positionAttribute = geometry.attributes.position;

				if ( positionAttribute !== undefined && positionAttribute !== null ) {

					vertices += positionAttribute.count;

				}

				if ( object.isMesh ) {

					if ( geometry.index !== null ) {

						triangles += geometry.index.count / 3;

					} else if ( positionAttribute !== undefined && positionAttribute !== null ) {

						triangles += positionAttribute.count / 3;

					}

				}

			}

		} );

		return { objects, vertices, triangles };

	}

	function getSceneObjects() {

		return editor.scene.children.filter( function ( object ) {

			if ( ! object ) return false;
			if ( object.userData && object.userData.hidden === true ) return false;
			if ( object.name && object.name.charAt( 0 ) === '$' ) return false;

			return true;

		} );

	}

	function getTopLevelSceneObject( object ) {

		if ( ! object || object === editor.scene || object === editor.camera ) return null;

		let target = object;

		while ( target.parent && target.parent !== editor.scene ) {

			target = target.parent;

		}

		return target.parent === editor.scene ? target : null;

	}

	function update() {

		const sceneObjects = getSceneObjects();
		const sceneStats = collectStats( editor.scene );
		const internalSelectedObjects = Array.isArray( editor.selectedObjects ) ? editor.selectedObjects : [];
		let selected = null;

		if ( internalSelectedObjects.length === 1 ) {

			selected = internalSelectedObjects[ 0 ];

		} else if ( internalSelectedObjects.length === 0 && editor.selected && editor.selected !== editor.scene && editor.selected !== editor.camera ) {

			selected = editor.selected;

		}

		const selectedTopLevel = getTopLevelSceneObject( selected );
		const hasSingleSelection = selectedTopLevel !== null;
		const selectedStats = hasSingleSelection ? collectStats( selectedTopLevel ) : null;

		if ( hasSingleSelection ) {

			objectsText.setValue(
				editor.utils.formatNumber( 1 ) + ' / ' + editor.utils.formatNumber( sceneObjects.length )
			);
			verticesText.setValue(
				editor.utils.formatNumber( selectedStats.vertices ) + ' / ' + editor.utils.formatNumber( sceneStats.vertices )
			);
			trianglesText.setValue(
				editor.utils.formatNumber( selectedStats.triangles ) + ' / ' + editor.utils.formatNumber( sceneStats.triangles )
			);

		} else {

			objectsText.setValue( editor.utils.formatNumber( sceneObjects.length ) );
			verticesText.setValue( editor.utils.formatNumber( sceneStats.vertices ) );
			trianglesText.setValue( editor.utils.formatNumber( sceneStats.triangles ) );

		}

	}

	function updateFrametime( frametime ) {

		frametimeText.setValue( Number( frametime ).toFixed( 2 ) );

	}

	//

	editor.signals.pathTracerUpdated.add( function ( samples ) {

		samples = Math.floor( samples );

		samplesText.setValue( samples );

		const samplesStringKey = ( pluralRules.select( samples ) === 'one' ) ? 'viewport/info/sample' : 'viewport/info/samples';
		samplesLabelText.setValue( strings.getKey( samplesStringKey ) );

	} );

	editor.signals.viewportShadingChanged.add( function () {

		const isRealisticShading = ( editor.viewportShading === 'realistic' );

		samplesText.setHidden( ! isRealisticShading );
		samplesLabelText.setHidden( ! isRealisticShading );

		container.setBottom( isRealisticShading ? '22px' : '10px' );

	} );

	update();

	return container;

}

export { ViewportInfo };
