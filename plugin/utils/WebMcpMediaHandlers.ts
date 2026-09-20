import * as THREE from 'three';
import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js';
import { WebMcpBatchCommand } from '../commands/WebMcpBatchCommand.js';
import { executeAtomicCommand } from '../webmcp/AtomicCommands.js';
import { authoredObjectSnapshot, captureEditorState, contentVersion, getEditorContext } from '../webmcp/EditorContext.js';
import { getEntityMutationReceipt, getEntityWebMcpState } from '../webmcp/EntityReadHandlers.js';
import { authoringPropertyConstraints, mergeAuthoringProperties, readAuthoringProperties } from '../webmcp/AuthoringProperties.js';
import { getImportedAnimations } from '../webmcp/ImportedAnimationMetadata.js';
import { beginEditorAnimationPreview, endEditorAnimationPreview, hasActiveEditorAnimationPreview, registerEditorAnimationPreview, stopEditorAnimationPreviews, unregisterEditorAnimationPreview } from '../webmcp/EditorAnimationPreview.js';
import type { MrppEditor } from '../types/mrpp.js';

type JsonRecord = Record<string, any>;
type PreviewAction = {
	time: number; paused: boolean; loop: number; timeScale: number;
	getClip(): THREE.AnimationClip; isScheduled(): boolean; isRunning(): boolean;
	reset(): PreviewAction; play(): PreviewAction; stop(): PreviewAction;
};
class RequestError extends Error {
	constructor( readonly code: string, message: string ) { super( message ); }
}
const failure = ( error: unknown ) => ( {
	ok: false,
	code: error instanceof RequestError ? error.code : error instanceof RangeError ? 'INVALID_RANGE' : 'INVALID_REQUEST',
	error: error instanceof Error ? error.message : String( error )
} );
const asRecord = ( value: unknown, label: string ): JsonRecord => {
	if ( ! value || typeof value !== 'object' || Array.isArray( value ) ) throw new TypeError( `${ label } 必须是对象` );
	return value as JsonRecord;
};
const node = ( editor: MrppEditor, value: unknown ) => {
	if ( typeof value !== 'string' || ! value.trim() || value.length > 200 ) throw new TypeError( 'nodeId 无效' );
	const object = editor.objectByUuid( value );
	if ( ! object || object === editor.scene || ! object.userData?.type ) throw new RequestError( 'NODE_NOT_FOUND', '找不到节点' );
	return object;
};
const readable = ( editor: MrppEditor ) => {
	if ( ! getEditorContext( editor ).active ) throw new RequestError( 'CONTEXT_CHANGED', '编辑器会话已结束' );
};
const editable = ( editor: MrppEditor, allowPreview = false ) => {
	readable( editor );
	if ( ! allowPreview && hasActiveEditorAnimationPreview( editor ) ) throw new RequestError( 'ANIMATION_PREVIEW_ACTIVE', '请先停止 WebMCP 动画预览，再修改创作内容' );
	if ( editor.data?.saveable === false ) throw new RequestError( 'READ_ONLY', '当前实体没有编辑权限' );
	if ( editor.metaLoader?.getLoadingStatus?.() ) throw new RequestError( 'EDITOR_LOADING', '实体仍在加载' );
};
const authoringType = ( object: any ): 'Sound' | 'Text' => {
	const type = String( object.userData.type ).toLowerCase();
	if ( type === 'sound' ) return 'Sound';
	if ( type === 'text' ) return 'Text';
	throw new RequestError( 'UNSUPPORTED_NODE_TYPE', '此接口仅支持 Sound 和 Text 节点的创作字段' );
};
const propertiesVersion = ( object: any ) => contentVersion( { nodeId: object.uuid, userData: object.userData } );
const snapshot = ( editor: MrppEditor, object: any ) => {
	const type = authoringType( object );
	return {
		nodeId: object.uuid, nodeType: type, properties: readAuthoringProperties( type, object.userData ),
		propertiesVersion: propertiesVersion( object ), contextGeneration: getEditorContext( editor ).generation,
		constraints: authoringPropertyConstraints[ type ], scope: 'authoring', runtimeSupport: 'not-verified',
		defaults: readAuthoringProperties( type, {} )
	};
};

function animations( editor: MrppEditor, object: any ) {
	if ( String( object.userData.type ).toLowerCase() !== 'polygen' ) throw new RequestError( 'UNSUPPORTED_NODE_TYPE', '动画信息仅支持模型节点' );
	const imported = getImportedAnimations( object );
	const actual = Array.isArray( object.animations ) ? object.animations : [];
	const clips: THREE.AnimationClip[] = imported !== undefined ? [ ...imported ] : actual.filter( ( clip: any ) => clip instanceof THREE.AnimationClip );
	const parsed = imported !== undefined || clips.length > 0;
	const pending = Boolean( editor.metaLoader?.getLoadingStatus?.() );
	const resourceId = object.userData.resource ?? null;
	const resource = ( editor.data?.resources || [] ).find( ( item: any ) => String( item?.id ) === String( resourceId ) );
	const explicitVersion = resource?.serverRevision ?? resource?.revision ?? resource?.updated_at ?? null;
	const descriptor = resource ? {
		id: resource.id, fileId: resource.file_id ?? resource.file?.id ?? null,
		version: explicitVersion, hash: resource.file?.hash ?? resource.file?.sha256 ?? resource.file?.md5 ?? null,
		size: resource.file?.size ?? resource.size ?? null
	} : null;
	const resourceVersion = explicitVersion !== null ? String( explicitVersion ) : descriptor ? contentVersion( descriptor ) : null;
	const animationVersion = contentVersion( {
		nodeId: object.uuid, resourceId, resourceVersion, parsed,
		clips: clips.map( clip => {
			const data = ( clip as any ).toJSON();
			delete data.uuid;
			return data;
		} )
	} );
	return { clips, metadata: {
		ok: true, nodeId: object.uuid, scope: 'imported-model',
		parseStatus: parsed ? 'ready' : pending ? 'pending' : 'unknown',
		reason: parsed ? null : pending ? 'MODEL_IMPORT_IN_PROGRESS' : 'NO_CONFIRMED_IMPORT_RESULT',
		source: imported !== undefined ? 'gltf-import' : parsed ? 'object-animation-clips' : 'unknown',
		resourceId, resourceVersion, resourceVersionSource: explicitVersion !== null ? 'resource-revision' : descriptor ? 'resource-descriptor-fingerprint' : 'unknown',
		animationVersion, contextGeneration: getEditorContext( editor ).generation,
		clips: parsed ? clips.map( ( clip, clipIndex ) => ( { clipIndex, selectionValue: `clip:${ clipIndex }`, name: clip.name, duration: clip.duration } ) ) : null,
		defaultPlaybackPolicy: 'not-declared', runtimeSupport: 'not-verified'
	} };
}

const previewContract = {
	scope: 'editor-preview', persisted: false, runtimeControl: false,
	concurrencyPolicy: 'one-model-per-editor',
	stopBehavior: 'restore-pre-preview-bindings', seekTimeOrigin: 'clip-local-seconds',
	editingPolicy: 'stop-before-edit-or-save; user-input-stops-preview-first',
	note: '仅操作当前编辑器预览；不保存播放策略，也不证明课程运行器支持这些操作。'
};

/** Project-owned adapters around public editor APIs; no runtime/Blockly/Three patches. */
export const createWebMcpMediaRequestHandlers = ( editor: MrppEditor ) => {
	const selectedActions = new WeakMap<object, PreviewAction>();
	const previewStops = new WeakMap<object, () => void>();
	const getPreview = ( object: any, clips: THREE.AnimationClip[] ) => {
		const actions = clips.map( clip => editor.mixer?.existingAction( clip, object ) as PreviewAction | null );
		const tracked = selectedActions.get( object );
		const action = actions.find( candidate => candidate?.isScheduled() ) ?? ( tracked && actions.includes( tracked ) ? tracked : null );
		return {
			action,
			state: {
				...previewContract, nodeId: object.uuid,
				status: ! action ? 'idle' : ! action.isScheduled() ? 'stopped' : action.paused ? 'paused' : action.isRunning() ? 'playing' : 'stopped',
				clipIndex: action ? clips.indexOf( action.getClip() ) : null,
				clipName: action?.getClip().name ?? null, time: action?.time ?? null,
				duration: action?.getClip().duration ?? null,
				loop: action ? action.loop !== ( THREE as any ).LoopOnce : null, speed: action?.timeScale ?? null
			}
		};
	};
	return {
		'webmcp-get-model-animation-metadata': ( payload: JsonRecord ) => {
			try { readable( editor ); return animations( editor, node( editor, payload.nodeId ) ).metadata; } catch ( error ) { return failure( error ); }
		},
		'webmcp-get-node-authoring-properties': async ( payload: JsonRecord ) => {
			try {
				readable( editor );
				const object = node( editor, payload.nodeId );
				const context = getEditorContext( editor );
				const before = contentVersion( authoredObjectSnapshot( editor.scene ) );
				const state = await getEntityWebMcpState( editor );
				if ( context !== getEditorContext( editor ) || before !== contentVersion( authoredObjectSnapshot( editor.scene ) ) ) throw new RequestError( 'ENTITY_CONFLICT', '读取期间编辑内容已改变，请重新读取' );
				return { ok: true, ...snapshot( editor, object ), entityVersion: state.entityVersion };
			} catch ( error ) { return failure( error ); }
		},
		'webmcp-stage-node-authoring-properties': async ( payload: JsonRecord ) => {
			try {
				editable( editor );
				const object = node( editor, payload.nodeId );
				const type = authoringType( object );
				const patch = asRecord( payload.properties, 'properties' );
				if ( Object.keys( patch ).length === 0 ) throw new TypeError( 'properties 不能为空' );
				const proposed = mergeAuthoringProperties( type, object.userData, patch );
				const current = readAuthoringProperties( type, object.userData );
				const assertCurrent = captureEditorState( editor );
				const state = await getEntityWebMcpState( editor ); assertCurrent();
				return { ok: true, ...snapshot( editor, object ), current, proposed, entityVersion: state.entityVersion, changed: contentVersion( current ) !== contentVersion( proposed ) };
			} catch ( error ) { return failure( error ); }
		},
		'webmcp-complete-node-authoring-properties': async ( payload: JsonRecord ) => {
			try {
				editable( editor );
				const object = node( editor, payload.nodeId );
				const type = authoringType( object );
				if ( payload.contextGeneration !== getEditorContext( editor ).generation ) throw new RequestError( 'CONTEXT_CHANGED', '编辑器会话已改变，请重新预览' );
				if ( payload.propertiesVersion !== propertiesVersion( object ) ) throw new RequestError( 'NODE_PROPERTIES_CONFLICT', '节点属性在预览后已改变' );
				const assertCurrent = captureEditorState( editor );
				const state = await getEntityWebMcpState( editor ); assertCurrent();
				if ( typeof payload.entityVersion !== 'string' || payload.entityVersion !== state.entityVersion ) throw new RequestError( 'ENTITY_CONFLICT', '实体在预览后已改变' );
				const proposed = mergeAuthoringProperties( type, {}, asRecord( payload.proposed, 'proposed' ) );
				if ( contentVersion( proposed ) !== contentVersion( payload.proposed ) ) throw new TypeError( 'proposed 必须是完整属性快照' );
				const changed = contentVersion( readAuthoringProperties( type, object.userData ) ) !== contentVersion( proposed );
				if ( changed ) {
					// Selecting Text activates the existing sidebar's objectChanged rendering and undo path.
					if ( type === 'Text' ) editor.select( object );
					executeAtomicCommand( editor, new WebMcpBatchCommand( editor, [ new SetValueCommand( editor, object, 'userData', { ...object.userData, ...proposed } ) ] ) );
				}
				const receipt = await getEntityMutationReceipt( editor );
				return { ok: true, ...snapshot( editor, object ), noChange: ! changed, saved: false, ...receipt };
			} catch ( error ) { return failure( error ); }
		},
		'webmcp-get-editor-animation-preview': ( payload: JsonRecord ) => {
			try {
				readable( editor ); const object = node( editor, payload.nodeId );
				const { clips, metadata } = animations( editor, object );
				return { ok: true, ...getPreview( object, clips ).state, animationVersion: metadata.animationVersion, parseStatus: metadata.parseStatus };
			} catch ( error ) { return failure( error ); }
		},
		'webmcp-control-editor-animation-preview': ( payload: JsonRecord ) => {
			try {
				if ( payload.command === 'stop' ) readable( editor ); else editable( editor, true );
				const object = node( editor, payload.nodeId );
				const { clips, metadata } = animations( editor, object );
				if ( payload.expectedAnimationVersion !== metadata.animationVersion ) throw new RequestError( 'ANIMATION_CONFLICT', '动画版本已改变或缺少版本，请重新读取元数据' );
				if ( metadata.parseStatus !== 'ready' ) throw new RequestError( 'ANIMATION_NOT_READY', '尚未获得实际导入动画' );
				if ( ! editor.mixer ) throw new RequestError( 'PREVIEW_UNAVAILABLE', '编辑器动画预览尚未准备完成' );
				const command = payload.command;
				if ( ! [ 'play', 'pause', 'resume', 'stop', 'seek' ].includes( command ) ) throw new TypeError( 'command 无效' );
				const current = getPreview( object, clips ).action;
				const index = payload.clipIndex ?? ( current ? clips.indexOf( current.getClip() ) : undefined );
				if ( ! Number.isInteger( index ) || index < 0 || index >= clips.length ) throw new RangeError( 'clipIndex 不存在，请从元数据选择动画' );
				const clip = clips[ index ];
				if ( ! Number.isFinite( clip.duration ) || clip.duration < 0 ) throw new RequestError( 'INVALID_CLIP', '动画时长无效' );
				if ( command === 'seek' && ( typeof payload.time !== 'number' || ! Number.isFinite( payload.time ) || payload.time < 0 || payload.time > clip.duration ) ) throw new RangeError( 'time 必须在 0 到 clip.duration 之间' );
				if ( payload.time !== undefined && command !== 'seek' ) throw new TypeError( 'time 仅适用于 seek' );
				if ( [ 'pause', 'resume' ].includes( command ) && ( ! current || current.getClip() !== clip || ! current.isScheduled() ) ) throw new RequestError( 'NO_ACTIVE_PREVIEW', '此动画尚未开始预览' );
				const action = editor.mixer.clipAction( clip, object ) as PreviewAction;
				if ( command !== 'stop' && ! previewStops.has( object ) ) {
					// Restore the previous root before traversing a new one. Nested roots
					// otherwise overwrite each other's original transform snapshots.
					stopEditorAnimationPreviews( editor );
					// Adopt an existing UI preview only after restoring its original bindings.
					const previous = current && current.isScheduled() ? { time: current.time, paused: current.paused } : null;
					for ( const other of clips ) editor.mixer.existingAction( other, object )?.stop();
					beginEditorAnimationPreview( object );
					const signal = getEditorContext( editor ).controller.signal;
					const stop = () => {
						for ( const other of clips ) editor.mixer.existingAction( other, object )?.stop();
						endEditorAnimationPreview( object );
						unregisterEditorAnimationPreview( editor, object );
						previewStops.delete( object ); signal.removeEventListener( 'abort', stop );
					};
					previewStops.set( object, stop ); registerEditorAnimationPreview( editor, object, stop );
					signal.addEventListener( 'abort', stop, { once: true } );
					if ( previous && ( command === 'pause' || command === 'resume' ) ) {
						action.play(); action.time = previous.time; action.paused = previous.paused; editor.mixer.update( 0 );
					}
				}
				if ( command === 'play' || command === 'seek' ) {
					for ( const other of clips ) if ( other !== clip ) editor.mixer.existingAction( other, object )?.stop();
				}
				if ( command === 'play' ) action.reset().play();
				if ( command === 'pause' ) action.paused = true;
				if ( command === 'resume' ) action.paused = false;
				if ( command === 'stop' ) {
					for ( const other of clips ) editor.mixer.existingAction( other, object )?.stop();
					previewStops.get( object )?.();
				}
				if ( command === 'seek' ) {
					action.play(); action.paused = true; action.time = payload.time; editor.mixer.update( 0 );
				}
				selectedActions.set( object, action );
				editor.signals.sceneGraphChanged.dispatch();
				return { ok: true, ...getPreview( object, clips ).state, animationVersion: metadata.animationVersion, command };
			} catch ( error ) { return { ...failure( error ), ...previewContract }; }
		}
	};
};
