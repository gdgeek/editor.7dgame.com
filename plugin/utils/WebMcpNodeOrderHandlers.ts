import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { MoveObjectCommand } from '../../three.js/editor/js/commands/MoveObjectCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;

type OrderSnapshot = {
	parentNodeId: string | null;
	parentName: string;
	currentIndex: number;
	siblingCount: number;
	siblingOrderVersion: string;
};

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const parseNodeId = ( value: unknown, label: string ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label } 不能为空` );

	}
	return value.trim();

};

const parseBeforeNodeId = ( value: unknown ): string | null => {

	if ( value === null ) return null;
	return parseNodeId( value, 'beforeNodeId' );

};

const getNode = ( editor: MrppEditor, nodeId: string ) => {

	const object = editor.objectByUuid( nodeId );
	if ( ! object || object === editor.scene || ! object.userData?.type || ! object.parent ) {

		throw new Error( `找不到可排序节点 ${ nodeId }` );

	}
	return object;

};

const getEntitySiblings = ( object: any ) =>
	object.parent.children.filter( ( sibling: any ) => Boolean( sibling.userData?.type ) );

const fnv1a = ( value: string ) => {

	let hash = 0x811c9dc5;
	for ( let index = 0; index < value.length; index ++ ) {

		hash ^= value.charCodeAt( index );
		hash = Math.imul( hash, 0x01000193 );

	}
	return ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' );

};

const readOrderSnapshot = ( editor: MrppEditor, object: any ): OrderSnapshot => {

	const parent = object.parent;
	if ( ! parent ) throw new Error( '节点当前没有有效父级' );
	const siblings = getEntitySiblings( object );
	const currentIndex = siblings.indexOf( object );
	if ( currentIndex < 0 ) throw new Error( '节点不在可排序的同级列表中' );
	return {
		parentNodeId: parent === editor.scene ? null : parent.uuid,
		parentName: parent === editor.scene ? '实体根层级' : parent.name || '未命名节点',
		currentIndex,
		siblingCount: siblings.length,
		siblingOrderVersion: fnv1a(
			siblings.map( ( sibling: any ) =>
				`${ sibling.uuid }:${ sibling.name || '' }:${ sibling.userData?.type || '' }`
			).join( '|' )
		)
	};

};

const parseOrderSnapshot = ( value: unknown ): OrderSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expected 必须是对象' );
	const parentNodeId = value.parentNodeId === null
		? null
		: parseNodeId( value.parentNodeId, 'expected.parentNodeId' );
	for ( const key of [ 'currentIndex', 'siblingCount' ] ) {

		const number = value[ key ];
		if ( typeof number !== 'number' || ! Number.isSafeInteger( number ) || number < 0 ) {

			throw new TypeError( `expected.${ key } 必须是非负整数` );

		}

	}
	if ( typeof value.siblingOrderVersion !== 'string' || ! value.siblingOrderVersion ) {

		throw new TypeError( 'expected.siblingOrderVersion 不能为空' );

	}
	return {
		parentNodeId,
		parentName: typeof value.parentName === 'string' ? value.parentName : '',
		currentIndex: value.currentIndex as number,
		siblingCount: value.siblingCount as number,
		siblingOrderVersion: value.siblingOrderVersion
	};

};

const snapshotsEqual = ( left: OrderSnapshot, right: OrderSnapshot ) =>
	left.parentNodeId === right.parentNodeId &&
	left.currentIndex === right.currentIndex &&
	left.siblingCount === right.siblingCount &&
	left.siblingOrderVersion === right.siblingOrderVersion;

const resolveBeforeNode = (
	editor: MrppEditor,
	object: any,
	beforeNodeId: string | null
) => {

	if ( beforeNodeId === null ) return null;
	if ( beforeNodeId === object.uuid ) throw new Error( 'beforeNodeId 不能是待排序节点自身' );
	const before = getNode( editor, beforeNodeId );
	if ( before.parent !== object.parent ) {

		throw new Error( '待排序节点和 beforeNodeId 必须位于同一父级' );

	}
	return before;

};

const getTargetIndex = ( object: any, before: any | null ) => {

	const siblings = getEntitySiblings( object );
	const withoutObject = siblings.filter( ( sibling: any ) => sibling !== object );
	if ( before === null ) return withoutObject.length;
	const targetIndex = withoutObject.indexOf( before );
	if ( targetIndex < 0 ) throw new Error( 'beforeNodeId 不在可排序的同级列表中' );
	return targetIndex;

};

const assertEditable = ( editor: MrppEditor ) => {

	if ( editor.data?.saveable === false ) throw new Error( '当前实体没有编辑权限' );
	if ( editor.metaLoader?.getLoadingStatus?.() ) {

		throw new Error( '实体模型仍在加载，请稍后重试' );

	}

};

const errorResult = ( error: unknown ) => ( {
	ok: false,
	code: 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );

export const createWebMcpNodeOrderRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-stage-node-reorder': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId, 'nodeId' ) );
			const beforeNodeId = parseBeforeNodeId( payload.beforeNodeId );
			const before = resolveBeforeNode( editor, object, beforeNodeId );
			const current = readOrderSnapshot( editor, object );
			const targetIndex = getTargetIndex( object, before );
			editor.select( object );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				current,
				proposed: {
					beforeNodeId,
					beforeNodeName: before ? before.name || '未命名节点' : null,
					targetIndex
				},
				changed: current.currentIndex !== targetIndex
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-reorder': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId, 'nodeId' ) );
			const expected = parseOrderSnapshot( payload.expected );
			const current = readOrderSnapshot( editor, object );
			if ( ! snapshotsEqual( current, expected ) ) {

				return {
					ok: false,
					code: 'NODE_ORDER_CONFLICT',
					error: '同级节点顺序在预览后已被修改，请重新预览',
					current
				};

			}
			if ( ! isRecord( payload.proposed ) ) {

				throw new TypeError( 'proposed 必须是对象' );

			}
			const beforeNodeId = parseBeforeNodeId( payload.proposed.beforeNodeId );
			const before = resolveBeforeNode( editor, object, beforeNodeId );
			const targetIndex = getTargetIndex( object, before );
			const noChange = current.currentIndex === targetIndex;
			if ( ! noChange ) {

				executeAtomicCommand( editor, new MoveObjectCommand( editor, object, object.parent, before ) );

			}
			editor.select( object );
			const order = readOrderSnapshot( editor, object );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				noChange,
				order,
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
