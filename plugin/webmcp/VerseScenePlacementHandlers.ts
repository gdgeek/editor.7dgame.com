import { AddObjectCommand } from '../../three.js/editor/js/commands/AddObjectCommand.js';
import { awaitEditorLoad, captureEditorState, withPlacement } from './EditorContext.js';
import { addObjectAtomically } from './AtomicCommands.js';
import { ensureMetaSignalRegistry } from '../mrpp/MetaSignalRegistry.js';
import { Builder } from '../mrpp/Builder.js';
import { WebMcpMetaFactory } from './WebMcpMetaFactory.js';
import type { MrppEditor } from '../types/mrpp.js';
import { createVerseSceneVersion, getSceneMutationReceipt } from './VerseSceneReadHandlers.js';

type JsonRecord = Record<string, unknown>;
type Vector3Value = { x: number; y: number; z: number };
type ModuleTransform = {
	position: Vector3Value;
	rotate: Vector3Value;
	scale: Vector3Value;
};

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const requireString = ( value: unknown, name: string ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ name }不能为空` );

	}
	return value.trim();

};

const requirePositiveInteger = ( value: unknown, name: string ): number => {

	if ( typeof value !== 'number' || ! Number.isSafeInteger( value ) || value <= 0 ) {

		throw new TypeError( `${ name }必须是正整数` );

	}
	return value;

};

const requireVector = ( value: unknown, name: string ): Vector3Value => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ name }必须是对象` );
	const axes = [ 'x', 'y', 'z' ] as const;
	const result = {} as Vector3Value;
	for ( const axis of axes ) {

		const coordinate = value[ axis ];
		if ( typeof coordinate !== 'number' || ! Number.isFinite( coordinate ) ) {

			throw new TypeError( `${ name }.${ axis }必须是有限数字` );

		}
		result[ axis ] = coordinate;

	}
	return result;

};

const requireTransform = ( value: unknown ): ModuleTransform => {

	if ( ! isRecord( value ) ) throw new TypeError( 'transform必须是对象' );
	return {
		position: requireVector( value.position, 'transform.position' ),
		rotate: requireVector( value.rotate, 'transform.rotate' ),
		scale: requireVector( value.scale, 'transform.scale' )
	};

};

const requireEntity = ( value: unknown ): JsonRecord => {

	if ( ! isRecord( value ) ) throw new TypeError( 'entity必须是对象' );
	requirePositiveInteger( value.id, 'entity.id' );
	return value;

};

export const completeVerseSceneEntityPlacement = async (
	editor: MrppEditor,
	payload: JsonRecord
): Promise<Record<string, unknown>> => {

	return withPlacement( editor, payload, async () => {
	const assertCurrent = captureEditorState( editor );
	assertCurrent();
	const loader = editor.verseLoader;
	if ( ! loader || typeof loader.getVerse !== 'function' ) {

		throw new Error( '场景编辑器尚未准备完成' );

	}
	if ( typeof loader.getLoadingStatus === 'function' && loader.getLoadingStatus() ) {

		throw new Error( '场景实体仍在加载，请稍后重试' );

	}

	const expectedSceneVersion = requireString( payload.expectedSceneVersion, 'expectedSceneVersion' );
	const currentVerse = await loader.getVerse();
	if ( createVerseSceneVersion( currentVerse ) !== expectedSceneVersion ) {

		throw new Error( '场景在预览后已发生变化，请重新预览实体放入操作' );

	}

	assertCurrent();
	const entity = requireEntity( payload.entity );
	const entityId = Number( entity.id );
	const title = requireString( payload.title, 'title' );
	const transform = requireTransform( payload.transform );
	const resources = new Map( window.resources ?? [] );
	if ( Array.isArray( entity.resources ) ) {

		for ( const resource of entity.resources ) {

			if ( isRecord( resource ) && resource.id !== undefined ) {

				resources.set( String( resource.id ), resource );

			}

		}

	}

	const builder = new Builder();
	const factory = new WebMcpMetaFactory( editor );
	const moduleData = builder.module( String( entityId ), title );
	moduleData.parameters.transform = transform;
	const node = factory.addModule( moduleData );
	const registry = ensureMetaSignalRegistry( editor );
	const signals = registry.validate( entity.events );
	if ( ! signals.ok || ! signals.value ) throw new Error( `实体信号格式无效: ${ signals.reason }` );
	( node as any ).metaEvents = signals.value;
	node.userData.custom = entity.custom ?? entity.custome;
	const entityData = entity.data;
	const entityChildren = isRecord( entityData ) ? entityData.children : null;
	if ( ! isRecord( entityChildren ) || ! Array.isArray( entityChildren.entities ) ) throw new Error( '实体数据缺失或格式无效' );
	// readMeta intentionally tolerates failures for interactive loads. WebMCP requires all children.
	for ( const child of entityChildren.entities ) {
		if ( ! child ) throw new Error( '实体包含无效节点' );
		const loaded = await awaitEditorLoad( editor, factory.building( child, resources ) );
		if ( ! loaded ) throw new Error( '实体节点加载失败' );
		assertCurrent();
		node.add( loaded );
	}
	await awaitEditorLoad( editor, factory.addGizmo( node ) );
	assertCurrent();
	const latestVerse = await loader.getVerse();
	assertCurrent();
	if ( createVerseSceneVersion( latestVerse ) !== expectedSceneVersion ) throw new Error( '场景在加载期间已改变' );
	addObjectAtomically( editor, new AddObjectCommand( editor, node ) );
	window.resources = resources;
	registry.upsert( entityId, signals.value, false );

	const receipt = await getSceneMutationReceipt( editor );
	return {
		ok: true,
		moduleId: node.uuid,
		moduleTitle: node.name,
		entityId,
		transform,
		...receipt
	};
	} );

};

export const markVerseSceneSaved = async (
	editor: MrppEditor,
	payload: JsonRecord
): Promise<Record<string, unknown>> => {

	const assertCurrent = captureEditorState( editor );
	const loader = editor.verseLoader;
	if ( ! loader || typeof loader.getVerse !== 'function' ) {

		throw new Error( '场景编辑器尚未准备完成' );

	}
	const expectedSceneVersion = requireString( payload.expectedSceneVersion, 'expectedSceneVersion' );
	const verse = await loader.getVerse();
	assertCurrent();
	const currentVersion = createVerseSceneVersion( verse );
	if ( currentVersion !== expectedSceneVersion ) {

		throw new Error( '保存完成前场景又发生了变化，当前编辑器仍保留未保存标记' );

	}
	loader.json = JSON.stringify( { verse } );
	return { ok: true, sceneVersion: currentVersion };

};
