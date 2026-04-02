import { UIPanel } from './libs/ui.js';

function ViewportControls( editor ) {

	const signals = editor.signals;

	const container = new UIPanel();
	container.setPosition( 'absolute' );
	container.setRight( '10px' );
	container.setTop( '10px' );

	signals.editorCleared.add( function () {

		editor.setViewportCamera( editor.camera.uuid );
		editor.setViewportShading( 'solid' );

	} );

	signals.cameraAdded.add( update );
	signals.cameraRemoved.add( update );
	signals.objectChanged.add( function ( object ) {

		if ( object.isCamera ) {

			update();

		}

	} );

	signals.cameraResetted.add( update );

	update();
	editor.setViewportShading( 'solid' );

	//

	function update() {

		const cameras = editor.cameras;
		const hasViewportCamera = editor.viewportCamera && editor.viewportCamera.uuid in cameras;
		const selectedCamera = hasViewportCamera ? editor.viewportCamera : editor.camera;
		editor.setViewportCamera( selectedCamera.uuid );

	}

	return container;

}

export { ViewportControls };
