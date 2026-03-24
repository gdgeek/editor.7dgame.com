import { UITabbedPanel, UISpan } from './libs/ui.js'

import { SidebarScene } from './Sidebar.Scene.js'
import { SidebarProperties } from './Sidebar.Properties.js'
// --- MRPP MODIFICATION START ---
import { SidebarEvents } from '../../../plugin/ui/sidebar/Sidebar.Events.js'
import { SidebarComponent } from '../../../plugin/ui/sidebar/Sidebar.Component.js'
import { SidebarCommand } from '../../../plugin/ui/sidebar/Sidebar.Command.js'
import { SidebarAnimation } from '../../../plugin/ui/sidebar/Sidebar.Animation.js'
import { SidebarMedia } from '../../../plugin/ui/sidebar/Sidebar.Media.js'
// --- MRPP MODIFICATION END ---
import { SidebarProject } from './Sidebar.Project.js'
import { SidebarSettings } from './Sidebar.Settings.js'
// --- MRPP MODIFICATION START ---
import { SidebarScreenshot } from '../../../plugin/ui/sidebar/Sidebar.Screenshot.js'
import { SidebarText } from '../../../plugin/ui/sidebar/Sidebar.Text.js'
// --- MRPP MODIFICATION END ---

function Sidebar(editor) {
	const strings = editor.strings

	// --- MRPP MODIFICATION START ---
	function getHierarchyLabel() {
		if (editor.type && editor.type.toLowerCase() === 'verse') {
			return strings.getKey('sidebar/entities')
		}

		const sceneLabel = strings.getKey('sidebar/scene')

		if (sceneLabel === 'Scene') return 'Hierarchy'
		if (sceneLabel === 'シーン') return '階層'
		if (sceneLabel === '場景') return '層級'
		if (sceneLabel === 'ฉาก') return 'ลำดับชั้น'

		return '层级'
	}
	// --- MRPP MODIFICATION END ---

	const container = new UITabbedPanel()
	container.setId('sidebar')

	// --- MRPP MODIFICATION START ---
	const eventsPanel = new SidebarEvents(editor)
	// --- MRPP MODIFICATION END ---
	const scene = new UISpan()
	scene.dom.style.display = 'flex'
	scene.dom.style.flexDirection = 'column'
	scene.dom.style.height = '100%'
	scene.dom.style.minHeight = '0'
	scene.add(new SidebarScene(editor))

	const propertiesPanel = new SidebarProperties(editor)
	propertiesPanel.dom.style.minHeight = '0'

	// --- MRPP MODIFICATION START ---
	if (editor.type.toLowerCase() == 'meta') {
		propertiesPanel.dom.style.marginTop = '3px'
		propertiesPanel.dom.style.flex = '1 1 auto'
		scene.add(propertiesPanel)
		// container.addTab('component', strings.getKey('sidebar/component'), new SidebarComponent(editor))
		// container.addTab('command', strings.getKey('sidebar/command'), new SidebarCommand(editor))
	} else if (editor.type.toLowerCase() == 'verse') {
		propertiesPanel.dom.style.marginTop = '3px'
		propertiesPanel.dom.style.flex = '1 1 auto'
		scene.add(propertiesPanel)
	}
	// --- MRPP MODIFICATION END ---
	const project = new SidebarProject(editor)
	const settings = new SidebarSettings(editor)
	// --- MRPP MODIFICATION START ---
	const screenshot = new SidebarScreenshot(editor)
	// --- MRPP MODIFICATION END ---

	container.addTab('scene', getHierarchyLabel(), scene)
	// container.addTab('project', strings.getKey('sidebar/project'), project)
	// container.addTab('settings', strings.getKey('sidebar/settings'), settings)
	// --- MRPP MODIFICATION START ---
	if (editor.type && editor.type.toLowerCase() === 'meta') {
		container.addTab('events', strings.getKey('sidebar/events'), eventsPanel.container)
	}
	container.addTab('screenshot', strings.getKey('sidebar/screenshot'), screenshot)
	// --- MRPP MODIFICATION END ---
	container.select('scene')

	return container
}

export { Sidebar }
