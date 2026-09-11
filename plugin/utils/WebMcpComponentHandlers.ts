import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { Box3, MathUtils, Vector3 } from 'three';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js';
import { AddComponentCommand } from '../commands/AddComponentCommand.js';
import { RemoveComponentCommand } from '../commands/RemoveComponentCommand.js';
import { SetComponentValueCommand } from '../commands/SetComponentValueCommand.js';
import { ROLES } from '../access/Access.js';
import type { MrppComponent, MrppEditor, MrppObject3D } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;
type ComponentType = 'Rotate' | 'Action' | 'Moved' | 'Trigger' | 'Tooltip';
type Operation = 'add' | 'update' | 'remove';

type ParsedChange = {
	operation: Operation;
	nodeId: string;
	componentType?: ComponentType;
	componentId?: string;
	settings?: JsonRecord;
};

type ComponentSnapshot = {
	componentId: string;
	componentType: ComponentType;
	settings: JsonRecord;
};

const COMPONENT_TYPES = new Set<ComponentType>( [
	'Rotate', 'Action', 'Moved', 'Trigger', 'Tooltip'
] );
const EXCLUSIVE_TYPES = new Set<ComponentType>( [ 'Action', 'Moved', 'Trigger' ] );
const VALID_NODE_TYPES = new Set( [ 'polygen', 'voxel', 'picture', 'entity' ] );
const TARGET_NODE_TYPES = new Set( [ 'polygen', 'voxel', 'picture' ] );
const MAX_CHANGES = 20;

const isRecord = ( value: unknown ): value is JsonRecord =>
	typeof value === 'object' && value !== null && ! Array.isArray( value );

const clone = <T>( value: T ): T => JSON.parse( JSON.stringify( value ) ) as T;

const stableValue = ( value: unknown ): unknown => {

	if ( Array.isArray( value ) ) return value.map( stableValue );
	if ( ! isRecord( value ) ) return value;
	return Object.fromEntries(
		Object.keys( value ).sort().map( ( key ) => [ key, stableValue( value[ key ] ) ] )
	);

};

const fingerprint = ( value: unknown ) => JSON.stringify( stableValue( value ) );

const parseId = ( value: unknown, label: string ) => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label } 不能为空` );

	}
	return value.trim();

};

const parseComponentType = ( value: unknown, label: string ): ComponentType => {

	if ( typeof value !== 'string' || ! COMPONENT_TYPES.has( value as ComponentType ) ) {

		throw new TypeError( `${ label } 不是受支持的组件类型` );

	}
	return value as ComponentType;

};

const parseSettings = ( value: unknown, label: string, required: boolean ) => {

	if ( value === undefined && ! required ) return undefined;
	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	if ( required && Object.keys( value ).length === 0 ) {

		throw new TypeError( `${ label } 至少需要一个设置项` );

	}
	return clone( value );

};

const parseChanges = ( value: unknown ): ParsedChange[] => {

	if ( ! Array.isArray( value ) || value.length === 0 || value.length > MAX_CHANGES ) {

		throw new TypeError( `changes 必须包含 1 到 ${ MAX_CHANGES } 项` );

	}
	const identities = new Set<string>();
	return value.map( ( item, index ) => {

		if ( ! isRecord( item ) ) throw new TypeError( `changes[${ index }] 必须是对象` );
		const operation = item.operation;
		if ( operation !== 'add' && operation !== 'update' && operation !== 'remove' ) {

			throw new TypeError( `changes[${ index }].operation 无效` );

		}
		const nodeId = parseId( item.nodeId, `changes[${ index }].nodeId` );
		const componentType = operation === 'add'
			? parseComponentType( item.componentType, `changes[${ index }].componentType` )
			: undefined;
		const componentId = operation === 'add'
			? undefined
			: parseId( item.componentId, `changes[${ index }].componentId` );
		const settings = operation === 'remove'
			? undefined
			: parseSettings( item.settings, `changes[${ index }].settings`, operation === 'update' );
		const identity = `${ nodeId }:${ componentId ?? `new:${ componentType }` }`;
		if ( identities.has( identity ) ) {

			throw new TypeError( `changes 中的组件目标 ${ identity } 重复` );

		}
		identities.add( identity );
		return { operation, nodeId, componentType, componentId, settings };

	} );

};

const getNodeType = ( object: any ) => String(
	object.userData?.type || object.type || ''
).toLowerCase();

const getNode = ( editor: MrppEditor, nodeId: string ) => {

	const object = editor.objectByUuid( nodeId ) as MrppObject3D | undefined;
	if ( ! object || ( object as any ) === editor.scene || ! object.userData?.type ) {

		throw new Error( `找不到可编辑节点 ${ nodeId }` );

	}
	return object;

};

const assertComponentNode = ( object: MrppObject3D, componentType?: ComponentType ) => {

	const nodeType = getNodeType( object );
	if ( ! VALID_NODE_TYPES.has( nodeType ) ) {

		throw new Error( `节点“${ object.name || object.uuid }”的类型 ${ nodeType || 'unknown' } 不支持组件` );

	}
	if ( nodeType === 'entity' && componentType && componentType !== 'Rotate' ) {

		throw new Error( '实体节点只支持 Rotate 组件' );

	}

};

const findComponent = ( components: MrppComponent[], componentId: string ) => {

	return components.find( ( component ) => component.parameters?.uuid === componentId );

};

const targetNode = (
	editor: MrppEditor,
	value: unknown,
	label: string,
	owner?: MrppObject3D,
	allowSelf = true
) => {

	if ( value === null ) return null;
	const nodeId = parseId( value, label );
	const target = getNode( editor, nodeId );
	if ( ! TARGET_NODE_TYPES.has( getNodeType( target ) ) ) {

		throw new Error( `${ label } 必须指向模型、体素或图片节点` );

	}
	if ( ! allowSelf && owner && target.uuid === owner.uuid ) {

		throw new Error( `${ label } 不能指向组件所在节点本身` );

	}
	return target;

};

const textValue = ( value: unknown, label: string, maxLength: number ) => {

	if ( typeof value !== 'string' ) throw new TypeError( `${ label } 必须是字符串` );
	if ( value.length > maxLength ) throw new RangeError( `${ label } 不能超过 ${ maxLength } 个字符` );
	if ( /[\u0000-\u001f\u007f]/.test( value ) ) {

		throw new TypeError( `${ label } 不能包含控制字符` );

	}
	return value;

};

const booleanValue = ( value: unknown, label: string ) => {

	if ( typeof value !== 'boolean' ) throw new TypeError( `${ label } 必须是布尔值` );
	return value;

};

const numberValue = ( value: unknown, label: string, min: number, max: number ) => {

	if ( typeof value !== 'number' || ! Number.isFinite( value ) ) {

		throw new TypeError( `${ label } 必须是有限数字` );

	}
	if ( value < min || value > max ) throw new RangeError( `${ label } 超出允许范围` );
	return value;

};

const computeTargetPosition = ( object: MrppObject3D ) => {

	object.updateWorldMatrix( true, true );
	const center = new Vector3();
	new Box3().setFromObject( object ).getCenter( center );
	center.applyMatrix4( object.matrixWorld.clone().invert() );
	return { uuid: object.uuid, x: center.x, y: center.y, z: center.z };

};

const createDefaultComponent = (
	type: ComponentType,
	object: MrppObject3D
): MrppComponent => {

	const uuid = MathUtils.generateUUID();
	switch ( type ) {

		case 'Rotate':
			return { type, parameters: { uuid, speed: { x: 0, y: 0, z: 0 }, isRotating: true, action: 'rotate' } };
		case 'Action':
			return { type, parameters: { uuid, action: '', parameter: '', mode: [ 'pinch' ] } };
		case 'Moved':
			return {
				type,
				parameters: {
					uuid, magnetic: false, scalable: false,
					limit: {
						x: { enable: false, min: 0, max: 0 },
						y: { enable: false, min: 0, max: 0 },
						z: { enable: false, min: 0, max: 0 }
					},
					action: ''
				}
			};
		case 'Trigger':
			return { type, parameters: { uuid, target: null, action: '' } };
		case 'Tooltip':
			return {
				type,
				parameters: {
					uuid, text: '', target: computeTargetPosition( object ), length: 0.25, action: 'tooltip'
				}
			};

	}

};

const supportedKeys = ( type: ComponentType ) => {

	switch ( type ) {

		case 'Rotate': return new Set( [ 'speed', 'isRotating' ] );
		case 'Action': return new Set( [ 'actionName', 'modes' ] );
		case 'Moved': return new Set( [ 'scalable', 'magnetic', 'actionName' ] );
		case 'Trigger': return new Set( [ 'targetNodeId', 'actionName' ] );
		case 'Tooltip': return new Set( [ 'text', 'length', 'targetNodeId' ] );

	}

};

const applySettings = (
	editor: MrppEditor,
	object: MrppObject3D,
	component: MrppComponent,
	settings: JsonRecord,
	label: string
) => {

	const type = parseComponentType( component.type, `${ label }.componentType` );
	const allowed = supportedKeys( type );
	for ( const key of Object.keys( settings ) ) {

		if ( ! allowed.has( key ) ) throw new TypeError( `${ label }.${ key } 不适用于 ${ type } 组件` );

	}
	const parameters = component.parameters;
	if ( type === 'Rotate' ) {

		if ( settings.speed !== undefined ) {

			if ( ! isRecord( settings.speed ) || Object.keys( settings.speed ).length === 0 ) {

				throw new TypeError( `${ label }.speed 必须是非空对象` );

			}
			const speed = isRecord( parameters.speed ) ? clone( parameters.speed ) : { x: 0, y: 0, z: 0 };
			for ( const axis of [ 'x', 'y', 'z' ] ) {

				if ( settings.speed[ axis ] !== undefined ) {

					speed[ axis ] = numberValue( settings.speed[ axis ], `${ label }.speed.${ axis }`, - 360000, 360000 );

				}

			}
			parameters.speed = speed;

		}
		if ( settings.isRotating !== undefined ) {

			parameters.isRotating = booleanValue( settings.isRotating, `${ label }.isRotating` );

		}

	}
	if ( type === 'Action' ) {

		if ( settings.actionName !== undefined ) {

			parameters.action = textValue( settings.actionName, `${ label }.actionName`, 100 );

		}
		if ( settings.modes !== undefined ) {

			if ( ! Array.isArray( settings.modes ) || settings.modes.length === 0 ) {

				throw new TypeError( `${ label }.modes 必须是非空数组` );

			}
			const modes = Array.from( new Set( settings.modes ) );
			if ( modes.some( ( mode ) => mode !== 'pinch' && mode !== 'touch' ) ) {

				throw new TypeError( `${ label }.modes 只能包含 pinch 或 touch` );

			}
			if ( modes.includes( 'touch' ) && ! editor.access?.atLeast?.( ROLES.MANAGER ) ) {

				throw new Error( '当前账号没有启用 touch 交互模式的权限' );

			}
			parameters.mode = modes;

		}

	}
	if ( type === 'Moved' ) {

		if ( settings.scalable !== undefined ) parameters.scalable = booleanValue( settings.scalable, `${ label }.scalable` );
		if ( settings.magnetic !== undefined ) parameters.magnetic = booleanValue( settings.magnetic, `${ label }.magnetic` );
		if ( settings.actionName !== undefined ) parameters.action = textValue( settings.actionName, `${ label }.actionName`, 100 );
		if ( parameters.magnetic === false ) parameters.action = '';

	}
	if ( type === 'Trigger' ) {

		if ( settings.actionName !== undefined ) parameters.action = textValue( settings.actionName, `${ label }.actionName`, 100 );
		if ( settings.targetNodeId !== undefined ) {

			parameters.target = targetNode(
				editor, settings.targetNodeId, `${ label }.targetNodeId`, object, false
			)?.uuid ?? null;

		}

	}
	if ( type === 'Tooltip' ) {

		if ( settings.text !== undefined ) parameters.text = textValue( settings.text, `${ label }.text`, 2000 );
		if ( settings.length !== undefined ) parameters.length = numberValue( settings.length, `${ label }.length`, 0, 1000 );
		if ( settings.targetNodeId !== undefined ) {

			const target = targetNode( editor, settings.targetNodeId, `${ label }.targetNodeId`, object );
			parameters.target = target ? computeTargetPosition( target ) : { uuid: '', x: 0, y: 0, z: 0 };

		}

	}
	return component;

};

const readSettings = ( component: MrppComponent ): JsonRecord => {

	const type = parseComponentType( component.type, 'component.type' );
	const parameters = component.parameters || { uuid: '' };
	switch ( type ) {

		case 'Rotate':
			return {
				speed: clone( parameters.speed || { x: 0, y: 0, z: 0 } ),
				isRotating: parameters.isRotating !== false
			};
		case 'Action':
			return { actionName: parameters.action || '', modes: clone( parameters.mode || [ 'pinch' ] ) };
		case 'Moved':
			return {
				scalable: Boolean( parameters.scalable ),
				magnetic: Boolean( parameters.magnetic ),
				actionName: parameters.action || ''
			};
		case 'Trigger':
			return { targetNodeId: parameters.target || null, actionName: parameters.action || '' };
		case 'Tooltip':
			return {
				text: parameters.text || '',
				length: Number( parameters.length ?? 0.25 ),
				targetNodeId: parameters.target?.uuid || null
			};

	}

};

const snapshot = ( component: MrppComponent ): ComponentSnapshot => ( {
	componentId: parseId( component.parameters?.uuid, 'component.parameters.uuid' ),
	componentType: parseComponentType( component.type, 'component.type' ),
	settings: readSettings( component )
} );

const parseSnapshot = ( value: unknown, label: string ): ComponentSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	return {
		componentId: parseId( value.componentId, `${ label }.componentId` ),
		componentType: parseComponentType( value.componentType, `${ label }.componentType` ),
		settings: parseSettings( value.settings, `${ label }.settings`, false ) || {}
	};

};

const assertExclusive = ( components: MrppComponent[], proposedType: ComponentType ) => {

	if ( ! EXCLUSIVE_TYPES.has( proposedType ) ) return;
	const conflict = components.find( ( component ) => {

		const type = component.type as ComponentType;
		return EXCLUSIVE_TYPES.has( type ) && type !== proposedType;

	} );
	if ( conflict ) {

		throw new Error( `不能同时添加 ${ proposedType } 与 ${ conflict.type } 互斥组件` );

	}

};

const createAtomicCommand = ( editor: MrppEditor, commands: any[] ) => {

	const command = new MultiCmdsCommand( editor, commands );
	command.name = `WebMCP 批量修改组件 ${ commands.length } 项`;
	return command;

};

const removeFailedHistoryEntry = ( editor: MrppEditor, command: any ) => {

	const history = ( editor as any ).history;
	if ( ! Array.isArray( history?.undos ) ) return;
	const index = history.undos.lastIndexOf( command );
	if ( index >= 0 ) history.undos.splice( index, 1 );

};

const assertReadable = ( editor: MrppEditor ) => {

	if ( editor.metaLoader?.getLoadingStatus?.() ) throw new Error( '实体模型仍在加载，请稍后重试' );

};

const assertEditable = ( editor: MrppEditor ) => {

	assertReadable( editor );
	if ( editor.data?.saveable === false ) throw new Error( '当前实体没有编辑权限' );

};

const errorResult = ( error: unknown ) => ( {
	ok: false,
	code: error instanceof RangeError ? 'INVALID_RANGE' : 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );

const listNodeComponents = ( object: MrppObject3D ) => ( {
	nodeId: object.uuid,
	nodeName: object.name || '未命名节点',
	nodeType: getNodeType( object ),
	components: ( object.components || [] ).map( snapshot )
} );

const colliderTargetIds = ( editor: MrppEditor ) => {

	const targets = new Set<string>();
	editor.scene.traverse( ( object: any ) => {

		for ( const component of object.components || [] ) {

			if ( component.type === 'Trigger' && typeof component.parameters?.target === 'string' ) {

				targets.add( component.parameters.target );

			}

		}

	} );
	return targets;

};

export const createWebMcpComponentRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-get-node-components': ( payload: JsonRecord ) => {

		try {

			assertReadable( editor );
			const object = getNode( editor, parseId( payload.nodeId, 'nodeId' ) );
			assertComponentNode( object );
			return { ok: true, ...listNodeComponents( object ) };

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-stage-component-batch': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const changes = parseChanges( payload.changes );
			const virtualComponents = new Map<string, MrppComponent[]>();
			const versions = new Map<string, string>();
			const previews = changes.map( ( change, index ) => {

				const object = getNode( editor, change.nodeId );
				assertComponentNode( object, change.componentType );
				if ( ! virtualComponents.has( object.uuid ) ) {

					virtualComponents.set( object.uuid, clone( object.components || [] ) );
					versions.set( object.uuid, fingerprint( object.components || [] ) );

				}
				const components = virtualComponents.get( object.uuid )!;
				let current: ComponentSnapshot | null = null;
				let proposed: ComponentSnapshot | null = null;
				if ( change.operation === 'add' ) {

					const type = change.componentType!;
					assertExclusive( components, type );
					const component = createDefaultComponent( type, object );
					applySettings( editor, object, component, change.settings || {}, `changes[${ index }].settings` );
					components.push( component );
					proposed = snapshot( component );

				} else {

					const component = findComponent( components, change.componentId! );
					if ( ! component ) throw new Error( `节点“${ object.name || object.uuid }”中找不到组件 ${ change.componentId }` );
					current = snapshot( component );
					if ( change.operation === 'remove' ) {

						components.splice( components.indexOf( component ), 1 );

					} else {

						const next = clone( component );
						applySettings( editor, object, next, change.settings || {}, `changes[${ index }].settings` );
						components.splice( components.indexOf( component ), 1, next );
						proposed = snapshot( next );

					}

				}
				return {
					operation: change.operation,
					nodeId: object.uuid,
					nodeName: object.name || '未命名节点',
					nodeType: getNodeType( object ),
					componentId: ( proposed || current )!.componentId,
					componentType: ( proposed || current )!.componentType,
					current,
					proposed,
					componentsVersion: versions.get( object.uuid )!,
					changed: change.operation !== 'update' || fingerprint( current ) !== fingerprint( proposed )
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
	'webmcp-complete-component-batch': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			if ( ! Array.isArray( payload.changes ) || payload.changes.length === 0 || payload.changes.length > MAX_CHANGES ) {

				throw new TypeError( `changes 必须包含 1 到 ${ MAX_CHANGES } 项` );

			}
			const nodeVersions = new Map<string, string>();
			for ( let index = 0; index < payload.changes.length; index ++ ) {

				const item = payload.changes[ index ];
				if ( ! isRecord( item ) ) throw new TypeError( `changes[${ index }] 格式无效` );
				const nodeId = parseId( item.nodeId, `changes[${ index }].nodeId` );
				const version = parseId( item.componentsVersion, `changes[${ index }].componentsVersion` );
				const previous = nodeVersions.get( nodeId );
				if ( previous && previous !== version ) throw new TypeError( `节点 ${ nodeId } 的组件版本不一致` );
				nodeVersions.set( nodeId, version );

			}
			for ( const [ nodeId, version ] of nodeVersions ) {

				const object = getNode( editor, nodeId );
				if ( fingerprint( object.components || [] ) !== version ) {

					return {
						ok: false,
						code: 'COMPONENT_CONFLICT',
						error: `节点“${ object.name || nodeId }”的组件在预览后已变化`,
						nodeId
					};

				}

			}

			const commands: any[] = [];
			const planningComponents = new Map<string, MrppComponent[]>();
			const touchedObjects: MrppObject3D[] = [];
			for ( let index = 0; index < payload.changes.length; index ++ ) {

				const item = payload.changes[ index ] as JsonRecord;
				const operation = item.operation;
				if ( operation !== 'add' && operation !== 'update' && operation !== 'remove' ) {

					throw new TypeError( `changes[${ index }].operation 无效` );

				}
				const object = getNode( editor, parseId( item.nodeId, `changes[${ index }].nodeId` ) );
				if ( ! touchedObjects.includes( object ) ) touchedObjects.push( object );
				if ( ! planningComponents.has( object.uuid ) ) {

					planningComponents.set( object.uuid, clone( object.components || [] ) );

				}
				const plannedComponents = planningComponents.get( object.uuid )!;
				if ( operation === 'add' ) {

					const proposed = parseSnapshot( item.proposed, `changes[${ index }].proposed` );
					if ( findComponent( plannedComponents, proposed.componentId ) ) throw new Error( `组件 ${ proposed.componentId } 已存在` );
					assertComponentNode( object, proposed.componentType );
					assertExclusive( plannedComponents, proposed.componentType );
					const component = createDefaultComponent( proposed.componentType, object );
					component.parameters.uuid = proposed.componentId;
					applySettings( editor, object, component, proposed.settings, `changes[${ index }].proposed.settings` );
					commands.push( new AddComponentCommand( editor, object, component ) );
					plannedComponents.push( clone( component ) );

				} else {

					const current = parseSnapshot( item.current, `changes[${ index }].current` );
					const plannedComponent = findComponent( plannedComponents, current.componentId );
					const component = findComponent( object.components || [], current.componentId );
					if ( ! plannedComponent || ! component || fingerprint( snapshot( plannedComponent ) ) !== fingerprint( current ) ) {

						throw new Error( `组件 ${ current.componentId } 在预览后已变化` );

					}
					if ( operation === 'remove' ) {

						commands.push( new RemoveComponentCommand( editor, object, component ) );
						plannedComponents.splice( plannedComponents.indexOf( plannedComponent ), 1 );

					} else {

						const proposed = parseSnapshot( item.proposed, `changes[${ index }].proposed` );
						if ( proposed.componentId !== current.componentId || proposed.componentType !== current.componentType ) {

							throw new Error( '更新组件时不能修改组件 UUID 或类型' );

						}
						const next = clone( plannedComponent );
						applySettings( editor, object, next, proposed.settings, `changes[${ index }].proposed.settings` );
						if ( fingerprint( component.parameters ) !== fingerprint( next.parameters ) ) {

							commands.push( new SetComponentValueCommand(
								editor, object, component, 'parameters', clone( next.parameters )
							) );

						}
						plannedComponents.splice( plannedComponents.indexOf( plannedComponent ), 1, next );

					}

				}

			}

			const beforeColliderTargets = colliderTargetIds( editor );
			const simulated = new Map<string, MrppComponent[]>();
			for ( const object of touchedObjects ) simulated.set( object.uuid, clone( object.components || [] ) );
			for ( const item of payload.changes as JsonRecord[] ) {

				const components = simulated.get( String( item.nodeId ) )!;
				const operation = item.operation;
				if ( operation === 'add' ) {

					const proposed = parseSnapshot( item.proposed, 'proposed' );
					const object = getNode( editor, String( item.nodeId ) );
					const component = createDefaultComponent( proposed.componentType, object );
					component.parameters.uuid = proposed.componentId;
					applySettings( editor, object, component, proposed.settings, 'proposed.settings' );
					components.push( component );

				} else {

					const current = parseSnapshot( item.current, 'current' );
					const found = findComponent( components, current.componentId )!;
					if ( operation === 'remove' ) components.splice( components.indexOf( found ), 1 );
					else {

						const proposed = parseSnapshot( item.proposed, 'proposed' );
						const next = clone( found );
						applySettings( editor, getNode( editor, String( item.nodeId ) ), next, proposed.settings, 'proposed.settings' );
						components.splice( components.indexOf( found ), 1, next );

					}

				}

			}
			const finalColliderTargets = new Set<string>();
			editor.scene.traverse( ( object: any ) => {

				const components = simulated.get( object.uuid ) || object.components || [];
				for ( const component of components ) {

					if ( component.type === 'Trigger' && typeof component.parameters?.target === 'string' ) {

						finalColliderTargets.add( component.parameters.target );

					}

				}

			} );
			for ( const targetId of new Set( [ ...beforeColliderTargets, ...finalColliderTargets ] ) ) {

				const target = editor.objectByUuid( targetId );
				if ( ! target?.userData ) continue;
				const proposed = finalColliderTargets.has( targetId );
				if ( Boolean( target.userData.isCollider ) !== proposed ) {

					commands.push( new SetValueCommand( editor, target.userData, 'isCollider', proposed ) );

				}

			}

			if ( commands.length > 0 ) {

				const command = createAtomicCommand( editor, commands );
				try { executeAtomicCommand( editor, command ); } catch ( error ) {

					removeFailedHistoryEntry( editor, command );
					throw error;

				}

			}
			editor.select( touchedObjects[ 0 ] );
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				noChange: commands.length === 0,
				commandCount: commands.length,
				changes: ( payload.changes as JsonRecord[] ).map( ( item ) => {

					const value = ( item.proposed || item.current ) as JsonRecord;
					return {
						operation: item.operation,
						nodeId: item.nodeId,
						nodeName: getNode( editor, String( item.nodeId ) ).name || '未命名节点',
						componentId: value.componentId,
						componentType: value.componentType
					};

				} ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
