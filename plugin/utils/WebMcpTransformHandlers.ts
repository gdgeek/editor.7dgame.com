import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { Euler, MathUtils, Vector3 } from 'three';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { SetPositionCommand } from '../../three.js/editor/js/commands/SetPositionCommand.js';
import { SetRotationCommand } from '../../three.js/editor/js/commands/SetRotationCommand.js';
import { SetScaleCommand } from '../../three.js/editor/js/commands/SetScaleCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;
type Axis = 'x' | 'y' | 'z';
type VectorSnapshot = Record<Axis, number>;

export type TransformSnapshot = {
	position: VectorSnapshot;
	rotationDegrees: VectorSnapshot;
	scale: VectorSnapshot;
};

export type TransformPatch = {
	position?: Partial<VectorSnapshot>;
	rotationDegrees?: Partial<VectorSnapshot>;
	scale?: Partial<VectorSnapshot>;
};

export type WebMcpRequestHandler = (
	payload: JsonRecord
) => Promise<Record<string, unknown>> | Record<string, unknown>;

const AXES: Axis[] = [ 'x', 'y', 'z' ];
const EPSILON = 1e-7;

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const finiteNumber = ( value: unknown, label: string ): number => {

	if ( typeof value !== 'number' || ! Number.isFinite( value ) ) {

		throw new TypeError( `${ label } 必须是有限数字` );

	}

	return value;

};

const parseVectorPatch = (
	value: unknown,
	label: string,
	limit: number
): Partial<VectorSnapshot> | undefined => {

	if ( value === undefined ) return undefined;
	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );

	const result: Partial<VectorSnapshot> = {};
	for ( const axis of AXES ) {

		if ( value[ axis ] === undefined ) continue;
		const number = finiteNumber( value[ axis ], `${ label }.${ axis }` );
		if ( Math.abs( number ) > limit ) {

			throw new RangeError( `${ label }.${ axis } 超出允许范围` );

		}
		result[ axis ] = number;

	}

	if ( Object.keys( result ).length === 0 ) {

		throw new TypeError( `${ label } 至少需要提供 x、y、z 中的一项` );

	}

	return result;

};

const parseTransformPatch = ( value: unknown ): TransformPatch => {

	if ( ! isRecord( value ) ) throw new TypeError( 'transform 必须是对象' );

	const patch: TransformPatch = {
		position: parseVectorPatch( value.position, 'position', 1_000_000 ),
		rotationDegrees: parseVectorPatch(
			value.rotationDegrees,
			'rotationDegrees',
			360_000
		),
		scale: parseVectorPatch( value.scale, 'scale', 10_000 )
	};

	if ( ! patch.position && ! patch.rotationDegrees && ! patch.scale ) {

		throw new TypeError( 'transform 至少需要包含 position、rotationDegrees 或 scale' );

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
	rotationDegrees: mergeVector(
		current.rotationDegrees,
		patch.rotationDegrees
	),
	scale: mergeVector( current.scale, patch.scale )
} );

const vectorsEqual = ( left: VectorSnapshot, right: VectorSnapshot ) =>
	AXES.every( ( axis ) => Math.abs( left[ axis ] - right[ axis ] ) <= EPSILON );

const snapshotsEqual = ( left: TransformSnapshot, right: TransformSnapshot ) =>
	vectorsEqual( left.position, right.position ) &&
	vectorsEqual( left.rotationDegrees, right.rotationDegrees ) &&
	vectorsEqual( left.scale, right.scale );

const parseSnapshot = ( value: unknown ): TransformSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( 'expectedCurrent 必须是对象' );

	const readVector = ( item: unknown, label: string ): VectorSnapshot => {

		if ( ! isRecord( item ) ) throw new TypeError( `${ label } 必须是对象` );
		return {
			x: finiteNumber( item.x, `${ label }.x` ),
			y: finiteNumber( item.y, `${ label }.y` ),
			z: finiteNumber( item.z, `${ label }.z` )
		};

	};

	return {
		position: readVector( value.position, 'expectedCurrent.position' ),
		rotationDegrees: readVector(
			value.rotationDegrees,
			'expectedCurrent.rotationDegrees'
		),
		scale: readVector( value.scale, 'expectedCurrent.scale' )
	};

};

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

const errorResult = ( error: unknown ) => ( {
	ok: false,
	code: error instanceof RangeError ? 'INVALID_RANGE' : 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );

export const createWebMcpTransformRequestHandlers = (
	editor: MrppEditor
): Record<string, WebMcpRequestHandler> => ( {
	'webmcp-stage-node-transform': ( payload ) => {

		try {

			if ( editor.data?.saveable === false ) {

				throw new Error( '当前实体没有编辑权限' );

			}
			if ( editor.metaLoader?.getLoadingStatus?.() ) {

				throw new Error( '实体模型仍在加载，请稍后重试' );

			}

			const object = getTargetObject( editor, payload.nodeId );
			const current = readSnapshot( object );
			const proposed = mergeSnapshot(
				current,
				parseTransformPatch( payload.transform )
			);

			editor.select( object );

			return {
				ok: true,
				nodeId: object.uuid,
				nodeName: object.name || '未命名节点',
				current,
				proposed,
				changed: ! snapshotsEqual( current, proposed )
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-transform': async ( payload ) => {

		try {

			if ( editor.data?.saveable === false ) {

				throw new Error( '当前实体没有编辑权限' );

			}

			const object = getTargetObject( editor, payload.nodeId );
			const expectedCurrent = parseSnapshot( payload.expectedCurrent );
			const current = readSnapshot( object );
			if ( ! snapshotsEqual( current, expectedCurrent ) ) {

				return {
					ok: false,
					code: 'TRANSFORM_CONFLICT',
					error: '节点变换已被其他操作修改，请重新预览',
					current
				};

			}

			const proposed = parseSnapshot( payload.proposed );
			const commands: any[] = [];
			if ( ! vectorsEqual( current.position, proposed.position ) ) {

				commands.push( new SetPositionCommand(
					editor,
					object,
					new Vector3(
						proposed.position.x,
						proposed.position.y,
						proposed.position.z
					)
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
					new Vector3(
						proposed.scale.x,
						proposed.scale.y,
						proposed.scale.z
					)
				) );

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
				transform: readSnapshot( object ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
