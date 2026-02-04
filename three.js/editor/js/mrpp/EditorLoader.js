import { SceneCreater } from './SceneCreater.js';
function EditorLoader( editor ) {

	const creater = new SceneCreater( editor );

	this.load = function ( input ) {

		const data = JSON.parse( input.data );

		editor.clear();
		creater
			.loadResources( input.resources )
			.then( resources => {

				creater.draw( data, resources );

			} )
			.catch( error => {

				console.error( 'EditorLoader error:', error );

			} );

	};

}

export { EditorLoader };
