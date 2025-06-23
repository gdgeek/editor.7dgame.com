import * as THREE from 'three';

import {
	UIPanel,
	UIRow,
	UIInput,
	UIButton,
	UIText,
	UINumber
} from './libs/ui.js';

import { SetPositionCommand } from './commands/SetPositionCommand.js';
import { SetRotationCommand } from './commands/SetRotationCommand.js';
import { SetScaleCommand } from './commands/SetScaleCommand.js';
import { SetValueCommand } from './commands/SetValueCommand.js';

function SidebarMultipleObjects(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('20px');
	container.setDisplay('none');

	// 多选标题
	const multipleObjectsTitleRow = new UIRow();
	const multipleObjectsTitle = new UIText('多选对象');
	multipleObjectsTitle.dom.style.fontWeight = 'bold';
	multipleObjectsTitleRow.add(multipleObjectsTitle);
	container.add(multipleObjectsTitleRow);

	// 多选对象计数
	const multipleObjectsCountRow = new UIRow();
	const multipleObjectsCount = new UIText('');
	multipleObjectsCountRow.add(new UIText('选中数量').setWidth('90px'));
	multipleObjectsCountRow.add(multipleObjectsCount);
	container.add(multipleObjectsCountRow);

	// 多选对象名称列表
	const multipleObjectsNameRow = new UIRow();
	const multipleObjectsName = new UIInput()
		.setWidth('150px')
		.setFontSize('12px')
		.onChange(function() {
			// 批量修改所有选中对象的名称
			const objects = editor.getSelectedObjects();
			const newName = multipleObjectsName.getValue();

			for (let i = 0; i < objects.length; i++) {
				const object = objects[i];
				// 如果有多个对象，给每个对象添加索引
				const name = objects.length > 1 ?
					`${newName} (${i + 1})` : newName;

				editor.execute(new SetValueCommand(editor, object, 'name', name));
			}
		});

	multipleObjectsNameRow.add(new UIText('名称').setWidth('90px'));
	multipleObjectsNameRow.add(multipleObjectsName);
	container.add(multipleObjectsNameRow);

	// 分割线
	const separator = new UIPanel();
	separator.setHeight('6px');
	container.add(separator);

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

	multipleObjectsPositionRow.add(new UIText('位置').setWidth('90px'));
	multipleObjectsPositionRow.add(multipleObjectsPositionX, 'X');
	multipleObjectsPositionRow.add(multipleObjectsPositionY, 'Y');
	multipleObjectsPositionRow.add(multipleObjectsPositionZ, 'Z');

	// 添加位置复制粘贴按钮
	const positionCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function() {
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

			editor.showNotification('位置数据已复制');
		});

	// 添加复制图标
	const positionCopyIcon = document.createElement('img');
	positionCopyIcon.src = 'images/copy.png';
	positionCopyIcon.style.width = '12px';
	positionCopyIcon.style.height = '12px';
	positionCopyIcon.style.display = 'block';
	positionCopyIcon.style.margin = '0 auto';
	positionCopyButton.dom.appendChild(positionCopyIcon);
	positionCopyButton.dom.title = '复制位置';

	const positionPasteButton = new UIButton('')
		.setWidth('24px')
		.onClick(function() {
			const positionData = localStorage.getItem('multipleObjectsPosition');
			if (positionData) {
				try {
					const position = JSON.parse(positionData);
					multipleObjectsPositionX.setValue(position.x);
					multipleObjectsPositionY.setValue(position.y);
					multipleObjectsPositionZ.setValue(position.z);
					updatePosition();
					editor.showNotification('位置数据已粘贴');
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
	positionPasteButton.dom.title = '粘贴位置';

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

	multipleObjectsRotationRow.add(new UIText('旋转').setWidth('90px'));
	multipleObjectsRotationRow.add(multipleObjectsRotationX, 'X');
	multipleObjectsRotationRow.add(multipleObjectsRotationY, 'Y');
	multipleObjectsRotationRow.add(multipleObjectsRotationZ, 'Z');

	// 添加旋转复制粘贴按钮
	const rotationCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function() {
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

			editor.showNotification('旋转数据已复制');
		});

	// 添加复制图标
	const rotationCopyIcon = document.createElement('img');
	rotationCopyIcon.src = 'images/copy.png';
	rotationCopyIcon.style.width = '12px';
	rotationCopyIcon.style.height = '12px';
	rotationCopyIcon.style.display = 'block';
	rotationCopyIcon.style.margin = '0 auto';
	rotationCopyButton.dom.appendChild(rotationCopyIcon);
	rotationCopyButton.dom.title = '复制旋转';

	const rotationPasteButton = new UIButton('')
		.setWidth('24px')
		.onClick(function() {
			const rotationData = localStorage.getItem('multipleObjectsRotation');
			if (rotationData) {
				try {
					const rotation = JSON.parse(rotationData);
					multipleObjectsRotationX.setValue(rotation.x);
					multipleObjectsRotationY.setValue(rotation.y);
					multipleObjectsRotationZ.setValue(rotation.z);
					updateRotation();
					editor.showNotification('旋转数据已粘贴');
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
	rotationPasteButton.dom.title = '粘贴旋转';

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

	multipleObjectsScaleRow.add(new UIText('缩放').setWidth('90px'));
	multipleObjectsScaleRow.add(multipleObjectsScaleX, 'X');
	multipleObjectsScaleRow.add(multipleObjectsScaleY, 'Y');
	multipleObjectsScaleRow.add(multipleObjectsScaleZ, 'Z');

	// 添加缩放复制粘贴按钮
	const scaleCopyButton = new UIButton('')
		.setWidth('24px')
		.onClick(function() {
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

			editor.showNotification('缩放数据已复制');
		});

	// 添加复制图标
	const scaleCopyIcon = document.createElement('img');
	scaleCopyIcon.src = 'images/copy.png';
	scaleCopyIcon.style.width = '12px';
	scaleCopyIcon.style.height = '12px';
	scaleCopyIcon.style.display = 'block';
	scaleCopyIcon.style.margin = '0 auto';
	scaleCopyButton.dom.appendChild(scaleCopyIcon);
	scaleCopyButton.dom.title = '复制缩放';

	const scalePasteButton = new UIButton('')
		.setWidth('24px')
		.onClick(function() {
			const scaleData = localStorage.getItem('multipleObjectsScale');
			if (scaleData) {
				try {
					const scale = JSON.parse(scaleData);
					multipleObjectsScaleX.setValue(scale.x);
					multipleObjectsScaleY.setValue(scale.y);
					multipleObjectsScaleZ.setValue(scale.z);
					updateScale();
					editor.showNotification('缩放数据已粘贴');
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
	scalePasteButton.dom.title = '粘贴缩放';

	multipleObjectsScaleRow.add(scaleCopyButton);
	multipleObjectsScaleRow.add(scalePasteButton);

	container.add(multipleObjectsScaleRow);

	// 辅助功能按钮
	const multipleObjectsActionsRow = new UIRow();

	// 重置位置按钮
	const resetPositionButton = new UIButton('归零位置')
		.setWidth('80px')
		.onClick(function() {
			multipleObjectsPositionX.setValue(0);
			multipleObjectsPositionY.setValue(0);
			multipleObjectsPositionZ.setValue(0);
			updatePosition();
		});

	// 重置旋转按钮
	const resetRotationButton = new UIButton('归零旋转')
		.setWidth('80px')
		.onClick(function() {
			multipleObjectsRotationX.setValue(0);
			multipleObjectsRotationY.setValue(0);
			multipleObjectsRotationZ.setValue(0);
			updateRotation();
		});

	// 重置缩放按钮
	const resetScaleButton = new UIButton('归一缩放')
		.setWidth('80px')
		.onClick(function() {
			multipleObjectsScaleX.setValue(1);
			multipleObjectsScaleY.setValue(1);
			multipleObjectsScaleZ.setValue(1);
			updateScale();
		});

	multipleObjectsActionsRow.add(resetPositionButton);
	multipleObjectsActionsRow.add(resetRotationButton);
	multipleObjectsActionsRow.add(resetScaleButton);

	container.add(multipleObjectsActionsRow);

	// 更新函数
	function updatePosition() {
		const objects = editor.getSelectedObjects();
		const newX = multipleObjectsPositionX.getValue();
		const newY = multipleObjectsPositionY.getValue();
		const newZ = multipleObjectsPositionZ.getValue();

		// 更新临时组的位置
		const multiSelectGroup = editor.multiSelectGroup;
		if (multiSelectGroup) {
			// 设置临时组位置
			multiSelectGroup.position.set(newX, newY, newZ);

			// 触发临时组的位置变更事件
			if (multiSelectGroup.userData.onPositionChange) {
				multiSelectGroup.userData.onPositionChange();
			}

			// 触发scene变化信号
			editor.signals.sceneGraphChanged.dispatch();
		}

		// 更新每个选中对象的位置
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			if (object.userData.offsetFromCenter) {
				const newPosition = multiSelectGroup.position.clone().add(object.userData.offsetFromCenter);

				// 只有当位置真的改变时才执行命令
				if (!object.position.equals(newPosition)) {
					editor.execute(new SetPositionCommand(editor, object, newPosition));
				}
			}
		}
	}

	function updateRotation() {
		const objects = editor.getSelectedObjects();
		const newX = multipleObjectsRotationX.getValue() * THREE.MathUtils.DEG2RAD;
		const newY = multipleObjectsRotationY.getValue() * THREE.MathUtils.DEG2RAD;
		const newZ = multipleObjectsRotationZ.getValue() * THREE.MathUtils.DEG2RAD;

		// 更新临时组的旋转
		const multiSelectGroup = editor.multiSelectGroup;
		if (multiSelectGroup) {
			// 设置临时组旋转
			multiSelectGroup.rotation.set(newX, newY, newZ);

			// 触发临时组的旋转变更事件
			if (multiSelectGroup.userData.onRotationChange) {
				multiSelectGroup.userData.onRotationChange();
			}

			// 触发scene变化信号
			editor.signals.sceneGraphChanged.dispatch();
		}

		// 更新选中对象的旋转
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			const newRotation = new THREE.Euler(newX, newY, newZ);

			// 只有当旋转真的改变时才执行命令
			if (!object.rotation.equals(newRotation)) {
				editor.execute(new SetRotationCommand(editor, object, newRotation));
			}
		}
	}

	function updateScale() {
		const objects = editor.getSelectedObjects();
		const newX = multipleObjectsScaleX.getValue();
		const newY = multipleObjectsScaleY.getValue();
		const newZ = multipleObjectsScaleZ.getValue();

		// 更新临时组的缩放
		const multiSelectGroup = editor.multiSelectGroup;
		if (multiSelectGroup) {
			// 设置临时组缩放
			multiSelectGroup.scale.set(newX, newY, newZ);

			// 触发临时组的缩放变更事件
			if (multiSelectGroup.userData.onScaleChange) {
				multiSelectGroup.userData.onScaleChange();
			}

			// 触发scene变化信号
			editor.signals.sceneGraphChanged.dispatch();
		}

		// 更新选中对象的缩放
		for (let i = 0; i < objects.length; i++) {
			const object = objects[i];
			const newScale = new THREE.Vector3(newX, newY, newZ);

			// 只有当缩放真的改变时才执行命令
			if (!object.scale.equals(newScale)) {
				editor.execute(new SetScaleCommand(editor, object, newScale));
			}
		}
	}

	// 用于更新UI的方法，但不触发命令
	function updateUIWithoutCommand(objects) {
		if (!objects || objects.length === 0) return;

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
	}

	// 用于更新UI的方法
	function updateUI(objects) {
		if (!objects || objects.length === 0) return;

		// 更新选中数量
		multipleObjectsCount.setValue(objects.length.toString());

		// 如果所有对象名称相同，使用该名称，否则显示多个名称
		// 提取所有对象的名称
		const names = objects.map(obj => obj.name);

		// 检查所有名称是否相同
		const allSameName = names.every(name => name === names[0]);

		// 如果所有名称相同，使用该名称，否则显示"多个名称"
		if (allSameName) {
			multipleObjectsName.setValue(names[0]);
		} else {
			// 创建名称摘要
			multipleObjectsName.setValue("[多个不同名称]");
		}

		// 使用临时组的位置
		const multiSelectGroup = editor.multiSelectGroup;
		if (multiSelectGroup) {
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
		} else {
			// 如果没有临时组，使用第一个对象的变换
			const firstObject = objects[0];

			multipleObjectsPositionX.setValue(firstObject.position.x);
			multipleObjectsPositionY.setValue(firstObject.position.y);
			multipleObjectsPositionZ.setValue(firstObject.position.z);

			// 使用度数显示旋转
			multipleObjectsRotationX.setValue(firstObject.rotation.x * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationY.setValue(firstObject.rotation.y * THREE.MathUtils.RAD2DEG);
			multipleObjectsRotationZ.setValue(firstObject.rotation.z * THREE.MathUtils.RAD2DEG);

			multipleObjectsScaleX.setValue(firstObject.scale.x);
			multipleObjectsScaleY.setValue(firstObject.scale.y);
			multipleObjectsScaleZ.setValue(firstObject.scale.z);
		}
	}

	// 事件监听
	signals.objectSelected.add(function(object) {
		if (object !== null) {
			const selectedObjects = editor.getSelectedObjects();

			// 如果是多选，显示多选面板，隐藏单选面板
			if (selectedObjects.length > 1) {
				container.setDisplay('block');
				updateUI(selectedObjects);
			} else {
				container.setDisplay('none');
			}
		} else {
			container.setDisplay('none');
		}
	});

	signals.objectChanged.add(function(object) {
		const selectedObjects = editor.getSelectedObjects();

		// 只有在多选模式下才更新UI
		if (selectedObjects.length > 1) {
			if (selectedObjects.includes(object)) {
				updateUI(selectedObjects);
			}
		}
	});

	signals.refreshSidebarObject3D.add(function(object) {
		const selectedObjects = editor.getSelectedObjects();

		// 只有在多选模式下才更新UI
		if (selectedObjects.length > 1) {
			if (selectedObjects.includes(object)) {
				updateUI(selectedObjects);
			}
		}
	});

	// 监听多选对象变换变化信号
	signals.multipleObjectsTransformChanged.add(function(object) {
		if (object === editor.multiSelectGroup) {
			// 更新多选面板UI，但不触发更新命令
			updateUIWithoutCommand(editor.getSelectedObjects());
		}
	});

	// 暴露公共方法
	return {
		container: container,
		updateUI: updateUI
	};
}

export { SidebarMultipleObjects };
