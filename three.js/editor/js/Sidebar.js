import { UITabbedPanel, UISpan } from './libs/ui.js'

import { SidebarScene } from './Sidebar.Scene.js'
import { SidebarProperties } from './Sidebar.Properties.js'
import { SidebarMeta } from './Sidebar.Meta.js'
import { SidebarEvents } from './Sidebar.Events.js'
import { SidebarComponent } from './Sidebar.Component.js'
import { SidebarCommand } from './Sidebar.Command.js'
import { SidebarAnimation } from './Sidebar.Animation.js'
import { SidebarMedia } from './Sidebar.Media.js'
import { SidebarProject } from './Sidebar.Project.js'
import { SidebarSettings } from './Sidebar.Settings.js'
import { SidebarScreenshot } from './Sidebar.Screenshot.js'
import { SidebarText } from './Sidebar.Text.js'

function Sidebar(editor) {
	const strings = editor.strings

	function getHierarchyLabel() {
		const sceneLabel = strings.getKey('sidebar/scene')

		if (sceneLabel === 'Scene') return 'Hierarchy'
		if (sceneLabel === 'シーン') return '階層'
		if (sceneLabel === '場景') return '層級'
		if (sceneLabel === 'ฉาก') return 'ลำดับชั้น'

		return '层级'
	}

	const container = new UITabbedPanel()
	container.setId('sidebar')

	const eventsPanel = new SidebarEvents(editor)
	const scene = new UISpan()
	scene.dom.style.display = 'flex'
	scene.dom.style.flexDirection = 'column'
	scene.dom.style.height = '100%'
	scene.dom.style.minHeight = '0'
	scene.add(new SidebarScene(editor))

	const propertiesPanel = new SidebarProperties(editor)
	propertiesPanel.dom.style.marginTop = '3px'
	propertiesPanel.dom.style.flex = '1 1 auto'
	propertiesPanel.dom.style.minHeight = '0'
	scene.add(propertiesPanel)

	if (editor.type.toLowerCase() == 'meta') {
		// container.addTab('component', strings.getKey('sidebar/component'), new SidebarComponent(editor))
		// container.addTab('command', strings.getKey('sidebar/command'), new SidebarCommand(editor))
	} else if (editor.type.toLowerCase() == 'verse') {
		scene.add(new SidebarMeta(editor))
	}
	const project = new SidebarProject(editor)
	const settings = new SidebarSettings(editor)
	const screenshot = new SidebarScreenshot(editor)

	container.addTab('scene', getHierarchyLabel(), scene)
	// container.addTab('project', strings.getKey('sidebar/project'), project)
	// container.addTab('settings', strings.getKey('sidebar/settings'), settings)
	if (editor.type && editor.type.toLowerCase() === 'meta') {
		container.addTab('events', strings.getKey('sidebar/events'), eventsPanel.container)
	}
	container.addTab('screenshot', strings.getKey('sidebar/screenshot'), screenshot)
	container.select('scene')

	return container
}

export { Sidebar }
