import { captureEditorState } from './EditorContext.js';
import { executeAtomicCommand } from './AtomicCommands.js';
import { Euler, MathUtils, Vector3 } from 'three';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { SetPositionCommand } from '../../three.js/editor/js/commands/SetPositionCommand.js';
import { SetRotationCommand } from '../../three.js/editor/js/commands/SetRotationCommand.js';
import { SetScaleCommand } from '../../three.js/editor/js/commands/SetScaleCommand.js';
import type { MrppEditor } from '../types/mrpp.js';
import { createVerseSceneVersion, getSceneMutationReceipt } from './VerseSceneReadHandlers.js';

type JsonRecord = Record<string, unknown>;
type Axis = 'x' | 'y' | 'z';
type VectorSnapshot = Record<Axis, number>;
type TransformSnapshot = {
	position: VectorSnapshot;
	rotationDegrees: VectorSnapshot;
	scale: VectorSnapshot;
};
type TransformPatch = {
	position?: Partial<VectorSnapshot>;
	rotationDegrees?: Partial<VectorSnapshot>;
	scale?: Partial<VectorSnapshot>;
};

const AXES: Axis[] = [ 'x', 'y', 'z' ];
const EPSILON = 1e-7;

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const finiteNumber = ( value: unknown, label: string ): number => {

	if ( typeof value !== 'number' || ! Number.isFinite( value ) ) {

		throw new TypeError( `${ label }必须是有限数字` );

	}
	return value;

};

const requireString = ( value: unknown, label: string ): string => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label }不能为空` );

	}
	return value.trim();

};

const parseVectorPatch = (
	value: unknown,
	label: string,
	limit: number
): Partial<VectorSnapshot> | undefined => {

	if ( value === undefined ) return undefined;
	if ( ! isRecord( value ) ) throw new TypeError( `${ label }必须是对象` );
	const result: Partial<VectorSnapshot> = {};
	for ( const axis of AXES ) {

		if ( value[ axis ] === undefined ) continue;
		const coordinate = finiteNumber( value[ axis ], `${ label }.${ axis }` );
		if ( Math.abs( coordinate ) > limit ) {

			throw new RangeError( `${ label }.${ axis }超出允许范围` );

		}
		result[ axis ] = coordinate;

	}
	if ( Object.keys( result ).length === 0 ) {

		throw new TypeError( `${ label }至少需要提供 x、y、z 中的一项` );

	}
	return result;

};

const parseTransformPatch = ( value: unknown ): TransformPatch => {

	if ( ! isRecord( value ) ) throw new TypeError( 'transform必须是对象' );
	const patch = {
		position: parseVectorPatch( value.position, 'position', 1_000_000 ),
		rotationDegrees: parseVectorPatch( value.rotationDegrees, 'rotationDegrees', 360_000 ),
		scale: parseVectorPatch( value.scale, 'scale', 10_000 )
	};
	if ( ! patch.position && ! patch.rotationDegrees && ! patch.scale ) {

		throw new TypeError( 'transform至少需要包含 position、rotationDegrees 或 scale' );

	}
	return patch;

};

const readSnapshot = ( object: any ): TransformSnapshot => ( {
	position: {
		x: object.position.x,
		y: object.position.y,
		z: object.position.z
	},
	rotationDegrees: {
		x: MathUtils.radToDeg( object.rotation.x ),
		y: MathUtils.radToDeg( object.rotation.y ),
		z: MathUtils.radToDeg( object.rotation.z )
	},
	scale: {
		x: object.scale.x,
		y: object.scale.y,
		z: object.scale.z
	}
} );

const readVector = ( value: unknown, label: string ): VectorSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label }必须是对象` );
	return {
		x: finiteNumber( value.x, `${ label }.x` ),
		y: finiteNumber( value.y, `${ label }.y` ),
		z: finiteNumber( value.z, `${ label }.z` )
	};

};

const parseSnapshot = ( value: unknown, label: string ): TransformSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label }必须是对象` );
	return {
		position: readVector( value.position, `${ label }.position` ),
		rotationDegrees: readVector( value.rotationDegrees, `${ label }.rotationDegrees` ),
		scale: readVector( value.scale, `${ label }.scale` )
	};

};

const mergeVector = (
	current: VectorSnapshot,
	patch?: Partial<VectorSnapshot>
): VectorSnapshot => ( {
	x: patch?.x ?? current.x,
	y: patch?.y ?? current.y,
	z: patch?.z ?? current.z
} );

const mergeSnapshot = (
	current: TransformSnapshot,
	patch: TransformPatch
): TransformSnapshot => ( {
	position: mergeVector( current.position, patch.position ),
	rotationDegrees: mergeVector( current.rotationDegrees, patch.rotationDegrees ),
	scale: mergeVector( current.scale, patch.scale )
} );

const vectorsEqual = ( left: VectorSnapshot, right: VectorSnapshot ) =>
	AXES.every( ( axis ) => Math.abs( left[ axis ] - right[ axis ] ) <= EPSILON );

const snapshotsEqual = ( left: TransformSnapshot, right: TransformSnapshot ) =>
	vectorsEqual( left.position, right.position ) &&
	vectorsEqual( left.rotationDegrees, right.rotationDegrees ) &&
	vectorsEqual( left.scale, right.scale );

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

export const stageVerseSceneModuleTransform = async (
	editor: MrppEditor,
	payload: JsonRecord
): Promise<Record<string, unknown>> => {

	try {

		const loader = ensureLoaderReady( editor );
		const object = getModule( editor, payload.moduleId );
		const verse = await loader.getVerse();
		const current = readSnapshot( object );
		const proposed = mergeSnapshot( current, parseTransformPatch( payload.transform ) );
		editor.select( object );
		return {
			ok: true,
			sceneVersion: createVerseSceneVersion( verse ),
			moduleId: object.uuid,
			moduleTitle: object.name || '未命名实体实例',
			current,
			proposed,
			changed: ! snapshotsEqual( current, proposed )
		};

	} catch ( error ) {

		return errorResult( error );

	}

};

export const completeVerseSceneModuleTransform = async (
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

			throw new Error( '场景在预览后已发生变化，请重新预览实例变换' );

		}

		const object = getModule( editor, payload.moduleId );
		const current = readSnapshot( object );
		const expectedCurrent = parseSnapshot( payload.expectedCurrent, 'expectedCurrent' );
		if ( ! snapshotsEqual( current, expectedCurrent ) ) {

			return {
				ok: false,
				code: 'TRANSFORM_CONFLICT',
				error: '实体实例变换已被其他操作修改，请重新预览',
				current
			};

		}

		const proposed = parseSnapshot( payload.proposed, 'proposed' );
		const commands: any[] = [];
		if ( ! vectorsEqual( current.position, proposed.position ) ) {

			commands.push( new SetPositionCommand(
				editor,
				object,
				new Vector3( proposed.position.x, proposed.position.y, proposed.position.z )
			) );

		}
		if ( ! vectorsEqual( current.rotationDegrees, proposed.rotationDegrees ) ) {

			commands.push( new SetRotationCommand(
				editor,
				object,
				new Euler(
					MathUtils.degToRad( proposed.rotationDegrees.x ),
					MathUtils.degToRad( proposed.rotationDegrees.y ),
					MathUtils.degToRad( proposed.rotationDegrees.z ),
					object.rotation.order
				)
			) );

		}
		if ( ! vectorsEqual( current.scale, proposed.scale ) ) {

			commands.push( new SetScaleCommand(
				editor,
				object,
				new Vector3( proposed.scale.x, proposed.scale.y, proposed.scale.z )
			) );

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
			transform: readSnapshot( object ),
			...receipt
		};

	} catch ( error ) {

		return errorResult( error );

	}

};
