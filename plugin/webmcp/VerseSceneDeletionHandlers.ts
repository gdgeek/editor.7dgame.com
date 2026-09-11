import { captureEditorState } from './EditorContext.js';
import { executeAtomicCommand } from './AtomicCommands.js';
import { RemoveObjectCommand } from '../../three.js/editor/js/commands/RemoveObjectCommand.js';
import type { MrppEditor } from '../types/mrpp.js';
import { createVerseSceneVersion, getSceneMutationReceipt } from './VerseSceneReadHandlers.js';

type JsonRecord = Record<string, unknown>;
type DeletionSnapshot = {
	moduleTitle: string;
	entityId: number | null;
	visible: boolean;
	descendantCount: number;
};

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const requireString = ( value: unknown, label: string ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label }不能为空` );

	}
	return value.trim();

};

const getModule = ( editor: MrppEditor, moduleId: unknown ) => {

	const id = requireString( moduleId, 'moduleId' );
	const object = editor.objectByUuid( id );
	if ( ! object || object === editor.scene || object.type !== 'Module' || object.parent !== editor.scene ) {

		throw new Error( `找不到可删除的场景实体实例 ${ id }` );

	}
	return object;

};

const ensureLoaderReady = ( editor: MrppEditor ) => {

	if ( editor.data?.saveable === false ) throw new Error( '当前场景没有编辑权限' );
	const loader = editor.verseLoader;
	if ( ! loader || typeof loader.getVerse !== 'function' ) {

		throw new Error( '场景编辑器尚未准备完成' );

	}
	if ( typeof loader.getLoadingStatus === 'function' && loader.getLoadingStatus() ) {

		throw new Error( '场景实体仍在加载，请稍后重试' );

	}
	return loader;

};

const countDescendants = ( object: any ) => {

	let count = -1;
	object.traverse( () => {

		count += 1;

	} );
	return Math.max( 0, count );

};

const readEntityId = ( object: any ): number | null => {

	const value = Number( object.userData?.meta_id );
	return Number.isSafeInteger( value ) && value > 0 ? value : null;

};

const readSnapshot = ( object: any ): DeletionSnapshot => ( {
	moduleTitle: object.name || '未命名实体实例',
	entityId: readEntityId( object ),
	visible: Boolean( object.visible ),
	descendantCount: countDescendants( object )
} );

const parseSnapshot = ( value: unknown ): DeletionSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expected必须是对象' );
	const moduleTitle = requireString( value.moduleTitle, 'expected.moduleTitle' );
	const entityId = value.entityId === null
		? null
		: Number( value.entityId );
	if ( entityId !== null && ( ! Number.isSafeInteger( entityId ) || entityId <= 0 ) ) {

		throw new TypeError( 'expected.entityId必须是正整数或 null' );

	}
	if ( typeof value.visible !== 'boolean' ) {

		throw new TypeError( 'expected.visible必须是布尔值' );

	}
	if (
		typeof value.descendantCount !== 'number' ||
		! Number.isSafeInteger( value.descendantCount ) ||
		value.descendantCount < 0
	) {

		throw new TypeError( 'expected.descendantCount必须是非负整数' );

	}
	return {
		moduleTitle,
		entityId,
		visible: value.visible,
		descendantCount: value.descendantCount
	};

};

const snapshotsEqual = ( left: DeletionSnapshot, right: DeletionSnapshot ) =>
	left.moduleTitle === right.moduleTitle &&
	left.entityId === right.entityId &&
	left.visible === right.visible &&
	left.descendantCount === right.descendantCount;

const errorResult = ( error: unknown ) => ( {
	ok: false,
	code: 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );

export const stageVerseSceneModuleDeletion = async (
	editor: MrppEditor,
	payload: JsonRecord
): Promise<Record<string, unknown>> => {

	try {

		const loader = ensureLoaderReady( editor );
		const object = getModule( editor, payload.moduleId );
		const verse = await loader.getVerse();
		const snapshot = readSnapshot( object );
		editor.select( object );
		return {
			ok: true,
			sceneVersion: createVerseSceneVersion( verse ),
			moduleId: object.uuid,
			...snapshot
		};

	} catch ( error ) {

		return errorResult( error );

	}

};

export const completeVerseSceneModuleDeletion = async (
	editor: MrppEditor,
	payload: JsonRecord
): Promise<Record<string, unknown>> => {

	try {

		const loader = ensureLoaderReady( editor );
		const assertCurrent = captureEditorState( editor );
		const verseBefore = await loader.getVerse();
		assertCurrent();
		const expectedSceneVersion = requireString( payload.expectedSceneVersion, 'expectedSceneVersion' );
		if ( createVerseSceneVersion( verseBefore ) !== expectedSceneVersion ) {

			throw new Error( '场景在预览后已发生变化，请重新预览实例删除' );

		}

		const object = getModule( editor, payload.moduleId );
		const current = readSnapshot( object );
		const expected = parseSnapshot( payload.expected );
		if ( ! snapshotsEqual( current, expected ) ) {

			return {
				ok: false,
				code: 'MODULE_DELETE_CONFLICT',
				error: '实体实例在预览后已被修改，请重新预览',
				current
			};

		}

		const moduleId = object.uuid;
		executeAtomicCommand( editor, new RemoveObjectCommand( editor, object ) );
		const receipt = await getSceneMutationReceipt( editor );
		return {
			ok: true,
			moduleId,
			moduleTitle: current.moduleTitle,
			entityId: current.entityId,
			removedObjectCount: current.descendantCount + 1,
			...receipt
		};

	} catch ( error ) {

		return errorResult( error );

	}

};
