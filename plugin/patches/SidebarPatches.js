import { SidebarEvents } from '../ui/sidebar/Sidebar.Events.js';
import { SidebarScreenshot } from '../ui/sidebar/Sidebar.Screenshot.js';
import { SidebarMultipleObjects } from '../ui/sidebar/Sidebar.MultipleObjects.js';
import { SidebarComponent } from '../ui/sidebar/Sidebar.Component.js';
import { SidebarCommand } from '../ui/sidebar/Sidebar.Command.js';
import { SidebarText } from '../ui/sidebar/Sidebar.Text.js';
import { SidebarAnimation } from '../ui/sidebar/Sidebar.Animation.js';

/**
 * Determine the hierarchy tab label based on editor type and current language.
 * Extracted from Sidebar.js MRPP modification.
 *
 * @param {object} editor - The Editor instance
 * @returns {string} The localized hierarchy label
 */
function getHierarchyLabel( editor ) {

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
 *
 * @param {object} editor - The Editor instance
 * @param {object} sidebarContainer - The UITabbedPanel returned by Sidebar(editor)
 */
function applySidebarPatches( editor, sidebarContainer ) {

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
		let propertiesPanel = null;
		let scenePanel = null;

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

		const eventsPanel = new SidebarEvents( editor );
		sidebarContainer.addTab( 'events', strings.getKey( 'sidebar/events' ), eventsPanel.container );

	}

	// 5. Add Screenshot tab
	const screenshot = new SidebarScreenshot( editor );
	sidebarContainer.addTab( 'screenshot', strings.getKey( 'sidebar/screenshot' ), screenshot );

	// 6. Ensure 'scene' tab is selected
	sidebarContainer.select( 'scene' );

}

/**
 * Apply MRPP patches to Sidebar.Properties after it is built.
 *
 * Responsibilities:
 * - Create MRPP panel instances (MultipleObjects, Component, Command, Text, Animation)
 * - Wire up objectSelected signal to dynamically add/remove MRPP panels
 *
 * The vanilla SidebarProperties creates a UITabbedPanel with static tabs
 * (object, geometry, material). This patch adds dynamic tab management
 * based on the selected object type.
 *
 * @param {object} editor - The Editor instance
 * @param {object} propertiesContainer - The UITabbedPanel returned by SidebarProperties(editor)
 */
function applySidebarPropertiesPatches( editor, propertiesContainer ) {

	const strings = editor.strings;
	const signals = editor.signals;

	// Create MRPP panel instances (once, reused across selections)
	const multipleObjectsPanel = new SidebarMultipleObjects( editor );
	const componentPanel = new SidebarComponent( editor );
	const commandPanel = new SidebarCommand( editor );
	const textPanel = new SidebarText( editor );
	const animationPanel = new SidebarAnimation( editor );

	// Save a reference to the vanilla object tab content.
	// The vanilla SidebarProperties adds it as addTab('object', ..., objectPanel).
	// We need to preserve it when rebuilding tabs.
	// We save the actual SidebarObject container DOM element (not the wrapper div)
	// so it survives clear() + addTab() cycles.
	let objectContentDom = null;
	let objectTabLabel = strings.getKey( 'sidebar/properties/object' );

	for ( let i = 0; i < propertiesContainer.panels.length; i ++ ) {

		if ( propertiesContainer.panels[ i ].dom.id === 'object' ) {

			// The panel wrapper div contains the SidebarObject container as its first child.
			// We save a reference to the actual content element.
			const panelDom = propertiesContainer.panels[ i ].dom;
			objectContentDom = panelDom.firstChild || panelDom;
			break;

		}

	}

	// Listen for object selection to dynamically manage tabs
	signals.objectSelected.add( function ( object ) {

		if ( object !== null ) {

			const selectedObjects = editor.getSelectedObjects();

			if ( selectedObjects.length > 1 ) {

				// Multi-select mode: clear all tabs and show multi-objects panel
				propertiesContainer.clear();
				propertiesContainer.addTab(
					'multiobjects',
					strings.getKey( 'sidebar/properties/multi_object' ),
					multipleObjectsPanel.container
				);
				propertiesContainer.select( 'multiobjects' );

			} else {

				// Single-select mode: rebuild with object tab + conditional MRPP tabs
				propertiesContainer.clear();

				// Re-add the vanilla object tab
				if ( objectContentDom ) {

					propertiesContainer.addTab( 'object', objectTabLabel, objectContentDom );

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

				// Ensure object tab is selected
				propertiesContainer.select( 'object' );

			}

		} else {

			// Deselected: show only the object tab
			propertiesContainer.clear();

			if ( objectContentDom ) {

				propertiesContainer.addTab( 'object', objectTabLabel, objectContentDom );

			}

			propertiesContainer.select( 'object' );

		}

	} );

}

export { applySidebarPatches, applySidebarPropertiesPatches, getHierarchyLabel };
