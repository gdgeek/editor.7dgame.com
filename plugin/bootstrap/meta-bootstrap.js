import { MetaLoader } from '../mrpp/MetaLoader.js';
import { initializeGlobalShortcuts } from '../utils/GlobalShortcuts.js';
import { applyEditorPatches } from '../patches/EditorPatches.js';
import { applyLoaderPatches } from '../patches/LoaderPatches.js';
import { applyViewportPatches } from '../patches/ViewportPatches.js';
import { applyUIThreePatches } from '../patches/UIThreePatches.js';
import { applySidebarPatches, applySidebarPropertiesPatches, hideObjectPropertyRows, hideAutosaveCheckbox } from '../patches/SidebarPatches.js';
import { applyMenubarPatches } from '../patches/MenubarPatches.js';

/**
 * Create a minimal UITabbedPanel-compatible wrapper from a DOM element.
 * Used to bridge the gap between deferred DOM observation and patch
 * functions that expect UITabbedPanel instances.
 *
 * @param {HTMLElement} dom - The DOM element with class TabbedPanel
 * @returns {object} A UITabbedPanel-compatible wrapper
 */
function wrapAsTabbedPanel( dom ) {

	const wrapper = {
		dom: dom,
		tabs: [],
		panels: [],
		selected: '',

		select: function ( id ) {

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

		addTab: function ( id, label, items ) {

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

			const tabObj = { dom: tabDom };
			this.tabs.push( tabObj );
			tabsDiv.appendChild( tabDom );

			// Create panel element
			const panelDom = document.createElement( 'div' );
			panelDom.id = id;
			panelDom.style.display = 'none';

			if ( items ) {

				if ( items.dom ) {

					panelDom.appendChild( items.dom );

				} else if ( items instanceof HTMLElement ) {

					panelDom.appendChild( items );

				}

			}

			const panelObj = {
				dom: panelDom,
				setDisplay: function ( v ) {

					panelDom.style.display = v;

				}
			};
			this.panels.push( panelObj );
			panelsDiv.appendChild( panelDom );

			this.select( id );

		},

		clear: function () {

			const tabsDiv = dom.querySelector( '.Tabs' );
			const panelsDiv = dom.querySelector( '.Panels' );

			if ( tabsDiv ) {

				while ( tabsDiv.children.length ) {

					tabsDiv.removeChild( tabsDiv.lastChild );

				}

			}

			if ( panelsDiv ) {

				while ( panelsDiv.children.length ) {

					panelsDiv.removeChild( panelsDiv.lastChild );

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

			const tabEl = tabElements[ i ];
			wrapper.tabs.push( { dom: tabEl } );

			// Override the original UITabbedPanel click handler so that
			// all tabs (original + newly added) use the wrapper's select().
			// We use capture phase + stopImmediatePropagation to prevent
			// the original handler from firing with a stale instance.
			( function ( el ) {

				el.addEventListener( 'click', function ( event ) {

					event.stopImmediatePropagation();
					wrapper.select( el.id );

				}, true );

			} )( tabEl );

		}

	}

	if ( panelsDiv ) {

		const panelElements = panelsDiv.children;
		for ( let i = 0; i < panelElements.length; i ++ ) {

			wrapper.panels.push( {
				dom: panelElements[ i ],
				setDisplay: function ( v ) {

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
 *
 * @param {object} editor - The Editor instance
 */
function applyDeferredUIPatches( editor ) {

	let sidebarPatched = false;
	let menubarPatched = false;

	function tryPatchSidebar() {

		if ( sidebarPatched ) return;

		const sidebarDom = document.getElementById( 'sidebar' );
		if ( ! sidebarDom ) return;

		sidebarPatched = true;

		const sidebarWrapper = wrapAsTabbedPanel( sidebarDom );
		applySidebarPatches( editor, sidebarWrapper );

		// Find the properties panel inside the sidebar
		const propertiesDom = sidebarDom.querySelector( '#properties' );
		if ( propertiesDom ) {

			// Properties is a UITabbedPanel nested inside the sidebar
			const propertiesWrapper = wrapAsTabbedPanel( propertiesDom );
			applySidebarPropertiesPatches( editor, propertiesWrapper );
			hideObjectPropertyRows( editor );

		}

	}

	function tryPatchMenubar() {

		if ( menubarPatched ) return;

		const menubarDom = document.getElementById( 'menubar' );
		if ( ! menubarDom ) return;

		menubarPatched = true;

		const menubarWrapper = { dom: menubarDom };
		applyMenubarPatches( editor, menubarWrapper );
		hideAutosaveCheckbox();

	}

	let animationHidden = false;

	function tryHideAnimation() {

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
		function setAnimationHiddenClass( hidden ) {

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
		editor.signals.objectSelected.add( function ( object ) {

			const hasAnimations = object !== null &&
				object.animations && object.animations.length > 0;

			setAnimationHiddenClass( ! hasAnimations );

			if ( ! hasAnimations ) {

				editor.signals.animationPanelChanged.dispatch( false );

			}

		} );

	}

	let viewportPatched = false;

	function tryPatchViewportControls() {

		if ( viewportPatched ) return;

		const viewport = document.getElementById( 'viewport' );
		if ( ! viewport ) return;

		const selects = viewport.querySelectorAll( 'select' );
		if ( selects.length < 2 ) return;

		viewportPatched = true;

		// First select is camera, second is shading — hide shading
		selects[ 1 ].style.display = 'none';

	}

	function tryPatchAll() {

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

function initMetaEditor( editor ) {

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

	editor.signals.messageSend.add( function ( e ) {

		const data = {
			...e,
			from: 'scene.meta.editor',
			verify: 'mrpp.com'
		};
		window.parent.postMessage( data, '*' );

	} );

	initializeGlobalShortcuts( editor );

	const loader = new MetaLoader( editor );
	editor.metaLoader = loader;

	window.addEventListener( 'message', e => {

		const data = e.data;

		if ( data.action && data.from && data.from === 'scene.meta.web' ) {

			if ( data.action === 'check-unsaved-changes' ) {

				( async () => {

					const requestId = ( data.data && data.data.requestId ) || '';
					let changed = false;
					try {

						if ( editor.metaLoader && typeof editor.metaLoader.changed === 'function' ) {

							changed = await editor.metaLoader.changed();

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

						const changed = editor.metaLoader && typeof editor.metaLoader.changed === 'function'
							? await editor.metaLoader.changed()
							: false;

						if ( ! changed ) {

							editor.signals.messageSend.dispatch( {
								action: 'save-meta-before-leave-none'
							} );
							return;

						}

						const meta = await editor.metaLoader.getMeta();
						const payload = { meta, events: editor.scene.events };
						editor.signals.messageSend.dispatch( {
							action: 'save-meta-before-leave',
							data: payload
						} );
						editor.metaLoader.json = JSON.stringify( payload );

					} catch ( error ) {

						console.error( 'Failed to save before leave:', error );
						editor.signals.messageSend.dispatch( {
							action: 'save-meta-before-leave-none'
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

	editor.signals.messageReceive.add( async function ( params ) {

		if ( ! editor.data ) {

			editor.data = {};

		}

		if ( params.action === 'load' ) {

			const data = params.data;
			loader.load( data.data );

			// 如果消息中包含可用资源类型，在编辑器上存储它们
			console.log( "Received load message with data:", data );
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

export { initMetaEditor };
