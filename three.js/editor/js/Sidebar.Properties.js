import { UITabbedPanel } from './libs/ui.js';

import { SidebarObject } from './Sidebar.Object.js';
import { SidebarGeometry } from './Sidebar.Geometry.js';
import { SidebarMaterial } from './Sidebar.Material.js';
import { SidebarMultipleObjects } from './Sidebar.MultipleObjects.js';

function SidebarProperties( editor ) {

	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UITabbedPanel();
	container.setId( 'properties' );

	// 创建多选对象面板
	const multipleObjectsPanel = new SidebarMultipleObjects(editor);

	// 创建单对象面板
	const objectPanel = new SidebarObject(editor);

	// container.addTab( 'geometry', strings.getKey( 'sidebar/properties/geometry' ), new SidebarGeometry( editor ) );
    // container.addTab( 'material', strings.getKey( 'sidebar/properties/material' ), new SidebarMaterial( editor ) );

	// 添加初始面板
	container.addTab('object', strings.getKey('sidebar/properties/object'), objectPanel);
	container.select('object');

	// 监听对象选择事件，自动切换选项卡
	signals.objectSelected.add(function(object) {
		if (object !== null) {
			const selectedObjects = editor.getSelectedObjects();

			// 清除所有现有标签页
			container.clear();

			if (selectedObjects.length > 1) {
				// 多选模式：显示多选面板
				container.addTab('multiobjects', '多选对象', multipleObjectsPanel.container);
				container.select('multiobjects');
			} else {
				// 单选模式：显示单对象面板
				container.addTab('object', strings.getKey('sidebar/properties/object'), objectPanel);
				container.select('object');
			}
		}
	});

	return container;
}

export { SidebarProperties };
