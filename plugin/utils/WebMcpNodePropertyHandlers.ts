import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;

export type NodePropertySnapshot = {
	name: string;
	visible: boolean;
};

type NodePropertyPatch = {
	name?: string;
	visible?: boolean;
};

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const parseName = ( value: unknown ): string => {

	if ( typeof value !== 'string' ) throw new TypeError( 'properties.name 必须是字符串' );
	const name = value.trim();
	if ( ! name ) throw new TypeError( 'properties.name 不能为空' );
	if ( name.length > 100 ) throw new RangeError( 'properties.name 不能超过 100 个字符' );
	if ( /[\u0000-\u001f\u007f]/.test( name ) ) {

		throw new TypeError( 'properties.name 不能包含控制字符' );

	}
	return name;

};

const parsePatch = ( value: unknown ): NodePropertyPatch => {

	if ( ! isRecord( value ) ) throw new TypeError( 'properties 必须是对象' );
	const patch: NodePropertyPatch = {};
	if ( value.name !== undefined ) patch.name = parseName( value.name );
	if ( value.visible !== undefined ) {

		if ( typeof value.visible !== 'boolean' ) {

			throw new TypeError( 'properties.visible 必须是布尔值' );

		}
		patch.visible = value.visible;

	}
	if ( patch.name === undefined && patch.visible === undefined ) {

		throw new TypeError( 'properties 至少需要包含 name 或 visible' );

	}
	return patch;

};

const parseSnapshot = ( value: unknown, label: string ): NodePropertySnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	if ( typeof value.name !== 'string' || typeof value.visible !== 'boolean' ) {

		throw new TypeError( `${ label } 必须包含 name 和 visible` );

	}
	return { name: value.name, visible: value.visible };

};

const readSnapshot = ( object: any ): NodePropertySnapshot => ( {
	name: object.name || '',
	visible: object.visible !== false
} );

const snapshotsEqual = (
	left: NodePropertySnapshot,
	right: NodePropertySnapshot
) => left.name === right.name && left.visible === right.visible;

const getTargetObject = ( editor: MrppEditor, nodeId: unknown ) => {

	if ( typeof nodeId !== 'string' || ! nodeId.trim() ) {

		throw new TypeError( 'nodeId 不能为空' );

	}
	const object = editor.objectByUuid( nodeId.trim() );
	if ( ! object || object === editor.scene || ! object.userData?.type ) {

		throw new Error( `找不到可编辑节点 ${ nodeId }` );

	}
	return object;

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

export const createWebMcpNodePropertyRequestHandlers = (
	editor: MrppEditor
) => ( {
	'webmcp-stage-node-properties': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getTargetObject( editor, payload.nodeId );
			const current = readSnapshot( object );
			const patch = parsePatch( payload.properties );
			const proposed: NodePropertySnapshot = {
				name: patch.name ?? current.name,
				visible: patch.visible ?? current.visible
			};
			editor.select( object );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: current.name || '未命名节点',
				current,
				proposed,
				changed: ! snapshotsEqual( current, proposed )
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-properties': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const object = getTargetObject( editor, payload.nodeId );
			const expectedCurrent = parseSnapshot( payload.expectedCurrent, 'expectedCurrent' );
			const current = readSnapshot( object );
			if ( ! snapshotsEqual( current, expectedCurrent ) ) {

				return {
					ok: false,
					code: 'NODE_PROPERTIES_CONFLICT',
					error: '节点名称或可见性已被其他操作修改，请重新预览',
					current
				};

			}

			const proposed = parseSnapshot( payload.proposed, 'proposed' );
			const commands: any[] = [];
			if ( current.name !== proposed.name ) {

				const safeName = parseName( proposed.name );
				commands.push( new SetValueCommand( editor, object, 'name', safeName ) );

			}
			if ( current.visible !== proposed.visible ) {

				commands.push( new SetValueCommand( editor, object, 'visible', proposed.visible ) );

			}
			if ( commands.length > 0 ) {

				executeAtomicCommand( editor, new MultiCmdsCommand( editor, commands ) );

			}
			editor.select( object );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				noChange: commands.length === 0,
				properties: readSnapshot( object ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
