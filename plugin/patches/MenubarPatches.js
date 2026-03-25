import { MenubarScreenshot } from '../ui/menubar/Menubar.Screenshot.js';
import { MenubarScene } from '../ui/menubar/Menubar.Scene.js';
import { MenubarGoto } from '../ui/menubar/Menubar.Goto.js';
import { MenubarEntity } from '../ui/menubar/Menubar.Entity.js';
import { injectMrppAddMenu } from '../ui/menubar/Menubar.MrppAdd.js';
import { injectMrppEditMenu } from '../ui/menubar/Menubar.MrppEdit.js';

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
 *
 * @param {HTMLElement} menubarDom - The #menubar DOM element
 * @param {string}      titleText - Exact textContent of the menu title
 * @returns {HTMLElement|null} The `.options` element, or null
 */
function findMenuOptions( menubarDom, titleText ) {

	const menus = menubarDom.children;

	for ( let i = 0; i < menus.length; i ++ ) {

		const menu = menus[ i ];
		const title = menu.querySelector( '.title' );

		if ( title && title.textContent === titleText ) {

			const opts = menu.querySelector( '.options' );
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
 *
 * @param {HTMLElement} dom - The `.options` DOM element
 * @returns {object} A UIPanel-compatible wrapper
 */
function wrapAsUIPanel( dom ) {

	return {
		dom: dom,
		add: function ( element ) {

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
 *
 * @param {object} editor            - The Editor instance (already patched)
 * @param {object} menubarContainer  - The UIPanel returned by Menubar(editor)
 */
function applyMenubarPatches( editor, menubarContainer ) {

	const strings = editor.strings;
	const menubarDom = menubarContainer.dom;

	// ── 1. Add Screenshot / Scene menu ───────────────────

	const editorType = ( editor.type || '' ).toLowerCase();

	// Find the Status element (last child) so we can insert before it,
	// keeping the status bar at the far right.
	const statusDom = menubarDom.querySelector( '#menubar-status' );

	if ( editorType === 'meta' ) {

		const sceneMenu = new MenubarScene( editor );
		if ( statusDom ) {

			menubarDom.insertBefore( sceneMenu.dom, statusDom );

		} else {

			menubarDom.appendChild( sceneMenu.dom );

		}

	} else if ( editorType === 'verse' ) {

		const entityMenu = new MenubarEntity( editor );
		if ( statusDom ) {

			menubarDom.insertBefore( entityMenu.dom, statusDom );

		} else {

			menubarDom.appendChild( entityMenu.dom );

		}

	} else {

		const screenshotMenu = new MenubarScreenshot( editor );
		if ( statusDom ) {

			menubarDom.insertBefore( screenshotMenu.dom, statusDom );

		} else {

			menubarDom.appendChild( screenshotMenu.dom );

		}

	}

	// ── 2. Add Goto menu ─────────────────────────────────

	const gotoMenu = new MenubarGoto( editor );
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
	// The original Edit menu contains:
	//   Undo / Redo / Clear History / --- / Center / Clone / Delete / --- / Fix Color Maps
	// MRPP mode only needs Undo / Redo / Clear History from the original.
	// Everything after Clear History is removed, then MRPP items are injected.

	const editTitle = strings.getKey( 'menubar/edit' );
	const editOptionsDom = findMenuOptions( menubarDom, editTitle );

	if ( editOptionsDom ) {

		const clearHistoryLabel = strings.getKey( 'menubar/edit/clear_history' );

		// Find the Clear History option, then remove everything after it
		let foundClearHistory = false;
		const children = Array.from( editOptionsDom.children );

		for ( let i = 0; i < children.length; i ++ ) {

			if ( ! foundClearHistory ) {

				if ( children[ i ].textContent === clearHistoryLabel ) {

					foundClearHistory = true;

				}

				continue;

			}

			// Remove everything after Clear History
			editOptionsDom.removeChild( children[ i ] );

		}

		injectMrppEditMenu( editor, wrapAsUIPanel( editOptionsDom ) );

	}

}

export { applyMenubarPatches };
