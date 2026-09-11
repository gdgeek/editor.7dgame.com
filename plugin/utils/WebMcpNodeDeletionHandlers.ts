import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { RemoveObjectCommand } from '../../three.js/editor/js/commands/RemoveObjectCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;

type ParentSnapshot = {
	parentNodeId: string | null;
	parentName: string;
	index: number;
};

type DeletionSnapshot = {
	parent: ParentSnapshot;
	subtreeVersion: string;
	directChildCount: number;
	descendantCount: number;
};

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const parseNodeId = ( value: unknown, label = 'nodeId' ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label } 不能为空` );

	}
	return value.trim();

};

const getNode = ( editor: MrppEditor, nodeId: string ) => {

	const object = editor.objectByUuid( nodeId );
	if ( ! object || object === editor.scene || ! object.userData?.type || ! object.parent ) {

		throw new Error( `找不到可删除节点 ${ nodeId }` );

	}
	return object;

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

const getEntityChildren = ( object: any ) =>
	object.children.filter( ( child: any ) => Boolean( child.userData?.type ) );

const collectEntityDescendants = ( object: any ) => {

	const descendants: any[] = [];
	const visit = ( parent: any ) => {

		for ( const child of getEntityChildren( parent ) ) {

			descendants.push( child );
			visit( child );

		}

	};
	visit( object );
	return descendants;

};

const stableValue = ( value: unknown ): string => {

	if ( value === null ) return 'null';
	if ( Array.isArray( value ) ) return `[${ value.map( stableValue ).join( ',' ) }]`;
	if ( isRecord( value ) ) {

		return `{${ Object.keys( value ).sort().map( ( key ) =>
			`${ JSON.stringify( key ) }:${ stableValue( value[ key ] ) }`
		).join( ',' ) }}`;

	}
	if ( typeof value === 'number' && ! Number.isFinite( value ) ) return String( value );
	return JSON.stringify( value ) ?? String( value );

};

const objectSignature = ( object: any ): JsonRecord => ( {
	uuid: object.uuid,
	name: object.name || '',
	type: object.userData?.type || '',
	visible: object.visible !== false,
	position: object.position?.toArray?.() ?? [],
	rotation: object.rotation
		? [ object.rotation.x, object.rotation.y, object.rotation.z, object.rotation.order ]
		: [],
	scale: object.scale?.toArray?.() ?? [],
	userData: object.userData ?? {},
	components: object.components ?? [],
	commands: object.commands ?? [],
	children: getEntityChildren( object ).map( objectSignature )
} );

const fnv1a = ( value: string ) => {

	let hash = 0x811c9dc5;
	for ( let index = 0; index < value.length; index ++ ) {

		hash ^= value.charCodeAt( index );
		hash = Math.imul( hash, 0x01000193 );

	}
	return ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' );

};

const readDeletionSnapshot = ( editor: MrppEditor, object: any ): DeletionSnapshot => {

	const descendants = collectEntityDescendants( object );
	return {
		parent: readParentSnapshot( editor, object ),
		subtreeVersion: fnv1a( stableValue( objectSignature( object ) ) ),
		directChildCount: getEntityChildren( object ).length,
		descendantCount: descendants.length
	};

};

const parseParentSnapshot = ( value: unknown ): ParentSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expected.parent 必须是对象' );
	const parentNodeId = value.parentNodeId === null
		? null
		: parseNodeId( value.parentNodeId, 'expected.parent.parentNodeId' );
	if ( typeof value.index !== 'number' || ! Number.isSafeInteger( value.index ) || value.index < 0 ) {

		throw new TypeError( 'expected.parent.index 必须是非负整数' );

	}
	return {
		parentNodeId,
		parentName: typeof value.parentName === 'string' ? value.parentName : '',
		index: value.index
	};

};

const parseDeletionSnapshot = ( value: unknown ): DeletionSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expected 必须是对象' );
	if ( typeof value.subtreeVersion !== 'string' || ! value.subtreeVersion ) {

		throw new TypeError( 'expected.subtreeVersion 不能为空' );

	}
	for ( const key of [ 'directChildCount', 'descendantCount' ] ) {

		const count = value[ key ];
		if ( typeof count !== 'number' || ! Number.isSafeInteger( count ) || count < 0 ) {

			throw new TypeError( `expected.${ key } 必须是非负整数` );

		}

	}
	return {
		parent: parseParentSnapshot( value.parent ),
		subtreeVersion: value.subtreeVersion,
		directChildCount: value.directChildCount as number,
		descendantCount: value.descendantCount as number
	};

};

const snapshotsEqual = ( left: DeletionSnapshot, right: DeletionSnapshot ) =>
	left.parent.parentNodeId === right.parent.parentNodeId &&
	left.parent.index === right.parent.index &&
	left.subtreeVersion === right.subtreeVersion &&
	left.directChildCount === right.directChildCount &&
	left.descendantCount === right.descendantCount;

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

export const createWebMcpNodeDeletionRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-stage-node-deletion': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId ) );
			const snapshot = readDeletionSnapshot( editor, object );
			const descendantNames = collectEntityDescendants( object )
				.slice( 0, 8 )
				.map( ( child ) => child.name || '未命名节点' );
			editor.select( object );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				nodeType: object.userData?.type || object.type,
				...snapshot,
				descendantNames
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-deletion': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId ) );
			const expected = parseDeletionSnapshot( payload.expected );
			const current = readDeletionSnapshot( editor, object );
			if ( ! snapshotsEqual( current, expected ) ) {

				return {
					ok: false,
					code: 'NODE_DELETE_CONFLICT',
					error: '节点或其子树在预览后已被修改，请重新预览',
					current
				};

			}

			const nodeId = object.uuid;
			const nodeName = object.name || '未命名节点';
			const removedNodeCount = current.descendantCount + 1;
			executeAtomicCommand( editor, new RemoveObjectCommand( editor, object ) );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				nodeId,
				nodeName,
				removedNodeCount,
				parent: current.parent,
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
