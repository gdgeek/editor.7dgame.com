import { UIInput, UISelect, UIRow, UIText } from '../../three.js/editor/js/libs/ui.js';
import { SidebarEvents } from '../ui/sidebar/Sidebar.Events.js';
import { SidebarScreenshot } from '../ui/sidebar/Sidebar.Screenshot.js';
import { SidebarMultipleObjects } from '../ui/sidebar/Sidebar.MultipleObjects.js';
import { SidebarComponent } from '../ui/sidebar/Sidebar.Component.js';
import { SidebarCommand } from '../ui/sidebar/Sidebar.Command.js';
import { SidebarText } from '../ui/sidebar/Sidebar.Text.js';
import { SidebarAnimation } from '../ui/sidebar/Sidebar.Animation.js';
import type { MrppEditor } from '../types/mrpp.js';

/**
 * Determine the hierarchy tab label based on editor type and current language.
 * Extracted from Sidebar.js MRPP modification.
 */
function getHierarchyLabel( editor: MrppEditor ): string {

	const strings = editor.strings;

	if ( editor.type && editor.type.toLowerCase() === 'verse' ) {

		return strings.getKey( 'sidebar/entities' );

	}

	const sceneLabel = strings.getKey( 'sidebar/scene' );

	if ( sceneLabel === 'Scene' ) return 'Hierarchy';
	if ( sceneLabel === 'シーン' ) return '階層';
	if ( sceneLabel === '場景' ) return '層級';
	if ( sceneLabel === 'ฉาก' ) return 'ลำดับชั้น';

	return '层级';

}

/**
 * Apply MRPP sidebar patches after the original Sidebar is built.
 *
 * Responsibilities:
 * - Rename the 'scene' tab to the correct hierarchy label
 * - Attach propertiesPanel inside the scene span (for meta/verse modes)
 * - Add Events tab (meta mode only)
 * - Add Screenshot tab
 */
function applySidebarPatches( editor: MrppEditor, sidebarContainer: any ): void {

	const strings = editor.strings;

	// 1. Rename the 'scene' tab to the hierarchy label.
	//    UITabbedPanel stores UITab objects in this.tabs[]. Each UITab has
	//    dom.id set to the tab id and textContent set to the label.
	const hierarchyLabel = getHierarchyLabel( editor );

	if ( sidebarContainer.tabs ) {

		for ( let i = 0; i < sidebarContainer.tabs.length; i ++ ) {

			if ( sidebarContainer.tabs[ i ].dom.id === 'scene' ) {

				sidebarContainer.tabs[ i ].dom.textContent = hierarchyLabel;
				break;

			}

		}

	}

	// 2. Remove project and settings tabs in MRPP mode.
	//    MRPP editors only need the scene/hierarchy tab; project and settings
	//    are not used. We remove them from both the DOM and the wrapper arrays.
	const editorType = ( editor.type || '' ).toLowerCase();

	if ( editorType === 'meta' || editorType === 'verse' ) {

		const tabsToRemove = [ 'project', 'settings' ];

		for ( const tabId of tabsToRemove ) {

			// Remove from wrapper arrays
			for ( let i = sidebarContainer.tabs.length - 1; i >= 0; i -- ) {

				if ( sidebarContainer.tabs[ i ].dom.id === tabId ) {

					const tabDom = sidebarContainer.tabs[ i ].dom;
					if ( tabDom.parentNode ) tabDom.parentNode.removeChild( tabDom );
					sidebarContainer.tabs.splice( i, 1 );
					break;

				}

			}

			for ( let i = sidebarContainer.panels.length - 1; i >= 0; i -- ) {

				if ( sidebarContainer.panels[ i ].dom.id === tabId ) {

					const panelDom = sidebarContainer.panels[ i ].dom;
					if ( panelDom.parentNode ) panelDom.parentNode.removeChild( panelDom );
					sidebarContainer.panels.splice( i, 1 );
					break;

				}

			}

		}

	}

	// 3. Attach propertiesPanel inside the scene content span.
	//    The vanilla Sidebar creates a UISpan for the scene tab content.
	//    In MRPP mode (meta/verse), the propertiesPanel is appended inside
	//    that span with flex styling so it shares the scene tab area.

	if ( editorType === 'meta' || editorType === 'verse' ) {

		// Find the properties panel and the scene panel in the container
		let propertiesPanel: any = null;
		let scenePanel: any = null;

		for ( let i = 0; i < sidebarContainer.panels.length; i ++ ) {

			const panel = sidebarContainer.panels[ i ];

			if ( panel.dom.id === 'properties' ) {

				propertiesPanel = panel;

			}

			if ( panel.dom.id === 'scene' ) {

				scenePanel = panel;

			}

		}

		// The propertiesPanel is inside a wrapper panel added by addTab.
		// We need to find the actual #properties element in the DOM.
		if ( ! propertiesPanel ) {

			const propsDom = sidebarContainer.dom.querySelector( '#properties' );

			if ( propsDom ) {

				propertiesPanel = { dom: propsDom };

			}

		}

		if ( propertiesPanel ) {

			propertiesPanel.dom.style.marginTop = '3px';
			propertiesPanel.dom.style.flex = '1 1 auto';
			propertiesPanel.dom.style.minHeight = '0';

		}

		// The scene tab content panel wraps a UISpan. Find the span
		// and append propertiesPanel to it.
		if ( scenePanel && propertiesPanel ) {

			const sceneSpan = scenePanel.dom.querySelector( 'span' );

			if ( sceneSpan && propertiesPanel.dom.parentNode !== sceneSpan ) {

				sceneSpan.appendChild( propertiesPanel.dom );

			}

		}

	}

	// 4. Add Events tab (meta mode only)
	if ( editorType === 'meta' ) {

		const eventsPanel = (SidebarEvents as any)( editor );
		sidebarContainer.addTab( 'events', strings.getKey( 'sidebar/events' ), eventsPanel.container );

	}

	// 5. Add Screenshot tab
	const screenshot = (SidebarScreenshot as any)( editor );
	sidebarContainer.addTab( 'screenshot', strings.getKey( 'sidebar/screenshot' ), screenshot );

	// 6. Inject search/filter UI above the outliner (Bug 1.1)
	injectOutlinerSearchUI( editor );

	// 7. Filter internal objects from the outliner (Bug 1.2)
	injectOutlinerFilter( editor );

	// 7b. Replace outliner type icons with MRPP custom type icons
	injectOutlinerCustomIcons( editor );

	// 8. Hide background/environment/fog rows (not needed in MRPP mode)
	hideSceneSettingsRows( editor );

	// 9. Ensure 'scene' tab is selected
	sidebarContainer.select( 'scene' );

}

/**
 * Properly clear a UITabbedPanel by removing all tabs and panels from both
 * the DOM and the internal arrays.
 *
 * UITabbedPanel.clear() (inherited from UIElement) only removes DOM children
 * but does NOT reset the tabs[] and panels[] arrays, causing stale state.
 * This helper resets both.
 */
function clearTabbedPanel( tabbedPanel: any ): void {

	// Support both real UITabbedPanel (has tabsDiv/panelsDiv properties)
	// and wrapAsTabbedPanel wrappers (use DOM querySelector)
	const tabsContainer = tabbedPanel.tabsDiv
		? tabbedPanel.tabsDiv.dom
		: tabbedPanel.dom.querySelector( '.Tabs' );

	const panelsContainer = tabbedPanel.panelsDiv
		? tabbedPanel.panelsDiv.dom
		: tabbedPanel.dom.querySelector( '.Panels' );

	// Remove all tab DOM elements
	if ( tabsContainer ) {

		while ( tabsContainer.children.length > 0 ) {

			tabsContainer.removeChild( tabsContainer.firstChild );

		}

	}

	// Remove all panel DOM elements
	if ( panelsContainer ) {

		while ( panelsContainer.children.length > 0 ) {

			panelsContainer.removeChild( panelsContainer.firstChild );

		}

	}

	// Reset internal arrays and selection state
	tabbedPanel.tabs = [];
	tabbedPanel.panels = [];
	tabbedPanel.selected = '';

}

/**
 * Apply MRPP patches to Sidebar.Properties after it is built.
 *
 * Responsibilities:
 * - Create MRPP panel instances (MultipleObjects, Component, Command, Text, Animation)
 * - Wire up objectSelected signal to dynamically add/remove MRPP panels
 *
 * The vanilla SidebarProperties (r183) creates a UITabbedPanel with static tabs
 * (objectTab, geometryTab, materialTab, scriptTab). This patch adds dynamic tab
 * management based on the selected object type.
 *
 * Note: In r183, tab IDs use the 'Tab' suffix (objectTab, geometryTab, etc.)
 * unlike r140 which used plain IDs (object, geometry, etc.).
 */
function applySidebarPropertiesPatches( editor: MrppEditor, propertiesContainer: any ): void {

	const strings = editor.strings;
	const editorSignals = editor.signals;

	// ── Fix: Remove hidden attribute from properties container ──────────
	// r183's toggleTabs sets container.setHidden(true) when no object is
	// selected. In MRPP mode, properties should always be visible (inside
	// the scene tab). Remove the hidden attribute immediately.
	if ( propertiesContainer.dom ) {

		propertiesContainer.dom.removeAttribute( 'hidden' );

	}

	// ── Sub-task 3.2: Remove r183 original geometry/material/script tabs ──
	// r183's SidebarProperties creates four static tabs: objectTab,
	// geometryTab, materialTab, scriptTab. MRPP dynamically manages tabs
	// via clearTabbedPanel + addTab. We remove the three non-object tabs
	// from both the DOM and the wrapper arrays so MRPP fully owns tab state.
	const r183TabsToRemove = [ 'geometryTab', 'materialTab', 'scriptTab' ];

	for ( const tabId of r183TabsToRemove ) {

		// Remove tab element from wrapper array and DOM
		for ( let i = propertiesContainer.tabs.length - 1; i >= 0; i -- ) {

			if ( propertiesContainer.tabs[ i ].dom.id === tabId ) {

				const tabDom = propertiesContainer.tabs[ i ].dom;
				if ( tabDom.parentNode ) tabDom.parentNode.removeChild( tabDom );
				propertiesContainer.tabs.splice( i, 1 );
				break;

			}

		}

		// Remove panel element from wrapper array and DOM
		for ( let i = propertiesContainer.panels.length - 1; i >= 0; i -- ) {

			if ( propertiesContainer.panels[ i ].dom.id === tabId ) {

				const panelDom = propertiesContainer.panels[ i ].dom;
				if ( panelDom.parentNode ) panelDom.parentNode.removeChild( panelDom );
				propertiesContainer.panels.splice( i, 1 );
				break;

			}

		}

	}

	// ── Sub-task 3.3: Neutralize r183's toggleTabs listener ──────────────
	// r183's SidebarProperties registers a `toggleTabs` function on
	// signals.objectSelected that shows/hides geometry/material/script tabs
	// and calls container.select(). This conflicts with MRPP's dynamic tab
	// management. We remove it by iterating the signal's internal _bindings
	// array and detaching any objectSelected listener registered before our
	// MRPP listener (i.e., the ones already present at this point).
	// The only objectSelected listener from SidebarProperties is toggleTabs.
	if ( editorSignals.objectSelected._bindings ) {

		const existingBindings = editorSignals.objectSelected._bindings.slice();
		for ( let i = 0; i < existingBindings.length; i ++ ) {

			const binding = existingBindings[ i ];
			if ( binding._listener && binding.getListener ) {

				const listener = binding.getListener();
				const src = listener.toString();

				// Identify toggleTabs by its characteristic references
				if ( src.indexOf( 'geometryTab' ) !== - 1 || src.indexOf( 'materialTab' ) !== - 1 ) {

					binding.detach();

				}

			}

		}

	}

	// Create MRPP panel instances (once, reused across selections)
	const multipleObjectsPanel = (SidebarMultipleObjects as any)( editor );
	const componentPanel = (SidebarComponent as any)( editor );
	const commandPanel = (SidebarCommand as any)( editor );
	const textPanel = (SidebarText as any)( editor );
	const animationPanel = (SidebarAnimation as any)( editor );

	// Save a reference to the vanilla object tab content.
	// In r183, SidebarProperties uses addTab('objectTab', ..., objectPanel).
	// We save the actual SidebarObject container DOM element (not the wrapper div)
	// so it survives clearTabbedPanel() + addTab() cycles.
	let objectContentDom: HTMLElement | null = null;
	const objectTabLabel = strings.getKey( 'sidebar/properties/object' );

	// r183 uses 'objectTab' as the tab id (not 'object' as in r140)
	for ( let i = 0; i < propertiesContainer.panels.length; i ++ ) {

		if ( propertiesContainer.panels[ i ].dom.id === 'objectTab' ) {

			// The panel wrapper div contains the SidebarObject container as its first child.
			// We save a reference to the actual content element.
			const panelDom = propertiesContainer.panels[ i ].dom;
			objectContentDom = panelDom.firstChild || panelDom;
			break;

		}

	}

	// ── Hide the "Export JSON" button from r183's SidebarObject ──────────
	// MRPP mode does not need per-object JSON export. We hide it each time
	// the object tab is rebuilt, since the button lives inside the
	// SidebarObject container which may not be fully rendered at patch time.
	function hideExportJsonButton(): void {

		if ( ! objectContentDom ) return;

		// Search in objectContentDom and its parent panel wrapper
		const searchRoots: HTMLElement[] = [ objectContentDom ];
		if ( objectContentDom.parentNode ) searchRoots.push( objectContentDom.parentNode as HTMLElement );

		for ( const root of searchRoots ) {

			const buttons = root.querySelectorAll( 'button' );
			for ( let i = 0; i < buttons.length; i ++ ) {

				if ( buttons[ i ].className === 'Button' ) {

					(buttons[ i ] as HTMLElement).style.display = 'none';

				}

			}

		}

	}

	// Try hiding immediately (may work if DOM is ready)
	hideExportJsonButton();

	// Listen for object selection to dynamically manage tabs
	editorSignals.objectSelected.add( function ( object: any ) {

		// Always ensure properties is visible in MRPP mode
		if ( propertiesContainer.dom ) {

			propertiesContainer.dom.removeAttribute( 'hidden' );

		}

		if ( object !== null ) {

			const selectedObjects = editor.getSelectedObjects();

			if ( selectedObjects.length > 1 ) {

				// Multi-select mode: clear all tabs and show multi-objects panel
				clearTabbedPanel( propertiesContainer );
				propertiesContainer.addTab(
					'multiobjects',
					strings.getKey( 'sidebar/properties/multi_object' ),
					multipleObjectsPanel.container
				);
				propertiesContainer.select( 'multiobjects' );

			} else {

				// Single-select mode: rebuild with object tab + conditional MRPP tabs
				clearTabbedPanel( propertiesContainer );

				// Re-add the vanilla object tab (using r183 id 'objectTab')
				if ( objectContentDom ) {

					propertiesContainer.addTab( 'objectTab', objectTabLabel, objectContentDom );

				}

				// Only add extra panels for non-Scene objects
				if ( object !== editor.scene ) {

					const objectType = object.type ? object.type.toLowerCase() : '';

					// Check for animations
					const hasAnimations =
						( object.animations && object.animations.length > 0 ) ||
						( object.userData && object.userData.animations &&
							object.userData.animations.length > 0 );

					if ( hasAnimations ) {

						propertiesContainer.addTab(
							'animation',
							strings.getKey( 'sidebar/animations' ),
							animationPanel.container
						);
						animationPanel.update( object );

					}

					if ( editor.type && editor.type.toLowerCase() === 'meta' ) {

						const componentValidTypes = [ 'polygen', 'voxel', 'picture', 'entity' ];
						const commandValidTypes = [ 'entity', 'point' ];

						if ( componentValidTypes.includes( objectType ) ) {

							propertiesContainer.addTab(
								'component',
								strings.getKey( 'sidebar/components' ),
								componentPanel.container
							);
							componentPanel.update();

						}

						if ( commandValidTypes.includes( objectType ) ) {

							propertiesContainer.addTab(
								'command',
								strings.getKey( 'sidebar/command' ),
								commandPanel.container
							);
							commandPanel.update();

						}

					}

					// Text objects show text panel
					if ( objectType === 'text' ) {

						propertiesContainer.addTab(
							'text',
							strings.getKey( 'sidebar/text' ),
							textPanel.container
						);
						textPanel.update();

					}

				}

				// Ensure object tab is selected (r183 id: 'objectTab')
				propertiesContainer.select( 'objectTab' );
				hideExportJsonButton();

			}

		} else {

			// Deselected: show only the object tab
			clearTabbedPanel( propertiesContainer );

			if ( objectContentDom ) {

				propertiesContainer.addTab( 'objectTab', objectTabLabel, objectContentDom );

			}

			propertiesContainer.select( 'objectTab' );
			hideExportJsonButton();

		}

	} );

}

/**
 * Inject search input and filter dropdown above the outliner in MRPP mode.
 *
 * Restores the search/filter UI that r140 had but r183's Sidebar.Scene.js
 * removed. Creates a UIInput for name search and a UISelect for type
 * filtering above the #outliner element.
 *
 * Both filters use AND logic and respect the internal object filter from
 * injectOutlinerFilter (objects already hidden by that filter stay hidden).
 */
function injectOutlinerSearchUI( editor: MrppEditor ): void {

	const outlinerDom = document.getElementById( 'outliner' );

	if ( ! outlinerDom ) return;

	const strings = editor.strings;

	// ── Build type filter options using i18n keys ──
	const filterOptions: Record<string, string> = {
		'': strings.getKey( 'sidebar/scene/filter/all' ),
		'module': strings.getKey( 'sidebar/scene/filter/type/module' ),
		'point': strings.getKey( 'sidebar/scene/filter/type/point' ),
		'text': strings.getKey( 'sidebar/scene/filter/type/text' ),
		'polygen': strings.getKey( 'sidebar/scene/filter/type/polygen' ),
		'picture': strings.getKey( 'sidebar/scene/filter/type/picture' ),
		'video': strings.getKey( 'sidebar/scene/filter/type/video' ),
		'audio': strings.getKey( 'sidebar/scene/filter/type/audio' ),
		'prototype': strings.getKey( 'sidebar/scene/filter/type/prototype' ),
	};

	// ── Search + Filter row (side by side) ──
	const searchFilterRow = new UIRow();
	searchFilterRow.setClass( 'Row' );
	searchFilterRow.dom.style.marginBottom = '4px';
	searchFilterRow.dom.style.display = 'flex';
	searchFilterRow.dom.style.gap = '4px';

	const searchInput = new UIInput( '' );
	(searchInput.dom as HTMLInputElement).placeholder = strings.getKey( 'sidebar/scene/search_placeholder' );
	searchInput.dom.style.flex = '1';
	searchInput.dom.style.boxSizing = 'border-box';
	searchFilterRow.add( searchInput );

	const filterSelect = new UISelect();
	filterSelect.setOptions( filterOptions );
	filterSelect.setValue( '' );
	filterSelect.dom.style.width = '120px';

	// Only show type filter in meta editor; verse doesn't need it
	const isMeta = ( editor.type || '' ).toLowerCase() === 'meta';

	if ( isMeta ) {

		searchFilterRow.add( filterSelect );

	} else {

		// Verse: search box takes full width
		searchInput.dom.style.width = '100%';

	}

	// ── Insert row above the outliner ──
	const parent = outlinerDom.parentNode;

	if ( parent ) {

		parent.insertBefore( searchFilterRow.dom, outlinerDom );

	}

	// ── Shared filter logic ──
	function applySearchFilter(): void {

		const searchText = searchInput.getValue().toLowerCase();
		const selectedType = filterSelect.getValue(); // '' means all
		const options = outlinerDom!.querySelectorAll( '.option' );

		for ( let i = 0; i < options.length; i ++ ) {

			const option = options[ i ] as HTMLElement;
			const id = parseInt( (option as any).value );

			if ( isNaN( id ) ) continue;

			const object = editor.scene.getObjectById( id );

			// Skip objects already hidden by injectOutlinerFilter (internal objects).
			// We detect this by checking if the object is the camera, scene, or $-prefixed.
			if ( ! object ) {

				// Could be the camera (not in scene graph)
				if ( editor.camera && (editor.camera as any).id === id ) continue;
				continue;

			}

			if (
				object === editor.camera ||
				object === editor.scene ||
				( object.name && object.name.charAt( 0 ) === '$' )
			) {

				// Internal object — leave hidden by injectOutlinerFilter
				continue;

			}

			let visible = true;

			// Name search filter
			if ( searchText.length > 0 ) {

				const objectName = ( object.name || '' ).toLowerCase();

				if ( objectName.indexOf( searchText ) === - 1 ) {

					visible = false;

				}

			}

			// Type filter (uses userData.type for MRPP custom types, falls back to object.type)
			if ( visible && selectedType !== '' ) {

				const objectType = ( object.userData && (object.userData as any).type )
					? (object.userData as any).type.toLowerCase()
					: ( object.type || '' ).toLowerCase();

				if ( objectType !== selectedType ) {

					visible = false;

				}

			}

			option.style.display = visible ? '' : 'none';

		}

	}

	// ── Wire up events ──
	searchInput.onInput( applySearchFilter );
	filterSelect.onChange( applySearchFilter );

	// Re-apply search/filter after outliner refreshes (MutationObserver)
	const observer = new MutationObserver( applySearchFilter );
	observer.observe( outlinerDom, { childList: true } );

}

/**
 * Filter internal objects from the outliner in MRPP mode.
 *
 * r183's Sidebar.Scene refreshUI() lists Camera, Scene root, and all
 * scene.children (including $lights etc.) without filtering. In r140,
 * MRPP filtered these out. This function uses a MutationObserver on
 * #outliner to hide internal objects after each refresh.
 *
 * Filter criteria:
 * - object === editor.camera (the editor camera)
 * - object === editor.scene (the Scene root node)
 * - object.name starts with '$' (internal objects like $lights)
 */
function injectOutlinerFilter( editor: MrppEditor ): void {

	const outlinerDom = document.getElementById( 'outliner' );

	if ( ! outlinerDom ) return;

	function filterOptions(): void {

		const options = outlinerDom!.querySelectorAll( '.option' );

		for ( let i = 0; i < options.length; i ++ ) {

			const option = options[ i ] as HTMLElement;
			const id = parseInt( (option as any).value );

			if ( isNaN( id ) ) continue;

			const object = editor.scene.getObjectById( id );

			if ( ! object ) {

				// Also check if this is the camera (camera is not part of scene graph)
				if ( editor.camera && (editor.camera as any).id === id ) {

					option.style.display = 'none';
					continue;

				}

				continue;

			}

			if (
				object === editor.camera ||
				object === editor.scene ||
				( object.name && object.name.charAt( 0 ) === '$' )
			) {

				option.style.display = 'none';

			}

		}

	}

	// Observe childList changes on the outliner to filter after each refreshUI
	const observer = new MutationObserver( filterOptions );

	observer.observe( outlinerDom, { childList: true } );

	// Run the filter once immediately
	filterOptions();

}

/**
 * Hide background, environment, and fog rows from the scene panel.
 * These are r183 Sidebar.Scene settings not needed in MRPP mode.
 * Uses label text matching to find and hide the rows + any sub-rows.
 */
function hideSceneSettingsRows( editor: MrppEditor ): void {

	const strings = editor.strings;

	// Labels to hide (row + any following sub-rows until next labeled row)
	const labelsToHide = [
		strings.getKey( 'sidebar/scene/background' ),
		strings.getKey( 'sidebar/scene/environment' ),
		strings.getKey( 'sidebar/scene/fog' )
	];

	// Scene panel content is inside #scene (the panel div, not the tab)
	const scenePanels = document.querySelectorAll( '#scene' );
	let sceneContent: HTMLElement | null = null;

	for ( let i = 0; i < scenePanels.length; i ++ ) {

		// The panel div (not the tab span)
		if ( scenePanels[ i ].tagName === 'DIV' ) {

			sceneContent = scenePanels[ i ] as HTMLElement;
			break;

		}

	}

	if ( ! sceneContent ) return;

	// Find all .Row elements and hide those matching the labels
	const rows = sceneContent.querySelectorAll( '.Row' );

	for ( let i = 0; i < rows.length; i ++ ) {

		const row = rows[ i ] as HTMLElement;
		const label = row.querySelector( '.Label' );

		if ( label && labelsToHide.indexOf( label.textContent! ) !== - 1 ) {

			row.style.display = 'none';

			// Also hide following sub-rows (no Label, indented rows)
			for ( let j = i + 1; j < rows.length; j ++ ) {

				const nextRow = rows[ j ] as HTMLElement;
				const nextLabel = nextRow.querySelector( '.Label' );

				if ( nextLabel ) break; // next labeled row, stop

				nextRow.style.display = 'none';

			}

		}

	}

	// Also hide the UIBreak before background row
	// (it's a <br> element between outliner and background)
	const breaks = sceneContent.querySelectorAll( 'br' );

	for ( let i = 0; i < breaks.length; i ++ ) {

		(breaks[ i ] as HTMLElement).style.display = 'none';

	}

}

/**
 * Replace r183's default outliner type icons with MRPP custom type icons.
 *
 * r183's getObjectType() only returns native three.js types (Scene, Camera,
 * Mesh, Object3D, etc). MRPP objects use userData.type for custom types
 * (Polygen, Picture, Video, Audio, Point, Text, Module, Entity, etc).
 *
 * This function observes the outliner and replaces the CSS class on the
 * type span to match the MRPP custom type, enabling custom icon styling.
 */
function injectOutlinerCustomIcons( editor: MrppEditor ): void {

	const outlinerDom = document.getElementById( 'outliner' );
	if ( ! outlinerDom ) return;

	// Inject CSS for custom MRPP type icons
	const style = document.createElement( 'style' );
	style.textContent = `
		#outliner .type { line-height: 14px; font-size: 11px; }
		#outliner .type.Scene { color: #807b7b; }
		#outliner .type.Scene:after { content: '◉'; }
		#outliner .type.Camera { color: #dd8888; }
		#outliner .type.Camera:after { content: '⌾'; }
		#outliner .type.Light { color: #dddd88; }
		#outliner .type.Light:after { content: '✦'; }
		#outliner .type.Object3D { color: #aaaaee; }
		#outliner .type.Object3D:after { content: '◇'; }
		#outliner .type.Mesh { color: #8888ee; }
		#outliner .type.Mesh:after { content: '⬢'; }
		#outliner .type.Module { color: #555555; }
		#outliner .type.Module:after { content: '⌗'; }
		#outliner .type.Entity { color: #d0d0d0; }
		#outliner .type.Entity:after { content: '◇'; }
		#outliner .type.Point { color: #d0d0d0; }
		#outliner .type.Point:after { content: '◇'; }
		#outliner .type.Text { color: #5b74a5; }
		#outliner .type.Text:after { content: 'T'; font-weight: 600; }
		#outliner .type.Polygen { color: #74a55b; }
		#outliner .type.Polygen:after { content: '⬢'; }
		#outliner .type.Picture { color: #5b8ca5; }
		#outliner .type.Picture:after { content: '▣'; font-size: 9px; }
		#outliner .type.Video { color: #a55ba5; }
		#outliner .type.Video:after { content: '▶'; font-size: 9px; }
		#outliner .type.Audio { color: #5ba55b; }
		#outliner .type.Audio:after { content: '♪'; }
		#outliner .type.Prototype { color: #a5995b; }
		#outliner .type.Prototype:after { content: '◈'; }
		#outliner .Geometry, #outliner .Material, #outliner .Script { display: none !important; }
	`;
	document.head.appendChild( style );

	function replaceTypeIcons(): void {

		const options = outlinerDom!.querySelectorAll( '.option' );

		for ( let i = 0; i < options.length; i ++ ) {

			const option = options[ i ] as HTMLElement;
			const id = parseInt( (option as any).value );
			if ( isNaN( id ) ) continue;

			const object = editor.scene.getObjectById( id );
			if ( ! object ) continue;

			// Get MRPP custom type from object.type (MRPP sets type directly on the object)
			// Fall back to userData.type for compatibility
			const mrppType = object.type || ( object.userData && (object.userData as any).type ) || '';

			// Skip native three.js types that r183 already handles
			const nativeTypes = [ 'Scene', 'PerspectiveCamera', 'OrthographicCamera',
				'AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'HemisphereLight',
				'Mesh', 'SkinnedMesh', 'Line', 'LineSegments', 'LineLoop', 'Points',
				'Group', 'Object3D', 'Bone', 'Sprite', 'LOD' ];

			if ( ! mrppType || nativeTypes.indexOf( mrppType ) !== - 1 ) continue;

			// Capitalize first letter for CSS class name
			const typeCssClass = mrppType.charAt( 0 ).toUpperCase() + mrppType.slice( 1 ).toLowerCase();

			// Find the type span and replace its class
			const typeSpan = option.querySelector( '.type' );
			if ( typeSpan && typeSpan.className !== 'type ' + typeCssClass ) {

				typeSpan.className = 'type ' + typeCssClass;

			}

			// Hide the opener (expand/collapse button) for MRPP custom type objects.
			// In the old version, these nodes could not be expanded.
			const opener = option.querySelector( '.opener' ) as HTMLElement | null;
			if ( opener ) {

				opener.style.display = 'none';

			}

			// Hide any child options that belong to this object's subtree.
			// Children appear as subsequent options with greater padding.
			const myPadding = parseInt( option.style.paddingLeft ) || 0;
			for ( let j = i + 1; j < options.length; j ++ ) {

				const childOption = options[ j ] as HTMLElement;
				const childPadding = parseInt( childOption.style.paddingLeft ) || 0;

				if ( childPadding <= myPadding ) break; // no longer a child

				const childId = parseInt( (childOption as any).value );
				if ( isNaN( childId ) ) continue;

				const childObj = editor.scene.getObjectById( childId );

				// Only hide children that are internal three.js nodes (not MRPP custom types)
				const childType = childObj ? childObj.type : '';
				if ( nativeTypes.indexOf( childType ) !== - 1 || ! childType ) {

					childOption.style.display = 'none';

				}

			}

		}

	}

	const observer = new MutationObserver( replaceTypeIcons );
	observer.observe( outlinerDom, { childList: true } );
	replaceTypeIcons();

}

/**
 * Hide object property rows that MRPP mode does not need:
 * shadow, frustum culled, render order.
 */
function hideObjectPropertyRows( editor: MrppEditor ): void {

	const strings = editor.strings;

	const labelsToHide = [
		strings.getKey( 'sidebar/object/shadow' ),
		strings.getKey( 'sidebar/object/frustumcull' ),
		strings.getKey( 'sidebar/object/renderorder' )
	];

	function hide(): void {

		const objectPanel = document.getElementById( 'objectTab' );
		if ( ! objectPanel ) return;

		const rows = objectPanel.querySelectorAll( '.Row' );

		for ( let i = 0; i < rows.length; i ++ ) {

			const row = rows[ i ] as HTMLElement;
			const label = row.querySelector( '.Label' );

			if ( label && labelsToHide.indexOf( label.textContent! ) !== - 1 ) {

				row.style.display = 'none';

			}

		}

	}

	editor.signals.objectSelected.add( function () {

		Promise.resolve().then( hide );

	} );

	hide();

}

/**
 * Hide the autosave checkbox from the menubar status area.
 */
function hideAutosaveCheckbox(): void {

	const statusDom = document.querySelector( '.menu.right' );
	if ( ! statusDom ) return;

	const labels = statusDom.querySelectorAll( 'label' );

	for ( let i = 0; i < labels.length; i ++ ) {

		const checkbox = labels[ i ].querySelector( 'input[type="checkbox"]' );
		if ( checkbox ) {

			(labels[ i ] as HTMLElement).style.display = 'none';
			break;

		}

	}

}

export { applySidebarPatches, applySidebarPropertiesPatches, getHierarchyLabel, clearTabbedPanel, injectOutlinerFilter, injectOutlinerSearchUI, injectOutlinerCustomIcons, hideObjectPropertyRows, hideAutosaveCheckbox };
