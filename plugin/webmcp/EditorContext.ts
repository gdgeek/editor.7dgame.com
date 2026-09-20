import type { MrppEditor } from '../types/mrpp.js';
import { getEditorAnimationAuthoringTransform } from './EditorAnimationPreview.js';

type Context = { generation: number; active: boolean; busy: boolean; operations: Set<string>; controller: AbortController };
const contexts = new WeakMap<MrppEditor, Context>();

export function getEditorContext( editor: MrppEditor ): Context {
	let context = contexts.get( editor );
	if ( ! context ) {
		context = { generation: 0, active: true, busy: false, operations: new Set(), controller: new AbortController() };
		contexts.set( editor, context );
	}
	return context;
}

export function resetEditorContext( editor: MrppEditor, active = true ): void {
	const previous = getEditorContext( editor );
	previous.active = false;
	previous.controller.abort();
	contexts.set( editor, { generation: previous.generation + 1, active, busy: false, operations: new Set(), controller: new AbortController() } );
}

/** Stop waiting promptly on navigation; underlying third-party loaders remain untouched. */
export async function awaitEditorLoad<T>( editor: MrppEditor, load: Promise<T>, timeoutMs = 60000 ): Promise<T> {
	const context = getEditorContext( editor );
	if ( ! context.active ) throw new Error( '编辑器会话已结束' );
	let timer: ReturnType<typeof setTimeout>;
	let abort: () => void = () => {};
	const cancelled = new Promise<never>( ( _, reject ) => {
		abort = () => reject( new Error( '编辑器会话已改变，加载操作已取消' ) );
		context.controller.signal.addEventListener( 'abort', abort, { once: true } );
		timer = setTimeout( () => reject( new Error( '素材加载超时，请重新预览操作' ) ), timeoutMs );
	} );
	try { return await Promise.race( [ load, cancelled ] ); } finally {
		clearTimeout( timer! );
		context.controller.signal.removeEventListener( 'abort', abort );
	}
}

export function stableValue( value: any ): string {
	if ( Array.isArray( value ) ) return `[${ value.map( stableValue ).join( ',' ) }]`;
	if ( value !== null && typeof value === 'object' ) {
		return `{${ Object.keys( value ).sort().map( key => `${ JSON.stringify( key ) }:${ stableValue( value[ key ] ) }` ).join( ',' ) }}`;
	}
	return JSON.stringify( value ) ?? 'null';
}

/** Authored state only: no renderer internals, geometry buffers, or parent cycles. */
export const authoredObjectSnapshot = ( object: any ): Record<string, unknown> => {
	const authored = getEditorAnimationAuthoringTransform( object ) ?? object;
	return {
	uuid: object.uuid, name: object.name, type: object.type, visible: authored.visible,
	position: authored.position?.toArray(), quaternion: authored.quaternion?.toArray(),
	scale: authored.scale?.toArray(), userData: object.userData ?? {},
	components: object.components ?? [], commands: object.commands ?? [], events: object.events,
	children: ( object.children ?? [] ).map( authoredObjectSnapshot )
	};
};

export function contentVersion( value: unknown ): string {
	const serialized = stableValue( value );
	let hash = 2166136261;
	for ( let index = 0; index < serialized.length; index ++ ) {
		hash = Math.imul( hash ^ serialized.charCodeAt( index ), 16777619 );
	}
	return `editor-v1-${ serialized.length }-${ ( hash >>> 0 ).toString( 16 ) }`;
}

export function captureEditorState( editor: MrppEditor ): () => void {
	const context = getEditorContext( editor );
	const scene = editor.scene;
	const data = editor.data;
	const snapshot = stableValue( authoredObjectSnapshot( scene ) );
	return () => {
		if ( ! context.active || context !== getEditorContext( editor ) || editor.scene !== scene || editor.data !== data ) {
			throw new Error( '编辑器会话已改变，请重新预览操作' );
		}
		if ( editor.data?.saveable === false || editor.metaLoader?.getLoadingStatus?.() || editor.verseLoader?.getLoadingStatus?.() ) {
			throw new Error( '编辑器当前不可写入' );
		}
		if ( stableValue( authoredObjectSnapshot( editor.scene ) ) !== snapshot ) {
			throw new Error( '编辑内容在加载期间已改变，请重新预览操作' );
		}
	};
}

/** Reserve before the first await. An attempted operation ID is never retried in this session. */
export async function withPlacement<T>( editor: MrppEditor, payload: Record<string, unknown>, run: () => Promise<T> ): Promise<T> {
	const context = getEditorContext( editor );
	if ( ! context.active ) throw new Error( '编辑器会话已结束' );
	if ( context.busy ) throw new Error( '另一项放入操作正在进行，请等待其完成' );
	const operationId = payload.operationId;
	if ( operationId !== undefined ) {
		if ( typeof operationId !== 'string' || ! operationId.trim() || operationId.length > 200 ) throw new Error( 'operationId 无效' );
		if ( context.operations.has( operationId ) ) throw new Error( '此操作已执行或已尝试，请重新预览' );
		if ( context.operations.size >= 1000 ) throw new Error( '本次会话操作次数已达上限，请重新打开编辑器' );
		context.operations.add( operationId );
	}
	context.busy = true;
	try { return await run(); } finally { context.busy = false; }
}
