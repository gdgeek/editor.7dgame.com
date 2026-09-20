import { AddObjectCommand } from '../../three.js/editor/js/commands/AddObjectCommand.js';
import { MoveObjectCommand } from '../../three.js/editor/js/commands/MoveObjectCommand.js';
import { WebMcpBatchCommand } from '../commands/WebMcpBatchCommand.js';
import { Builder } from '../mrpp/Builder.js';
import type { MrppEditor } from '../types/mrpp.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { mergeAuthoringProperties } from '../webmcp/AuthoringProperties.js';
import { awaitEditorLoad, captureEditorState, getEditorContext, stableValue } from '../webmcp/EditorContext.js';
import { getEntityMutationReceipt, getEntityWebMcpState } from '../webmcp/EntityReadHandlers.js';
import { WebMcpMetaFactory } from '../webmcp/WebMcpMetaFactory.js';

type JsonRecord = Record<string, any>;
type Vector = { x: number; y: number; z: number };
type CreationItem = {
	clientKey: string;
	kind: 'resource' | 'empty' | 'text';
	parentNodeId?: string | null;
	parentClientKey?: string;
	name: string;
	visible: boolean;
	transform: { position: Vector; rotationDegrees: Vector; scale: Vector };
	resource?: JsonRecord;
	text?: JsonRecord;
};
type BatchOperation = { fingerprint: string; result?: JsonRecord; promise: Promise<JsonRecord> };
type Context = ReturnType<typeof getEditorContext>;

export const MAX_NODE_CREATION_ITEMS = 20;
const RESOURCE_TYPES = new Set( [ 'polygen', 'picture', 'video', 'voxel', 'audio', 'particle' ] );
// Receipts deliberately share the INIT/DESTROY lifetime of the editor context.
const operationStores = new WeakMap<Context, Map<string, BatchOperation>>();
const operationsFor = ( context: Context ) => {
	let store = operationStores.get( context );
	if ( ! store ) { store = new Map(); operationStores.set( context, store ); }
	return store;
};

class CreationError extends Error {
	constructor( readonly code: string, message: string ) { super( message ); }
}
const isRecord = ( value: unknown ): value is JsonRecord => typeof value === 'object' && value !== null && ! Array.isArray( value );
const stringValue = ( value: unknown, label: string, maxLength = 200 ): string => {
	if ( typeof value !== 'string' || ! value.trim() || value.length > maxLength || /[\u0000-\u001f\u007f]/.test( value ) ) {
		throw new TypeError( `${ label } 必须是 1–${ maxLength } 个字符的非空字符串，且不能包含控制字符` );
	}
	return value.trim();
};
const assertKeys = ( value: JsonRecord, keys: string[], label: string ) => {
	for ( const key of Object.keys( value ) ) if ( ! keys.includes( key ) ) throw new TypeError( `${ label }.${ key } 不受支持` );
};
const vector = ( value: unknown, label: string, fallback: number, limit: number ): Vector => {
	if ( value === undefined ) return { x: fallback, y: fallback, z: fallback };
	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	assertKeys( value, [ 'x', 'y', 'z' ], label );
	const result = { x: fallback, y: fallback, z: fallback };
	for ( const axis of [ 'x', 'y', 'z' ] as const ) {
		if ( value[ axis ] === undefined ) continue;
		if ( typeof value[ axis ] !== 'number' || ! Number.isFinite( value[ axis ] ) || Math.abs( value[ axis ] ) > limit ) {
			throw new TypeError( `${ label }.${ axis } 必须是绝对值不超过 ${ limit } 的有限数字` );
		}
		result[ axis ] = value[ axis ];
	}
	return result;
};
const resourceValue = ( value: unknown ): JsonRecord => {
	if ( ! isRecord( value ) ) throw new TypeError( 'resource 必须是已验证的资源对象' );
	const id = Number( value.id );
	if ( ! ( typeof value.id === 'number' || typeof value.id === 'string' ) || ! Number.isSafeInteger( id ) || id <= 0 ) throw new TypeError( 'resource.id 必须是正整数' );
	if ( typeof value.type !== 'string' || ! RESOURCE_TYPES.has( value.type.toLowerCase() ) ) throw new TypeError( 'resource.type 不受支持' );
	stringValue( value.name, 'resource.name', 500 );
	if ( ! isRecord( value.file ) || typeof value.file.url !== 'string' || ! value.file.url.trim() ) throw new TypeError( 'resource.file.url 不能为空' );
	return { ...JSON.parse( JSON.stringify( value ) ), id, type: value.type.toLowerCase() };
};

const parseItems = ( value: unknown ): CreationItem[] => {
	if ( ! Array.isArray( value ) || value.length < 1 || value.length > MAX_NODE_CREATION_ITEMS ) throw new TypeError( `items 必须包含 1–${ MAX_NODE_CREATION_ITEMS } 项` );
	const clientKeys = new Set<string>();
	return value.map( ( item, index ) => {
		const label = `items[${ index }]`;
		if ( ! isRecord( item ) ) throw new TypeError( `${ label } 必须是对象` );
		assertKeys( item, [ 'clientKey', 'kind', 'resource', 'resourceType', 'resourceId', 'parentNodeId', 'parentClientKey', 'name', 'visible', 'transform', 'text' ], label );
		const clientKey = stringValue( item.clientKey, `${ label }.clientKey`, 100 );
		if ( clientKeys.has( clientKey ) ) throw new TypeError( `clientKey ${ clientKey } 重复` );
		clientKeys.add( clientKey );
		if ( ! [ 'resource', 'empty', 'text' ].includes( item.kind ) ) throw new TypeError( `${ label }.kind 不受支持` );
		if ( item.parentClientKey !== undefined && item.parentNodeId !== undefined ) throw new TypeError( `${ label } 只能设置 parentNodeId 或 parentClientKey 中的一项` );
		const parent = item.parentClientKey === undefined
			? { parentNodeId: item.parentNodeId === undefined || item.parentNodeId === null ? null : stringValue( item.parentNodeId, `${ label }.parentNodeId` ) }
			: { parentClientKey: stringValue( item.parentClientKey, `${ label }.parentClientKey`, 100 ) };
		if ( item.visible !== undefined && typeof item.visible !== 'boolean' ) throw new TypeError( `${ label }.visible 必须是布尔值` );
		const transform = item.transform === undefined ? {} : item.transform;
		if ( ! isRecord( transform ) ) throw new TypeError( `${ label }.transform 必须是对象` );
		assertKeys( transform, [ 'position', 'rotationDegrees', 'scale' ], `${ label }.transform` );
		const resource = item.kind === 'resource' ? resourceValue( item.resource ) : undefined;
		if ( resource && ( item.resourceType !== undefined && item.resourceType !== resource.type || item.resourceId !== undefined && String( item.resourceId ) !== String( resource.id ) ) ) throw new TypeError( `${ label } 的资源标识与已验证资源不一致` );
		if ( ! resource && ( item.resource !== undefined || item.resourceType !== undefined || item.resourceId !== undefined ) ) throw new TypeError( `${ label } 不是资源节点，不能包含资源字段` );
		let text: JsonRecord | undefined;
		if ( item.kind === 'text' ) {
			const patch = item.text === undefined ? {} : item.text;
			if ( ! isRecord( patch ) ) throw new TypeError( `${ label }.text 必须是对象` );
			assertKeys( patch, [ 'content', 'size', 'color', 'rect', 'align', 'background', 'follow' ], `${ label }.text` );
			const { content, ...style } = patch;
			const normalized = mergeAuthoringProperties( 'Text', {}, { ...style, ...( content === undefined ? {} : { text: content } ) } );
			const { text: contentValue, ...normalizedStyle } = normalized;
			text = { content: contentValue, ...normalizedStyle };
		} else if ( item.text !== undefined ) throw new TypeError( `${ label } 不是文字节点，不能包含 text 字段` );
		return {
			clientKey, kind: item.kind, ...parent,
			name: item.name === undefined ? resource ? `${ resource.name } [${ resource.type === 'audio' ? 'sound' : resource.type }]`.slice( 0, 100 ) : item.kind === 'text' ? 'Text' : 'Point' : stringValue( item.name, `${ label }.name`, 100 ),
			visible: item.visible ?? true,
			transform: {
				position: vector( transform.position, `${ label }.transform.position`, 0, 1_000_000 ),
				rotationDegrees: vector( transform.rotationDegrees, `${ label }.transform.rotationDegrees`, 0, 360_000 ),
				scale: vector( transform.scale, `${ label }.transform.scale`, 1, 10_000 )
			}, ...( resource ? { resource } : {} ), ...( text ? { text } : {} )
		};
	} );
};

const existingParent = ( editor: MrppEditor, id: string | null | undefined ) => {
	if ( id === null || id === undefined ) return editor.scene;
	const node = editor.objectByUuid( id );
	if ( ! node || node === editor.scene || ! node.userData?.type || node.userData?.hidden ) throw new TypeError( `找不到可编辑父节点 ${ id }` );
	return node;
};

/** Stable topological order permits forward references without changing sibling order. */
const creationOrder = ( editor: MrppEditor, items: CreationItem[] ): CreationItem[] => {
	const byKey = new Map( items.map( item => [ item.clientKey, item ] ) );
	const seen = new Set<string>();
	const visiting = new Set<string>();
	const result: CreationItem[] = [];
	const visit = ( item: CreationItem ) => {
		if ( seen.has( item.clientKey ) ) return;
		if ( visiting.has( item.clientKey ) ) throw new TypeError( 'parentClientKey 不能构成循环层级' );
		visiting.add( item.clientKey );
		if ( item.parentClientKey !== undefined ) {
			const parent = byKey.get( item.parentClientKey );
			if ( ! parent ) throw new TypeError( `parentClientKey ${ item.parentClientKey } 不存在于本批次` );
			visit( parent );
		} else existingParent( editor, item.parentNodeId );
		visiting.delete( item.clientKey ); seen.add( item.clientKey ); result.push( item );
	};
	items.forEach( visit );
	const resources = new Map<string, string>();
	for ( const item of items ) if ( item.resource ) {
		const key = String( item.resource.id ), value = stableValue( item.resource );
		if ( resources.has( key ) && resources.get( key ) !== value ) throw new TypeError( `同一资源 ${ key } 不能包含冲突的资源数据` );
		resources.set( key, value );
	}
	return result;
};

const recovery = ( status: string, context: Context ) => ( {
	scope: 'editor-session', contextGeneration: context.generation,
	persisted: false, status,
	nextAction: status === 'applied' ? 'save_or_read_current_entity' : status === 'not_applied' ? 'preview_again_with_new_operation_id' : status === 'in_progress' ? 'query_same_operation' : 'inspect_entity_before_new_operation',
	safeToReplayWithNewOperationId: status === 'not_applied'
} );
const errorResult = ( error: unknown, context: Context, operationId?: string, status = 'not_applied' ): JsonRecord => ( {
	ok: false, operationId,
	code: error instanceof CreationError ? error.code : error instanceof TypeError || error instanceof RangeError ? 'INVALID_REQUEST' : error instanceof Error && error.message.includes( '超时' ) ? 'LOAD_TIMEOUT' : 'BATCH_FAILED',
	error: error instanceof Error ? error.message : String( error ),
	status, atomic: status !== 'unknown', recovery: recovery( status, context )
} );

/** One project-owned compound command; vendor editor and Three.js stay untouched. */
const applyNodes = ( editor: MrppEditor, items: CreationItem[], nodes: Map<string, any> ) => {
	const roots = items.filter( item => item.parentClientKey === undefined );
	const commands: any[] = [];
	const appended = new Map<any, number>();
	for ( const item of roots ) {
		const node = nodes.get( item.clientKey ), parent = existingParent( editor, item.parentNodeId );
		commands.push( new AddObjectCommand( editor, node ) );
		if ( parent !== editor.scene ) {
			const move = new MoveObjectCommand( editor, node, parent );
			// AddObjectCommand attaches to the root immediately before this command.
			move.oldParent = editor.scene; move.oldIndex = editor.scene.children.length;
			move.newIndex = parent.children.length + ( appended.get( parent ) ?? 0 );
			appended.set( parent, ( appended.get( parent ) ?? 0 ) + 1 );
			commands.push( move );
		}
	}
	const selected = editor.selected;
	try { executeAtomicCommand( editor, new WebMcpBatchCommand( editor, commands ) ); } catch ( error ) {
		// Also covers a late history/serialization signal failing after execute succeeded.
		for ( const item of [ ...roots ].reverse() ) {
			const node = nodes.get( item.clientKey );
			if ( node.parent ) {
				try { editor.removeObject( node ); } catch {
					try { node.removeFromParent(); } catch { /* Report any remaining parent below. */ }
				}
			}
		}
		try { editor.select( selected ); } catch { /* Removal and history restoration remain authoritative. */ }
		if ( roots.some( item => nodes.get( item.clientKey ).parent ) ) throw new CreationError( 'ROLLBACK_INCOMPLETE', '批次失败且回滚未完成，请先检查实体，不要重放创建' );
		throw error;
	}
};

export const createWebMcpNodeCreationRequestHandlers = ( editor: MrppEditor, options: { loadTimeoutMs?: number } = {} ) => ( {
	'webmcp-preview-node-creation-batch': async ( payload: JsonRecord ): Promise<JsonRecord> => {
		const context = getEditorContext( editor );
		try {
			const assertCurrent = captureEditorState( editor ); assertCurrent();
			const items = parseItems( payload.items );
			const order = creationOrder( editor, items );
			const state = await getEntityWebMcpState( editor ); assertCurrent();
			return {
				ok: true, items, expectedEntityVersion: state.entityVersion, contextGeneration: context.generation,
				creationOrder: order.map( item => item.clientKey ), maxItems: MAX_NODE_CREATION_ITEMS,
				summary: { total: items.length, resources: items.filter( item => item.kind === 'resource' ).length, empty: items.filter( item => item.kind === 'empty' ).length, text: items.filter( item => item.kind === 'text' ).length },
				atomic: true, persistence: 'save-required', recoveryScope: 'editor-session'
			};
		} catch ( error ) { return errorResult( error, context ); }
	},
	'webmcp-complete-node-creation-batch': async ( payload: JsonRecord ): Promise<JsonRecord> => {
		const context = getEditorContext( editor );
		let operationId: string | undefined;
		try {
			operationId = stringValue( payload.operationId, 'operationId' );
			const expectedEntityVersion = stringValue( payload.expectedEntityVersion, 'expectedEntityVersion' );
			const items = parseItems( payload.items );
			const fingerprint = stableValue( { expectedEntityVersion, items } );
			const store = operationsFor( context ), previous = store.get( operationId );
			if ( previous ) {
				if ( previous.fingerprint !== fingerprint ) throw new CreationError( 'OPERATION_CONFLICT', 'operationId 已用于另一份批次请求，请查询原操作回执' );
				return { ...await previous.promise, replayed: true };
			}
			if ( ! context.active ) throw new CreationError( 'CONTEXT_CHANGED', '编辑器会话已结束' );
			if ( context.busy ) throw new CreationError( 'EDITOR_BUSY', '另一项放入操作正在进行，请等待其完成' );
			if ( context.operations.has( operationId ) ) throw new CreationError( 'OPERATION_CONFLICT', 'operationId 已用于另一项编辑操作' );
			if ( context.operations.size >= 1000 ) throw new CreationError( 'OPERATION_LIMIT', '本次会话操作次数已达上限，请保存并重新打开编辑器' );
			context.operations.add( operationId ); context.busy = true;
			const key = operationId;
			const operation = {} as BatchOperation;
			operation.fingerprint = fingerprint;
			// Schedule after installing the receipt record so simultaneous retries join it.
			operation.promise = Promise.resolve().then( async () => {
				let committedItems: JsonRecord[] | undefined;
				let preparedItems: JsonRecord[] | undefined;
				try {
					const assertCurrent = captureEditorState( editor ); assertCurrent();
					const order = creationOrder( editor, items );
					const state = await getEntityWebMcpState( editor ); assertCurrent();
					if ( state.entityVersion !== expectedEntityVersion ) throw new CreationError( 'VERSION_CONFLICT', '实体在预览后已改变，请重新预览' );
					const shared = window.resources instanceof Map ? window.resources : new Map<string, any>();
					const resources = new Map( shared );
					const registered = Array.isArray( editor.data.resources ) ? [ ...editor.data.resources ] : [];
					for ( const item of items ) if ( item.resource ) {
						resources.set( String( item.resource.id ), item.resource );
						const at = registered.findIndex( ( resource: any ) => resource && String( resource.id ) === String( item.resource!.id ) );
						if ( at < 0 ) registered.push( item.resource ); else registered[ at ] = item.resource;
					}
					const factory = new WebMcpMetaFactory( editor ), builder = new Builder(), nodes = new Map<string, any>();
					// One deadline covers the whole batch; late loads can only produce detached nodes.
					let loading = true;
					try { await awaitEditorLoad( editor, ( async () => {
						for ( const item of order ) {
							const raw = item.kind === 'resource' ? builder.resource( item.resource as any ) : item.kind === 'text' ? builder.text( item.text!.content ) : builder.entity();
							if ( ! raw ) throw new Error( `无法创建 ${ item.clientKey }` );
							if ( item.text ) { const { content, ...style } = item.text; Object.assign( raw.parameters, style, { text: content } ); }
							Object.assign( raw.parameters, { name: item.name, active: item.visible, transform: { position: item.transform.position, rotate: item.transform.rotationDegrees, scale: item.transform.scale } } );
							const node = await factory.building( raw, resources );
							if ( ! loading ) return;
							assertCurrent();
							if ( ! node ) throw new Error( `节点 ${ item.clientKey } 加载失败` );
							nodes.set( item.clientKey, node );
						}
					} )(), options.loadTimeoutMs ); } finally { loading = false; }
					const latest = await getEntityWebMcpState( editor ); assertCurrent();
					if ( latest.entityVersion !== expectedEntityVersion ) throw new CreationError( 'VERSION_CONFLICT', '实体在加载期间已改变，请重新预览' );
					// Use request order to preserve siblings even when parents were forward references.
					for ( const item of items ) if ( item.parentClientKey !== undefined ) nodes.get( item.parentClientKey ).add( nodes.get( item.clientKey ) );
					const itemReceipts = items.map( item => {
						const node = nodes.get( item.clientKey );
						return { clientKey: item.clientKey, kind: item.kind, nodeId: node.uuid, nodeName: node.name, nodeType: node.userData?.type || node.type, parentNodeId: item.parentClientKey === undefined ? item.parentNodeId ?? null : nodes.get( item.parentClientKey ).uuid, resourceId: item.resource?.id ?? null, status: 'applied' };
					} );
					preparedItems = itemReceipts;
					applyNodes( editor, items, nodes );
					committedItems = itemReceipts;
					window.resources = resources;
					editor.data.resources = registered;
					const receipt = await getEntityMutationReceipt( editor );
					return {
						ok: true, operationId: key, status: 'applied', atomic: true, replayed: false,
						items: committedItems,
						...receipt, recovery: recovery( 'applied', context )
					};
				} catch ( error ) {
					if ( committedItems ) return {
						ok: true, operationId: key, status: 'applied', atomic: true, replayed: false, items: committedItems,
						readBackVerified: false, readBackError: error instanceof Error ? error.message : String( error ),
						recovery: recovery( 'applied', context )
					};
					const result = errorResult( error, context, key, error instanceof CreationError && error.code === 'ROLLBACK_INCOMPLETE' ? 'unknown' : 'not_applied' );
					return { ...result, items: ( result.status === 'unknown' && preparedItems ? preparedItems : items.map( item => ( { clientKey: item.clientKey, kind: item.kind } ) ) ).map( item => ( { ...item, status: result.status, error: result.error } ) ) };
				} finally { context.busy = false; }
			} ).then( result => { operation.result = result; return result; } );
			store.set( key, operation );
			return await operation.promise;
		} catch ( error ) { return errorResult( error, context, operationId, error instanceof CreationError && error.code === 'OPERATION_CONFLICT' ? 'unknown' : 'not_applied' ); }
	},
	'webmcp-get-node-creation-operation': ( payload: JsonRecord ): JsonRecord => {
		const context = getEditorContext( editor );
		try {
			const operationId = stringValue( payload.operationId, 'operationId' );
			const operation = operationsFor( context ).get( operationId );
			if ( operation?.result ) return { ...operation.result, replayed: true };
			const status = operation ? 'in_progress' : 'unknown';
			return { ok: Boolean( operation ), operationId, status, code: operation ? 'IN_PROGRESS' : 'OPERATION_UNKNOWN', recovery: recovery( status, context ) };
		} catch ( error ) { return errorResult( error, context ); }
	}
} );
