import { VerseLoader } from '../mrpp/VerseLoader.js';
import { initializeGlobalShortcuts } from '../utils/GlobalShortcuts.js';
import { applyEditorPatches } from '../patches/EditorPatches.js';
import { applyLoaderPatches } from '../patches/LoaderPatches.js';
import { applyViewportPatches } from '../patches/ViewportPatches.js';
import { applyUIThreePatches } from '../patches/UIThreePatches.js';
import { applySidebarPatches, applySidebarPropertiesPatches, hideObjectPropertyRows, hideAutosaveCheckbox } from '../patches/SidebarPatches.js';
import { applyMenubarPatches } from '../patches/MenubarPatches.js';
import type { MrppEditor } from '../types/mrpp.js';

interface TabObj {
	dom: HTMLElement;
}

interface PanelObj {
	dom: HTMLElement;
	setDisplay( v: string ): void;
}

interface TabbedPanelWrapper {
	dom: HTMLElement;
	tabs: TabObj[];
	panels: PanelObj[];
	selected: string;
	select( id: string ): void;
	addTab( id: string, label: string, items?: { dom: HTMLElement } | HTMLElement ): void;
	clear(): void;
}

/**
 * Create a minimal UITabbedPanel-compatible wrapper from a DOM element.
 * Used to bridge the gap between deferred DOM observation and patch
 * functions that expect UITabbedPanel instances.
 */
function wrapAsTabbedPanel( dom: HTMLElement ): TabbedPanelWrapper {

	const wrapper: TabbedPanelWrapper = {
		dom: dom,
		tabs: [],
		panels: [],
		selected: '',

		select: function ( id: string ): void {

			// Deselect current
			for ( let i = 0; i < this.tabs.length; i ++ ) {

				if ( this.tabs[ i ].dom.id === this.selected ) {

					this.tabs[ i ].dom.classList.remove( 'selected' );

				}

			}

			for ( let i = 0; i < this.panels.length; i ++ ) {

				if ( this.panels[ i ].dom.id === this.selected ) {

					this.panels[ i ].dom.style.display = 'none';

				}

			}

			// Select new
			for ( let i = 0; i < this.tabs.length; i ++ ) {

				if ( this.tabs[ i ].dom.id === id ) {

					this.tabs[ i ].dom.classList.add( 'selected' );

				}

			}

			for ( let i = 0; i < this.panels.length; i ++ ) {

				if ( this.panels[ i ].dom.id === id ) {

					this.panels[ i ].dom.style.display = '';

				}

			}

			this.selected = id;

		},

		addTab: function ( id: string, label: string, items?: { dom: HTMLElement } | HTMLElement ): void {

			const tabsDiv = dom.querySelector( '.Tabs' );
			const panelsDiv = dom.querySelector( '.Panels' );

			if ( ! tabsDiv || ! panelsDiv ) return;

			// Create tab element
			const tabDom = document.createElement( 'span' );
			tabDom.className = 'Tab';
			tabDom.id = id;
			tabDom.textContent = label;

			const self = this;
			tabDom.addEventListener( 'click', function () {

				self.select( id );

			} );

			const tabObj: TabObj = { dom: tabDom };
			this.tabs.push( tabObj );
			tabsDiv.appendChild( tabDom );

			// Create panel element
			const panelDom = document.createElement( 'div' );
			panelDom.id = id;
			panelDom.style.display = 'none';

			if ( items ) {

				if ( 'dom' in items ) {

					panelDom.appendChild( items.dom );

				} else if ( items instanceof HTMLElement ) {

					panelDom.appendChild( items );

				}

			}

			const panelObj: PanelObj = {
				dom: panelDom,
				setDisplay: function ( v: string ): void {

					panelDom.style.display = v;

				}
			};
			this.panels.push( panelObj );
			panelsDiv.appendChild( panelDom );

			this.select( id );

		},

		clear: function (): void {

			const tabsDiv = dom.querySelector( '.Tabs' );
			const panelsDiv = dom.querySelector( '.Panels' );

			if ( tabsDiv ) {

				while ( tabsDiv.children.length ) {

					tabsDiv.removeChild( tabsDiv.lastChild! );

				}

			}

			if ( panelsDiv ) {

				while ( panelsDiv.children.length ) {

					panelsDiv.removeChild( panelsDiv.lastChild! );

				}

			}

			this.tabs = [];
			this.panels = [];
			this.selected = '';

		}
	};

	// Populate tabs and panels from existing DOM
	const tabsDiv = dom.querySelector( '.Tabs' );
	const panelsDiv = dom.querySelector( '.Panels' );

	if ( tabsDiv ) {

		const tabElements = tabsDiv.children;
		for ( let i = 0; i < tabElements.length; i ++ ) {

			const tabEl = tabElements[ i ] as HTMLElement;
			wrapper.tabs.push( { dom: tabEl } );

			// Override the original UITabbedPanel click handler so that
			// all tabs (original + newly added) use the wrapper's select().
			// We use capture phase + stopImmediatePropagation to prevent
			// the original handler from firing with a stale instance.
			( function ( el: HTMLElement ) {

				el.addEventListener( 'click', function ( event: Event ) {

					event.stopImmediatePropagation();
					wrapper.select( el.id );

				}, true );

			} )( tabEl );

		}

	}

	if ( panelsDiv ) {

		const panelElements = panelsDiv.children;
		for ( let i = 0; i < panelElements.length; i ++ ) {

			const panelEl = panelElements[ i ] as HTMLElement;
			wrapper.panels.push( {
				dom: panelEl,
				setDisplay: function ( v: string ): void {

					this.dom.style.display = v;

				}
			} );

		}

	}

	return wrapper;

}


/**
 * Apply deferred UI patches (sidebar, menubar, properties) once the
 * DOM elements are available. Uses a MutationObserver to detect when
 * #sidebar and #menubar are added to the document.
 */
function applyDeferredUIPatches( editor: MrppEditor ): void {

	let sidebarPatched = false;
	let menubarPatched = false;

	function tryPatchSidebar(): void {

		if ( sidebarPatched ) return;

		const sidebarDom = document.getElementById( 'sidebar' );
		if ( ! sidebarDom ) return;

		sidebarPatched = true;

		const sidebarWrapper = wrapAsTabbedPanel( sidebarDom );
		applySidebarPatches( editor, sidebarWrapper );

		// Find the properties panel inside the sidebar
		const propertiesDom = sidebarDom.querySelector( '#properties' ) as HTMLElement | null;
		if ( propertiesDom ) {

			// Properties is a UITabbedPanel nested inside the sidebar
			const propertiesWrapper = wrapAsTabbedPanel( propertiesDom );
			applySidebarPropertiesPatches( editor, propertiesWrapper );
			hideObjectPropertyRows( editor );

		}

	}

	function tryPatchMenubar(): void {

		if ( menubarPatched ) return;

		const menubarDom = document.getElementById( 'menubar' );
		if ( ! menubarDom ) return;

		menubarPatched = true;

		const menubarWrapper = { dom: menubarDom };
		applyMenubarPatches( editor, menubarWrapper );
		hideAutosaveCheckbox();

	}

	let animationHidden = false;

	function tryHideAnimation(): void {

		if ( animationHidden ) return;

		// Check if the animation panel exists yet
		const animationPanel = document.getElementById( 'animation' );
		if ( ! animationPanel || animationPanel.parentElement !== document.body ) return;

		animationHidden = true;

		// Inject CSS class with !important to reliably override inline styles
		// set by Animation.js and AnimationResizer signal handlers.
		const style = document.createElement( 'style' );
		style.textContent = '.mrpp-animation-hidden { display: none !important; }';
		document.head.appendChild( style );

		// Helper: query fresh each time since resizer may be added after animation panel
		function setAnimationHiddenClass( hidden: boolean ): void {

			const panel = document.getElementById( 'animation' );
			if ( panel && panel.parentElement === document.body ) {

				panel.classList.toggle( 'mrpp-animation-hidden', hidden );

			}

			const resizer = document.getElementById( 'animation-resizer' );
			if ( resizer ) {

				resizer.classList.toggle( 'mrpp-animation-hidden', hidden );

			}

		}

		// Initially hidden
		setAnimationHiddenClass( true );

		if ( editor.signals && editor.signals.animationPanelChanged ) {

			editor.signals.animationPanelChanged.dispatch( false );

		}

		// Show only when selecting objects with animations, hide otherwise
		editor.signals.objectSelected.add( function ( object: any ) {

			const hasAnimations = object !== null &&
				object.animations && object.animations.length > 0;

			setAnimationHiddenClass( ! hasAnimations );

			if ( ! hasAnimations ) {

				editor.signals.animationPanelChanged.dispatch( false );

			}

		} );

	}

	let viewportPatched = false;

	function tryPatchViewportControls(): void {

		if ( viewportPatched ) return;

		const viewport = document.getElementById( 'viewport' );
		if ( ! viewport ) return;

		const selects = viewport.querySelectorAll( 'select' );
		if ( selects.length < 2 ) return;

		viewportPatched = true;

		// First select is camera, second is shading — hide shading
		( selects[ 1 ] as HTMLElement ).style.display = 'none';

	}

	function tryPatchAll(): void {

		tryPatchSidebar();
		tryPatchMenubar();
		tryHideAnimation();
		tryPatchViewportControls();

		if ( sidebarPatched && menubarPatched && animationHidden && viewportPatched ) {

			observer.disconnect();

		}

	}

	// Try immediately in case elements already exist
	tryPatchAll();

	if ( sidebarPatched && menubarPatched && animationHidden && viewportPatched ) return;

	// Observe DOM for sidebar/menubar creation
	const observer = new MutationObserver( function () {

		tryPatchAll();

	} );

	const observeTarget = document.body || document.documentElement;
	if ( observeTarget ) {

		observer.observe( observeTarget, {
			childList: true,
			subtree: true
		} );

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

	editor.signals.messageSend.add( function ( e: any ) {

		window.parent.postMessage( {
			...e,
			from: 'scene.verse.editor',
			verify: 'mrpp.com'
		}, '*' );

	} );

	initializeGlobalShortcuts( editor );

	const loader = new VerseLoader( editor );
	editor.verseLoader = loader;

	window.addEventListener( 'message', ( e: MessageEvent ) => {

		const data = e.data;

		if ( data.action && data.from && data.from === 'scene.verse.web' ) {

			if ( data.action === 'check-unsaved-changes' ) {

				( async () => {

					const requestId = ( data.data && data.data.requestId ) || '';
					let changed = false;
					try {

						if ( editor.verseLoader && typeof editor.verseLoader.changed === 'function' ) {

							changed = await editor.verseLoader.changed();

						}

					} catch ( error ) {

						console.error( 'Failed to check unsaved changes:', error );

					}

					editor.signals.messageSend.dispatch( {
						action: 'unsaved-changes-result',
						data: { requestId, changed: Boolean( changed ) }
					} );

				} )();
				return;

			}

			if ( data.action === 'save-before-leave' ) {

				( async () => {

					try {

						const changed = editor.verseLoader && typeof editor.verseLoader.changed === 'function'
							? await editor.verseLoader.changed()
							: false;

						if ( ! changed ) {

							editor.signals.messageSend.dispatch( {
								action: 'save-verse-before-leave-none'
							} );
							return;

						}

						const verse = await editor.verseLoader.getVerse();
						const payload = { verse };
						editor.signals.messageSend.dispatch( {
							action: 'save-verse-before-leave',
							data: payload
						} );
						editor.verseLoader.json = JSON.stringify( payload );

					} catch ( error ) {

						console.error( 'Failed to save before leave:', error );
						editor.signals.messageSend.dispatch( {
							action: 'save-verse-before-leave-none'
						} );

					}

				} )();
				return;

			}

			editor.signals.messageReceive.dispatch( {
				action: data.action,
				data: data.data
			} );

		}

	} );

	editor.signals.messageReceive.add( async function ( params: any ) {

		if ( ! editor.data ) {

			editor.data = {};

		}

		if ( params.action === 'load' ) {

			const data = params.data;
			loader.load( data.data );
			//console.log("Loaded verse data:", data);
			// 保存用户信息
			if ( data.user ) {

				editor.data.user = data.user;
				console.log( "Set user role:", editor.data.user.role );

			}

		} else if ( params.action === 'user-info' ) {

			// 保存用户信息
			editor.data.user = params.data;
			console.log( "Updated user role:", editor.data.user.role );

		}

	} );

	editor.signals.messageSend.dispatch( {
		action: 'ready'
	} );

}

export { initVerseEditor };
