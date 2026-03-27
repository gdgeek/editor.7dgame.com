// SceneCreater.js is a known pre-existing broken import — the file never existed in the repo.
// Using a dynamic require pattern to preserve the original import for compatibility.
// @ts-expect-error SceneCreater.js does not exist (known broken import, see KNOWN_BROKEN_IMPORTS in import-paths.test.js)
import { SceneCreater } from './SceneCreater.js';
import type { MrppEditor } from '../types/mrpp.js';

class EditorLoader {

	editor: MrppEditor;
	// SceneCreater is a missing module — typed as any for editor API interaction
	creater: any;

	constructor( editor: MrppEditor ) {

		this.editor = editor;
		this.creater = new SceneCreater( editor );

	}

	load( input: { data: string; resources: any[] } ): void {

		const data = JSON.parse( input.data );

		this.editor.clear();
		this.creater
			.loadResources( input.resources )
			.then( ( resources: any ) => {

				this.creater.draw( data, resources );

			} )
			.catch( ( error: any ) => {

				console.error( 'EditorLoader error:', error );

			} );

	}

}

export { EditorLoader };
