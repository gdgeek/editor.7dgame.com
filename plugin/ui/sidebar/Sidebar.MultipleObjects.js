import * as THREE from 'three';

import {
	UIPanel,
	UIRow,
	UIInput,
	UIButton,
	UIText,
	UINumber,
	UICheckbox
} from '../../../three.js/editor/js/libs/ui.js';

import { SetPositionCommand } from '../../../three.js/editor/js/commands/SetPositionCommand.js';
import { SetRotationCommand } from '../../../three.js/editor/js/commands/SetRotationCommand.js';
import { SetScaleCommand } from '../../../three.js/editor/js/commands/SetScaleCommand.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';
import { MultiTransformCommand } from '../../commands/MultiTransformCommand.js';
import { MultiCmdsCommand } from '../../../three.js/editor/js/commands/MultiCmdsCommand.js';
import { AddObjectCommand } from '../../../three.js/editor/js/commands/AddObjectCommand.js';
import { RemoveObjectCommand } from '../../../three.js/editor/js/commands/RemoveObjectCommand.js';
import * as SkeletonUtils from '../../../three.js/examples/jsm/utils/SkeletonUtils.js';

function SidebarMultipleObjects(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('20px');
	container.setDisplay('none');

	const styleIconButton = function (button) {
		button.dom.style.display = 'inline-flex';
		button.dom.style.alignItems = 'center';
		button.dom.style.justifyContent = 'center';
		button.dom.style.padding = '0';
	};

	const styleActionIcon = function (icon) {
		icon.style.width = '13px';
		icon.style.height = '13px';
		icon.style.display = 'block';
		icon.style.margin = '0 auto';
	};

	// 多选对象计数
	const multipleObjectsCountRow = new UIRow();
	const multipleObjectsCount = new UIText('');
	multipleObjectsCountRow.add(new UIText(strings.getKey('sidebar/multi_objects/selection_count')).setWidth('90px'));
	multipleObjectsCountRow.add(multipleObjectsCount);
	container.add(multipleObjectsCountRow);

	// 多选对象名称列表标题
	const multipleObjectsNameRow = new UIRow();
	const multipleObjectsNameInput = new UIInput('')
		.setWidth('120px')
		.setFontSize('12px');
	let hasMixedName = false;
	let isSyncingUnifiedNameInput = false;
	let unifiedNameValueOnFocus = '';

	multipleObjectsNameInput.dom.placeholder = strings.getKey('sidebar/multi_objects/name_placeholder');
	multipleObjectsNameInput.dom.addEventListener('focus', function () {
		unifiedNameValueOnFocus = multipleObjectsNameInput.getValue();
	});
	multipleObjectsNameInput.dom.addEventListener('keydown', function (event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			multipleObjectsNameInput.dom.blur();
		}
	});
	multipleObjectsNameInput.dom.addEventListener('blur', function () {
		if (isSyncingUnifiedNameInput) return;
		if (multipleObjectsNameInput.getValue() === unifiedNameValueOnFocus) return;
		applyUnifiedName();
	});

	multipleObjectsNameRow.add(new UIText(strings.getKey('sidebar/object/name')).setWidth('90px'));
	multipleObjectsNameRow.add(multipleObjectsNameInput);
	container.add(multipleObjectsNameRow);

	// 批量前后缀命名
	const prefixRenameRow = new UIRow();
	const prefixRenameInput = new UIInput('')
		.setWidth('120px')
		.setFontSize('12px');
	prefixRenameInput.dom.placeholder = strings.getKey('sidebar/multi_objects/prefix_placeholder');
	let hasMixedPrefix = false;
	let hasMixedSuffix = false;

	const suffixRenameRow = new UIRow();
	const suffixRenameInput = new UIInput('')
		.setWidth('120px')
		.setFontSize('12px');
	suffixRenameInput.dom.placeholder = strings.getKey('sidebar/multi_objects/suffix_placeholder');

	let isSyncingAffixInputs = false;
	let prefixValueOnFocus = '';
	let suffixValueOnFocus = '';

	prefixRenameInput.dom.addEventListener('keydown', function (event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			prefixRenameInput.dom.blur();
		}
	});
	prefixRenameInput.dom.addEventListener('focus', function () {
		prefixValueOnFocus = prefixRenameInput.getValue();
	});
	prefixRenameInput.dom.addEventListener('blur', function () {
		if (isSyncingAffixInputs) return;
		if (prefixRenameInput.getValue() === prefixValueOnFocus) return;
		applyAffixRename();
	});

	suffixRenameInput.dom.addEventListener('keydown', function (event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			suffixRenameInput.dom.blur();
		}
	});
	suffixRenameInput.dom.addEventListener('focus', function () {
		suffixValueOnFocus = suffixRenameInput.getValue();
	});
	suffixRenameInput.dom.addEventListener('blur', function () {
		if (isSyncingAffixInputs) return;
		if (suffixRenameInput.getValue() === suffixValueOnFocus) return;
		applyAffixRename();
	});

	prefixRenameRow.add(new UIText(strings.getKey('sidebar/multi_objects/prefix_label')).setWidth('90px'));
	prefixRenameRow.add(prefixRenameInput);
	container.add(prefixRenameRow);

	suffixRenameRow.add(new UIText(strings.getKey('sidebar/multi_objects/suffix_label')).setWidth('90px'));
	suffixRenameRow.add(suffixRenameInput);
	container.add(suffixRenameRow);

	// 拷贝和删除全部按钮行
	const cloneDeleteActionsRow = new UIRow();

	function applyUnifiedName() {
		const selectedObjects = editor.getSelectedObjects();
		if (!selectedObjects || selectedObjects.length < 2) return;

		let name = multipleObjectsNameInput.getValue();
		if (name == null) name = '';
		if (hasMixedName && name === '-') return;

		const hasAnyChange = selectedObjects.some(function (object) {
			const oldPrefix = (object.userData && typeof object.userData.namePrefix === 'string') ? object.userData.namePrefix : '';
			const oldSuffix = (object.userData && typeof object.userData.nameSuffix === 'string') ? object.userData.nameSuffix : '';
			const currentName = object.name || '';
			let baseName = currentName;

			if (oldPrefix && baseName.startsWith(oldPrefix)) {
				baseName = baseName.slice(oldPrefix.length);
			}
			if (oldSuffix && baseName.endsWith(oldSuffix)) {
				baseName = baseName.slice(0, baseName.length - oldSuffix.length);
			}

			return baseName !== name;
		});

		if (!hasAnyChange) {
			syncUnifiedNameInput(selectedObjects);
			return;
		}

		const cmds = selectedObjects.map(function (object) {
			const oldPrefix = (object.userData && typeof object.userData.namePrefix === 'string') ? object.userData.namePrefix : '';
			const oldSuffix = (object.userData && typeof object.userData.nameSuffix === 'string') ? object.userData.nameSuffix : '';
			const nextName = `${oldPrefix}${name}${oldSuffix}`;
			return new SetValueCommand(editor, object, 'name', nextName);
		});
		const cmd = new MultiCmdsCommand(editor, cmds, 'Set Unified Name', '批量统一名称');
		editor.execute(cmd);

		const message = strings.getKey('sidebar/multi_objects/name_success').replace('{0}', selectedObjects.length);
		editor.showNotification(message, false);
		syncUnifiedNameInput(selectedObjects);
	}

	function syncUnifiedNameInput(objects) {
		isSyncingUnifiedNameInput = true;
		if (!objects || objects.length === 0) {
			hasMixedName = false;
			multipleObjectsNameInput.setValue('');
			isSyncingUnifiedNameInput = false;
			return;
		}

		let firstBaseName = null;
		let isMixed = false;

		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			const oldPrefix = (object.userData && typeof object.userData.namePrefix === 'string') ? object.userData.namePrefix : '';
			const oldSuffix = (object.userData && typeof object.userData.nameSuffix === 'string') ? object.userData.nameSuffix : '';
			const currentName = object.name || '';
			let baseName = currentName;

			if (oldPrefix && baseName.startsWith(oldPrefix)) {
				baseName = baseName.slice(oldPrefix.length);
			}
			if (oldSuffix && baseName.endsWith(oldSuffix)) {
				baseName = baseName.slice(0, baseName.length - oldSuffix.length);
			}

			if (firstBaseName === null) {
				firstBaseName = baseName;
			} else if (firstBaseName !== baseName) {
				isMixed = true;
				break;
			}
		}

		hasMixedName = isMixed;
		multipleObjectsNameInput.setValue(isMixed ? '-' : (firstBaseName || ''));
		isSyncingUnifiedNameInput = false;
	}

	function applyAffixRename() {
		const selectedObjects = editor.getSelectedObjects();
		if (!selectedObjects || selectedObjects.length < 2) return;

		let prefix = prefixRenameInput.getValue();
		if (prefix == null) prefix = '';
		let suffix = suffixRenameInput.getValue();
		if (suffix == null) suffix = '';

		const keepPrefix = hasMixedPrefix && prefix === '-';
		const keepSuffix = hasMixedSuffix && suffix === '-';

		if (keepPrefix && keepSuffix) return;

		const cmds = [];
		let prefixChanged = false;
		let suffixChanged = false;
		for (let i = 0; i < selectedObjects.length; i++) {
			const object = selectedObjects[i];
			const currentName = object.name || '';
			const oldPrefix = (object.userData && typeof object.userData.namePrefix === 'string') ? object.userData.namePrefix : '';
			const oldSuffix = (object.userData && typeof object.userData.nameSuffix === 'string') ? object.userData.nameSuffix : '';

			let baseName = currentName;
			if (oldPrefix && baseName.startsWith(oldPrefix)) {
				baseName = baseName.slice(oldPrefix.length);
			}
			if (oldSuffix && baseName.endsWith(oldSuffix)) {
				baseName = baseName.slice(0, baseName.length - oldSuffix.length);
			}

			const targetPrefix = keepPrefix ? oldPrefix : prefix;
			const targetSuffix = keepSuffix ? oldSuffix : suffix;
			if (targetPrefix !== oldPrefix) prefixChanged = true;
			if (targetSuffix !== oldSuffix) suffixChanged = true;
			const nextName = `${targetPrefix}${baseName}${targetSuffix}`;
			if (nextName !== currentName) {
				cmds.push(new SetValueCommand(editor, object, 'name', nextName));
			}

			const nextUserData = Object.assign({}, object.userData || {});
			if (targetPrefix === '') {
				delete nextUserData.namePrefix;
			} else {
				nextUserData.namePrefix = targetPrefix;
			}

			if (targetSuffix === '') {
				delete nextUserData.nameSuffix;
			} else {
				nextUserData.nameSuffix = targetSuffix;
			}
			const userDataChanged =
				((object.userData && object.userData.namePrefix) || undefined) !== (nextUserData.namePrefix || undefined) ||
				((object.userData && object.userData.nameSuffix) || undefined) !== (nextUserData.nameSuffix || undefined);

			if (userDataChanged) {
				cmds.push(new SetValueCommand(editor, object, 'userData', nextUserData));
			}
		}

		if (cmds.length === 0) {
			syncAffixInputs(selectedObjects);
			return;
		}

		const cmd = new MultiCmdsCommand(editor, cmds, 'Set Name Affix', '批量设置前后缀');
		editor.execute(cmd);

		let messageKey = 'sidebar/multi_objects/affix_success';
		if (prefixChanged && !suffixChanged) {
			messageKey = prefix === '' ? 'sidebar/multi_objects/prefix_removed' : 'sidebar/multi_objects/prefix_success';
		} else if (!prefixChanged && suffixChanged) {
			messageKey = suffix === '' ? 'sidebar/multi_objects/suffix_removed' : 'sidebar/multi_objects/suffix_success';
		} else if (prefixChanged && suffixChanged) {
			messageKey = 'sidebar/multi_objects/affix_success';
		}
		const message = strings.getKey(messageKey).replace('{0}', selectedObjects.length);
		editor.showNotification(message, false);
		syncAffixInputs(selectedObjects);
	}

	function syncAffixInputs(objects) {
		isSyncingAffixInputs = true;
		if (!objects || objects.length === 0) {
			hasMixedPrefix = false;
			hasMixedSuffix = false;
			prefixRenameInput.setValue('');
			suffixRenameInput.setValue('');
			isSyncingAffixInputs = false;
			return;
		}

		let firstPrefix = null;
		let firstSuffix = null;
		let isMixedPrefix = false;
		let isMixedSuffix = false;

		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			const prefix = (object.userData && typeof object.userData.namePrefix === 'string') ? object.userData.namePrefix : '';
			const suffix = (object.userData && typeof object.userData.nameSuffix === 'string') ? object.userData.nameSuffix : '';
			if (firstPrefix === null) {
				firstPrefix = prefix;
			} else if (firstPrefix !== prefix) {
				isMixedPrefix = true;
			}

			if (firstSuffix === null) {
				firstSuffix = suffix;
			} else if (firstSuffix !== suffix) {
				isMixedSuffix = true;
			}
		}

		hasMixedPrefix = isMixedPrefix;
		hasMixedSuffix = isMixedSuffix;
		prefixRenameInput.setValue(isMixedPrefix ? '-' : (firstPrefix || ''));
		suffixRenameInput.setValue(isMixedSuffix ? '-' : (firstSuffix || ''));
		isSyncingAffixInputs = false;
	}

	// 检查对象或其子对象是否包含 SkinnedMesh
	function hasSkinnedMesh(object) {
		let found = false;
		object.traverse((child) => {
			if (child.isSkinnedMesh) {
				found = true;
			}
		});
		return found;
	}

	// 深度克隆对象，正确处理 SkinnedMesh 和骨骼
	function cloneObject(source) {
		if (hasSkinnedMesh(source)) {
			return SkeletonUtils.clone(source);
		}
		return source.clone();
	}

	// 拷贝全部按钮
	const cloneAllButton = new UIButton(strings.getKey('sidebar/multi_objects/clone_all'))
		.setWidth('80px')
		.onClick(function () {
			const selectedObjects = editor.getSelectedObjects();
			if (selectedObjects.length === 0) return;

			const objectsToCopy = [...selectedObjects];
			const clonedObjects = [];

			for (let i = 0; i < objectsToCopy.length; i++) {
				let object = objectsToCopy[i];
				if (object === null || object.parent === null) continue;

				const clonedObject = cloneObject(object);

				// 保持原始type
				if (object.type) {
					clonedObject.type = object.type;
				}

				// 复制animations数组
				if (object.animations && object.animations.length > 0) {
					clonedObject.animations = object.animations.map(clip => clip.clone());
				}

				// 复制components并重新生成UUID
				if (object.components) {
					/**
					 * MRPP 扩展属性：组件数组，附加在 THREE.Object3D 实例上。
					 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
					 * @type {Array<{type: string, [key: string]: any}>}
					 */
					clonedObject.components = JSON.parse(JSON.stringify(object.components));
					clonedObject.components.forEach(component => {
						if (component.parameters && component.parameters.uuid) {
							component.parameters.uuid = THREE.MathUtils.generateUUID();
						}
					});
				}

				// 复制commands并重新生成UUID
				if (object.commands) {
					/**
					 * MRPP 扩展属性：命令数组，附加在 THREE.Object3D 实例上。
					 * 不属于 three.js 原生类型定义，迁移时需要声明扩展类型。
					 * @type {Array<{type: string, [key: string]: any}>}
					 */
					clonedObject.commands = JSON.parse(JSON.stringify(object.commands));
					clonedObject.commands.forEach(command => {
						if (command.parameters && command.parameters.uuid) {
							command.parameters.uuid = THREE.MathUtils.generateUUID();
						}
					});
				}

				const parent = object.parent;
				const cmd = new AddObjectCommand(editor, clonedObject);
				cmd.execute = function () {
					editor.addObject(clonedObject, parent);
					clonedObjects.push(clonedObject);

					if (clonedObjects.length === objectsToCopy.length) {
						editor.clearSelection();
						editor.select(clonedObjects[0]);
						for (let j = 1; j < clonedObjects.length; j++) {
							editor.select(clonedObjects[j], true);
						}
					}
				};
				editor.execute(cmd);
			}

			editor.showNotification(strings.getKey('sidebar/multi_objects/clone_success'));
		});

	// 删除全部按钮
	const deleteAllButton = new UIButton(strings.getKey('sidebar/multi_objects/delete_all'))
		.setWidth('80px')
		.onClick(function () {
			const selectedObjects = editor.getSelectedObjects();
			if (selectedObjects.length === 0) return;

			const objectsToDelete = [...selectedObjects];
			for (let i = objectsToDelete.length - 1; i >= 0; i--) {
				const object = objectsToDelete[i];
				if (object !== null && object.parent !== null) {
					editor.execute(new RemoveObjectCommand(editor, object));
				}
			}

			editor.showNotification(strings.getKey('sidebar/multi_objects/delete_success'));
		});

	cloneDeleteActionsRow.add(cloneAllButton);
	cloneDeleteActionsRow.add(deleteAllButton);
	container.add(cloneDeleteActionsRow);

	// 分割线
	const separator = new UIPanel();
	separator.setHeight('6px');
	container.add(separator);

	// 存储拖动状态的变量
	let isDragging = false;
	let dragCommand = null;
	let dragStartPositions = {};
	let dragStartRotations = {};
	let dragStartScales = {};
	let dragStartGroupTransform = {
		position: null,
		rotation: null,
		scale: null
	};
	let isApplyingTransformFromPanel = false;

	// 拖动开始时的处理函数
	function onDragStart() {
		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		// 只有在有选中对象和多选组时才处理
		if (objects.length === 0 || !multiSelectGroup) return;

		// 标记开始拖动
		isDragging = true;

		// 存储开始拖动时的状态
		dragStartPositions = {};
		dragStartRotations = {};
		dragStartScales = {};

		// 记录每个对象的初始变换
		objects.forEach(object => {
			dragStartPositions[object.id] = object.position.clone();
			dragStartRotations[object.id] = object.rotation.clone();
			dragStartScales[object.id] = object.scale.clone();
		});

		// 记录多选组的初始变换
		dragStartGroupTransform = {
			position: multiSelectGroup.position.clone(),
			rotation: multiSelectGroup.rotation.clone(),
			scale: multiSelectGroup.scale.clone()
		};
	}

	// 拖动结束时的处理函数
	function onDragEnd() {
		if (!isDragging) return;

		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		// 只有在拖动状态且有选中对象时才处理
		if (objects.length === 0 || !multiSelectGroup) {
			isDragging = false;
			return;
		}

		// 创建命令来记录整个拖动过程
		const multiCommand = new MultiTransformCommand(editor, objects);

		// 手动设置命令的初始和最终状态
		objects.forEach(object => {
			if (dragStartPositions[object.id]) {
				multiCommand.oldPositions[object.id] = dragStartPositions[object.id];
				multiCommand.newPositions[object.id] = object.position.clone();
			}
			if (dragStartRotations[object.id]) {
				multiCommand.oldRotations[object.id] = dragStartRotations[object.id];
				multiCommand.newRotations[object.id] = object.rotation.clone();
			}
			if (dragStartScales[object.id]) {
				multiCommand.oldScales[object.id] = dragStartScales[object.id];
				multiCommand.newScales[object.id] = object.scale.clone();
			}
		});

		// 设置多选组的状态
		multiCommand.oldGroupPosition = dragStartGroupTransform.position;
		multiCommand.oldGroupRotation = dragStartGroupTransform.rotation;
		multiCommand.oldGroupScale = dragStartGroupTransform.scale;

		multiCommand.newGroupPosition = multiSelectGroup.position.clone();
		multiCommand.newGroupRotation = multiSelectGroup.rotation.clone();
		multiCommand.newGroupScale = multiSelectGroup.scale.clone();

		// 执行命令
		editor.execute(multiCommand);

		// 重置拖动状态
		isDragging = false;
		dragCommand = null;
	}

	// 位置
	const multipleObjectsPositionRow = new UIRow();
	const multipleObjectsPositionX = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updatePosition);
	multipleObjectsPositionX.dom.classList.add('axis-x'); // X轴 - 红色

	const multipleObjectsPositionY = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updatePosition);
	multipleObjectsPositionY.dom.classList.add('axis-y'); // Y轴 - 绿色

	const multipleObjectsPositionZ = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updatePosition);
	multipleObjectsPositionZ.dom.classList.add('axis-z'); // Z轴 - 蓝色

	// 添加拖动事件监听
	multipleObjectsPositionX.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsPositionX.dom.addEventListener('mouseup', onDragEnd);
	multipleObjectsPositionY.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsPositionY.dom.addEventListener('mouseup', onDragEnd);
	multipleObjectsPositionZ.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsPositionZ.dom.addEventListener('mouseup', onDragEnd);

	// 全局鼠标抬起事件，确保捕获在输入框外释放鼠标的情况
	document.addEventListener('mouseup', onDragEnd);

	multipleObjectsPositionRow.add(new UIText(strings.getKey('sidebar/object/position')).setWidth('90px'));
	multipleObjectsPositionRow.add(multipleObjectsPositionX, multipleObjectsPositionY, multipleObjectsPositionZ);

	// 添加位置复制粘贴按钮
	const positionCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const position = new THREE.Vector3(
				multipleObjectsPositionX.getValue(),
				multipleObjectsPositionY.getValue(),
				multipleObjectsPositionZ.getValue()
			);

			// 将位置数据保存到剪贴板
			localStorage.setItem('multipleObjectsPosition', JSON.stringify({
				x: position.x,
				y: position.y,
				z: position.z
			}));

			editor.showNotification(strings.getKey('sidebar/multi_objects/copy_position_success'));
		});

	styleIconButton(positionCopyButton);

	// 添加复制图标
	const positionCopyIcon = document.createElement('img');
	positionCopyIcon.src = 'images/copy.png';
	styleActionIcon(positionCopyIcon);
	positionCopyButton.dom.appendChild(positionCopyIcon);
	positionCopyButton.dom.title = strings.getKey('sidebar/multi_objects/copy_position');

	const positionPasteButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const positionData = localStorage.getItem('multipleObjectsPosition');
			if (positionData) {
				try {
					const position = JSON.parse(positionData);
					multipleObjectsPositionX.setValue(position.x);
					multipleObjectsPositionY.setValue(position.y);
					multipleObjectsPositionZ.setValue(position.z);
					updatePosition();
					editor.showNotification(strings.getKey('sidebar/multi_objects/paste_position_success'));
				} catch (e) {
					console.error('无法粘贴位置数据', e);
				}
			}
		});

	styleIconButton(positionPasteButton);

	// 添加粘贴图标
	const positionPasteIcon = document.createElement('img');
	positionPasteIcon.src = 'images/paste.png';
	styleActionIcon(positionPasteIcon);
	positionPasteButton.dom.appendChild(positionPasteIcon);
	positionPasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_position');

	// 默认隐藏复制粘贴按钮
	positionCopyButton.dom.style.display = 'none';
	positionPasteButton.dom.style.display = 'none';

	// 添加鼠标悬停事件
	multipleObjectsPositionRow.dom.addEventListener('mouseenter', function () {
		positionCopyButton.dom.style.display = 'inline-flex';
		positionPasteButton.dom.style.display = 'inline-flex';
	});
	multipleObjectsPositionRow.dom.addEventListener('mouseleave', function () {
		positionCopyButton.dom.style.display = 'none';
		positionPasteButton.dom.style.display = 'none';
	});

	multipleObjectsPositionRow.add(positionCopyButton);
	multipleObjectsPositionRow.add(positionPasteButton);

	container.add(multipleObjectsPositionRow);

	// 旋转
	const multipleObjectsRotationRow = new UIRow();
	const multipleObjectsRotationX = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updateRotation);
	multipleObjectsRotationX.dom.classList.add('axis-x'); // X轴 - 红色

	const multipleObjectsRotationY = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updateRotation);
	multipleObjectsRotationY.dom.classList.add('axis-y'); // Y轴 - 绿色

	const multipleObjectsRotationZ = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updateRotation);
	multipleObjectsRotationZ.dom.classList.add('axis-z'); // Z轴 - 蓝色

	// 添加拖动事件监听
	multipleObjectsRotationX.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsRotationX.dom.addEventListener('mouseup', onDragEnd);
	multipleObjectsRotationY.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsRotationY.dom.addEventListener('mouseup', onDragEnd);
	multipleObjectsRotationZ.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsRotationZ.dom.addEventListener('mouseup', onDragEnd);

	multipleObjectsRotationRow.add(new UIText(strings.getKey('sidebar/object/rotation')).setWidth('90px'));
	multipleObjectsRotationRow.add(multipleObjectsRotationX, multipleObjectsRotationY, multipleObjectsRotationZ);

	// 添加旋转复制粘贴按钮
	const rotationCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const rotation = new THREE.Vector3(
				multipleObjectsRotationX.getValue(),
				multipleObjectsRotationY.getValue(),
				multipleObjectsRotationZ.getValue()
			);

			// 将旋转数据保存到剪贴板
			localStorage.setItem('multipleObjectsRotation', JSON.stringify({
				x: rotation.x,
				y: rotation.y,
				z: rotation.z
			}));

			editor.showNotification(strings.getKey('sidebar/multi_objects/copy_rotation_success'));
		});

	styleIconButton(rotationCopyButton);

	// 添加复制图标
	const rotationCopyIcon = document.createElement('img');
	rotationCopyIcon.src = 'images/copy.png';
	styleActionIcon(rotationCopyIcon);
	rotationCopyButton.dom.appendChild(rotationCopyIcon);
	rotationCopyButton.dom.title = strings.getKey('sidebar/multi_objects/copy_rotation');

	const rotationPasteButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const rotationData = localStorage.getItem('multipleObjectsRotation');
			if (rotationData) {
				try {
					const rotation = JSON.parse(rotationData);
					multipleObjectsRotationX.setValue(rotation.x);
					multipleObjectsRotationY.setValue(rotation.y);
					multipleObjectsRotationZ.setValue(rotation.z);
					updateRotation();
					editor.showNotification(strings.getKey('sidebar/multi_objects/paste_rotation_success'));
				} catch (e) {
					console.error('无法粘贴旋转数据', e);
				}
			}
		});

	styleIconButton(rotationPasteButton);

	// 添加粘贴图标
	const rotationPasteIcon = document.createElement('img');
	rotationPasteIcon.src = 'images/paste.png';
	styleActionIcon(rotationPasteIcon);
	rotationPasteButton.dom.appendChild(rotationPasteIcon);
	rotationPasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_rotation');

	// 默认隐藏复制粘贴按钮
	rotationCopyButton.dom.style.display = 'none';
	rotationPasteButton.dom.style.display = 'none';

	// 添加鼠标悬停事件
	multipleObjectsRotationRow.dom.addEventListener('mouseenter', function () {
		rotationCopyButton.dom.style.display = 'inline-flex';
		rotationPasteButton.dom.style.display = 'inline-flex';
	});
	multipleObjectsRotationRow.dom.addEventListener('mouseleave', function () {
		rotationCopyButton.dom.style.display = 'none';
		rotationPasteButton.dom.style.display = 'none';
	});

	multipleObjectsRotationRow.add(rotationCopyButton);
	multipleObjectsRotationRow.add(rotationPasteButton);

	container.add(multipleObjectsRotationRow);

	// 缩放
	const multipleObjectsScaleRow = new UIRow();
	const multipleObjectsScaleX = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.setValue(1)
		.onChange(updateScale);
	multipleObjectsScaleX.dom.classList.add('axis-x'); // X轴 - 红色

	const multipleObjectsScaleY = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.setValue(1)
		.onChange(updateScale);
	multipleObjectsScaleY.dom.classList.add('axis-y'); // Y轴 - 绿色

	const multipleObjectsScaleZ = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.setValue(1)
		.onChange(updateScale);
	multipleObjectsScaleZ.dom.classList.add('axis-z'); // Z轴 - 蓝色

	// 添加拖动事件监听
	multipleObjectsScaleX.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsScaleX.dom.addEventListener('mouseup', onDragEnd);
	multipleObjectsScaleY.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsScaleY.dom.addEventListener('mouseup', onDragEnd);
	multipleObjectsScaleZ.dom.addEventListener('mousedown', onDragStart);
	multipleObjectsScaleZ.dom.addEventListener('mouseup', onDragEnd);

	multipleObjectsScaleRow.add(new UIText(strings.getKey('sidebar/object/scale')).setWidth('90px'));
	multipleObjectsScaleRow.add(multipleObjectsScaleX, multipleObjectsScaleY, multipleObjectsScaleZ);

	// 添加缩放复制粘贴按钮
	const scaleCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const scale = new THREE.Vector3(
				multipleObjectsScaleX.getValue(),
				multipleObjectsScaleY.getValue(),
				multipleObjectsScaleZ.getValue()
			);

			// 将缩放数据保存到剪贴板
			localStorage.setItem('multipleObjectsScale', JSON.stringify({
				x: scale.x,
				y: scale.y,
				z: scale.z
			}));

			editor.showNotification(strings.getKey('sidebar/multi_objects/copy_scale_success'));
		});

	styleIconButton(scaleCopyButton);

	// 添加复制图标
	const scaleCopyIcon = document.createElement('img');
	scaleCopyIcon.src = 'images/copy.png';
	styleActionIcon(scaleCopyIcon);
	scaleCopyButton.dom.appendChild(scaleCopyIcon);
	scaleCopyButton.dom.title = strings.getKey('sidebar/multi_objects/copy_scale');

	const scalePasteButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const scaleData = localStorage.getItem('multipleObjectsScale');
			if (scaleData) {
				try {
					const scale = JSON.parse(scaleData);
					multipleObjectsScaleX.setValue(scale.x);
					multipleObjectsScaleY.setValue(scale.y);
					multipleObjectsScaleZ.setValue(scale.z);
					updateScale();
					editor.showNotification(strings.getKey('sidebar/multi_objects/paste_scale_success'));
				} catch (e) {
					console.error('无法粘贴缩放数据', e);
				}
			}
		});

	styleIconButton(scalePasteButton);

	// 添加粘贴图标
	const scalePasteIcon = document.createElement('img');
	scalePasteIcon.src = 'images/paste.png';
	styleActionIcon(scalePasteIcon);
	scalePasteButton.dom.appendChild(scalePasteIcon);
	scalePasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_scale');

	// 默认隐藏复制粘贴按钮
	scaleCopyButton.dom.style.display = 'none';
	scalePasteButton.dom.style.display = 'none';

	// 添加鼠标悬停事件
	multipleObjectsScaleRow.dom.addEventListener('mouseenter', function () {
		scaleCopyButton.dom.style.display = 'inline-flex';
		scalePasteButton.dom.style.display = 'inline-flex';
	});
	multipleObjectsScaleRow.dom.addEventListener('mouseleave', function () {
		scaleCopyButton.dom.style.display = 'none';
		scalePasteButton.dom.style.display = 'none';
	});

	multipleObjectsScaleRow.add(scaleCopyButton);
	multipleObjectsScaleRow.add(scalePasteButton);
	multipleObjectsScaleRow.setMarginBottom('8px');

	container.add(multipleObjectsScaleRow);

	// 辅助功能按钮
	const multipleObjectsActionsRow = new UIRow();

	// 归零位置按钮
	const resetPositionButton = new UIButton(strings.getKey('sidebar/object/resetPosition'))
		.setWidth('80px')
		.onClick(function () {
			const selectedObjects = editor.getSelectedObjects();
			const cmds = selectedObjects.map(obj => {
				return new SetPositionCommand(editor, obj, new THREE.Vector3(0, 0, 0));
			});
			const cmd = new MultiCmdsCommand(editor, cmds, 'Reset Position', '重置位置');
			editor.execute(cmd);
			editor.showNotification(strings.getKey('sidebar/multi_objects/reset_position_success'));
		});

	// 重置旋转按钮
	const resetRotationButton = new UIButton(strings.getKey('sidebar/object/resetRotation'))
		.setWidth('80px')
		.onClick(function () {
			const selectedObjects = editor.getSelectedObjects();
			const cmds = selectedObjects.map(obj => {
				return new SetRotationCommand(editor, obj, new THREE.Euler(0, 0, 0));
			});
			const cmd = new MultiCmdsCommand(editor, cmds, 'Reset Rotation', '重置旋转');
			editor.execute(cmd);
			editor.showNotification(strings.getKey('sidebar/multi_objects/reset_rotation_success'));
		});

	// 重置缩放按钮
	const resetScaleButton = new UIButton(strings.getKey('sidebar/object/resetScale'))
		.setWidth('80px')
		.onClick(function () {
			const selectedObjects = editor.getSelectedObjects();
			const cmds = selectedObjects.map(obj => {
				return new SetScaleCommand(editor, obj, new THREE.Vector3(1, 1, 1));
			});
			const cmd = new MultiCmdsCommand(editor, cmds, 'Reset Scale', '重置缩放');
			editor.execute(cmd);
			editor.showNotification(strings.getKey('sidebar/multi_objects/reset_scale_success'));
		});

	multipleObjectsActionsRow.add(resetPositionButton);
	multipleObjectsActionsRow.add(resetRotationButton);
	multipleObjectsActionsRow.add(resetScaleButton);

	container.add(multipleObjectsActionsRow);

	// 在这里添加可见性模块，位于重置按钮组后面
	const multipleObjectsVisibleRow = new UIRow();
	const multipleObjectsVisible = new UICheckbox().onChange(updateVisibility);

	multipleObjectsVisibleRow.add(
		new UIText(strings.getKey('sidebar/object/visible')).setWidth('90px')
	);
	multipleObjectsVisibleRow.add(multipleObjectsVisible);

	container.add(multipleObjectsVisibleRow);

	// 添加全部变换数据的复制粘贴行
	const transformActionsRow = new UIRow();

	// 全部变换数据复制按钮
	const transformCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function () {
			const positionData = new THREE.Vector3(
				multipleObjectsPositionX.getValue(),
				multipleObjectsPositionY.getValue(),
				multipleObjectsPositionZ.getValue()
			);
			const rotationData = new THREE.Vector3(
				multipleObjectsRotationX.getValue(),
				multipleObjectsRotationY.getValue(),
				multipleObjectsRotationZ.getValue()
			);
			const scaleData = new THREE.Vector3(
				multipleObjectsScaleX.getValue(),
				multipleObjectsScaleY.getValue(),
				multipleObjectsScaleZ.getValue()
			);

			// 更新全局剪贴板
			localStorage.setItem('multipleObjectsTransform', JSON.stringify({
				position: {
					x: positionData.x,
					y: positionData.y,
					z: positionData.z
				},
				rotation: {
					x: rotationData.x,
					y: rotationData.y,
					z: rotationData.z
				},
				scale: {
					x: scaleData.x,
					y: scaleData.y,
					z: scaleData.z
				}
			}));

			editor.showNotification(strings.getKey('sidebar/multi_objects/copy_transform_success'));
		});

	transformCopyButton.dom.title = strings.getKey('sidebar/multi_objects/copy_transform');
	styleIconButton(transformCopyButton);

	// 添加复制图标
	const transformCopyIcon = document.createElement('img');
	transformCopyIcon.src = 'images/copy.png';
	styleActionIcon(transformCopyIcon);
	transformCopyButton.dom.appendChild(transformCopyIcon);

	// 全部变换数据粘贴按钮
	const transformPasteButton = new UIButton('')
		.setMarginLeft('2px')
		.setWidth('24px')
		.onClick(function () {
			const transformData = localStorage.getItem('multipleObjectsTransform');
			if (transformData) {
				try {
					const data = JSON.parse(transformData);

					if (data.position) {
						multipleObjectsPositionX.setValue(data.position.x);
						multipleObjectsPositionY.setValue(data.position.y);
						multipleObjectsPositionZ.setValue(data.position.z);
						updatePosition();
					}

					if (data.rotation) {
						multipleObjectsRotationX.setValue(data.rotation.x);
						multipleObjectsRotationY.setValue(data.rotation.y);
						multipleObjectsRotationZ.setValue(data.rotation.z);
						updateRotation();
					}

					if (data.scale) {
						multipleObjectsScaleX.setValue(data.scale.x);
						multipleObjectsScaleY.setValue(data.scale.y);
						multipleObjectsScaleZ.setValue(data.scale.z);
						updateScale();
					}

					editor.showNotification(strings.getKey('sidebar/multi_objects/paste_transform_success'));
				} catch (e) {
					console.error('无法粘贴变换数据', e);
				}
			}
		});

	transformPasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_transform');
	styleIconButton(transformPasteButton);

	// 添加粘贴图标
	const transformPasteIcon = document.createElement('img');
	transformPasteIcon.src = 'images/paste.png';
	styleActionIcon(transformPasteIcon);
	transformPasteButton.dom.appendChild(transformPasteIcon);

	transformActionsRow.add(transformCopyButton);
	transformActionsRow.add(transformPasteButton);

	// 默认隐藏全局复制粘贴按钮行
	transformActionsRow.setDisplay('none');

	container.add(transformActionsRow);

	// 创建变换组边框div
	const createTransformBorder = function () {
		// 移除旧的边框（如果存在）
		const oldBorder = container.dom.querySelector('.transform-border');
		if (oldBorder) {
			container.dom.removeChild(oldBorder);
		}

		// 创建新的边框
		const transformBorder = document.createElement('div');
		transformBorder.className = 'transform-border';
		transformBorder.style.position = 'absolute';
		transformBorder.style.border = '1px dashed #888';
		transformBorder.style.borderRadius = '4px';
		transformBorder.style.pointerEvents = 'none';
		transformBorder.style.display = 'none';
		transformBorder.style.zIndex = '0';
		container.dom.appendChild(transformBorder);

		return transformBorder;
	};

	// 创建并获取边框元素
	let transformBorder = createTransformBorder();

	// 更新边框位置和大小
	const updateBorderPosition = function () {
		if (!multipleObjectsPositionRow.dom || !multipleObjectsScaleRow.dom) return;

		// 计算数据区域的位置（标签宽度是90px）
		const labelWidth = 90;
		const paddingLeft = 5;

		// 获取数据区域的左边界（标签宽度+一些padding）
		const dataAreaLeft = labelWidth + paddingLeft;

		// 获取位置行的输入框区域
		const posInputX = multipleObjectsPositionX.dom;
		const posInputZ = multipleObjectsPositionZ.dom;
		const scaleInputZ = multipleObjectsScaleZ.dom;

		// 计算数据区域的顶部和底部位置
		const posRowTop = multipleObjectsPositionRow.dom.offsetTop;
		const scaleRowBottom = multipleObjectsScaleRow.dom.offsetTop + multipleObjectsScaleRow.dom.offsetHeight;

		// 计算数据区域的宽度（从第一个输入框到最后一个输入框，不包括单属性复制按钮的宽度）
		// 排除单一属性复制粘贴按钮的宽度(约52px)
		const dataAreaWidth = posInputZ.offsetLeft + posInputZ.offsetWidth - posInputX.offsetLeft;

		// 设置边框位置和大小，只包围数据区域（不包括单一属性复制粘贴按钮）
		transformBorder.style.top = (posRowTop - 5) + 'px';
		transformBorder.style.left = dataAreaLeft + 'px';
		transformBorder.style.width = dataAreaWidth + 'px';
		transformBorder.style.height = (scaleRowBottom - posRowTop + 10) + 'px';

		// 获取辅助功能按钮行的位置
		const actionsRowBottom = multipleObjectsActionsRow.dom.offsetTop;

		// 更新按钮位置，放在数据区域的下方并水平居中
		const buttonWidth = transformCopyButton.dom.offsetWidth + transformPasteButton.dom.offsetWidth + 2; // +2是按钮间距
		const buttonLeft = dataAreaLeft + (dataAreaWidth - buttonWidth) / 2;

		transformActionsRow.dom.style.position = 'absolute';
		transformActionsRow.dom.style.left = buttonLeft + 'px';
		// 放在变换区域下方
		const buttonTop = scaleRowBottom + 5;

		// 统一放在下方，与Sidebar.Object.js保持一致
		transformActionsRow.dom.style.top = buttonTop + 'px';
	};

	// 创建空白间隙行
	let spacerRow = null;

	// 创建或获取间隙行
	const getSpacerRow = function () {
		if (!spacerRow) {
			spacerRow = new UIPanel();
			spacerRow.setDisplay('none');
			spacerRow.dom.style.border = 'none';
			spacerRow.dom.style.marginTop = '0';
			spacerRow.dom.style.marginBottom = '0';
			spacerRow.dom.style.height = '14px';
			container.dom.insertBefore(spacerRow.dom, multipleObjectsActionsRow.dom);
		}
		return spacerRow;
	};

	// 显示变换操作和边框
	const showTransformActions = function () {
		transformActionsRow.setDisplay('');
		transformBorder.style.display = 'block';
		updateBorderPosition();

		// 显示间隙空白行
		getSpacerRow().setDisplay('');
	};

	// 隐藏变换操作和边框
	const hideTransformActions = function () {
		transformActionsRow.setDisplay('none');
		transformBorder.style.display = 'none';

		// 隐藏间隙空白行
		if (spacerRow) {
			spacerRow.setDisplay('none');
		}
	};

	// 存储事件监听器引用，以便稍后移除
	const eventListeners = [];

	// 移除所有事件监听器
	const removeAllEventListeners = function () {
		for (const listener of eventListeners) {
			listener.element.removeEventListener(listener.type, listener.callback);
		}
		eventListeners.length = 0;
	};

	// 添加事件监听器并保存引用
	const addEventListenerWithRef = function (element, type, callback) {
		element.addEventListener(type, callback);
		eventListeners.push({
			element: element,
			type: type,
			callback: callback
		});
	};

	// 创建一个透明的悬停区域覆盖三个变换行的数据区域
	const createHoverArea = function () {
		// 移除旧的悬停区域（如果存在）
		const oldHoverArea = container.dom.querySelector('.transform-hover-area');
		if (oldHoverArea) {
			container.dom.removeChild(oldHoverArea);
		}

		// 移除所有旧的事件监听器
		removeAllEventListeners();

		if (!multipleObjectsPositionRow.dom || !multipleObjectsScaleRow.dom) return;

		// 计算数据区域的位置信息（用于检测鼠标是否在数据区域）
		const labelWidth = 90;
		const paddingLeft = 5;
		const dataAreaLeft = labelWidth + paddingLeft;
		const posInputX = multipleObjectsPositionX.dom;
		const posInputZ = multipleObjectsPositionZ.dom;
		const dataAreaWidth = posInputZ.offsetLeft + posInputZ.offsetWidth - posInputX.offsetLeft;

		// 用于跟踪鼠标是否在相关区域内
		let isMouseInRelevantArea = false;

		// 检查鼠标是否要隐藏工具栏的定时器
		let hideTimeout = null;

		// 安全地显示变换操作和边框
		const safeShowTransformActions = function () {
			// 清除任何正在等待的隐藏定时器
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				hideTimeout = null;
			}

			isMouseInRelevantArea = true;
			showTransformActions();
		};

		// 安全地隐藏变换操作和边框，带延迟
		const safeHideTransformActions = function () {
			// 清除任何正在等待的隐藏定时器
			if (hideTimeout) {
				clearTimeout(hideTimeout);
			}

			// 设置一个短暂的延迟，给鼠标时间移动到按钮上
			hideTimeout = setTimeout(function () {
				if (!isMouseInRelevantArea) {
					hideTransformActions();
				}
				hideTimeout = null;
			}, 200);
		};

		// 检查鼠标是否在按钮区域
		const isInButtonArea = function (event) {
			const rect = transformActionsRow.dom.getBoundingClientRect();
			return (
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom
			);
		};

		// 创建一个覆盖整个变换数据区域的透明层（包括行与行之间的间隙）
		const transformAreaOverlay = document.createElement('div');
		transformAreaOverlay.className = 'transform-area-overlay';
		transformAreaOverlay.style.position = 'absolute';
		transformAreaOverlay.style.top = (multipleObjectsPositionRow.dom.offsetTop - 5) + 'px';
		transformAreaOverlay.style.left = dataAreaLeft + 'px';
		transformAreaOverlay.style.width = dataAreaWidth + 'px';
		transformAreaOverlay.style.height = (multipleObjectsScaleRow.dom.offsetTop + multipleObjectsScaleRow.dom.offsetHeight - multipleObjectsPositionRow.dom.offsetTop + 10) + 'px';
		transformAreaOverlay.style.zIndex = '1';
		transformAreaOverlay.style.pointerEvents = 'none'; // 不要阻止下层元素的事件

		container.dom.appendChild(transformAreaOverlay);

		// 全局鼠标移动事件
		const handleGlobalMouseMove = function (event) {
			// 计算鼠标是否在变换数据区域内
			const overlayRect = transformAreaOverlay.getBoundingClientRect();
			const inOverlayArea = (
				event.clientX >= overlayRect.left &&
				event.clientX <= overlayRect.right &&
				event.clientY >= overlayRect.top &&
				event.clientY <= overlayRect.bottom
			);

			const inButtonArea = isInButtonArea(event);

			// 更新状态
			isMouseInRelevantArea = inOverlayArea || inButtonArea ||
				transformActionsRow.dom.contains(event.target) ||
				transformCopyButton.dom.contains(event.target) ||
				transformPasteButton.dom.contains(event.target);

			// 根据鼠标位置决定显示或隐藏
			if (isMouseInRelevantArea) {
				safeShowTransformActions();
			} else if (transformActionsRow.dom.style.display !== 'none') {
				safeHideTransformActions();
			}
		};

		// 为document添加鼠标移动事件
		addEventListenerWithRef(document, 'mousemove', handleGlobalMouseMove);

		// 为复制粘贴按钮添加单独的鼠标事件
		addEventListenerWithRef(transformCopyButton.dom, 'mouseenter', function () {
			isMouseInRelevantArea = true;
			safeShowTransformActions();
		});

		addEventListenerWithRef(transformPasteButton.dom, 'mouseenter', function () {
			isMouseInRelevantArea = true;
			safeShowTransformActions();
		});

		// 为按钮行添加事件
		addEventListenerWithRef(transformActionsRow.dom, 'mouseenter', function () {
			isMouseInRelevantArea = true;
			safeShowTransformActions();
		});

		// 在document上添加全局点击事件，用于处理点击按钮后的状态
		addEventListenerWithRef(document, 'click', function (event) {
			if (transformCopyButton.dom.contains(event.target) || transformPasteButton.dom.contains(event.target)) {
				// 如果点击的是复制或粘贴按钮，保持显示一小段时间后隐藏
				setTimeout(function () {
					isMouseInRelevantArea = false;
					hideTransformActions();
				}, 200);
			}
		});
	};

	// 更新函数
	function updatePosition() {
		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		if (!multiSelectGroup) return; // Should exist if we are here?

		const valX = multipleObjectsPositionX.getValue();
		const valY = multipleObjectsPositionY.getValue();
		const valZ = multipleObjectsPositionZ.getValue();

		const oldPositions = {};
		let hasPositionChange = false;
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			oldPositions[object.id] = object.position.clone();

			if (valX !== null && object.position.x !== valX) {
				object.position.x = valX;
				hasPositionChange = true;
			}
			if (valY !== null && object.position.y !== valY) {
				object.position.y = valY;
				hasPositionChange = true;
			}
			if (valZ !== null && object.position.z !== valZ) {
				object.position.z = valZ;
				hasPositionChange = true;
			}

			object.updateMatrixWorld(true);
		}

		if (hasPositionChange === false) return;

		const oldGroupPosition = multiSelectGroup.position.clone();

		if (valX !== null) multiSelectGroup.position.x = valX;
		if (valY !== null) multiSelectGroup.position.y = valY;
		if (valZ !== null) multiSelectGroup.position.z = valZ;

		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			object.userData.offsetFromCenter = object.position.clone().sub(multiSelectGroup.position);
		}

		isApplyingTransformFromPanel = true;

		try {
			editor.signals.sceneGraphChanged.dispatch();

			if (!isDragging) {
				const multiCommand = new MultiTransformCommand(editor, objects, 'MultiPositionCommand', '多对象位置变换');
				multiCommand.oldGroupPosition = oldGroupPosition;

				for (let i = 0; i < objects.length; i++) {
					const object = objects[i];
					multiCommand.oldPositions[object.id] = oldPositions[object.id];
				}

				editor.execute(multiCommand);
			}

			if (multiSelectGroup && objects.length > 0) {
				editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
			}
		} finally {
			isApplyingTransformFromPanel = false;
		}
	}

	function updateRotation() {
		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		if (!multiSelectGroup) return;

		const valX = multipleObjectsRotationX.getValue();
		const valY = multipleObjectsRotationY.getValue();
		const valZ = multipleObjectsRotationZ.getValue();

		const oldRotations = {};
		let hasRotationChange = false;
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			oldRotations[object.id] = object.rotation.clone();

			if (valX !== null) {
				const nextX = valX * THREE.MathUtils.DEG2RAD;
				if (object.rotation.x !== nextX) {
					object.rotation.x = nextX;
					hasRotationChange = true;
				}
			}

			if (valY !== null) {
				const nextY = valY * THREE.MathUtils.DEG2RAD;
				if (object.rotation.y !== nextY) {
					object.rotation.y = nextY;
					hasRotationChange = true;
				}
			}

			if (valZ !== null) {
				const nextZ = valZ * THREE.MathUtils.DEG2RAD;
				if (object.rotation.z !== nextZ) {
					object.rotation.z = nextZ;
					hasRotationChange = true;
				}
			}

			object.updateMatrixWorld(true);
		}

		if (hasRotationChange === false) return;

		const oldGroupRotation = multiSelectGroup.rotation.clone();

		if (valX !== null) multiSelectGroup.rotation.x = valX * THREE.MathUtils.DEG2RAD;
		if (valY !== null) multiSelectGroup.rotation.y = valY * THREE.MathUtils.DEG2RAD;
		if (valZ !== null) multiSelectGroup.rotation.z = valZ * THREE.MathUtils.DEG2RAD;

		isApplyingTransformFromPanel = true;

		try {
			editor.signals.sceneGraphChanged.dispatch();

			if (!isDragging) {
				const multiCommand = new MultiTransformCommand(editor, objects, 'MultiRotationCommand', '多对象旋转变换');
				multiCommand.oldGroupRotation = oldGroupRotation;

				for (let i = 0; i < objects.length; i++) {
					const object = objects[i];
					multiCommand.oldRotations[object.id] = oldRotations[object.id];
				}

				editor.execute(multiCommand);
			}

			if (multiSelectGroup && objects.length > 0) {
				editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
			}
		} finally {
			isApplyingTransformFromPanel = false;
		}
	}

	function updateScale() {
		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		if (!multiSelectGroup) return;

		const valX = multipleObjectsScaleX.getValue();
		const valY = multipleObjectsScaleY.getValue();
		const valZ = multipleObjectsScaleZ.getValue();

		const oldScales = {};
		let hasScaleChange = false;
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			oldScales[object.id] = object.scale.clone();

			if (valX !== null && object.scale.x !== valX) {
				object.scale.x = valX;
				hasScaleChange = true;
			}
			if (valY !== null && object.scale.y !== valY) {
				object.scale.y = valY;
				hasScaleChange = true;
			}
			if (valZ !== null && object.scale.z !== valZ) {
				object.scale.z = valZ;
				hasScaleChange = true;
			}

			object.updateMatrixWorld(true);
		}

		if (hasScaleChange === false) return;

		const oldGroupScale = multiSelectGroup.scale.clone();

		if (valX !== null) multiSelectGroup.scale.x = valX;
		if (valY !== null) multiSelectGroup.scale.y = valY;
		if (valZ !== null) multiSelectGroup.scale.z = valZ;

		isApplyingTransformFromPanel = true;

		try {
			editor.signals.sceneGraphChanged.dispatch();

			if (!isDragging) {
				const multiCommand = new MultiTransformCommand(editor, objects, 'MultiScaleCommand', '多对象缩放变换');
				multiCommand.oldGroupScale = oldGroupScale;

				for (let i = 0; i < objects.length; i++) {
					const object = objects[i];
					multiCommand.oldScales[object.id] = oldScales[object.id];
				}

				editor.execute(multiCommand);
			}

			if (multiSelectGroup && objects.length > 0) {
				editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
			}
		} finally {
			isApplyingTransformFromPanel = false;
		}
	}

	// 更新可见性函数
	function updateVisibility() {
		const objects = editor.getSelectedObjects();
		const newVisibility = multipleObjectsVisible.getValue();

		// 为每个对象设置可见性
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			if (object.visible !== newVisibility) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						'visible',
						newVisibility
					)
				);
			}
		}

		// 触发scene变化信号
		editor.signals.sceneGraphChanged.dispatch();
	}

	// 用于更新UI的方法，但不触发命令
	function updateUIWithoutCommand(objects) {
		if (!objects || objects.length === 0) return;
		syncUnifiedNameInput(objects);
		syncAffixInputs(objects);

		// 仅更新UI而不触发命令，用于从场景变化同步到面板
		const multiSelectGroup = editor.multiSelectGroup;
		if (multiSelectGroup) {
			// 更新UI数值但不触发change事件

			// 暂时禁用onChange事件
			const origPositionXOnChange = multipleObjectsPositionX.onChangeCallback;
			const origPositionYOnChange = multipleObjectsPositionY.onChangeCallback;
			const origPositionZOnChange = multipleObjectsPositionZ.onChangeCallback;

			const origRotationXOnChange = multipleObjectsRotationX.onChangeCallback;
			const origRotationYOnChange = multipleObjectsRotationY.onChangeCallback;
			const origRotationZOnChange = multipleObjectsRotationZ.onChangeCallback;

			const origScaleXOnChange = multipleObjectsScaleX.onChangeCallback;
			const origScaleYOnChange = multipleObjectsScaleY.onChangeCallback;
			const origScaleZOnChange = multipleObjectsScaleZ.onChangeCallback;

			// 临时清除onChange回调
			multipleObjectsPositionX.onChangeCallback = null;
			multipleObjectsPositionY.onChangeCallback = null;
			multipleObjectsPositionZ.onChangeCallback = null;

			multipleObjectsRotationX.onChangeCallback = null;
			multipleObjectsRotationY.onChangeCallback = null;
			multipleObjectsRotationZ.onChangeCallback = null;

			multipleObjectsScaleX.onChangeCallback = null;
			multipleObjectsScaleY.onChangeCallback = null;
			multipleObjectsScaleZ.onChangeCallback = null;

			// 更新UI值
			multipleObjectsPositionX.setValue(multiSelectGroup.position.x);
			multipleObjectsPositionY.setValue(multiSelectGroup.position.y);
			multipleObjectsPositionZ.setValue(multiSelectGroup.position.z);

			// 使用度数显示旋转
			multipleObjectsRotationX.setValue(multiSelectGroup.rotation.x * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationY.setValue(multiSelectGroup.rotation.y * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationZ.setValue(multiSelectGroup.rotation.z * THREE.MathUtils.RAD2DEG);

			multipleObjectsScaleX.setValue(multiSelectGroup.scale.x);
			multipleObjectsScaleY.setValue(multiSelectGroup.scale.y);
			multipleObjectsScaleZ.setValue(multiSelectGroup.scale.z);

			// 恢复onChange回调
			multipleObjectsPositionX.onChangeCallback = origPositionXOnChange;
			multipleObjectsPositionY.onChangeCallback = origPositionYOnChange;
			multipleObjectsPositionZ.onChangeCallback = origPositionZOnChange;

			multipleObjectsRotationX.onChangeCallback = origRotationXOnChange;
			multipleObjectsRotationY.onChangeCallback = origRotationYOnChange;
			multipleObjectsRotationZ.onChangeCallback = origRotationZOnChange;

			multipleObjectsScaleX.onChangeCallback = origScaleXOnChange;
			multipleObjectsScaleY.onChangeCallback = origScaleYOnChange;
			multipleObjectsScaleZ.onChangeCallback = origScaleZOnChange;
		}

		// 检查可见性
		// 判断逻辑：如果所有对象都可见则为true，如果有任何一个不可见则为false
		let allVisible = true;
		for (let i = 0; i < objects.length; i++) {
			if (!objects[i].visible) {
				allVisible = false;
				break;
			}
		}
		multipleObjectsVisible.setValue(allVisible);
	}

	// 用于更新UI的方法
	function updateUI(objects) {
		if (!objects || objects.length === 0) return;
		syncUnifiedNameInput(objects);
		syncAffixInputs(objects);

		// 更新选中数量
		multipleObjectsCount.setValue(objects.length.toString());

		// 检查属性一致性函数
		function checkConsistency(prop, axis) {
			const firstVal = objects[0][prop][axis];
			const tolerance = 0.0001;
			for (let i = 1; i < objects.length; i++) {
				if (Math.abs(objects[i][prop][axis] - firstVal) > tolerance) {
					return null;
				}
			}
			return firstVal;
		}

		// 位置
		const posX = checkConsistency('position', 'x');
		const posY = checkConsistency('position', 'y');
		const posZ = checkConsistency('position', 'z');

		if (posX !== null) {
			multipleObjectsPositionX.setValue(posX);
			multipleObjectsPositionX.dom.placeholder = '';
		} else {
			multipleObjectsPositionX.setValue(null);
			multipleObjectsPositionX.dom.placeholder = '-';
		}

		if (posY !== null) {
			multipleObjectsPositionY.setValue(posY);
			multipleObjectsPositionY.dom.placeholder = '';
		} else {
			multipleObjectsPositionY.setValue(null);
			multipleObjectsPositionY.dom.placeholder = '-';
		}

		if (posZ !== null) {
			multipleObjectsPositionZ.setValue(posZ);
			multipleObjectsPositionZ.dom.placeholder = '';
		} else {
			multipleObjectsPositionZ.setValue(null);
			multipleObjectsPositionZ.dom.placeholder = '-';
		}

		// 旋转 (Euler)
		const rotX = checkConsistency('rotation', 'x');
		const rotY = checkConsistency('rotation', 'y');
		const rotZ = checkConsistency('rotation', 'z');

		if (rotX !== null) {
			multipleObjectsRotationX.setValue(rotX * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationX.dom.placeholder = '';
		} else {
			multipleObjectsRotationX.setValue(null);
			multipleObjectsRotationX.dom.placeholder = '-';
		}

		if (rotY !== null) {
			multipleObjectsRotationY.setValue(rotY * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationY.dom.placeholder = '';
		} else {
			multipleObjectsRotationY.setValue(null);
			multipleObjectsRotationY.dom.placeholder = '-';
		}

		if (rotZ !== null) {
			multipleObjectsRotationZ.setValue(rotZ * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationZ.dom.placeholder = '';
		} else {
			multipleObjectsRotationZ.setValue(null);
			multipleObjectsRotationZ.dom.placeholder = '-';
		}

		// 缩放
		const scaleX = checkConsistency('scale', 'x');
		const scaleY = checkConsistency('scale', 'y');
		const scaleZ = checkConsistency('scale', 'z');

		if (scaleX !== null) {
			multipleObjectsScaleX.setValue(scaleX);
			multipleObjectsScaleX.dom.placeholder = '';
		} else {
			multipleObjectsScaleX.setValue(null);
			multipleObjectsScaleX.dom.placeholder = '-';
		}

		if (scaleY !== null) {
			multipleObjectsScaleY.setValue(scaleY);
			multipleObjectsScaleY.dom.placeholder = '';
		} else {
			multipleObjectsScaleY.setValue(null);
			multipleObjectsScaleY.dom.placeholder = '-';
		}

		if (scaleZ !== null) {
			multipleObjectsScaleZ.setValue(scaleZ);
			multipleObjectsScaleZ.dom.placeholder = '';
		} else {
			multipleObjectsScaleZ.setValue(null);
			multipleObjectsScaleZ.dom.placeholder = '-';
		}

		// 检查可见性
		// 判断逻辑：如果所有对象都可见则为true，如果有任何一个不可见则为false
		let allVisible = true;
		for (let i = 0; i < objects.length; i++) {
			if (!objects[i].visible) {
				allVisible = false;
				break;
			}
		}
		multipleObjectsVisible.setValue(allVisible);
	}

	// 事件监听
	signals.objectSelected.add(function (object) {
		if (object !== null) {
			const selectedObjects = editor.getSelectedObjects();

			// 如果是多选，显示多选面板，隐藏单选面板
			if (selectedObjects.length > 1) {
				container.setDisplay('block');
				updateUI(selectedObjects);

				// 延迟执行以确保DOM已更新
				setTimeout(function () {
					createHoverArea();
					transformBorder = createTransformBorder();
				}, 100);
			} else {
				container.setDisplay('none');
			}
		} else {
			container.setDisplay('none');
		}
	});

	signals.objectChanged.add(function (object) {
		if (isApplyingTransformFromPanel) return;

		const selectedObjects = editor.getSelectedObjects();

		// 只有在多选模式下才更新UI
		if (selectedObjects.length > 1) {
			if (selectedObjects.includes(object)) {
				updateUI(selectedObjects);
			}
		}
	});

	// 监听保存信号，当场景保存时更新当前多选对象的初始位置
	signals.upload.add(function () {
		const multiSelectGroup = editor.multiSelectGroup;
		if (multiSelectGroup) {
			// 保存当前位置到userData中
			multiSelectGroup.userData.savedPosition = {
				x: multiSelectGroup.position.x,
				y: multiSelectGroup.position.y,
				z: multiSelectGroup.position.z
			};

			console.log('多选对象位置已在保存时更新');
		}
	});

	signals.refreshSidebarObject3D.add(function (object) {
		if (isApplyingTransformFromPanel) return;

		const selectedObjects = editor.getSelectedObjects();

		// 只有在多选模式下才更新UI
		if (selectedObjects.length > 1) {
			if (selectedObjects.includes(object)) {
				updateUI(selectedObjects);
			}
		}
	});

	// 监听多选对象变换变化信号
	signals.multipleObjectsTransformChanged.add(function (object) {
		if (isApplyingTransformFromPanel) return;

		if (object === editor.multiSelectGroup) {
			// 更新多选面板UI，但不触发更新命令
			updateUIWithoutCommand(editor.getSelectedObjects());

			// 触发场景结构树刷新
			signals.sceneGraphChanged.dispatch();
		}
	});

	// 暴露公共方法
	return {
		container: container,
		updateUI: updateUI
	};
}

export { SidebarMultipleObjects };
