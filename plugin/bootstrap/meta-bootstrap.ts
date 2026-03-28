import { MetaLoader } from '../mrpp/MetaLoader.js';
import { initializeGlobalShortcuts } from '../utils/GlobalShortcuts.js';
import { applyEditorPatches } from '../patches/EditorPatches.js';
import { applyLoaderPatches } from '../patches/LoaderPatches.js';
import { applyViewportPatches } from '../patches/ViewportPatches.js';
import { applyUIThreePatches } from '../patches/UIThreePatches.js';
import { applyDeferredUIPatches } from '../utils/DeferredUIPatches.js';
import { MessageBridge } from '../utils/MessageBridge.js';
import { setupBridgeHandlers } from '../utils/BridgeHandlers.js';
import type { MrppEditor } from '../types/mrpp.js';


// ── Meta response action mapping ─────────────────────────────────────

const RESPONSE_ACTIONS = new Set( [
	'save-meta', 'save-meta-none',
	'save-meta-before-leave', 'save-meta-before-leave-none',
	'unsaved-changes-result'
] );

function mapToResponsePayload( action: string, data: any ): Record<string, unknown> {

	switch ( action ) {

		case 'save-meta':
			return { action: 'save', ...data };
		case 'save-meta-none':
			return { action: 'save', noChange: true };
		case 'save-meta-before-leave':
			return { action: 'save-before-leave', ...data };
		case 'save-meta-before-leave-none':
			return { action: 'save-before-leave', noChange: true };
		case 'unsaved-changes-result':
			return { action: 'check-unsaved-changes', changed: data?.changed };
		default:
			return { action, ...data };

	}

}


function initMetaEditor( editor: MrppEditor ): void {

	// ── Apply all patches in specified order ─────────────────────────
	applyEditorPatches( editor );
	applyLoaderPatches( editor );
	applyViewportPatches( editor );
	applyUIThreePatches( editor );

	// Sidebar, Menubar, and Properties patches are deferred because
	// these UI components are created after initMetaEditor returns
	// (in the HTML entry point). A MutationObserver detects when
	// #sidebar and #menubar appear in the DOM.
	applyDeferredUIPatches( editor );

	// ── Existing bootstrap logic (preserved) ─────────────────────────

	editor.type = 'meta';

	const bridge = new MessageBridge();

	initializeGlobalShortcuts( editor );

	const loader = new MetaLoader( editor );
	editor.metaLoader = loader;

	// ── Register bridge handlers via shared factory ──────────────────

	setupBridgeHandlers( {
		bridge,
		editor,
		responseActions: RESPONSE_ACTIONS,
		mapToResponsePayload,
		getLoaderChanged: async () => {

			if ( editor.metaLoader && typeof editor.metaLoader.changed === 'function' ) {

				return await editor.metaLoader.changed();

			}

			return false;

		},
		getLoaderData: async () => {

			const meta = await editor.metaLoader.getMeta();
			return { meta, events: editor.scene.events };

		},
		loaderJsonSetter: ( json: string ) => {

			editor.metaLoader.json = json;

		}
	} );

	// ── Internal messageReceive handler (processes dispatched signals) ──

	editor.signals.messageReceive.add( async function ( params: any ) {

		if ( ! editor.data ) {

			editor.data = {};

		}

		if ( params.action === 'load' ) {

			const data = params.data;
			loader.load( data.data );

			// 如果消息中包含可用资源类型，在编辑器上存储它们
			console.log( 'Received load message with data:', data );
			if ( data.availableResourceTypes ) {

				editor.availableResourceTypes = data.availableResourceTypes;

				// 直接触发一个自定义事件，通知菜单更新资源类型，避免递归
				editor.signals.messageReceive.dispatch( {
					action: 'available-resource-types',
					data: data.availableResourceTypes
				} );

			}

			// 保存resources信息到编辑器对象中
			if ( data.data && data.data.resources ) {

				editor.data.resources = data.data.resources;

			}

			// 保存用户信息
			if ( data.user ) {

				editor.data.user = data.user;
				console.log( 'Set user role:', editor.data.user.role );

			}

		}

	} );

	bridge.init();

}

export { initMetaEditor };
