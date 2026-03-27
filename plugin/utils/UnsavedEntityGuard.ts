import { DialogUtils } from './DialogUtils.js';
import type { MrppEditor } from '../types/mrpp.js';

let activeGuardPromise: Promise<boolean> | null = null;

async function hasUnsavedEntityChanges( editor: MrppEditor | null ): Promise<boolean> {

	if ( ! editor ) return false;

	const checks: Promise<boolean>[] = [];

	if ( editor.verseLoader && typeof editor.verseLoader.changed === 'function' ) {

		checks.push( editor.verseLoader.changed() );

	}

	if ( editor.metaLoader && typeof editor.metaLoader.changed === 'function' ) {

		checks.push( editor.metaLoader.changed() );

	}

	if ( checks.length === 0 ) return false;

	const results = await Promise.all( checks );
	return results.some( Boolean );

}

function getSaveConfirmMessage( editor: MrppEditor | null ): string {

	if ( editor && editor.strings ) {

		return editor.strings.getKey( 'sidebar/confirm/scene/modified' );

	}

	return '是否保存当前实体';

}

interface NavigationGuardState {
	skipNextClick: boolean;
}

function replayNavigationClick( element: HTMLElement, state: NavigationGuardState ): void {

	if ( ! element || ! element.isConnected ) return;

	state.skipNextClick = true;
	element.click();

	setTimeout( function () {

		state.skipNextClick = false;

	}, 0 );

}

async function runEntitySaveGuard( editor: MrppEditor, onProceed?: (() => void | Promise<void>) | null, onCancel?: (() => void | Promise<void>) | null ): Promise<boolean> {

	if ( activeGuardPromise ) return activeGuardPromise;

	activeGuardPromise = new Promise<boolean>( async ( resolve ) => {

		try {

			const changed = await hasUnsavedEntityChanges( editor );

			if ( ! changed ) {

				if ( onProceed ) await onProceed();
				resolve( true );
				return;

			}

			DialogUtils.showSceneSaveDialog(
				getSaveConfirmMessage( editor ),
				async function () {

					if ( editor && editor.signals && editor.signals.upload ) {

						await editor.signals.upload.dispatch();

					}

					if ( onProceed ) await onProceed();
					resolve( true );

				},
				async function () {

					if ( onProceed ) await onProceed();
					resolve( true );

				},
				async function () {

					if ( onCancel ) await onCancel();
					resolve( false );

				}
			);

		} catch ( error ) {

			console.error( 'Entity save guard failed:', error );
			if ( onProceed ) await onProceed();
			resolve( true );

		}

	} ).finally( function () {

		activeGuardPromise = null;

	} );

	return activeGuardPromise;

}

function getLeftNavClickableTarget( target: EventTarget | null ): HTMLElement | null {

	if ( ! target || typeof (target as HTMLElement).closest !== 'function' ) return null;

	const candidate = (target as HTMLElement).closest( 'a[href], [role="menuitem"], .el-menu-item, .sidebar-item, .nav-item, .menu-item' ) as HTMLElement | null;
	if ( ! candidate ) return null;

	const navRoot = candidate.closest( 'aside, .el-aside, .ar-sidebar, .sidebar, .sidebar-left, .layout-sidebar, .el-menu' );
	if ( ! navRoot ) return null;

	if ( candidate.getAttribute && candidate.getAttribute( 'data-unsaved-guard-ignore' ) === 'true' ) {

		return null;

	}

	const href = candidate.getAttribute ? candidate.getAttribute( 'href' ) : null;
	if ( href && ( href === '#' || href.startsWith( 'javascript:' ) ) ) {

		return null;

	}

	if ( candidate.getAttribute && candidate.getAttribute( 'target' ) === '_blank' ) {

		return null;

	}

	return candidate;

}

function bindParentNavigationGuard( editor: MrppEditor ): void {

	if ( window.parent === window ) return;

	let parentDocument: Document | null = null;

	try {

		parentDocument = window.parent.document;

	} catch ( error ) {

		console.warn( 'Cannot bind parent navigation guard:', error );
		return;

	}

	const state: NavigationGuardState = { skipNextClick: false };

	parentDocument.addEventListener( 'click', async function ( event: MouseEvent ) {

		if ( state.skipNextClick || event.defaultPrevented ) return;

		const clickable = getLeftNavClickableTarget( event.target );
		if ( ! clickable ) return;

		event.preventDefault();
		event.stopPropagation();
		if ( typeof event.stopImmediatePropagation === 'function' ) {

			event.stopImmediatePropagation();

		}

		await runEntitySaveGuard( editor, async function () {

			replayNavigationClick( clickable, state );

		} );

	}, true );

}

export { bindParentNavigationGuard, hasUnsavedEntityChanges, runEntitySaveGuard };
