import { Box3, Vector3 } from 'three'

import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js'

import { AddObjectCommand } from './commands/AddObjectCommand.js'
import { RemoveObjectCommand } from './commands/RemoveObjectCommand.js'
import { SetPositionCommand } from './commands/SetPositionCommand.js'

function MenubarEdit(editor) {
	const strings = editor.strings

	const container = new UIPanel()
	container.setClass('menu')

	const title = new UIPanel()
	title.setClass('title')
	title.setTextContent(strings.getKey('menubar/edit'))
	container.add(title)

	const options = new UIPanel()
	options.setClass('options')
	container.add(options)

	// Undo

	const undo = new UIRow()
	undo.setClass('option')
	undo.setTextContent(strings.getKey('menubar/edit/undo'))
	undo.onClick(function () {
		editor.undo()
	})
	options.add(undo)

	// Redo

	const redo = new UIRow()
	redo.setClass('option')
	redo.setTextContent(strings.getKey('menubar/edit/redo'))
	redo.onClick(function () {
		editor.redo()
	})
	options.add(redo)

	// Clear History

	let option = new UIRow()
	option.setClass('option')
	option.setTextContent(strings.getKey('menubar/edit/clear_history'))
	option.onClick(function () {
		if (confirm('The Undo/Redo History will be cleared. Are you sure?')) {
			editor.history.clear()
		}
	})
	options.add(option)

	editor.signals.historyChanged.add(function () {
		const history = editor.history

		undo.setClass('option')
		redo.setClass('option')

		if (history.undos.length == 0) {
			undo.setClass('inactive')
		}

		if (history.redos.length == 0) {
			redo.setClass('inactive')
		}
	})

	// ---

	options.add(new UIHorizontalRule())

	// Center

	option = new UIRow()
	option.setClass('option')
	option.setTextContent(strings.getKey('menubar/edit/center'))
	option.onClick(function () {
		const object = editor.selected

		if (object === null || object.parent === null) return // avoid centering the camera or scene

		const aabb = new Box3().setFromObject(object)
		const center = aabb.getCenter(new Vector3())
		const newPosition = new Vector3()

		newPosition.x = object.position.x + (object.position.x - center.x)
		newPosition.y = object.position.y + (object.position.y - center.y)
		newPosition.z = object.position.z + (object.position.z - center.z)

		editor.execute(new SetPositionCommand(editor, object, newPosition))
	})
	options.add(option)

	// Clone

	option = new UIRow()
	option.setClass('option')
	option.setTextContent(strings.getKey('menubar/edit/clone'))
	option.onClick(function () {
		let object = editor.selected;
		console.error("objectSelected:", object)
		if (object === null || object.parent === null) return;

		object = object.clone();
		console.error("clonedObject: ", object)
		// 保持原始type
		if(editor.selected.type) {
			object.type = editor.selected.type;
		}

		// 复制components并重新生成UUID
		if(editor.selected.components) {
			object.components = JSON.parse(JSON.stringify(editor.selected.components));
			// 为每个组件的选择项生成新的UUID
			object.components.forEach(component => {
				if(component.parameters && component.parameters.uuid) {
					component.parameters.uuid = THREE.MathUtils.generateUUID();
				}
				// 如果组件中包含选择项,也重新生成UUID
				if(component.parameters && component.parameters.options) {
					Object.keys(component.parameters.options).forEach(key => {
						const newUuid = THREE.MathUtils.generateUUID();
						component.parameters.options[newUuid] = component.parameters.options[key];
						delete component.parameters.options[key];
					});
				}
			});
		}

		if(editor.selected.commands) {
			object.commands = JSON.parse(JSON.stringify(editor.selected.commands));
			object.commands.forEach(command => {
				if(command.parameters && command.parameters.uuid) {
					command.parameters.uuid = THREE.MathUtils.generateUUID();
				}
				if(command.parameters && command.parameters.options) {
					Object.keys(command.parameters.options).forEach(key => {
						const newUuid = THREE.MathUtils.generateUUID();
						command.parameters.options[newUuid] = command.parameters.options[key];
						delete command.parameters.options[key];
					});
				}
			});
		}

		// editor.execute(new AddObjectCommand(editor, object));

		const parent = editor.selected.parent;

		const cmd = new AddObjectCommand(editor, object);

		cmd.execute = function() {
			editor.addObject(object, parent);
			editor.select(object);
		};

		editor.execute(cmd);
	})
	options.add(option)

	// Delete

	option = new UIRow()
	option.setClass('option')
	option.setTextContent(strings.getKey('menubar/edit/delete'))
	option.onClick(function () {
		const object = editor.selected

		if (object !== null && object.parent !== null) {
			editor.execute(new RemoveObjectCommand(editor, object))
		}
	})
	options.add(option)

	//

	options.add(new UIHorizontalRule())

	// Set textures to sRGB. See #15903

	option = new UIRow()
	option.setClass('option')
	option.setTextContent(strings.getKey('menubar/edit/fixcolormaps'))
	option.onClick(function () {
		editor.scene.traverse(fixColorMap)
	})
	//options.add(option)

	const colorMaps = ['map', 'envMap', 'emissiveMap']

	function fixColorMap(obj) {
		const material = obj.material

		if (material !== undefined) {
			if (Array.isArray(material) === true) {
				for (let i = 0; i < material.length; i++) {
					fixMaterial(material[i])
				}
			} else {
				fixMaterial(material)
			}

			editor.signals.sceneGraphChanged.dispatch()
		}
	}

	function fixMaterial(material) {
		let needsUpdate = material.needsUpdate

		for (let i = 0; i < colorMaps.length; i++) {
			const map = material[colorMaps[i]]

			if (map) {
				map.encoding = THREE.sRGBEncoding
				needsUpdate = true
			}
		}

		material.needsUpdate = needsUpdate
	}

	// 添加键盘快捷键事件监听
	document.addEventListener('keydown', function(event) {
		// 检查是否按下Ctrl键(Windows)或Command键(Mac)
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;

		if (isCtrlOrCmd) {
			switch (event.key.toLowerCase()) {
				case 'c': // Ctrl+C
					event.preventDefault(); // 阻止默认的复制行为
					copySelected();
					break;
				case 'v': // Ctrl+V
					event.preventDefault(); // 阻止默认的粘贴行为
					pasteSelected();
					break;
			}
		}
	});

	// 用于存储复制的对象
	let copiedObject = null;

	// 复制功能
	function copySelected() {
		const object = editor.selected;
		if (object === null || object.parent === null) return;
		copiedObject = object;
	}

	// 粘贴功能
	function pasteSelected() {
		if (copiedObject === null) return;

		const object = copiedObject.clone();

		// 保持原始type
		if(copiedObject.type) {
			object.type = copiedObject.type;
		}

		// 复制components并重新生成UUID
		if(copiedObject.components) {
			object.components = JSON.parse(JSON.stringify(copiedObject.components));
			// 为每个组件的选择项生成新的UUID
			object.components.forEach(component => {
				if(component.parameters && component.parameters.uuid) {
					component.parameters.uuid = THREE.MathUtils.generateUUID();
				}
				// 如果组件中包含选择项,也重新生成UUID
				if(component.parameters && component.parameters.options) {
					Object.keys(component.parameters.options).forEach(key => {
						const newUuid = THREE.MathUtils.generateUUID();
						component.parameters.options[newUuid] = component.parameters.options[key];
						delete component.parameters.options[key];
					});
				}
			});
		}

		if(copiedObject.commands) {
			object.commands = JSON.parse(JSON.stringify(copiedObject.commands));
			object.commands.forEach(command => {
				if(command.parameters && command.parameters.uuid) {
					command.parameters.uuid = THREE.MathUtils.generateUUID();
				}
				if(command.parameters && command.parameters.options) {
					Object.keys(command.parameters.options).forEach(key => {
						const newUuid = THREE.MathUtils.generateUUID();
						command.parameters.options[newUuid] = command.parameters.options[key];
						delete command.parameters.options[key];
					});
				}
			});
		}

		editor.execute(new AddObjectCommand(editor, object));
	}

	return container
}

export { MenubarEdit }
