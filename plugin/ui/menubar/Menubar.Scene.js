import { UIPanel, UIRow } from '../../../three.js/editor/js/libs/ui.js';

function MenubarScene( editor ) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/scene' ) );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	let sceneItems = [];

	function normalizeSceneItems( input ) {

		if ( ! Array.isArray( input ) ) return [];

		const items = input.map( function ( item ) {

			let id = null;
			let name = '';

			if ( typeof item === 'string' ) {

				name = item.trim();
				return { id, name };

			}
			if ( item && typeof item === 'object' ) {

				const rawId = item.id ?? item.verse_id ?? item.sceneId ?? item.scene_id;
				const parsedId = Number( rawId );
				id = Number.isFinite( parsedId ) ? parsedId : null;
				name = String(
					item.name ||
					item.title ||
					item.sceneName ||
					item.scene ||
					''
				).trim();
				return { id, name };

			}

			return { id: null, name: '' };

		} ).filter( function ( item ) {
			return Boolean( item.name );
		} );

		const deduped = [];
		const keySet = new Set();

		items.forEach( function ( item ) {

			const key = item.id !== null ? 'id:' + item.id : 'name:' + item.name;
			if ( keySet.has( key ) ) return;
			keySet.add( key );
			deduped.push( item );

		} );

		return deduped;

	}

	function extractSceneItems( payload ) {

		if ( ! payload || typeof payload !== 'object' ) return [];

		const candidates = [
			payload.entityUsedScenes,
			payload.entityScenes,
			payload.loadedScenes,
			payload.scenes,
			payload.sceneList,
			payload.usedSceneList,
			payload.relatedScenes,
			payload.usedScenes,
			payload.sceneNames,
			payload.verseScenes,
			payload.verses,
			payload.data && payload.data.entityUsedScenes,
			payload.data && payload.data.entityScenes,
			payload.data && payload.data.loadedScenes,
			payload.data && payload.data.scenes,
			payload.data && payload.data.sceneList,
			payload.data && payload.data.usedSceneList,
			payload.data && payload.data.relatedScenes,
			payload.data && payload.data.usedScenes,
			payload.data && payload.data.sceneNames,
			payload.data && payload.data.verseScenes,
			payload.data && payload.data.verses,
			payload.entitySceneNames,
			payload.data && payload.data.entitySceneNames
		];

		let fallback = [];

		for ( let i = 0; i < candidates.length; i ++ ) {

			const items = normalizeSceneItems( candidates[ i ] );
			if ( items.length === 0 ) continue;
			if ( items.some( function ( item ) { return item.id !== null; } ) ) {
				return items;
			}
			if ( fallback.length === 0 ) {
				fallback = items;
			}

		}

		return fallback;

	}

	function renderOptions() {

		while ( options.dom.firstChild ) {
			options.dom.removeChild( options.dom.firstChild );
		}

		if ( sceneItems.length === 0 ) {

			const emptyRow = new UIRow();
			emptyRow.setClass( 'inactive' );
			emptyRow.setTextContent( strings.getKey( 'menubar/scene/empty' ) );
			options.add( emptyRow );
			return;

		}

		sceneItems.forEach( function ( scene ) {
			const row = new UIRow();
			row.setClass( 'option' );
			row.setTextContent( scene.name );
			row.onClick( function () {
				signals.messageSend.dispatch( {
					action: 'goto',
					data: {
						target: 'verse.scene',
						sceneId: scene.id,
						sceneName: scene.name
					}
				} );
			} );
			options.add( row );
		} );

	}

	function updateFromPayload( payload ) {

		const items = extractSceneItems( payload );
		sceneItems = items;
		renderOptions();

	}

	signals.messageReceive.add( function ( params ) {

		if ( ! params ) return;

		if ( params.action === 'load' ) {
			updateFromPayload( params.data );
			return;
		}

		if ( params.action === 'scene-list' || params.action === 'entity-scenes' || params.action === 'loaded-scenes' ) {
			updateFromPayload( params.data );
		}

	} );

	if ( editor.data ) {
		updateFromPayload( editor.data );
	}

	renderOptions();

	return container;

}

export { MenubarScene };
