import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { addObjectAtomically } from '../webmcp/AtomicCommands.js';
import * as THREE from 'three';
import * as SkeletonUtils from '../../three.js/examples/jsm/utils/SkeletonUtils.js';
import { AddObjectCommand } from '../../three.js/editor/js/commands/AddObjectCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;

type ParentSnapshot = {
	parentNodeId: string | null;
	parentName: string;
	index: number;
};

type CloneSnapshot = {
	parent: ParentSnapshot;
	sourceVersion: string;
	siblingOrderVersion: string;
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

const parseName = ( value: unknown, label = 'name' ): string => {

	if ( typeof value !== 'string' ) throw new TypeError( `${ label } 必须是字符串` );
	const name = value.trim();
	if ( ! name ) throw new TypeError( `${ label } 不能为空` );
	if ( name.length > 100 ) throw new RangeError( `${ label } 不能超过 100 个字符` );
	if ( /[\u0000-\u001f\u007f]/.test( name ) ) {

		throw new TypeError( `${ label } 不能包含控制字符` );

	}
	return name;

};

const getNode = ( editor: MrppEditor, nodeId: string ) => {

	const object = editor.objectByUuid( nodeId );
	if ( ! object || object === editor.scene || ! object.userData?.type || ! object.parent ) {

		throw new Error( `找不到可复制节点 ${ nodeId }` );

	}
	return object;

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

const readParentSnapshot = ( editor: MrppEditor, object: any ): ParentSnapshot => {

	const parent = object.parent;
	if ( ! parent ) throw new Error( '节点当前没有有效父级' );
	return {
		parentNodeId: parent === editor.scene ? null : parent.uuid,
		parentName: parent === editor.scene ? '实体根层级' : parent.name || '未命名节点',
		index: parent.children.indexOf( object )
	};

};

const readCloneSnapshot = ( editor: MrppEditor, object: any ): CloneSnapshot => {

	const descendants = collectEntityDescendants( object );
	const siblings = object.parent.children.filter( ( sibling: any ) => sibling.userData?.type );
	return {
		parent: readParentSnapshot( editor, object ),
		sourceVersion: fnv1a( stableValue( objectSignature( object ) ) ),
		siblingOrderVersion: fnv1a(
			siblings.map( ( sibling: any ) =>
				`${ sibling.uuid }:${ sibling.name || '' }:${ sibling.userData?.type || '' }`
			).join( '|' )
		),
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

const parseCloneSnapshot = ( value: unknown ): CloneSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expected 必须是对象' );
	for ( const key of [ 'sourceVersion', 'siblingOrderVersion' ] ) {

		if ( typeof value[ key ] !== 'string' || ! value[ key ] ) {

			throw new TypeError( `expected.${ key } 不能为空` );

		}

	}
	for ( const key of [ 'directChildCount', 'descendantCount' ] ) {

		const count = value[ key ];
		if ( typeof count !== 'number' || ! Number.isSafeInteger( count ) || count < 0 ) {

			throw new TypeError( `expected.${ key } 必须是非负整数` );

		}

	}
	return {
		parent: parseParentSnapshot( value.parent ),
		sourceVersion: value.sourceVersion as string,
		siblingOrderVersion: value.siblingOrderVersion as string,
		directChildCount: value.directChildCount as number,
		descendantCount: value.descendantCount as number
	};

};

const snapshotsEqual = ( left: CloneSnapshot, right: CloneSnapshot ) =>
	left.parent.parentNodeId === right.parent.parentNodeId &&
	left.parent.index === right.parent.index &&
	left.sourceVersion === right.sourceVersion &&
	left.siblingOrderVersion === right.siblingOrderVersion &&
	left.directChildCount === right.directChildCount &&
	left.descendantCount === right.descendantCount;

const getUniqueCloneName = ( object: any, requestedName: unknown ) => {

	const siblingNames = new Set(
		object.parent.children.map( ( sibling: any ) => sibling.name || '' )
	);
	if ( requestedName !== undefined ) {

		const name = parseName( requestedName, 'name' );
		if ( siblingNames.has( name ) ) throw new Error( `同一父级已存在名为“${ name }”的节点` );
		return name;

	}

	const baseName = `${ object.name || '未命名节点' } 副本`;
	if ( ! siblingNames.has( baseName ) ) return baseName;
	let suffix = 2;
	while ( siblingNames.has( `${ baseName } (${ suffix })` ) ) suffix ++;
	return `${ baseName } (${ suffix })`;

};

const hasSkinnedMesh = ( object: any ) => {

	let found = false;
	object.traverse( ( child: any ) => {

		if ( child.isSkinnedMesh ) found = true;

	} );
	return found;

};

const cloneObject = ( source: any ) =>
	hasSkinnedMesh( source ) ? SkeletonUtils.clone( source ) : source.clone();

/** Build the complete identity map before copying interactions between sibling nodes. */
export const copyHierarchyDataWithNewUUIDs = ( source: any, target: any ) => {

	const ids = new Map<string, string>();
	const pairs: Array<[any, any]> = [];
	const collect = ( before: any, after: any ) => {
		ids.set( before.uuid, after.uuid );
		pairs.push( [ before, after ] );
		for ( let index = 0; index < before.children.length; index ++ ) {
			collect( before.children[ index ], after.children[ index ] );
		}
	};
	collect( source, target );
	for ( const [ before ] of pairs ) {
		for ( const key of [ 'components', 'commands' ] ) {
			for ( const item of before[ key ] ?? [] ) {
				if ( item.parameters?.uuid ) ids.set( item.parameters.uuid, THREE.MathUtils.generateUUID() );
				for ( const id of Object.keys( item.parameters?.options ?? {} ) ) ids.set( id, THREE.MathUtils.generateUUID() );
			}
		}
	}
	const remap = ( value: any ): any => {
		if ( typeof value === 'string' ) return ids.get( value ) ?? value;
		if ( Array.isArray( value ) ) return value.map( remap );
		if ( value && typeof value === 'object' ) {
			return Object.fromEntries( Object.entries( value ).map( ( [ key, item ] ) => [ ids.get( key ) ?? key, remap( item ) ] ) );
		}
		return value;
	};
	for ( const [ before, after ] of pairs ) {
		after.type = before.type;
		after.userData = remap( before.userData );
		for ( const key of [ 'components', 'commands' ] ) {
			if ( before[ key ] ) after[ key ] = remap( before[ key ] );
		}
		if ( before.animations?.length ) after.animations = before.animations.map( ( clip: any ) => clip.clone() );
	}

};

const assertEditable = ( editor: MrppEditor ) => {

	if ( editor.data?.saveable === false ) throw new Error( '当前实体没有编辑权限' );
	if ( editor.metaLoader?.getLoadingStatus?.() ) {

		throw new Error( '实体模型仍在加载，请稍后重试' );

	}

};

const errorResult = ( error: unknown ) => ( {
	ok: false,
	code: error instanceof RangeError ? 'INVALID_RANGE' : 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );

export const createWebMcpNodeCloneRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-stage-node-clone': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getNode( editor, parseNodeId( payload.nodeId ) );
			const snapshot = readCloneSnapshot( editor, object );
			const proposedName = getUniqueCloneName( object, payload.name );
			editor.select( object );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				nodeType: object.userData?.type || object.type,
				...snapshot,
				proposedName
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-clone': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const source = getNode( editor, parseNodeId( payload.nodeId ) );
			const expected = parseCloneSnapshot( payload.expected );
			const current = readCloneSnapshot( editor, source );
			if ( ! snapshotsEqual( current, expected ) ) {

				return {
					ok: false,
					code: 'NODE_CLONE_CONFLICT',
					error: '源节点、子树或同级顺序在预览后已被修改，请重新预览',
					current
				};

			}
			const proposedName = parseName( payload.proposedName, 'proposedName' );
			if ( source.parent.children.some( ( sibling: any ) => sibling.name === proposedName ) ) {

				return {
					ok: false,
					code: 'NODE_CLONE_NAME_CONFLICT',
					error: `同一父级已存在名为“${ proposedName }”的节点`
				};

			}

			const clone = cloneObject( source );
			copyHierarchyDataWithNewUUIDs( source, clone );
			clone.name = proposedName;
			const parent = source.parent;
			const command = new AddObjectCommand( editor, clone );
			command.execute = function () {

				const insertIndex = parent.children.indexOf( source ) + 1;
				editor.addObject( clone, parent, insertIndex );
				editor.select( clone );

			};
			addObjectAtomically( editor, command );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				sourceNodeId: source.uuid,
				nodeId: clone.uuid,
				nodeName: clone.name,
				nodeType: clone.userData?.type || clone.type,
				clonedNodeCount: current.descendantCount + 1,
				parent: readParentSnapshot( editor, clone ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
