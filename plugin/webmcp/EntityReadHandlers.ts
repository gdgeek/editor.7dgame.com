import type { MrppEditor } from '../types/mrpp.js';
import { captureEditorState, contentVersion, getEditorContext } from './EditorContext.js';

export async function getEntityWebMcpState( editor: MrppEditor ): Promise<Record<string, unknown>> {
	const context = getEditorContext( editor );
	const loader = editor.metaLoader;
	if ( ! context.active || ! loader?.getMeta ) throw new Error( '实体编辑器尚未准备完成' );
	const meta = await loader.getMeta();
	const events = JSON.parse( JSON.stringify( editor.scene.events ?? { inputs: [], outputs: [] } ) );
	const snapshot = { meta, events };
	if ( context !== getEditorContext( editor ) || ! context.active ) throw new Error( '编辑器会话已改变' );
	return {
		ok: true, meta, events, entityId: editor.data?.id ?? null,
		entityVersion: contentVersion( snapshot ), changed: loader.json !== null && loader.json !== JSON.stringify( snapshot ),
		loading: Boolean( loader.getLoadingStatus?.() ), source: 'live-editor', contextGeneration: context.generation
	};
}

export async function markEntitySaved( editor: MrppEditor, payload: Record<string, unknown> ): Promise<Record<string, unknown>> {
	const assertCurrent = captureEditorState( editor );
	const state = await getEntityWebMcpState( editor );
	assertCurrent();
	if ( typeof payload.expectedEntityVersion !== 'string' || state.entityVersion !== payload.expectedEntityVersion ) {
		throw new Error( '保存完成前实体又发生了变化，当前编辑器仍保留未保存标记' );
	}
	editor.metaLoader.json = JSON.stringify( { meta: state.meta, events: state.events } );
	return { ok: true, entityVersion: state.entityVersion };
}

/** An applied command is acknowledged even if its subsequent read-back fails. */
export async function getEntityMutationReceipt( editor: MrppEditor ): Promise<Record<string, unknown>> {
	try {
		const state = await getEntityWebMcpState( editor );
		return { meta: state.meta, events: state.events, entityVersion: state.entityVersion, readBackVerified: true };
	} catch ( error ) {
		return { readBackVerified: false, readBackError: error instanceof Error ? error.message : String( error ) };
	}
}
