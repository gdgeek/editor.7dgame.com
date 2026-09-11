import { captureEditorState } from './EditorContext.js';
import { executeAtomicCommand } from './AtomicCommands.js';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js';
import type { MrppEditor } from '../types/mrpp.js';
import { createVerseSceneVersion, getSceneMutationReceipt } from './VerseSceneReadHandlers.js';

type JsonRecord = Record<string, unknown>;
type PropertySnapshot = {
	title: string;
	visible: boolean;
};
type PropertyPatch = {
	title?: string;
	visible?: boolean;
};

const MAX_TITLE_LENGTH = 120;

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const requireString = ( value: unknown, label: string ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label }不能为空` );

	}
	return value.trim();

};

const normalizeTitle = ( value: unknown, label: string ): string => {

	if ( typeof value !== 'string' ) throw new TypeError( `${ label }必须是字符串` );
	const title = value
		.trim()
		.replace( /\s*\[(polygen|picture|video|sound|audio|text|point|prototype|entity|module)\]\s*$/i, '' )
		.trim();
	if ( ! title ) throw new TypeError( `${ label }不能为空` );
	if ( title.length > MAX_TITLE_LENGTH ) {

		throw new RangeError( `${ label }不能超过 ${ MAX_TITLE_LENGTH } 个字符` );

	}
	if ( /[\u0000-\u001f\u007f]/.test( title ) ) {

		throw new TypeError( `${ label }不能包含控制字符` );

	}
	return title;

};

const parsePatch = ( value: unknown ): PropertyPatch => {

	if ( ! isRecord( value ) ) throw new TypeError( 'properties必须是对象' );
	const patch: PropertyPatch = {};
	if ( value.title !== undefined ) patch.title = normalizeTitle( value.title, 'properties.title' );
	if ( value.visible !== undefined ) {

		if ( typeof value.visible !== 'boolean' ) {

			throw new TypeError( 'properties.visible必须是布尔值' );

		}
		patch.visible = value.visible;

	}
	if ( patch.title === undefined && patch.visible === undefined ) {

		throw new TypeError( 'properties至少需要包含 title 或 visible' );

	}
	return patch;

};

const readSnapshot = ( object: any ): PropertySnapshot => ( {
	title: String( object.name ?? '' ),
	visible: Boolean( object.visible )
} );

const parseExpectedSnapshot = ( value: unknown ): PropertySnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expectedCurrent必须是对象' );
	if ( typeof value.title !== 'string' ) {

		throw new TypeError( 'expectedCurrent.title必须是字符串' );

	}
	if ( typeof value.visible !== 'boolean' ) {

		throw new TypeError( 'expectedCurrent.visible必须是布尔值' );

	}
	return { title: value.title, visible: value.visible };

};

const parseProposedSnapshot = ( value: unknown ): PropertySnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'proposed必须是对象' );
	if ( typeof value.visible !== 'boolean' ) {

		throw new TypeError( 'proposed.visible必须是布尔值' );

	}
	return {
		title: normalizeTitle( value.title, 'proposed.title' ),
		visible: value.visible
	};

};

const snapshotsEqual = ( left: PropertySnapshot, right: PropertySnapshot ) =>
	left.title === right.title && left.visible === right.visible;

const getModule = ( editor: MrppEditor, moduleId: unknown ) => {

	const id = requireString( moduleId, 'moduleId' );
	const object = editor.objectByUuid( id );
	if ( ! object || object === editor.scene || object.type !== 'Module' ) {

		throw new Error( `找不到场景实体实例 ${ id }` );

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

const errorResult = ( error: unknown ) => ( {
	ok: false,
	code: error instanceof RangeError ? 'INVALID_RANGE' : 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );

export const stageVerseSceneModuleProperties = async (
	editor: MrppEditor,
	payload: JsonRecord
): Promise<Record<string, unknown>> => {

	try {

		const loader = ensureLoaderReady( editor );
		const object = getModule( editor, payload.moduleId );
		const verse = await loader.getVerse();
		const current = readSnapshot( object );
		const patch = parsePatch( payload.properties );
		const proposed = {
			title: patch.title ?? current.title,
			visible: patch.visible ?? current.visible
		};
		editor.select( object );
		return {
			ok: true,
			sceneVersion: createVerseSceneVersion( verse ),
			moduleId: object.uuid,
			moduleTitle: current.title || '未命名实体实例',
			current,
			proposed,
			changed: ! snapshotsEqual( current, proposed )
		};

	} catch ( error ) {

		return errorResult( error );

	}

};

export const completeVerseSceneModuleProperties = async (
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

			throw new Error( '场景在预览后已发生变化，请重新预览实例属性' );

		}

		const object = getModule( editor, payload.moduleId );
		const current = readSnapshot( object );
		const expectedCurrent = parseExpectedSnapshot( payload.expectedCurrent );
		if ( ! snapshotsEqual( current, expectedCurrent ) ) {

			return {
				ok: false,
				code: 'PROPERTY_CONFLICT',
				error: '实体实例属性已被其他操作修改，请重新预览',
				current
			};

		}

		const proposed = parseProposedSnapshot( payload.proposed );
		const commands: any[] = [];
		if ( current.title !== proposed.title ) {

			commands.push( new SetValueCommand( editor, object, 'name', proposed.title ) );

		}
		if ( current.visible !== proposed.visible ) {

			commands.push( new SetValueCommand( editor, object, 'visible', proposed.visible ) );

		}
		if ( commands.length > 0 ) {

			executeAtomicCommand( editor, new MultiCmdsCommand( editor, commands ) );

		}
		editor.select( object );
		const receipt = await getSceneMutationReceipt( editor );
		return {
			ok: true,
			moduleId: object.uuid,
			moduleTitle: object.name || '未命名实体实例',
			noChange: commands.length === 0,
			properties: readSnapshot( object ),
			...receipt
		};

	} catch ( error ) {

		return errorResult( error );

	}

};
