import { VerseLoader } from '../mrpp/VerseLoader.js';
import { initializeGlobalShortcuts } from '../utils/GlobalShortcuts.js';
import { applyEditorPatches } from '../patches/EditorPatches.js';
import { applyLoaderPatches } from '../patches/LoaderPatches.js';
import { applyViewportPatches } from '../patches/ViewportPatches.js';
import { applyUIThreePatches } from '../patches/UIThreePatches.js';
import { applyDeferredUIPatches } from '../utils/DeferredUIPatches.js';
import { MessageBridge } from '../utils/MessageBridge.js';
import { setupBridgeHandlers } from '../utils/BridgeHandlers.js';
import type { MrppEditor } from '../types/mrpp.js';


// ── Verse response action mapping ────────────────────────────────────

const RESPONSE_ACTIONS = new Set( [
	'save-verse', 'save-verse-none',
	'save-verse-before-leave', 'save-verse-before-leave-none',
	'unsaved-changes-result'
] );

function mapToResponsePayload( action: string, data: any ): Record<string, unknown> {

	switch ( action ) {

		case 'save-verse':
			return { action: 'save', ...data };
		case 'save-verse-none':
			return { action: 'save', noChange: true };
		case 'save-verse-before-leave':
			return { action: 'save-before-leave', ...data };
		case 'save-verse-before-leave-none':
			return { action: 'save-before-leave', noChange: true };
		case 'unsaved-changes-result':
			return { action: 'check-unsaved-changes', changed: data?.changed };
		default:
			return { action, ...data };

	}

}


function initVerseEditor( editor: MrppEditor ): void {

	// ── Apply all patches in specified order ─────────────────────────
	applyEditorPatches( editor );
	applyLoaderPatches( editor );
	applyViewportPatches( editor );
	applyUIThreePatches( editor );

	// ── Inject verse-specific outliner icon CSS ──────────────────────
	// In verse editor, entity/module objects show as Object3D in r183's
	// outliner. Replace the default dot with the puzzle icon from old version.
	const entityIconStyle = document.createElement( 'style' );
	entityIconStyle.textContent = `
		#outliner .type.Object3D:after { content: ''; }
		#outliner .type.Object3D {
			width: 12px;
			height: 12px;
			background-color: #6f8fb3;
			-webkit-mask: url('images/entity-puzzle.svg') center / contain no-repeat;
			mask: url('images/entity-puzzle.svg') center / contain no-repeat;
			vertical-align: middle;
			position: relative;
			top: -1px;
		}
	`;
	document.head.appendChild( entityIconStyle );

	// Sidebar, Menubar, and Properties patches are deferred because
	// these UI components are created after initVerseEditor returns
	// (in the HTML entry point). A MutationObserver detects when
	// #sidebar and #menubar appear in the DOM.
	applyDeferredUIPatches( editor );

	// ── Existing bootstrap logic (preserved) ─────────────────────────

	editor.type = 'verse';

	const bridge = new MessageBridge();

	initializeGlobalShortcuts( editor );

	const loader = new VerseLoader( editor );
	editor.verseLoader = loader;

	// ── Register bridge handlers via shared factory ──────────────────

	setupBridgeHandlers( {
		bridge,
		editor,
		responseActions: RESPONSE_ACTIONS,
		mapToResponsePayload,
		getLoaderChanged: async () => {

			if ( editor.verseLoader && typeof editor.verseLoader.changed === 'function' ) {

				return await editor.verseLoader.changed();

			}

			return false;

		},
		getLoaderData: async () => {

			const verse = await editor.verseLoader.getVerse();
			return { verse };

		},
		loaderJsonSetter: ( json: string ) => {

			editor.verseLoader.json = json;

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

			// 保存用户信息
			if ( data.user ) {

				editor.data.user = data.user;
				console.log( 'Set user role:', editor.data.user.role );

			}

		}

	} );

	bridge.init();

}

export { initVerseEditor };
