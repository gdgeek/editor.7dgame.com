import { Box3, Vector3 } from 'three'
import * as SkeletonUtils from '../../examples/jsm/utils/SkeletonUtils.js'

import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js'

import { AddObjectCommand } from './commands/AddObjectCommand.js'
import { RemoveObjectCommand } from './commands/RemoveObjectCommand.js'
import { SetPositionCommand } from './commands/SetPositionCommand.js'
// --- MRPP MODIFICATION START ---
import { MetaFactory } from '../../../plugin/mrpp/MetaFactory.js';
import { Builder } from '../../../plugin/mrpp/Builder.js';
// --- MRPP MODIFICATION END ---

function hasSkinnedMesh(object) {
	let found = false;
	object.traverse((child) => {
		if (child.isSkinnedMesh) {
			found = true;
		}
	});
	return found;
}

function clone(source) {
	// 如果包含 SkinnedMesh，使用 SkeletonUtils.clone
	if (hasSkinnedMesh(source)) {
		return SkeletonUtils.clone(source);
	}
	// 否则使用普通 clone
	return source.clone();
}

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

	// --- 选中对象时才显示的分割线

	const selectionDivider = new UIHorizontalRule();
	selectionDivider.dom.style.display = 'none';
	options.add(selectionDivider)

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
	//options.add(option)

	// Clone - 只在选中对象时显示

	const cloneOption = new UIRow()
	cloneOption.setClass('option')
	cloneOption.setTextContent(strings.getKey('menubar/edit/clone'))
	cloneOption.onClick(function () {
		const selectedObjects = editor.getSelectedObjects();

		if (selectedObjects.length === 0) return;

		// 记录克隆后的对象，以便最后可以全选它们
		const clonedObjects = [];

		// 克隆所有选中的对象
		for (let i = 0; i < selectedObjects.length; i++) {
			let object = selectedObjects[i];
			//console.error("objectSelected:", object)
			if (object === null || object.parent === null) continue;

			object = clone(object);
			//console.error("clonedObject: ", object)
			// 保持原始type
			if (selectedObjects[i].type) {
				object.type = selectedObjects[i].type;
			}

			// 复制animations数组（Three.js的clone()不会自动复制）
			if (selectedObjects[i].animations && selectedObjects[i].animations.length > 0) {
				object.animations = selectedObjects[i].animations.map(clip => clip.clone());
			}

			// 复制components并重新生成UUID
			if (selectedObjects[i].components) {
				object.components = JSON.parse(JSON.stringify(selectedObjects[i].components));
				// 为每个组件的选择项生成新的UUID
				object.components.forEach(component => {
					if (component.parameters && component.parameters.uuid) {
						component.parameters.uuid = THREE.MathUtils.generateUUID();
					}
					// 如果组件中包含选择项,也重新生成UUID
					if (component.parameters && component.parameters.options) {
						Object.keys(component.parameters.options).forEach(key => {
							const newUuid = THREE.MathUtils.generateUUID();
							component.parameters.options[newUuid] = component.parameters.options[key];
							delete component.parameters.options[key];
						});
					}
				});
			}

			if (selectedObjects[i].commands) {
				object.commands = JSON.parse(JSON.stringify(selectedObjects[i].commands));
				object.commands.forEach(command => {
					if (command.parameters && command.parameters.uuid) {
						command.parameters.uuid = THREE.MathUtils.generateUUID();
					}
					if (command.parameters && command.parameters.options) {
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

			cmd.execute = function () {
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
	cloneOption.dom.style.display = 'none';
	options.add(cloneOption)

	// Replace - 只在选中可替换对象时显示（放在拷贝后面）

	let selectedObjectType = '';

	const factory = new MetaFactory(editor);
	const builder = new Builder();

	// 将resources暴露到window全局对象，与Add.js中的共享
	const resources = window.resources || new Map();
	if (!window.resources) {
		window.resources = resources;
	}

	editor.signals.messageReceive.add(async function (params) {

		if (params.action === 'replace-resource') {

			const data = params.data;

			// 将资源同时保存到本地和全局资源集合
			resources.set(data.id.toString(), data);

			// 添加到editor.resources
			if (!editor.data.resources) editor.data.resources = [];

			// 更新或添加资源
			const existingIndex = editor.data.resources.findIndex(resource =>
				resource && resource.id == data.id
			);

			if (existingIndex >= 0) {
				editor.data.resources[existingIndex] = data;
			} else {
				editor.data.resources.push(data);
			}

			// 创建对象
			const raw = builder.resource(data);
			if (raw) {
				const node = await factory.building(raw, resources);
				if (node) {
					const selected = editor.selected;
					if (selected) {
						//console.log('替换前的旧对象:', selected);
						//console.log('替换用的新对象:', node);

						// 保存旧对象的所有属性
						const position = selected.position.clone();
						const rotation = selected.rotation.clone();
						const scale = selected.scale.clone();
						const parent = selected.parent;
						const uuid = selected.uuid;
						const name = selected.name;
						const visible = selected.visible;

						// 根据 selectedObjectType 有条件地保存专用属性，避免误用
						let sortingOrder = undefined;
						let loop = undefined;

						// selectedObjectType 在外层作用域已维护（'picture','audio','video' 等）
						const selType = selectedObjectType || (selected.userData && selected.userData.type ? selected.userData.type.toLowerCase() : '');

						if (selType === 'picture') {
							sortingOrder = selected.userData && typeof selected.userData.sortingOrder !== 'undefined' ? selected.userData.sortingOrder : undefined;
						}

						if (selType === 'audio' || selType === 'video') {
							loop = selected.userData && typeof selected.userData.loop !== 'undefined' ? selected.userData.loop : undefined;
						}

						const components = selected.components ? [...selected.components] : [];
						const commands = selected.commands ? [...selected.commands] : [];

						// 保存需要保留的子节点（跳过userData.hidden=true的子节点）
						const childrenToKeep = [];
						selected.children.forEach(child => {
							if (!child.userData || child.userData.hidden !== true) {
								childrenToKeep.push(child);
							}
						});

						// 删除旧对象
						editor.execute(new RemoveObjectCommand(editor, selected));

						// 应用旧对象的基本属性到新对象
						node.position.copy(position);
						node.rotation.copy(rotation);
						node.scale.copy(scale);
						node.uuid = uuid;
						node.name = name;
						node.visible = visible;

						// 恢复 picture/sound/video 专用属性到新对象的 userData（如果有）
						if (!node.userData) node.userData = {};
						if (typeof sortingOrder !== 'undefined') node.userData.sortingOrder = sortingOrder;
						if (typeof loop !== 'undefined') node.userData.loop = loop;

						node.components = components;
						node.commands = commands;

						// 将需要保留的子节点添加到新对象
						childrenToKeep.forEach(child => {
							node.add(child);
						});

						const cmd = new AddObjectCommand(editor, node);

						cmd.execute = function () {
							editor.addObject(node, parent);
							editor.select(node);
						};
						// 执行修改后的命令
						editor.execute(cmd);

						editor.showNotification(strings.getKey('menubar/replace/success'), false);
					}
				}
			}
		}
	});

	const replaceOption = new UIRow()
	replaceOption.setClass('option')
	replaceOption.setTextContent(strings.getKey('menubar/replace'))
	replaceOption.onClick(function () {
		const selected = editor.selected;
		if (selected && selectedObjectType) {
			editor.signals.messageSend.dispatch({
				action: 'replace-resource',
				data: {
					type: selectedObjectType,
					target: selected.uuid
				}
			});
		}
	})
	replaceOption.dom.style.display = 'none';
	options.add(replaceOption)

	// Delete - 只在选中对象时显示

	const deleteOption = new UIRow()
	deleteOption.setClass('option')
	deleteOption.setTextContent(strings.getKey('menubar/edit/delete'))
	deleteOption.onClick(function () {
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
	deleteOption.dom.style.display = 'none';
	options.add(deleteOption)

	// 缓存选中的对象，用于键盘快捷键
	let cachedSelectedObjects = [];

	// 监听选择状态，控制菜单项的显示/隐藏
	editor.signals.objectSelected.add(function (object) {
		selectedObjectType = '';

		// 更新缓存的选中对象
		cachedSelectedObjects = editor.getSelectedObjects();
		//console.log('Selection changed, cached objects:', cachedSelectedObjects.map(o => o ? o.name : 'null'));

		if (!object) {
			// 没有选中对象时隐藏这些菜单项和分割线
			selectionDivider.dom.style.display = 'none';
			cloneOption.dom.style.display = 'none';
			deleteOption.dom.style.display = 'none';
			replaceOption.dom.style.display = 'none';
			return;
		}

		// 有选中对象时显示分割线、拷贝和删除
		selectionDivider.dom.style.display = '';
		cloneOption.dom.style.display = '';
		deleteOption.dom.style.display = '';

		// 检查是否为可替换类型
		const isPolygen = object && (
			(object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'polygen') ||
			(object.name && object.name.toLowerCase().includes('[polygen]'))
		);

		const isVoxel = object && (
			(object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'voxel') ||
			(object.name && object.name.toLowerCase().includes('[voxel]'))
		);

		const isPicture = object && (
			(object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'picture') ||
			(object.name && object.name.toLowerCase().includes('[picture]'))
		);

		const isSound = object && (
			(object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'sound') ||
			(object.name && object.name.toLowerCase().includes('[sound]'))
		);

		const isVideo = object && (
			(object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'video') ||
			(object.name && object.name.toLowerCase().includes('[video]'))
		);

		// 设置当前选中对象类型，并显示替换选项
		if (isPolygen) {
			selectedObjectType = 'polygen';
			replaceOption.dom.style.display = '';
		} else if (isVoxel) {
			selectedObjectType = 'voxel';
			replaceOption.dom.style.display = '';
		} else if (isPicture) {
			selectedObjectType = 'picture';
			replaceOption.dom.style.display = '';
		} else if (isSound) {
			selectedObjectType = 'audio';
			replaceOption.dom.style.display = '';
		} else if (isVideo) {
			selectedObjectType = 'video';
			replaceOption.dom.style.display = '';
		} else {
			replaceOption.dom.style.display = 'none';
		}
	});

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

	// 添加键盘快捷键事件监听 - 使用捕获阶段，在焦点变化之前处理
	document.addEventListener('keydown', function (event) {
		// 检查是否在输入框中，避免干扰输入
		const activeElement = document.activeElement;
		const isInputActive = activeElement && (
			activeElement.tagName === 'INPUT' ||
			activeElement.tagName === 'TEXTAREA' ||
			activeElement.isContentEditable
		);

		// 检查是否按下Ctrl键(Windows)或Command键(Mac)
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;

		if (isCtrlOrCmd) {
			switch (event.key.toLowerCase()) {
				case 'c': // Ctrl+C
					if (!isInputActive) {
						event.preventDefault(); // 阻止默认的复制行为
						copySelected();
					}
					break;
				case 'v': // Ctrl+V
					if (!isInputActive) {
						event.preventDefault(); // 阻止默认的粘贴行为
						pasteSelected();
					}
					break;
			}
		}

		// Del 键删除 - 支持多选删除 (同时支持 Mac 的 Backspace)
		if ((event.key === 'Delete' || event.key === 'Backspace') && !isInputActive) {
			event.preventDefault();
			event.stopPropagation(); // 阻止事件继续传播

			// 在事件处理开始时立即获取缓存的选中对象
			const objectsToDeleteNow = [...cachedSelectedObjects];
			//console.log('Del/Backspace key pressed, objectsToDeleteNow:', objectsToDeleteNow.map(o => o ? o.name : 'null'));

			if (objectsToDeleteNow.length > 0) {
				// 多选删除 - 从后向前删除以避免索引问题
				for (let i = objectsToDeleteNow.length - 1; i >= 0; i--) {
					const object = objectsToDeleteNow[i];
					if (object !== null && object.parent !== null) {
						editor.execute(new RemoveObjectCommand(editor, object));
					}
				}
			}
		}
	}, true); // true = 使用捕获阶段

	// 删除选中对象功能
	function deleteSelected() {
		// 优先从 outliner 获取所有选中的对象ID
		const outlinerElement = document.getElementById('outliner');
		let objectsToDelete = [];

		// 调试日志
		// console.log('deleteSelected - editor.selectedObjects:', editor.selectedObjects.map(o => o ? o.name : 'null'));
		// console.log('deleteSelected - editor.selected:', editor.selected ? editor.selected.name : 'null');

		if (outlinerElement) {
			// 获取所有标记为 active 的选项
			const activeElements = outlinerElement.querySelectorAll('.option.active');
			//console.log('deleteSelected - activeElements count:', activeElements.length);

			for (let i = 0; i < activeElements.length; i++) {
				const objectId = parseInt(activeElements[i].value);
				//console.log('deleteSelected - Found active element with id:', objectId);
				if (!isNaN(objectId)) {
					const object = editor.scene.getObjectById(objectId);
					if (object && objectsToDelete.indexOf(object) === -1) {
						objectsToDelete.push(object);
					}
				}
			}
		}

		// 如果 DOM 查询没有结果，使用缓存的选中对象
		if (objectsToDelete.length === 0 && cachedSelectedObjects.length > 0) {
			//	console.log('deleteSelected - Using cachedSelectedObjects:', cachedSelectedObjects.map(o => o ? o.name : 'null'));
			objectsToDelete = [...cachedSelectedObjects];
		}

		// 如果缓存也没有结果，尝试使用 editor.selectedObjects
		if (objectsToDelete.length === 0) {
			//console.log('deleteSelected - Using editor.selectedObjects fallback');
			objectsToDelete = [...editor.selectedObjects];
		}

		// 如果仍然没有结果，使用 editor.selected 作为单个对象
		if (objectsToDelete.length === 0 && editor.selected) {
			//console.log('deleteSelected - Using editor.selected fallback');
			objectsToDelete = [editor.selected];
		}

		//console.log('deleteSelected - Final objectsToDelete count:', objectsToDelete.length);

		if (objectsToDelete.length > 0) {
			// 多选删除 - 从后向前删除以避免索引问题
			for (let i = objectsToDelete.length - 1; i >= 0; i--) {
				const object = objectsToDelete[i];
				if (object !== null && object.parent !== null) {
					editor.execute(new RemoveObjectCommand(editor, object));
				}
			}
		}
	}

	// 用于存储复制的对象
	let copiedObjects = [];

	// 复制功能
	function copySelected() {
		// 直接获取UI控件中的选中值，而不是editor.getSelectedObjects()
		const outliner = editor.scene.getObjectById ? null : document.getElementById('outliner');

		// 确保我们获取所有选中的对象，包括通过Shift选择的范围和缺失资源的对象
		const selectedObjects = editor.getSelectedObjects();

		//console.log("复制选中的对象：", selectedObjects);

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

		//console.log("已复制对象数量：", copiedObjects.length);
	}

	// 粘贴功能
	function pasteSelected() {
		if (copiedObjects.length === 0) return;

		// 记录新创建的对象，以便最后可以全选它们
		const newObjects = [];

		// 粘贴所有复制的对象
		for (let i = 0; i < copiedObjects.length; i++) {
			const copiedObject = copiedObjects[i];
			const object = clone(copiedObject);

			// 保持原始type
			if (copiedObject.type) {
				object.type = copiedObject.type;
			}

			// 复制animations数组（Three.js的clone()不会自动复制）
			if (copiedObject.animations && copiedObject.animations.length > 0) {
				object.animations = copiedObject.animations.map(clip => clip.clone());
			}

			// 复制components并重新生成UUID
			if (copiedObject.components) {
				object.components = JSON.parse(JSON.stringify(copiedObject.components));
				// 为每个组件的选择项生成新的UUID
				object.components.forEach(component => {
					if (component.parameters && component.parameters.uuid) {
						component.parameters.uuid = THREE.MathUtils.generateUUID();
					}
					// 如果组件中包含选择项,也重新生成UUID
					if (component.parameters && component.parameters.options) {
						Object.keys(component.parameters.options).forEach(key => {
							const newUuid = THREE.MathUtils.generateUUID();
							component.parameters.options[newUuid] = component.parameters.options[key];
							delete component.parameters.options[key];
						});
					}
				});
			}

			if (copiedObject.commands) {
				object.commands = JSON.parse(JSON.stringify(copiedObject.commands));
				object.commands.forEach(command => {
					if (command.parameters && command.parameters.uuid) {
						command.parameters.uuid = THREE.MathUtils.generateUUID();
					}
					if (command.parameters && command.parameters.options) {
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
