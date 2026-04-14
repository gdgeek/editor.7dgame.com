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

					// Animation preview is temporarily hidden.

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
	const typePrefix = strings.getKey( 'sidebar/scene/filter/type_prefix' );
	const componentPrefix = strings.getKey( 'sidebar/scene/filter/component_prefix' );

	function formatFilterLabel( prefix: string, label: string ): string {

		return `${ prefix }：${ label }`;

	}

	function getFilterObjectType( object: any ): string {

		const rawType = ( object.userData && ( object.userData as any ).type ) || object.type || '';
		const normalizedType = String( rawType ).toLowerCase();
		const objectName = String( object.name || '' ).trim().toLowerCase();

		if ( normalizedType === 'sound' ) return 'audio';
		if ( normalizedType === 'entity' && /^point(?:\s*\(\d+\))?$/.test( objectName ) ) return 'point';

		return normalizedType;

	}

	function hasFilterComponent( object: any, componentType: string ): boolean {

		const components = Array.isArray( object.components )
			? object.components
			: Array.isArray( object.userData && ( object.userData as any ).components )
				? ( object.userData as any ).components
				: [];

		for ( let i = 0; i < components.length; i ++ ) {

			const currentType = String( components[ i ] && components[ i ].type || '' ).toLowerCase();

			if ( currentType === componentType ) return true;

		}

		return false;

	}

	// ── Build type filter options using i18n keys ──
	const filterOptions: Record<string, string> = {
		'': strings.getKey( 'sidebar/scene/filter/all' ),
		'type:point': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/point' ) ),
		'type:text': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/text' ) ),
		'type:polygen': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/polygen' ) ),
		'type:picture': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/picture' ) ),
		'type:video': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/video' ) ),
		'type:audio': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/audio' ) ),
		'type:prototype': formatFilterLabel( typePrefix, strings.getKey( 'sidebar/scene/filter/type/prototype' ) ),
		'component:rotate': formatFilterLabel( componentPrefix, strings.getKey( 'sidebar/components/select/rotate' ) ),
		'component:action': formatFilterLabel( componentPrefix, strings.getKey( 'sidebar/components/select/action' ) ),
		'component:moved': formatFilterLabel( componentPrefix, strings.getKey( 'sidebar/components/select/moved' ) ),
		'component:trigger': formatFilterLabel( componentPrefix, strings.getKey( 'sidebar/components/select/trigger' ) ),
		'component:tooltip': formatFilterLabel( componentPrefix, strings.getKey( 'sidebar/components/select/tooltip' ) ),
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

			// Type / component filter
			if ( visible && selectedType !== '' ) {

				const [ filterKind, filterValue ] = String( selectedType ).split( ':' );

				if ( filterKind === 'type' ) {

					visible = getFilterObjectType( object ) === filterValue;

				} else if ( filterKind === 'component' ) {

					visible = hasFilterComponent( object, filterValue );

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
	const isSceneEditor = !! ( editor.type && editor.type.toLowerCase() === 'verse' );

	outlinerDom.classList.toggle( 'mrpp-scene-outliner', isSceneEditor );

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
		#outliner.mrpp-scene-outliner .type.Entity { color: transparent; }
		#outliner.mrpp-scene-outliner .type.Entity:after {
			content: '';
			display: inline-block;
			width: 9px;
			height: 9px;
			vertical-align: middle;
			background-repeat: no-repeat;
			background-position: center;
			background-size: contain;
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%236a7f9c' d='M192 104.8c0-9.2-5.8-17.3-13.2-22.8C167.2 73.3 160 61.3 160 48c0-26.5 28.7-48 64-48s64 21.5 64 48c0 13.3-7.2 25.3-18.8 34c-7.4 5.5-13.2 13.6-13.2 22.8c0 12.8 10.4 23.2 23.2 23.2l56.8 0c26.5 0 48 21.5 48 48l0 56.8c0 12.8 10.4 23.2 23.2 23.2c9.2 0 17.3-5.8 22.8-13.2c8.7-11.6 20.7-18.8 34-18.8c26.5 0 48 28.7 48 64s-21.5 64-48 64c-13.3 0-25.3-7.2-34-18.8c-5.5-7.4-13.6-13.2-22.8-13.2c-12.8 0-23.2 10.4-23.2 23.2L384 464c0 26.5-21.5 48-48 48l-56.8 0c-12.8 0-23.2-10.4-23.2-23.2c0-9.2 5.8-17.3 13.2-22.8c11.6-8.7 18.8-20.7 18.8-34c0-26.5-28.7-48-64-48s-64 21.5-64 48c0 13.3 7.2 25.3 18.8 34c7.4 5.5 13.2 13.6 13.2 22.8c0 12.8-10.4 23.2-23.2 23.2L48 512c-26.5 0-48-21.5-48-48L0 343.2C0 330.4 10.4 320 23.2 320c9.2 0 17.3 5.8 22.8 13.2C54.7 344.8 66.7 352 80 352c26.5 0 48-28.7 48-64s-21.5-64-48-64c-13.3 0-25.3 7.2-34 18.8C40.5 250.2 32.4 256 23.2 256C10.4 256 0 245.6 0 232.8L0 176c0-26.5 21.5-48 48-48l120.8 0c12.8 0 23.2-10.4 23.2-23.2z'/%3E%3C/svg%3E");
		}
		#outliner .type.Point { color: #d0d0d0; }
		#outliner .type.Point:after { content: '◇'; }
		#outliner .type.Text { color: #5b74a5; }
		#outliner .type.Text:after { content: 'T'; font-weight: 600; }
		#outliner .type.Polygen { color: #74a55b; }
		#outliner .type.Polygen:after { content: '⬢'; }
		#outliner .type.Voxel { color: #74a55b; }
		#outliner .type.Voxel:after { content: '⬢'; }
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

	function getMrppTypeClass( object: any ): string {

		const rawType = ( object.userData && ( object.userData as any ).type ) || object.type || '';
		const normalizedType = String( rawType ).toLowerCase();
		const customTypeMap: Record<string, string> = {
			module: 'Module',
			entity: 'Entity',
			point: 'Point',
			text: 'Text',
			polygen: 'Polygen',
			voxel: 'Voxel',
			picture: 'Picture',
			video: 'Video',
			audio: 'Audio',
			sound: 'Audio',
			prototype: 'Prototype'
		};

		if ( isSceneEditor && normalizedType === 'module' ) {

			return 'Entity';

		}

		return customTypeMap[ normalizedType ] || '';

	}

	function replaceTypeIcons(): void {

		const options = outlinerDom!.querySelectorAll( '.option' );

		for ( let i = 0; i < options.length; i ++ ) {

			const option = options[ i ] as HTMLElement;
			const id = parseInt( (option as any).value );
			if ( isNaN( id ) ) continue;

			const object = editor.scene.getObjectById( id );
			if ( ! object ) continue;

			const nativeTypes = [ 'Scene', 'PerspectiveCamera', 'OrthographicCamera',
				'AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'HemisphereLight',
				'Mesh', 'SkinnedMesh', 'Line', 'LineSegments', 'LineLoop', 'Points',
				'Group', 'Object3D', 'Bone', 'Sprite', 'LOD' ];
			const typeCssClass = getMrppTypeClass( object );

			if ( ! typeCssClass ) continue;

			// Find the type span and replace its class
			const typeSpan = option.querySelector( '.type' );
			if ( typeSpan && typeSpan.className !== 'type ' + typeCssClass ) {

				typeSpan.className = 'type ' + typeCssClass;

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
	observer.observe( outlinerDom, { childList: true, subtree: true } );
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

		// r183: no #objectTab id — search all .Row elements with .Label children
		const rows = document.querySelectorAll( '.Row' );

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

	// Hide only the autosave checkbox (first child), keep version text visible
	for ( let i = 0; i < statusDom.children.length; i ++ ) {

		const child = statusDom.children[ i ] as HTMLElement;
		// UIBoolean (autosave) contains an input checkbox; version UIText does not
		if ( child.querySelector( 'input' ) ) {

			child.style.display = 'none';

		}

	}

}

export { applySidebarPatches, applySidebarPropertiesPatches, getHierarchyLabel, clearTabbedPanel, injectOutlinerFilter, injectOutlinerSearchUI, injectOutlinerCustomIcons, hideObjectPropertyRows, hideAutosaveCheckbox };
