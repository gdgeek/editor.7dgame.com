import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { Euler, MathUtils, Vector3 } from 'three';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { SetPositionCommand } from '../../three.js/editor/js/commands/SetPositionCommand.js';
import { SetRotationCommand } from '../../three.js/editor/js/commands/SetRotationCommand.js';
import { SetScaleCommand } from '../../three.js/editor/js/commands/SetScaleCommand.js';
import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

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

type PropertySnapshot = {
	name: string;
	visible: boolean;
};

type PropertyPatch = {
	name?: string;
	visible?: boolean;
};

type ParsedBatchChange = {
	nodeId: string;
	transform?: TransformPatch;
	properties?: PropertyPatch;
};

const AXES: Axis[] = [ 'x', 'y', 'z' ];
const EPSILON = 1e-7;
const MAX_CHANGES = 20;

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const finiteNumber = ( value: unknown, label: string ) => {

	if ( typeof value !== 'number' || ! Number.isFinite( value ) ) {

		throw new TypeError( `${ label } 必须是有限数字` );

	}
	return value;

};

const parseNodeId = ( value: unknown, label: string ) => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label } 不能为空` );

	}
	return value.trim();

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

const parseTransformPatch = ( value: unknown, label: string ): TransformPatch => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	const patch: TransformPatch = {
		position: parseVectorPatch( value.position, `${ label }.position`, 1_000_000 ),
		rotationDegrees: parseVectorPatch(
			value.rotationDegrees,
			`${ label }.rotationDegrees`,
			360_000
		),
		scale: parseVectorPatch( value.scale, `${ label }.scale`, 10_000 )
	};
	if ( ! patch.position && ! patch.rotationDegrees && ! patch.scale ) {

		throw new TypeError( `${ label } 至少需要包含 position、rotationDegrees 或 scale` );

	}
	return patch;

};

const parseName = ( value: unknown, label: string ) => {

	if ( typeof value !== 'string' ) throw new TypeError( `${ label } 必须是字符串` );
	const name = value.trim();
	if ( ! name ) throw new TypeError( `${ label } 不能为空` );
	if ( name.length > 100 ) throw new RangeError( `${ label } 不能超过 100 个字符` );
	if ( /[\u0000-\u001f\u007f]/.test( name ) ) {

		throw new TypeError( `${ label } 不能包含控制字符` );

	}
	return name;

};

const parsePropertyPatch = ( value: unknown, label: string ): PropertyPatch => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	const patch: PropertyPatch = {};
	if ( value.name !== undefined ) patch.name = parseName( value.name, `${ label }.name` );
	if ( value.visible !== undefined ) {

		if ( typeof value.visible !== 'boolean' ) {

			throw new TypeError( `${ label }.visible 必须是布尔值` );

		}
		patch.visible = value.visible;

	}
	if ( patch.name === undefined && patch.visible === undefined ) {

		throw new TypeError( `${ label } 至少需要包含 name 或 visible` );

	}
	return patch;

};

const parseBatchChanges = ( value: unknown ): ParsedBatchChange[] => {

	if ( ! Array.isArray( value ) || value.length === 0 ) {

		throw new TypeError( 'changes 必须是非空数组' );

	}
	if ( value.length > MAX_CHANGES ) {

		throw new RangeError( `changes 不能超过 ${ MAX_CHANGES } 项` );

	}
	const nodeIds = new Set<string>();
	return value.map( ( item, index ) => {

		if ( ! isRecord( item ) ) throw new TypeError( `changes[${ index }] 必须是对象` );
		const nodeId = parseNodeId( item.nodeId, `changes[${ index }].nodeId` );
		if ( nodeIds.has( nodeId ) ) throw new Error( `changes 中的节点 ${ nodeId } 重复` );
		nodeIds.add( nodeId );
		const transform = item.transform === undefined
			? undefined
			: parseTransformPatch( item.transform, `changes[${ index }].transform` );
		const properties = item.properties === undefined
			? undefined
			: parsePropertyPatch( item.properties, `changes[${ index }].properties` );
		if ( ! transform && ! properties ) {

			throw new TypeError( `changes[${ index }] 至少需要包含 transform 或 properties` );

		}
		return { nodeId, transform, properties };

	} );

};

const getNode = ( editor: MrppEditor, nodeId: string ) => {

	const object = editor.objectByUuid( nodeId );
	if ( ! object || object === editor.scene || ! object.userData?.type ) {

		throw new Error( `找不到可编辑节点 ${ nodeId }` );

	}
	return object;

};

const readTransform = ( object: any ): TransformSnapshot => ( {
	position: { x: object.position.x, y: object.position.y, z: object.position.z },
	rotationDegrees: {
		x: MathUtils.radToDeg( object.rotation.x ),
		y: MathUtils.radToDeg( object.rotation.y ),
		z: MathUtils.radToDeg( object.rotation.z )
	},
	scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
} );

const mergeVector = (
	current: VectorSnapshot,
	patch?: Partial<VectorSnapshot>
): VectorSnapshot => ( {
	x: patch?.x ?? current.x,
	y: patch?.y ?? current.y,
	z: patch?.z ?? current.z
} );

const mergeTransform = (
	current: TransformSnapshot,
	patch: TransformPatch
): TransformSnapshot => ( {
	position: mergeVector( current.position, patch.position ),
	rotationDegrees: mergeVector( current.rotationDegrees, patch.rotationDegrees ),
	scale: mergeVector( current.scale, patch.scale )
} );

const parseVectorSnapshot = ( value: unknown, label: string ): VectorSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	return {
		x: finiteNumber( value.x, `${ label }.x` ),
		y: finiteNumber( value.y, `${ label }.y` ),
		z: finiteNumber( value.z, `${ label }.z` )
	};

};

const parseTransformSnapshot = ( value: unknown, label: string ): TransformSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	return {
		position: parseVectorSnapshot( value.position, `${ label }.position` ),
		rotationDegrees: parseVectorSnapshot(
			value.rotationDegrees,
			`${ label }.rotationDegrees`
		),
		scale: parseVectorSnapshot( value.scale, `${ label }.scale` )
	};

};

const readProperties = ( object: any ): PropertySnapshot => ( {
	name: object.name || '',
	visible: object.visible !== false
} );

const mergeProperties = (
	current: PropertySnapshot,
	patch: PropertyPatch
): PropertySnapshot => ( {
	name: patch.name ?? current.name,
	visible: patch.visible ?? current.visible
} );

const parsePropertySnapshot = ( value: unknown, label: string ): PropertySnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	if ( typeof value.name !== 'string' || typeof value.visible !== 'boolean' ) {

		throw new TypeError( `${ label } 必须包含 name 和 visible` );

	}
	return { name: value.name, visible: value.visible };

};

const vectorsEqual = ( left: VectorSnapshot, right: VectorSnapshot ) =>
	AXES.every( ( axis ) => Math.abs( left[ axis ] - right[ axis ] ) <= EPSILON );

const transformsEqual = ( left: TransformSnapshot, right: TransformSnapshot ) =>
	vectorsEqual( left.position, right.position ) &&
	vectorsEqual( left.rotationDegrees, right.rotationDegrees ) &&
	vectorsEqual( left.scale, right.scale );

const propertiesEqual = ( left: PropertySnapshot, right: PropertySnapshot ) =>
	left.name === right.name && left.visible === right.visible;

const createAtomicCommand = ( editor: MrppEditor, commands: any[] ) => {

	const command = new MultiCmdsCommand( editor, commands );
	command.name = `WebMCP 批量修改 ${ commands.length } 项`;
	return command;

};

const removeFailedHistoryEntry = ( editor: MrppEditor, command: any ) => {

	const history = ( editor as any ).history;
	if ( ! Array.isArray( history?.undos ) ) return;
	const index = history.undos.lastIndexOf( command );
	if ( index >= 0 ) history.undos.splice( index, 1 );

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

export const createWebMcpNodeBatchRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-stage-node-batch': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const changes = parseBatchChanges( payload.changes );
			const previews = changes.map( ( change ) => {

				const object = getNode( editor, change.nodeId );
				const currentTransform = change.transform ? readTransform( object ) : undefined;
				const proposedTransform = currentTransform && change.transform
					? mergeTransform( currentTransform, change.transform )
					: undefined;
				const currentProperties = change.properties ? readProperties( object ) : undefined;
				const proposedProperties = currentProperties && change.properties
					? mergeProperties( currentProperties, change.properties )
					: undefined;
				const changed = Boolean(
					( currentTransform && proposedTransform &&
						! transformsEqual( currentTransform, proposedTransform ) ) ||
					( currentProperties && proposedProperties &&
						! propertiesEqual( currentProperties, proposedProperties ) )
				);
				return {
					nodeId: object.uuid,
					nodeName: object.name || '未命名节点',
					current: {
						...( currentTransform ? { transform: currentTransform } : {} ),
						...( currentProperties ? { properties: currentProperties } : {} )
					},
					proposed: {
						...( proposedTransform ? { transform: proposedTransform } : {} ),
						...( proposedProperties ? { properties: proposedProperties } : {} )
					},
					changed
				};

			} );
			editor.select( getNode( editor, previews[ 0 ].nodeId ) );
			return {
				ok: true,
				changes: previews,
				changedCount: previews.filter( ( preview ) => preview.changed ).length
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-node-batch': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			if ( ! Array.isArray( payload.changes ) || payload.changes.length === 0 ||
				payload.changes.length > MAX_CHANGES ) {

				throw new TypeError( `changes 必须包含 1 到 ${ MAX_CHANGES } 项` );

			}
			const seenNodeIds = new Set<string>();
			const planned: Array<{ object: any; commands: any[] }> = [];
			for ( let index = 0; index < payload.changes.length; index ++ ) {

				const item = payload.changes[ index ];
				if ( ! isRecord( item ) || ! isRecord( item.current ) || ! isRecord( item.proposed ) ) {

					throw new TypeError( `changes[${ index }] 格式无效` );

				}
				const nodeId = parseNodeId( item.nodeId, `changes[${ index }].nodeId` );
				if ( seenNodeIds.has( nodeId ) ) throw new Error( `changes 中的节点 ${ nodeId } 重复` );
				seenNodeIds.add( nodeId );
				const object = getNode( editor, nodeId );
				const commands: any[] = [];

				if ( item.current.transform !== undefined || item.proposed.transform !== undefined ) {

					const expected = parseTransformSnapshot(
						item.current.transform,
						`changes[${ index }].current.transform`
					);
					const current = readTransform( object );
					if ( ! transformsEqual( current, expected ) ) {

						return {
							ok: false,
							code: 'BATCH_CONFLICT',
							error: `节点“${ object.name || nodeId }”的变换在预览后已被修改`,
							nodeId
						};

					}
					const proposed = parseTransformSnapshot(
						item.proposed.transform,
						`changes[${ index }].proposed.transform`
					);
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

				}

				if ( item.current.properties !== undefined || item.proposed.properties !== undefined ) {

					const expected = parsePropertySnapshot(
						item.current.properties,
						`changes[${ index }].current.properties`
					);
					const current = readProperties( object );
					if ( ! propertiesEqual( current, expected ) ) {

						return {
							ok: false,
							code: 'BATCH_CONFLICT',
							error: `节点“${ object.name || nodeId }”的属性在预览后已被修改`,
							nodeId
						};

					}
					const proposed = parsePropertySnapshot(
						item.proposed.properties,
						`changes[${ index }].proposed.properties`
					);
					if ( current.name !== proposed.name ) {

						commands.push( new SetValueCommand(
							editor,
							object,
							'name',
							parseName( proposed.name, `changes[${ index }].proposed.properties.name` )
						) );

					}
					if ( current.visible !== proposed.visible ) {

						commands.push( new SetValueCommand( editor, object, 'visible', proposed.visible ) );

					}

				}
				if ( item.current.transform === undefined && item.current.properties === undefined ) {

					throw new TypeError( `changes[${ index }] 没有可执行内容` );

				}
				planned.push( { object, commands } );

			}

			const commands = planned.flatMap( ( item ) => item.commands );
			if ( commands.length > 0 ) {

				const command = createAtomicCommand( editor, commands );
				try {

					executeAtomicCommand( editor, command );

				} catch ( error ) {

					removeFailedHistoryEntry( editor, command );
					throw error;

				}

			}
			editor.select( planned[ 0 ].object );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				noChange: commands.length === 0,
				commandCount: commands.length,
				changes: planned.map( ( item ) => ( {
					nodeId: item.object.uuid,
					nodeName: item.object.name || '未命名节点',
					transform: readTransform( item.object ),
					properties: readProperties( item.object )
				} ) ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
