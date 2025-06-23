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
		const selectedObjects = editor.getSelectedObjects();

		if (selectedObjects.length === 0) return;

		// 记录克隆后的对象，以便最后可以全选它们
		const clonedObjects = [];

		// 克隆所有选中的对象
		for (let i = 0; i < selectedObjects.length; i++) {
			let object = selectedObjects[i];
			console.error("objectSelected:", object)
			if (object === null || object.parent === null) continue;

			object = object.clone();
			console.error("clonedObject: ", object)
			// 保持原始type
			if(selectedObjects[i].type) {
				object.type = selectedObjects[i].type;
			}

			// 复制components并重新生成UUID
			if(selectedObjects[i].components) {
				object.components = JSON.parse(JSON.stringify(selectedObjects[i].components));
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

			if(selectedObjects[i].commands) {
				object.commands = JSON.parse(JSON.stringify(selectedObjects[i].commands));
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

			const parent = selectedObjects[i].parent;

			const cmd = new AddObjectCommand(editor, object);

			cmd.execute = function() {
				editor.addObject(object, parent);
				clonedObjects.push(object);

				// 仅在所有对象都克隆完成后才设置选择状态
				if (clonedObjects.length === selectedObjects.length) {
					// 如果克隆了多个对象，全选它们
					if (clonedObjects.length > 1) {
						// 清除当前选择
						editor.clearSelection();

						// 选中第一个作为主选择
						editor.select(clonedObjects[0]);

						// 添加其余对象到选择
						for (let j = 1; j < clonedObjects.length; j++) {
							editor.select(clonedObjects[j], true);
						}
					} else {
						// 只克隆了一个对象，直接选择
						editor.select(clonedObjects[0]);
					}
				}
			};

			editor.execute(cmd);
		}
	})
	options.add(option)

	// Delete

	option = new UIRow()
	option.setClass('option')
	option.setTextContent(strings.getKey('menubar/edit/delete'))
	option.onClick(function () {
		const selectedObjects = editor.getSelectedObjects();

		if (selectedObjects.length > 0) {
			// 多选删除
			for (let i = selectedObjects.length - 1; i >= 0; i--) {
				const object = selectedObjects[i];
				if (object !== null && object.parent !== null) {
					editor.execute(new RemoveObjectCommand(editor, object));
				}
			}
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
	let copiedObjects = [];

	// 复制功能
	function copySelected() {
		// 直接获取UI控件中的选中值，而不是editor.getSelectedObjects()
		const outliner = editor.scene.getObjectById ? null : document.getElementById('outliner');

		// 确保我们获取所有选中的对象，包括通过Shift选择的范围和缺失资源的对象
		const selectedObjects = editor.getSelectedObjects();

		console.log("复制选中的对象：", selectedObjects);

		if (selectedObjects.length === 0) return;

		// 清空之前复制的对象
		copiedObjects = [];

		// 复制所有选中的对象，包括缺失资源的对象
		for (let i = 0; i < selectedObjects.length; i++) {
			const object = selectedObjects[i];
			// 只检查对象是否存在且有父级，允许复制缺失资源的对象
			if (object !== null && object.parent !== null) {
				copiedObjects.push(object);
			}
		}

		console.log("已复制对象数量：", copiedObjects.length);
	}

	// 粘贴功能
	function pasteSelected() {
		if (copiedObjects.length === 0) return;

		// 记录新创建的对象，以便最后可以全选它们
		const newObjects = [];

		// 粘贴所有复制的对象
		for (let i = 0; i < copiedObjects.length; i++) {
			const copiedObject = copiedObjects[i];
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

			// 添加对象，并记录
			editor.execute(new AddObjectCommand(editor, object));
			newObjects.push(object);
		}

		// 如果复制了多个对象，粘贴后全选它们
		if (newObjects.length > 1) {
			// 清除当前选择
			editor.clearSelection();

			// 选中第一个作为主选择
			editor.select(newObjects[0]);

			// 添加其余对象到选择
			for (let i = 1; i < newObjects.length; i++) {
				editor.select(newObjects[i], true);
			}
		}
	}

	return container
}

export { MenubarEdit }
