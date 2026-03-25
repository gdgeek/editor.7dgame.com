import { UIPanel, UIRow } from '../../../three.js/editor/js/libs/ui.js';

function MenubarEntity( editor ) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/entity' ) );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	let entityItems = [];

	function normalizeEntityItems( input ) {

		if ( ! Array.isArray( input ) ) return [];

		const items = input.map( function ( item ) {

			let id = null;
			let name = '';

			if ( typeof item === 'string' ) {

				name = item.trim();
				return { id, name };

			}

			if ( item && typeof item === 'object' ) {

				const rawId = item.id ?? item.meta_id ?? item.metaId ?? item.entityId ?? item.entity_id;
				const parsedId = Number( rawId );
				id = Number.isFinite( parsedId ) ? parsedId : null;
				name = String(
					item.name ||
					item.title ||
					item.metaName ||
					item.entityName ||
					''
				).trim();
				return { id, name };

			}

			return { id: null, name: '' };

		} ).filter( function ( item ) {
			return item.id !== null && Boolean( item.name );
		} );

		const deduped = [];
		const keySet = new Set();

		items.forEach( function ( item ) {

			const key = 'id:' + item.id;
			if ( keySet.has( key ) ) return;
			keySet.add( key );
			deduped.push( item );

		} );

		return deduped;

	}

	function extractEntityItems( payload ) {

		if ( ! payload || typeof payload !== 'object' ) return [];

		const candidates = [
			payload.loadedEntities,
			payload.entities,
			payload.entityList,
			payload.metas,
			payload.metaList,
			payload.data && payload.data.loadedEntities,
			payload.data && payload.data.entities,
			payload.data && payload.data.entityList,
			payload.data && payload.data.metas,
			payload.data && payload.data.metaList
		];

		for ( let i = 0; i < candidates.length; i ++ ) {

			const items = normalizeEntityItems( candidates[ i ] );
			if ( items.length > 0 ) return items;

		}

		return [];

	}

	function extractFromSceneModules() {

		const result = [];
		const keySet = new Set();

		editor.scene.children.forEach( function ( object ) {

			if ( ! object || ! object.userData ) return;
			const type = typeof object.type === 'string' ? object.type.toLowerCase() : '';
			if ( type !== 'module' ) return;

			const rawId = object.userData.meta_id;
			const id = Number( rawId );
			if ( ! Number.isFinite( id ) ) return;

			const key = 'id:' + id;
			if ( keySet.has( key ) ) return;
			keySet.add( key );

			const name = String( object.userData.meta_name || object.name || ( 'meta-' + id ) ).trim();
			result.push( { id, name } );

		} );

		return result;

	}

	function renderOptions() {

		while ( options.dom.firstChild ) {
			options.dom.removeChild( options.dom.firstChild );
		}

		if ( entityItems.length === 0 ) {

			const emptyRow = new UIRow();
			emptyRow.setClass( 'inactive' );
			emptyRow.setTextContent( strings.getKey( 'menubar/entity/empty' ) );
			options.add( emptyRow );
			return;

		}

		entityItems.forEach( function ( entity ) {
			const row = new UIRow();
			row.setClass( 'option' );
			row.setTextContent( entity.name );
			row.onClick( function () {

				if ( editor.verseLoader && editor.verseLoader.getLoadingStatus() ) return;

				signals.messageSend.dispatch( {
					action: 'edit-meta',
					data: {
						meta_id: entity.id,
						meta_name: entity.name
					}
				} );

			} );
			options.add( row );
		} );

	}

	function updateFromPayload( payload ) {

		const items = extractEntityItems( payload );
		entityItems = items.length > 0 ? items : extractFromSceneModules();
		renderOptions();

	}

	signals.messageReceive.add( function ( params ) {

		if ( ! params ) return;

		if ( params.action === 'load' ) {
			updateFromPayload( params.data );
			return;
		}

		if (
			params.action === 'entity-list' ||
			params.action === 'loaded-entities' ||
			params.action === 'meta-list'
		) {
			updateFromPayload( params.data );
		}

	} );

	signals.sceneGraphChanged.add( function () {
		if ( entityItems.length === 0 ) {
			entityItems = extractFromSceneModules();
			renderOptions();
		}
	} );

	if ( editor.data ) {
		updateFromPayload( editor.data );
	}

	renderOptions();

	return container;

}

export { MenubarEntity };
