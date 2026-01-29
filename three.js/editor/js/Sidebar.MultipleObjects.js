import * as THREE from 'three';

import {
	UIPanel,
	UIRow,
	UIInput,
	UIButton,
	UIText,
	UINumber,
	UICheckbox
} from './libs/ui.js';

import { SetPositionCommand } from './commands/SetPositionCommand.js';
import { SetRotationCommand } from './commands/SetRotationCommand.js';
import { SetScaleCommand } from './commands/SetScaleCommand.js';
import { SetValueCommand } from './commands/SetValueCommand.js';
import { MultiTransformCommand } from './commands/MultiTransformCommand.js';
import { MultiCmdsCommand } from './commands/MultiCmdsCommand.js';

function SidebarMultipleObjects(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('20px');
	container.setDisplay('none');

	// 多选标题
	const multipleObjectsTitleRow = new UIRow();
	const multipleObjectsTitle = new UIText(strings.getKey('sidebar/properties/multi_object'));
	multipleObjectsTitle.dom.style.fontWeight = 'bold';
	multipleObjectsTitleRow.add(multipleObjectsTitle);
	container.add(multipleObjectsTitleRow);

	// 多选对象计数
	const multipleObjectsCountRow = new UIRow();
	const multipleObjectsCount = new UIText('');
	multipleObjectsCountRow.add(new UIText(strings.getKey('sidebar/multi_objects/selection_count')).setWidth('90px'));
	multipleObjectsCountRow.add(multipleObjectsCount);
	container.add(multipleObjectsCountRow);

	// 多选对象名称列表标题
	const multipleObjectsNameRow = new UIRow();
	multipleObjectsNameRow.add(new UIText(strings.getKey('sidebar/object/name')).setWidth('90px'));
	container.add(multipleObjectsNameRow);

	// 创建名称列表容器 - 纵向排列
	const namesListContainer = new UIPanel();
	namesListContainer.dom.style.marginLeft = '0px';
	namesListContainer.dom.style.marginBottom = '10px';
	namesListContainer.dom.style.maxHeight = '120px';
	namesListContainer.dom.style.overflowY = 'auto';
	namesListContainer.dom.style.border = '1px solid #ccc';
	namesListContainer.dom.style.borderRadius = '3px';
	namesListContainer.dom.style.padding = '3px';
	container.add(namesListContainer);

	// 存储名称文本UI元素的数组
	const nameTextElements = [];

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
	const multipleObjectsPositionY = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updatePosition);
	const multipleObjectsPositionZ = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updatePosition);

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

	// 添加复制图标
	const positionCopyIcon = document.createElement('img');
	positionCopyIcon.src = 'images/copy.png';
	positionCopyIcon.style.width = '12px';
	positionCopyIcon.style.height = '12px';
	positionCopyIcon.style.display = 'block';
	positionCopyIcon.style.margin = '0 auto';
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

	// 添加粘贴图标
	const positionPasteIcon = document.createElement('img');
	positionPasteIcon.src = 'images/paste.png';
	positionPasteIcon.style.width = '12px';
	positionPasteIcon.style.height = '12px';
	positionPasteIcon.style.display = 'block';
	positionPasteIcon.style.margin = '0 auto';
	positionPasteButton.dom.appendChild(positionPasteIcon);
	positionPasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_position');

	// 默认隐藏复制粘贴按钮
	positionCopyButton.dom.style.display = 'none';
	positionPasteButton.dom.style.display = 'none';

	// 添加鼠标悬停事件
	multipleObjectsPositionRow.dom.addEventListener('mouseenter', function () {
		positionCopyButton.dom.style.display = '';
		positionPasteButton.dom.style.display = '';
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
	const multipleObjectsRotationY = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updateRotation);
	const multipleObjectsRotationZ = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.onChange(updateRotation);

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

	// 添加复制图标
	const rotationCopyIcon = document.createElement('img');
	rotationCopyIcon.src = 'images/copy.png';
	rotationCopyIcon.style.width = '12px';
	rotationCopyIcon.style.height = '12px';
	rotationCopyIcon.style.display = 'block';
	rotationCopyIcon.style.margin = '0 auto';
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

	// 添加粘贴图标
	const rotationPasteIcon = document.createElement('img');
	rotationPasteIcon.src = 'images/paste.png';
	rotationPasteIcon.style.width = '12px';
	rotationPasteIcon.style.height = '12px';
	rotationPasteIcon.style.display = 'block';
	rotationPasteIcon.style.margin = '0 auto';
	rotationPasteButton.dom.appendChild(rotationPasteIcon);
	rotationPasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_rotation');

	// 默认隐藏复制粘贴按钮
	rotationCopyButton.dom.style.display = 'none';
	rotationPasteButton.dom.style.display = 'none';

	// 添加鼠标悬停事件
	multipleObjectsRotationRow.dom.addEventListener('mouseenter', function () {
		rotationCopyButton.dom.style.display = '';
		rotationPasteButton.dom.style.display = '';
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
	const multipleObjectsScaleY = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.setValue(1)
		.onChange(updateScale);
	const multipleObjectsScaleZ = new UINumber()
		.setPrecision(3)
		.setWidth('40px')
		.setValue(1)
		.onChange(updateScale);

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

	// 添加复制图标
	const scaleCopyIcon = document.createElement('img');
	scaleCopyIcon.src = 'images/copy.png';
	scaleCopyIcon.style.width = '12px';
	scaleCopyIcon.style.height = '12px';
	scaleCopyIcon.style.display = 'block';
	scaleCopyIcon.style.margin = '0 auto';
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

	// 添加粘贴图标
	const scalePasteIcon = document.createElement('img');
	scalePasteIcon.src = 'images/paste.png';
	scalePasteIcon.style.width = '12px';
	scalePasteIcon.style.height = '12px';
	scalePasteIcon.style.display = 'block';
	scalePasteIcon.style.margin = '0 auto';
	scalePasteButton.dom.appendChild(scalePasteIcon);
	scalePasteButton.dom.title = strings.getKey('sidebar/multi_objects/paste_scale');

	// 默认隐藏复制粘贴按钮
	scaleCopyButton.dom.style.display = 'none';
	scalePasteButton.dom.style.display = 'none';

	// 添加鼠标悬停事件
	multipleObjectsScaleRow.dom.addEventListener('mouseenter', function () {
		scaleCopyButton.dom.style.display = '';
		scalePasteButton.dom.style.display = '';
	});
	multipleObjectsScaleRow.dom.addEventListener('mouseleave', function () {
		scaleCopyButton.dom.style.display = 'none';
		scalePasteButton.dom.style.display = 'none';
	});

	multipleObjectsScaleRow.add(scaleCopyButton);
	multipleObjectsScaleRow.add(scalePasteButton);

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

	// 添加复制图标
	const transformCopyIcon = document.createElement('img');
	transformCopyIcon.src = 'images/copy.png';
	transformCopyIcon.style.width = '12px';
	transformCopyIcon.style.height = '12px';
	transformCopyIcon.style.display = 'block';
	transformCopyIcon.style.margin = '0 auto';
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

	// 添加粘贴图标
	const transformPasteIcon = document.createElement('img');
	transformPasteIcon.src = 'images/paste.png';
	transformPasteIcon.style.width = '12px';
	transformPasteIcon.style.height = '12px';
	transformPasteIcon.style.display = 'block';
	transformPasteIcon.style.margin = '0 auto';
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

		// Update group position only for valid inputs
		if (valX !== null) multiSelectGroup.position.x = valX;
		if (valY !== null) multiSelectGroup.position.y = valY;
		if (valZ !== null) multiSelectGroup.position.z = valZ;

		// 触发临时组的位置变更事件
		if (multiSelectGroup.userData.onPositionChange) {
			multiSelectGroup.userData.onPositionChange();
		}

		// 触发scene变化信号
		editor.signals.sceneGraphChanged.dispatch();

		// 更新每个选中对象的位置
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			if (object.userData.offsetFromCenter) {
				const newPosition = multiSelectGroup.position.clone().add(object.userData.offsetFromCenter);

				// 更新对象位置
				if (!object.position.equals(newPosition)) {
					object.position.copy(newPosition);
				}
			}
		}

		// 只有在不是拖动状态下才创建和执行命令
		// 如果是拖动状态，会在onDragEnd中统一创建一个命令
		if (!isDragging) {
			// MultiTransformCommand captures current state as 'new state'.
			// Since we already modified objects above, this captures the change.
			const multiCommand = new MultiTransformCommand(editor, objects, 'MultiPositionCommand', '多对象位置变换');
			multiCommand.updateNewState(); // 更新变换后的状态
			editor.execute(multiCommand);
		}

		// 触发多选对象变换更新信号，用于更新包围盒
		if (multiSelectGroup && objects.length > 0) {
			editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
		}
	}

	function updateRotation() {
		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		if (!multiSelectGroup) return;

		const valX = multipleObjectsRotationX.getValue();
		const valY = multipleObjectsRotationY.getValue();
		const valZ = multipleObjectsRotationZ.getValue();

		// Use input value if valid, otherwise keep existing group value
		const newX = (valX !== null ? valX : multiSelectGroup.rotation.x * THREE.MathUtils.RAD2DEG) * THREE.MathUtils.DEG2RAD;
		const newY = (valY !== null ? valY : multiSelectGroup.rotation.y * THREE.MathUtils.RAD2DEG) * THREE.MathUtils.DEG2RAD;
		const newZ = (valZ !== null ? valZ : multiSelectGroup.rotation.z * THREE.MathUtils.RAD2DEG) * THREE.MathUtils.DEG2RAD;

		// 更新临时组的旋转
		multiSelectGroup.rotation.set(newX, newY, newZ);

		// 触发临时组的旋转变更事件
		if (multiSelectGroup.userData.onRotationChange) {
			multiSelectGroup.userData.onRotationChange();
		}

		// 触发scene变化信号
		editor.signals.sceneGraphChanged.dispatch();

		// 更新选中对象的旋转
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			const newRotation = new THREE.Euler(newX, newY, newZ);

			// 更新对象旋转
			if (!object.rotation.equals(newRotation)) {
				object.rotation.copy(newRotation);
			}
		}

		// 只有在不是拖动状态下才创建和执行命令
		// 如果是拖动状态，会在onDragEnd中统一创建一个命令
		if (!isDragging) {
			const multiCommand = new MultiTransformCommand(editor, objects, 'MultiRotationCommand', '多对象旋转变换');
			multiCommand.updateNewState(); // 更新变换后的状态
			editor.execute(multiCommand);
		}

		// 触发多选对象变换更新信号，用于更新包围盒
		if (multiSelectGroup && objects.length > 0) {
			editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
		}
	}

	function updateScale() {
		const objects = editor.getSelectedObjects();
		const multiSelectGroup = editor.multiSelectGroup;

		if (!multiSelectGroup) return;

		const valX = multipleObjectsScaleX.getValue();
		const valY = multipleObjectsScaleY.getValue();
		const valZ = multipleObjectsScaleZ.getValue();

		const newX = valX !== null ? valX : multiSelectGroup.scale.x;
		const newY = valY !== null ? valY : multiSelectGroup.scale.y;
		const newZ = valZ !== null ? valZ : multiSelectGroup.scale.z;

		// 更新临时组的缩放
		multiSelectGroup.scale.set(newX, newY, newZ);

		// 触发临时组的缩放变更事件
		if (multiSelectGroup.userData.onScaleChange) {
			multiSelectGroup.userData.onScaleChange();
		}

		// 触发scene变化信号
		editor.signals.sceneGraphChanged.dispatch();

		// 更新选中对象的缩放
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			const newScale = new THREE.Vector3(newX, newY, newZ);

			// 更新对象缩放
			if (!object.scale.equals(newScale)) {
				object.scale.copy(newScale);
			}
		}

		// 只有在不是拖动状态下才创建和执行命令
		// 如果是拖动状态，会在onDragEnd中统一创建一个命令
		if (!isDragging) {
			const multiCommand = new MultiTransformCommand(editor, objects, 'MultiScaleCommand', '多对象缩放变换');
			multiCommand.updateNewState(); // 更新变换后的状态
			editor.execute(multiCommand);
		}

		// 触发多选对象变换更新信号，用于更新包围盒
		if (multiSelectGroup && objects.length > 0) {
			editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
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

		// 清除现有的名称文本列表
		namesListContainer.dom.innerHTML = '';
		nameTextElements.length = 0;

		// 提取所有对象的名称
		const names = objects.map(obj => obj.name);

		// 显示所有名称列表（纵向排列）
		for (let i = 0; i < names.length; i++) {
			const nameText = document.createElement('div');
			nameText.textContent = `${i + 1}. ${names[i]}`;
			nameText.style.fontSize = '12px';
			nameText.style.padding = '3px 6px';
			nameText.style.borderBottom = i < names.length - 1 ? '1px dotted #ddd' : 'none';
			nameText.style.color = '#555';
			namesListContainer.dom.appendChild(nameText);
			nameTextElements.push(nameText);
		}

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

		// 更新选中数量
		multipleObjectsCount.setValue(objects.length.toString());

		// 清除现有的名称文本列表
		namesListContainer.dom.innerHTML = '';
		nameTextElements.length = 0;

		// 提取所有对象的名称
		const names = objects.map(obj => obj.name);

		// 显示所有名称列表（纵向排列）
		for (let i = 0; i < names.length; i++) {
			const nameText = document.createElement('div');
			nameText.textContent = `${i + 1}. ${names[i]}`;
			nameText.style.fontSize = '12px';
			nameText.style.padding = '3px 6px';
			nameText.style.borderBottom = i < names.length - 1 ? '1px dotted #ddd' : 'none';
			nameText.style.color = '#555';
			namesListContainer.dom.appendChild(nameText);
			nameTextElements.push(nameText);
		}

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
