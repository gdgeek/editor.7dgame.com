import type { MrppEditor } from '../types/mrpp.js';
import { getEditorContext } from './EditorContext.js';

export const createVerseSceneVersion = ( verse: unknown ): string => {

	const json = JSON.stringify( verse ?? null );
	let hash = 2166136261;
	for ( let index = 0; index < json.length; index += 1 ) {

		hash ^= json.charCodeAt( index );
		hash = Math.imul( hash, 16777619 );

	}
	return `verse-v1-${ json.length }-${ ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' ) }`;

};

const selectedModuleIds = ( editor: MrppEditor ): string[] => {

	const selected = typeof editor.getSelectedObjects === 'function'
		? editor.getSelectedObjects()
		: editor.selected
			? [ editor.selected ]
			: [];

	return selected
		.filter( ( object ) => object?.type === 'Module' && object.uuid )
		.map( ( object ) => String( object.uuid ) );

};

export const getVerseSceneWebMcpState = async (
	editor: MrppEditor
): Promise<Record<string, unknown>> => {

	const loader = editor.verseLoader;
	const context = getEditorContext( editor );
	if ( ! loader || typeof loader.getVerse !== 'function' ) {

		throw new Error( '场景编辑器尚未准备完成' );

	}

	const verse = await loader.getVerse();
	if ( ! context.active || context !== getEditorContext( editor ) ) throw new Error( '编辑器会话已改变' );
	const changed = loader.json !== null && loader.json !== undefined && loader.json !== JSON.stringify( { verse } );
	const loading = typeof loader.getLoadingStatus === 'function'
		? Boolean( loader.getLoadingStatus() )
		: false;

	return {
		ok: true,
		verse,
		sceneVersion: createVerseSceneVersion( verse ),
		changed: Boolean( changed ),
		loading,
		loadProgress: loader.getLoadingProgress?.() ?? null, source: 'live-editor', contextGeneration: context.generation,
		selectedModuleIds: selectedModuleIds( editor )
	};

};

export async function getSceneMutationReceipt( editor: MrppEditor ): Promise<Record<string, unknown>> {
	try {
		const state = await getVerseSceneWebMcpState( editor );
		return { verse: state.verse, sceneVersion: state.sceneVersion, readBackVerified: true };
	} catch ( error ) {
		return { readBackVerified: false, readBackError: error instanceof Error ? error.message : String( error ) };
	}
}
