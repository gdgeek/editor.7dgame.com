import { UITabbedPanel, UISpan } from './libs/ui.js'

import { SidebarScene } from './Sidebar.Scene.js'
import { SidebarProperties } from './Sidebar.Properties.js'
import { SidebarProject } from './Sidebar.Project.js'
import { SidebarSettings } from './Sidebar.Settings.js'

function Sidebar(editor) {
	const strings = editor.strings

	const container = new UITabbedPanel()
	container.setId('sidebar')

	const scene = new UISpan()
	scene.dom.style.display = 'flex'
	scene.dom.style.flexDirection = 'column'
	scene.dom.style.height = '100%'
	scene.dom.style.minHeight = '0'
	scene.add(new SidebarScene(editor))

	const propertiesPanel = new SidebarProperties(editor)
	propertiesPanel.dom.style.minHeight = '0'
	scene.add(propertiesPanel)

	const project = new SidebarProject(editor)
	const settings = new SidebarSettings(editor)

	container.addTab('scene', strings.getKey('sidebar/scene'), scene)
	container.addTab('project', strings.getKey('sidebar/project'), project)
	container.addTab('settings', strings.getKey('sidebar/settings'), settings)
	container.select('scene')

	return container
}

export { Sidebar }
