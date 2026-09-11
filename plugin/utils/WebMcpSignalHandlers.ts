import { getEntityMutationReceipt } from '../webmcp/EntityReadHandlers.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { MathUtils } from 'three';
import { WebMcpBatchCommand as MultiCmdsCommand } from '../commands/WebMcpBatchCommand.js';
import { AddEventCommand } from '../commands/AddEventCommand.js';
import { RemoveEventCommand } from '../commands/RemoveEventCommand.js';
import { SetEventValueCommand } from '../commands/SetEventValueCommand.js';
import type { MrppEditor, MrppEventIO, MrppScene } from '../types/mrpp.js';

type JsonRecord = Record<string, unknown>;
type SignalDirection = 'input' | 'output';
type SignalOperation = 'add' | 'rename' | 'remove';

type ParsedChange = {
	operation: SignalOperation;
	direction: SignalDirection;
	signalId?: string;
	title?: string;
};

type SignalSnapshot = {
	signalId: string;
	direction: SignalDirection;
	title: string;
};

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

const parseTitle = ( value: unknown, label: string ) => {

	if ( typeof value !== 'string' || ! value.trim() ) {

		throw new TypeError( `${ label } 不能为空` );

	}
	const title = value.trim();
	if ( title.length > 100 ) throw new RangeError( `${ label } 不能超过 100 个字符` );
	if ( /[\u0000-\u001f\u007f]/.test( title ) ) {

		throw new TypeError( `${ label } 不能包含控制字符` );

	}
	return title;

};

const parseDirection = ( value: unknown, label: string ): SignalDirection => {

	if ( value !== 'input' && value !== 'output' ) {

		throw new TypeError( `${ label } 必须是 input 或 output` );

	}
	return value;

};

const parseChanges = ( value: unknown ): ParsedChange[] => {

	if ( ! Array.isArray( value ) || value.length === 0 || value.length > MAX_CHANGES ) {

		throw new TypeError( `changes 必须包含 1 到 ${ MAX_CHANGES } 项` );

	}
	const targets = new Set<string>();
	return value.map( ( item, index ) => {

		if ( ! isRecord( item ) ) throw new TypeError( `changes[${ index }] 必须是对象` );
		const operation = item.operation;
		if ( operation !== 'add' && operation !== 'rename' && operation !== 'remove' ) {

			throw new TypeError( `changes[${ index }].operation 无效` );

		}
		const direction = parseDirection( item.direction, `changes[${ index }].direction` );
		const signalId = operation === 'add'
			? undefined
			: parseId( item.signalId, `changes[${ index }].signalId` );
		const title = operation === 'remove'
			? undefined
			: parseTitle( item.title, `changes[${ index }].title` );
		if ( signalId ) {

			const target = `${ direction }:${ signalId }`;
			if ( targets.has( target ) ) throw new TypeError( `changes 中的信号目标 ${ target } 重复` );
			targets.add( target );

		}
		return { operation, direction, signalId, title };

	} );

};

const ensureEvents = ( editor: MrppEditor ) => {

	const scene = editor.scene as MrppScene;
	if ( ! scene.events ) ( scene as any ).events = { inputs: [], outputs: [] };
	if ( ! Array.isArray( scene.events.inputs ) ) scene.events.inputs = [];
	if ( ! Array.isArray( scene.events.outputs ) ) scene.events.outputs = [];
	return scene.events;

};

const getList = (
	events: { inputs: MrppEventIO[]; outputs: MrppEventIO[] },
	direction: SignalDirection
) => direction === 'input' ? events.inputs : events.outputs;

const findSignal = ( list: MrppEventIO[], signalId: string ) =>
	list.find( ( signal ) => signal.uuid === signalId );

const snapshot = (
	signal: MrppEventIO,
	direction: SignalDirection
): SignalSnapshot => ( {
	signalId: parseId( signal.uuid, 'signal.uuid' ),
	direction,
	title: parseTitle( signal.title, 'signal.title' )
} );

const parseSnapshot = ( value: unknown, label: string ): SignalSnapshot => {

	if ( ! isRecord( value ) ) throw new TypeError( `${ label } 必须是对象` );
	return {
		signalId: parseId( value.signalId, `${ label }.signalId` ),
		direction: parseDirection( value.direction, `${ label }.direction` ),
		title: parseTitle( value.title, `${ label }.title` )
	};

};

const createAtomicCommand = ( editor: MrppEditor, commands: any[] ) => {

	const command = new MultiCmdsCommand( editor, commands );
	command.name = `WebMCP 批量修改信号 ${ commands.length } 项`;
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

const listSignals = ( editor: MrppEditor ) => {

	const events = ensureEvents( editor );
	return {
		inputs: events.inputs.map( ( signal ) => snapshot( signal, 'input' ) ),
		outputs: events.outputs.map( ( signal ) => snapshot( signal, 'output' ) )
	};

};

export const createWebMcpSignalRequestHandlers = ( editor: MrppEditor ) => ( {
	'webmcp-get-entity-signals': () => {

		try {

			assertReadable( editor );
			return { ok: true, ...listSignals( editor ) };

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-stage-signal-batch': ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			const changes = parseChanges( payload.changes );
			const currentEvents = ensureEvents( editor );
			const virtualEvents = clone( currentEvents );
			const signalsVersion = fingerprint( currentEvents );
			const previews = changes.map( ( change ) => {

				const list = getList( virtualEvents, change.direction );
				let current: SignalSnapshot | null = null;
				let proposed: SignalSnapshot | null = null;
				if ( change.operation === 'add' ) {

					const signal = { title: change.title!, uuid: MathUtils.generateUUID() };
					list.push( signal );
					proposed = snapshot( signal, change.direction );

				} else {

					const signal = findSignal( list, change.signalId! );
					if ( ! signal ) throw new Error( `找不到 ${ change.direction } 信号 ${ change.signalId }` );
					current = snapshot( signal, change.direction );
					if ( change.operation === 'remove' ) {

						list.splice( list.indexOf( signal ), 1 );

					} else {

						signal.title = change.title!;
						proposed = snapshot( signal, change.direction );

					}

				}
				return {
					operation: change.operation,
					direction: change.direction,
					signalId: ( proposed || current )!.signalId,
					current,
					proposed,
					signalsVersion,
					changed: change.operation !== 'rename' || current!.title !== proposed!.title,
					references: []
				};

			} );
			return {
				ok: true,
				changes: previews,
				changedCount: previews.filter( ( preview ) => preview.changed ).length
			};

		} catch ( error ) {

			return errorResult( error );

		}

	},
	'webmcp-complete-signal-batch': async ( payload: JsonRecord ) => {

		try {

			assertEditable( editor );
			if ( ! Array.isArray( payload.changes ) || payload.changes.length === 0 || payload.changes.length > MAX_CHANGES ) {

				throw new TypeError( `changes 必须包含 1 到 ${ MAX_CHANGES } 项` );

			}
			const currentEvents = ensureEvents( editor );
			const expectedVersions = new Set<string>();
			for ( let index = 0; index < payload.changes.length; index ++ ) {

				const item = payload.changes[ index ];
				if ( ! isRecord( item ) ) throw new TypeError( `changes[${ index }] 格式无效` );
				expectedVersions.add( parseId( item.signalsVersion, `changes[${ index }].signalsVersion` ) );

			}
			if ( expectedVersions.size !== 1 || ! expectedVersions.has( fingerprint( currentEvents ) ) ) {

				return {
					ok: false,
					code: 'SIGNAL_CONFLICT',
					error: '实体信号在预览后已变化，请重新预览'
				};

			}

			const plannedEvents = clone( currentEvents );
			const addCommands: any[] = [];
			const renameCommands: any[] = [];
			const removeCommands: Array<{ direction: SignalDirection; index: number; command: any }> = [];
			for ( let index = 0; index < payload.changes.length; index ++ ) {

				const item = payload.changes[ index ] as JsonRecord;
				const operation = item.operation;
				if ( operation !== 'add' && operation !== 'rename' && operation !== 'remove' ) {

					throw new TypeError( `changes[${ index }].operation 无效` );

				}
				const direction = parseDirection( item.direction, `changes[${ index }].direction` );
				const plannedList = getList( plannedEvents, direction );
				const actualList = getList( currentEvents, direction );
				if ( operation === 'add' ) {

					const proposed = parseSnapshot( item.proposed, `changes[${ index }].proposed` );
					if ( proposed.direction !== direction ) throw new Error( '新增信号方向与预览不一致' );
					if ( findSignal( currentEvents.inputs, proposed.signalId ) || findSignal( currentEvents.outputs, proposed.signalId ) ) {

						throw new Error( `信号 ${ proposed.signalId } 已存在` );

					}
					const signal = { title: proposed.title, uuid: proposed.signalId };
					addCommands.push( new AddEventCommand( editor, signal, direction ) );
					plannedList.push( clone( signal ) );

				} else {

					const current = parseSnapshot( item.current, `changes[${ index }].current` );
					if ( current.direction !== direction ) throw new Error( '信号方向与预览不一致' );
					const planned = findSignal( plannedList, current.signalId );
					const actual = findSignal( actualList, current.signalId );
					if ( ! planned || ! actual || fingerprint( snapshot( planned, direction ) ) !== fingerprint( current ) ) {

						throw new Error( `信号 ${ current.signalId } 在预览后已变化` );

					}
					if ( operation === 'remove' ) {

						removeCommands.push( {
							direction,
							index: actualList.indexOf( actual ),
							command: new RemoveEventCommand( editor, actual, direction )
						} );
						plannedList.splice( plannedList.indexOf( planned ), 1 );

					} else {

						const proposed = parseSnapshot( item.proposed, `changes[${ index }].proposed` );
						if ( proposed.signalId !== current.signalId || proposed.direction !== current.direction ) {

							throw new Error( '重命名信号时不能修改 UUID 或方向' );

						}
						if ( proposed.title !== current.title ) {

							renameCommands.push( new SetEventValueCommand( editor, actual, direction, 'title', proposed.title ) );

						}
						planned.title = proposed.title;

					}

				}

			}

			removeCommands.sort( ( left, right ) => {

				if ( left.direction !== right.direction ) return left.direction.localeCompare( right.direction );
				return right.index - left.index;

			} );
			const commands = [
				...renameCommands,
				...addCommands,
				...removeCommands.map( ( item ) => item.command )
			];
			if ( commands.length > 0 ) {

				const command = createAtomicCommand( editor, commands );
				try { executeAtomicCommand( editor, command ); } catch ( error ) {

					removeFailedHistoryEntry( editor, command );
					throw error;

				}

			}
			const receipt = await getEntityMutationReceipt( editor );
			return {
				ok: true,
				noChange: commands.length === 0,
				commandCount: commands.length,
				changes: ( payload.changes as JsonRecord[] ).map( ( item ) => {

					const value = ( item.proposed || item.current ) as JsonRecord;
					return {
						operation: item.operation,
						direction: item.direction,
						signalId: value.signalId,
						title: value.title
					};

				} ),
				...receipt
			};

		} catch ( error ) {

			return errorResult( error );

		}

	}
} );
