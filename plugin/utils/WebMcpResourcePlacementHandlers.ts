import { AddObjectCommand } from '../../three.js/editor/js/commands/AddObjectCommand.js';
import { awaitEditorLoad, captureEditorState, withPlacement } from '../webmcp/EditorContext.js';
import { getEntityWebMcpState, getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { addObjectAtomically } from '../webmcp/AtomicCommands.js';
import { Builder } from '../mrpp/Builder.js';
import { WebMcpMetaFactory } from '../webmcp/WebMcpMetaFactory.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;

const RESOURCE_TYPES = new Set( [
	'polygen',
	'picture',
	'video',
	'voxel',
	'audio',
	'particle'
] );

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const parseResource = ( value: unknown ): JsonRecord => {

	if ( ! isRecord( value ) ) throw new TypeError( 'resource 必须是对象' );
	const id = value.id;
	if ( ( typeof id !== 'number' && typeof id !== 'string' ) || String( id ).trim() === '' ) {

		throw new TypeError( 'resource.id 不能为空' );

	}
	if ( typeof value.type !== 'string' || ! RESOURCE_TYPES.has( value.type.toLowerCase() ) ) {

		throw new TypeError( `不支持的素材类型：${ String( value.type ?? '空' ) }` );

	}
	if ( typeof value.name !== 'string' || ! value.name.trim() ) {

		throw new TypeError( 'resource.name 不能为空' );

	}
	if ( ! isRecord( value.file ) || typeof value.file.url !== 'string' || ! value.file.url ) {

		throw new TypeError( 'resource.file.url 不能为空' );

	}
	return value;

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

export const createWebMcpResourcePlacementRequestHandlers = (
	editor: MrppEditor
) => ( {
	'webmcp-complete-resource-placement': async ( payload: JsonRecord ) => {

		try {

			return await withPlacement( editor, payload, async () => {
			assertEditable( editor );
			const assertCurrent = captureEditorState( editor );
			if ( payload.expectedEntityVersion !== undefined ) {
				const state = await getEntityWebMcpState( editor );
				if ( state.entityVersion !== payload.expectedEntityVersion ) throw new Error( '实体在预览后已改变' );
				assertCurrent();
			}
			const resource = parseResource( payload.resource );
			const resourceId = String( resource.id );
			const sharedResources = ( window as any ).resources instanceof Map
				? ( window as any ).resources as Map<string, any>
				: new Map<string, any>();
			const buildingResources = new Map( sharedResources );
			buildingResources.set( resourceId, resource );

			const builder = new Builder();
			const raw = builder.resource( resource as any );
			if ( ! raw ) throw new Error( '无法为该素材创建实体节点' );
			const factory = new WebMcpMetaFactory( editor );
			const node = await awaitEditorLoad( editor, factory.building( raw, buildingResources ) );
			if ( ! node ) throw new Error( '素材加载失败，未创建节点' );

			assertCurrent();
			addObjectAtomically( editor, new AddObjectCommand( editor, node ) );
			sharedResources.set( resourceId, resource );
			( window as any ).resources = sharedResources;
			if ( ! Array.isArray( editor.data.resources ) ) editor.data.resources = [];
			const existingIndex = editor.data.resources.findIndex(
				( item: any ) => item && String( item.id ) === resourceId
			);
			if ( existingIndex >= 0 ) {

				editor.data.resources[ existingIndex ] = resource;

			} else {

				editor.data.resources.push( resource );

			}

			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				nodeId: node.uuid,
				nodeName: node.name || '未命名节点',
				nodeType: node.userData?.type || node.type,
				resourceId: resource.id,
				...receipt
			};
			} );

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
