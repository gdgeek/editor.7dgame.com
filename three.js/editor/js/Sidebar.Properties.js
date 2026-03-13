import { UITabbedPanel } from './libs/ui.js';

import { SidebarObject } from './Sidebar.Object.js';
import { SidebarGeometry } from './Sidebar.Geometry.js';
import { SidebarMaterial } from './Sidebar.Material.js';
import { SidebarMultipleObjects } from './Sidebar.MultipleObjects.js';
import { SidebarEvents } from './Sidebar.Events.js';
import { SidebarComponent } from './Sidebar.Component.js';
import { SidebarCommand } from './Sidebar.Command.js';
import { SidebarText } from './Sidebar.Text.js';
import { SidebarAnimation } from './Sidebar.Animation.js';

function SidebarProperties( editor ) {

	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UITabbedPanel();
	container.setId( 'properties' );

	// 创建多选对象面板
	const multipleObjectsPanel = new SidebarMultipleObjects(editor);

	// 创建单对象面板
	const objectPanel = new SidebarObject(editor);

	// 创建事件面板
	const eventsPanel = new SidebarEvents(editor);

	// 创建组件面板
	const componentPanel = new SidebarComponent(editor);

	// 创建指令面板
	const commandPanel = new SidebarCommand(editor);

	// 创建文字面板
	const textPanel = new SidebarText(editor);

	// 创建动画面板
	const animationPanel = new SidebarAnimation(editor);

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
				container.addTab('multiobjects', strings.getKey('sidebar/properties/multi_object'), multipleObjectsPanel.container);
				container.select('multiobjects');
			} else {
				// 单选模式
				if (object === editor.scene) {
					// Scene节点：显示事件面板
					container.addTab('events', strings.getKey('sidebar/events'), eventsPanel.container);
					container.select('events');
					eventsPanel.update();
				} else {
					// 其他对象：显示单对象面板
					container.addTab('object', strings.getKey('sidebar/properties/object'), objectPanel);
					container.select('object');

					// 检查对象类型
					const objectType = object.type ? object.type.toLowerCase() : '';

					// 检查是否有动画
					const hasAnimations = (object.animations && object.animations.length > 0) || (object.userData && object.userData.animations && object.userData.animations.length > 0);

					if (hasAnimations) {
						container.addTab('animation', strings.getKey('sidebar/animations'), animationPanel.container);
						animationPanel.update(object);
					}

					if (editor.type && editor.type.toLowerCase() === 'meta') {
						//模型、体素、图片类型显示组件面板
						const componentValidTypes = ['polygen', 'voxel', 'picture'];
						//节点类型显示指令面板
						const commandValidTypes = ['entity','point'];

						if (componentValidTypes.includes(objectType)) {
							container.addTab('component', strings.getKey('sidebar/components'), componentPanel.container);
							componentPanel.update();
						}
						if (commandValidTypes.includes(objectType)) {
							container.addTab('command', strings.getKey('sidebar/command'), commandPanel.container);
							commandPanel.update();
						}
					}

					// 文本对象显示文本面板
					if (objectType === 'text') {
						container.addTab('text', strings.getKey('sidebar/text'), textPanel.container);
						textPanel.update();
					}

					// 确保默认选中object标签页
					container.select('object');
				}
			}
		} else {
			// 取消选中时，显示默认的object面板
			container.clear();
			container.addTab('object', strings.getKey('sidebar/properties/object'), objectPanel);
			container.select('object');
		}
	});

	return container;
}

export { SidebarProperties };
