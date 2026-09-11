import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { MoveObjectCommand } from '../../three.js/editor/js/commands/MoveObjectCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;

type ParentSnapshot = {
	parentNodeId: string | null;
	parentName: string;
	index: number;
};

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const parseNodeId = ( value: unknown, label: string ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label } 不能为空` );

	}
	return value.trim();

};

const parseParentNodeId = ( value: unknown ): string | null => {

	if ( value === null ) return null;
	return parseNodeId( value, 'parentNodeId' );

};

const getNode = ( editor: MrppEditor, nodeId: string ) => {

	const object = editor.objectByUuid( nodeId );
	if ( ! object || object === editor.scene || ! object.userData?.type ) {

		throw new Error( `找不到可编辑节点 ${ nodeId }` );

	}
	return object;

};

const getParent = ( editor: MrppEditor, parentNodeId: string | null ) =>
	parentNodeId === null ? editor.scene : getNode( editor, parentNodeId );

const assertValidParent = ( object: any, parent: any ) => {

	let current = parent;
	while ( current ) {

		if ( current === object ) throw new Error( '不能把节点移动到自己或自己的子节点下' );
		current = current.parent;

	}

};

const readParentSnapshot = ( editor: MrppEditor, object: any ): ParentSnapshot => {

	const parent = object.parent;
	if ( ! parent ) throw new Error( '节点当前没有有效父级' );
	return {
		parentNodeId: parent === editor.scene ? null : parent.uuid,
		parentName: parent === editor.scene ? '实体根层级' : parent.name || '未命名节点',
		index: parent.children.indexOf( object )
	};

};

const parseParentSnapshot = ( value: unknown ): ParentSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expectedCurrentParent 必须是对象' );
	const parentNodeId = value.parentNodeId === null
		? null
		: parseNodeId( value.parentNodeId, 'expectedCurrentParent.parentNodeId' );
	if ( typeof value.index !== 'number' || ! Number.isSafeInteger( value.index ) || value.index < 0 ) {

		throw new TypeError( 'expectedCurrentParent.index 必须是非负整数' );

	}
	return {
		parentNodeId,
		parentName: typeof value.parentName === 'string' ? value.parentName : '',
		index: value.index
	};

};

const parentsEqual = ( left: ParentSnapshot, right: ParentSnapshot ) =>
	left.parentNodeId === right.parentNodeId && left.index === right.index;

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

export const createWebMcpHierarchyRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-stage-node-reparent': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId, 'nodeId' ) );
			const parentNodeId = parseParentNodeId( payload.parentNodeId );
			const parent = getParent( editor, parentNodeId );
			assertValidParent( object, parent );
			const currentParent = readParentSnapshot( editor, object );
			const proposedParent = {
				parentNodeId,
				parentName: parent === editor.scene ? '实体根层级' : parent.name || '未命名节点'
			};
			editor.select( object );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				currentParent,
				proposedParent,
				changed: currentParent.parentNodeId !== proposedParent.parentNodeId
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-reparent': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId, 'nodeId' ) );
			const expectedCurrentParent = parseParentSnapshot( payload.expectedCurrentParent );
			const currentParent = readParentSnapshot( editor, object );
			if ( ! parentsEqual( currentParent, expectedCurrentParent ) ) {

				return {
					ok: false,
					code: 'NODE_PARENT_CONFLICT',
					error: '节点父级或顺序已被其他操作修改，请重新预览',
					currentParent
				};

			}
			if ( ! isRecord( payload.proposedParent ) ) {

				throw new TypeError( 'proposedParent 必须是对象' );

			}
			const parentNodeId = parseParentNodeId( payload.proposedParent.parentNodeId );
			const parent = getParent( editor, parentNodeId );
			assertValidParent( object, parent );
			const noChange = object.parent === parent;
			if ( ! noChange ) executeAtomicCommand( editor, new MoveObjectCommand( editor, object, parent ) );
			editor.select( object );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				noChange,
				parent: readParentSnapshot( editor, object ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
