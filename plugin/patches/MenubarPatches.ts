import { MenubarScreenshot } from '../ui/menubar/Menubar.Screenshot.js';
import { MenubarScene } from '../ui/menubar/Menubar.Scene.js';
import { MenubarGoto } from '../ui/menubar/Menubar.Goto.js';
import { MenubarEntity } from '../ui/menubar/Menubar.Entity.js';
import { injectMrppAddMenu } from '../ui/menubar/Menubar.MrppAdd.js';
import { injectMrppEditMenu } from '../ui/menubar/Menubar.MrppEdit.js';
import type { MrppEditor } from '../types/mrpp.js';

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Locate the `options` UIPanel inside a menu container whose title
 * matches the given text.  Menubar menus follow a consistent structure:
 *
 *   <div class="menu">          ← menu container
 *     <div class="title">Edit</div>
 *     <div class="options">…</div>
 *   </div>
 *
 * We walk the menubar's direct children, match the title text, then
 * return the sibling `.options` element.
 */
function findMenuOptions( menubarDom: HTMLElement, titleText: string ): HTMLElement | null {

	const menus = menubarDom.children;

	for ( let i = 0; i < menus.length; i ++ ) {

		const menu = menus[ i ];
		const title = menu.querySelector( '.title' );

		if ( title && title.textContent === titleText ) {

			const opts = menu.querySelector( '.options' ) as HTMLElement | null;
			return opts || null;

		}

	}

	return null;

}

/**
 * Wrap a raw DOM element in a minimal object that exposes the `.add()`
 * method expected by `injectMrppAddMenu` / `injectMrppEditMenu`.
 * Those functions call `options.add( uiElement )` which internally does
 * `this.dom.appendChild( uiElement.dom )`.
 */
function wrapAsUIPanel( dom: HTMLElement ): { dom: HTMLElement; add( element: any ): void } {

	return {
		dom: dom,
		add: function ( element: any ): void {

			if ( element && element.dom ) {

				dom.appendChild( element.dom );

			}

		}
	};

}

// ── main entry point ─────────────────────────────────────────────────

/**
 * Apply all MRPP menubar patches after the original Menubar is built.
 *
 * Responsibilities:
 * - Add Screenshot/Scene menu (depending on editor.type)
 * - Add Goto menu
 * - Inject MRPP items into the Add menu via injectMrppAddMenu
 * - Inject MRPP items into the Edit menu via injectMrppEditMenu
 */
function applyMenubarPatches( editor: MrppEditor, menubarContainer: any ): void {

	const strings = editor.strings;
	const menubarDom: HTMLElement = menubarContainer.dom;

	// ── 0. Remove r183 menus not needed in MRPP mode ─────

	const menusToRemove = [
		strings.getKey( 'menubar/view' ),
		strings.getKey( 'menubar/render' ),
		strings.getKey( 'menubar/help' )
	];

	const children = Array.from( menubarDom.children );

	for ( let i = 0; i < children.length; i ++ ) {

		const menu = children[ i ];
		const title = menu.querySelector( '.title' );

		if ( title && menusToRemove.indexOf( title.textContent! ) !== - 1 ) {

			menubarDom.removeChild( menu );

		}

	}

	// ── 0b. Clean up File menu: keep only "Save" and rewire it ──

	const fileMenuTitle = strings.getKey( 'menubar/file' );
	const saveLabel = strings.getKey( 'menubar/file/save' );
	const publishLabel = strings.getKey( 'sidebar/project/app/publish' );
	const updatedChildren = Array.from( menubarDom.children );

	for ( let i = 0; i < updatedChildren.length; i ++ ) {

		const menu = updatedChildren[ i ];
		const titleEl = menu.querySelector( '.title' );

		if ( titleEl && titleEl.textContent === fileMenuTitle ) {

			const optionsEl = menu.querySelector( '.options' );
			if ( optionsEl ) {

				const items = Array.from( optionsEl.children );
				for ( let j = 0; j < items.length; j ++ ) {

					const item = items[ j ];
					const itemText = item.textContent!.trim();
					const isSaveItem = itemText === saveLabel || itemText.startsWith( saveLabel );
					const isPublishItem = itemText === publishLabel || itemText.startsWith( publishLabel );
					if ( isSaveItem === false && isPublishItem === false ) {

						optionsEl.removeChild( item );

					} else if ( isSaveItem ) {

						// Rewire save button to use editor.save() (MRPP save flow)
						// instead of r183's default toJSON + download behavior
						const newSave = item.cloneNode( true );
						(newSave as HTMLElement).addEventListener( 'click', function () {

							editor.save();

						} );
						optionsEl.replaceChild( newSave, item );

					}

				}

				const editorType = ( editor.type || '' ).toLowerCase();
				const needsPublishItem = editorType === 'verse' && !! ( editor.signals && ( editor.signals as any ).release );
				const hasPublishItem = Array.from( optionsEl.children ).some( function ( child ) {

					return ( child.textContent || '' ).trim().startsWith( publishLabel );

				} );

				if ( needsPublishItem && hasPublishItem === false ) {

					const publishOption = document.createElement( 'div' );
					publishOption.className = 'option';
					publishOption.textContent = publishLabel;
					publishOption.addEventListener( 'click', function () {

						( editor.signals as any ).release.dispatch();

					} );
					optionsEl.appendChild( publishOption );

				}

			}

			break;

		}

	}

	// ── 1. Add Screenshot / Scene menu ───────────────────

	const editorType = ( editor.type || '' ).toLowerCase();

	// Find the Status element (last child) so we can insert before it,
	// keeping the status bar at the far right.
	// In r183, MenubarStatus uses class 'menu right' (no id attribute).
	const statusDom = menubarDom.querySelector( '.menu.right' );

	if ( editorType === 'meta' ) {

		const sceneMenu = (MenubarScene as any)( editor );
		if ( statusDom ) {

			menubarDom.insertBefore( sceneMenu.dom, statusDom );

		} else {

			menubarDom.appendChild( sceneMenu.dom );

		}

	} else if ( editorType === 'verse' ) {

		const entityMenu = (MenubarEntity as any)( editor );
		if ( statusDom ) {

			menubarDom.insertBefore( entityMenu.dom, statusDom );

		} else {

			menubarDom.appendChild( entityMenu.dom );

		}

	} else {

		const screenshotMenu = (MenubarScreenshot as any)( editor );
		if ( statusDom ) {

			menubarDom.insertBefore( screenshotMenu.dom, statusDom );

		} else {

			menubarDom.appendChild( screenshotMenu.dom );

		}

	}

	// ── 2. Add Goto menu ─────────────────────────────────

	const gotoMenu = (MenubarGoto as any)( editor );
	if ( statusDom ) {

		menubarDom.insertBefore( gotoMenu.dom, statusDom );

	} else {

		menubarDom.appendChild( gotoMenu.dom );

	}

	// ── 3. Inject MRPP items into the Add menu ───────────

	const addTitle = strings.getKey( 'menubar/add' );
	const addOptionsDom = findMenuOptions( menubarDom, addTitle );

	if ( addOptionsDom ) {

		// Clear original three.js geometry menu items before injecting MRPP items
		while ( addOptionsDom.firstChild ) {

			addOptionsDom.removeChild( addOptionsDom.firstChild );

		}

		injectMrppAddMenu( editor, wrapAsUIPanel( addOptionsDom ) );

	}

	// ── 4. Inject MRPP items into the Edit menu ──────────
	//
	// In r183, the Edit menu contains:
	//   Undo / Redo / --- / Center / Clone / Delete
	// (Clear History was removed in r183.)
	// MRPP mode only needs Undo / Redo from the original.
	// Everything after Redo (the separator and subsequent items) is removed,
	// then MRPP items are injected.

	const editTitle = strings.getKey( 'menubar/edit' );
	const editOptionsDom = findMenuOptions( menubarDom, editTitle );

	if ( editOptionsDom ) {

		// Keep only the first two options (Undo + Redo), remove everything else
		// (separator + Center + Clone + Delete + any other r183 items)
		const editChildren = Array.from( editOptionsDom.children );

		for ( let i = 2; i < editChildren.length; i ++ ) {

			editOptionsDom.removeChild( editChildren[ i ] );

		}

		// Add "Clear History" option (removed in r183 but needed by MRPP)
		const clearHistoryOption = document.createElement( 'div' );
		clearHistoryOption.className = 'option';
		clearHistoryOption.textContent = strings.getKey( 'menubar/edit/clearHistory' );
		clearHistoryOption.addEventListener( 'click', function () {

			if ( confirm( strings.getKey( 'prompt/history/clear' ) ) ) {

				editor.history.clear();

			}

		} );
		editOptionsDom.appendChild( clearHistoryOption );

		injectMrppEditMenu( editor, wrapAsUIPanel( editOptionsDom ) );

	}

}

export { applyMenubarPatches };
