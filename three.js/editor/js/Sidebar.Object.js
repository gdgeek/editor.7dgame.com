import * as THREE from "three";

import {
	UIPanel,
	UIRow,
	UIInput,
	UIButton,
	UIColor,
	UICheckbox,
	UIInteger,
	UITextArea,
	UIText,
	UINumber,
} from "./libs/ui.js";
import { UIBoolean } from "./libs/ui.three.js";

import { SetUuidCommand } from "./commands/SetUuidCommand.js";
import { SetValueCommand } from "./commands/SetValueCommand.js";
import { SetPositionCommand } from "./commands/SetPositionCommand.js";
import { SetRotationCommand } from "./commands/SetRotationCommand.js";
import { SetScaleCommand } from "./commands/SetScaleCommand.js";
import { SetColorCommand } from "./commands/SetColorCommand.js";
import { MetaFactory } from "./mrpp/MetaFactory.js";

function SidebarObject(editor) {
	const strings = editor.strings;

	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop("0");
	container.setPaddingTop("20px");
	container.setDisplay("none");

	// 存储复制的变换数据
	const clipboard = {
		position: null,
		rotation: null,
		scale: null,
	};

	// 专门存储单一属性的复制数据
	const singlePropertyClipboard = {
		position: null,
		rotation: null,
		scale: null,
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
			callback: callback,
		});
	};

	// Actions

	/*
	let objectActions = new UI.Select().setPosition( 'absolute' ).setRight( '8px' ).setFontSize( '11px' );
	objectActions.setOptions( {

		'Actions': 'Actions',
		'Reset Position': 'Reset Position',
		'Reset Rotation': 'Reset Rotation',
		'Reset Scale': 'Reset Scale'

	} );
	objectActions.onClick( function ( event ) {

		event.stopPropagation(); // Avoid panel collapsing

	} );
	objectActions.onChange( function ( event ) {

		let object = editor.selected;

		switch ( this.getValue() ) {

			case 'Reset Position':
				editor.execute( new SetPositionCommand( editor, object, new Vector3( 0, 0, 0 ) ) );
				break;

			case 'Reset Rotation':
				editor.execute( new SetRotationCommand( editor, object, new Euler( 0, 0, 0 ) ) );
				break;

			case 'Reset Scale':
				editor.execute( new SetScaleCommand( editor, object, new Vector3( 1, 1, 1 ) ) );
				break;

		}

		this.setValue( 'Actions' );

	} );
	container.addStatic( objectActions );
	*/

	// type

	const objectTypeRow = new UIRow();
	const objectType = new UIText();

	objectTypeRow.add(
		new UIText(strings.getKey("sidebar/object/type")).setWidth("90px")
	);
	objectTypeRow.add(objectType);

	container.add(objectTypeRow);

	// uuid

	const objectUUIDRow = new UIRow();
	const objectUUID = new UIInput()
		.setWidth("150px")
		.setFontSize("12px")
		.setDisabled(true);
	/*const objectUUIDRenew = new UIButton(strings.getKey('sidebar/object/new'))
		.setMarginLeft('7px')
		.onClick(function () {
			objectUUID.setValue(THREE.MathUtils.generateUUID())

			editor.execute(
				new SetUuidCommand(editor, editor.selected, objectUUID.getValue())
			)
		})
*/
	objectUUIDRow.add(
		new UIText(strings.getKey("sidebar/object/uuid")).setWidth("90px")
	);
	objectUUIDRow.add(objectUUID);
	//objectUUIDRow.add(objectUUIDRenew)

	container.add(objectUUIDRow);

	// name

	const objectNameRow = new UIRow();
	const objectName = new UIInput()
		.setWidth("150px")
		.setFontSize("12px")
		.onChange(function () {
			editor.execute(
				new SetValueCommand(
					editor,
					editor.selected,
					"name",
					objectName.getValue()
				)
			);
		});

	objectNameRow.add(
		new UIText(strings.getKey("sidebar/object/name")).setWidth("90px")
	);
	objectNameRow.add(objectName);

	container.add(objectNameRow);

	// position

	const objectPositionRow = new UIRow();
	const objectPositionX = new UINumber()
		.setPrecision(3)
		.setWidth("40px")
		.onChange(update);
	const objectPositionY = new UINumber()
		.setPrecision(3)
		.setWidth("40px")
		.onChange(update);
	const objectPositionZ = new UINumber()
		.setPrecision(3)
		.setWidth("40px")
		.onChange(update);

	// 位置复制粘贴按钮
	const positionCopyButton = new UIButton("")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				const positionData = new THREE.Vector3(
					objectPositionX.getValue(),
					objectPositionY.getValue(),
					objectPositionZ.getValue()
				);

				// 同时更新两个剪贴板
				singlePropertyClipboard.position = positionData;
				clipboard.position = positionData;

				editor.showNotification("位置数据复制成功");
			}
		});

	positionCopyButton.dom.title = "复制";

	// 添加复制图标
	const positionCopyIcon = document.createElement("img");
	positionCopyIcon.src = "images/copy.png";
	positionCopyIcon.style.width = "12px";
	positionCopyIcon.style.height = "12px";
	positionCopyIcon.style.display = "block";
	positionCopyIcon.style.margin = "0 auto";
	positionCopyButton.dom.appendChild(positionCopyIcon);

	const positionPasteButton = new UIButton("")
		.setMarginLeft("2px")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				// 优先使用单一属性剪贴板，如果没有则使用全局剪贴板
				const positionData =
					singlePropertyClipboard.position || clipboard.position;

				if (positionData !== null) {
					editor.execute(
						new SetPositionCommand(
							editor,
							editor.selected,
							positionData.clone()
						)
					);
					editor.showNotification("位置数据粘贴成功");
				}
			}
		});

	positionPasteButton.dom.title = "粘贴";

	// 添加粘贴图标
	const positionPasteIcon = document.createElement("img");
	positionPasteIcon.src = "images/paste.png";
	positionPasteIcon.style.width = "12px";
	positionPasteIcon.style.height = "12px";
	positionPasteIcon.style.display = "block";
	positionPasteIcon.style.margin = "0 auto";
	positionPasteButton.dom.appendChild(positionPasteIcon);

	// 默认隐藏复制粘贴按钮
	positionCopyButton.dom.style.display = "none";
	positionPasteButton.dom.style.display = "none";

	// 添加鼠标悬停事件
	objectPositionRow.dom.addEventListener("mouseenter", function () {
		positionCopyButton.dom.style.display = "";
		positionPasteButton.dom.style.display = "";
	});
	objectPositionRow.dom.addEventListener("mouseleave", function () {
		positionCopyButton.dom.style.display = "none";
		positionPasteButton.dom.style.display = "none";
	});

	objectPositionRow.add(
		new UIText(strings.getKey("sidebar/object/position")).setWidth("90px")
	);
	objectPositionRow.add(objectPositionX, objectPositionY, objectPositionZ);
	objectPositionRow.add(positionCopyButton, positionPasteButton);

	container.add(objectPositionRow);

	// rotation

	const objectRotationRow = new UIRow();
	const objectRotationX = new UINumber()
		.setStep(10)
		.setNudge(0.1)
		.setUnit("°")
		.setWidth("40px")
		.onChange(update);
	const objectRotationY = new UINumber()
		.setStep(10)
		.setNudge(0.1)
		.setUnit("°")
		.setWidth("40px")
		.onChange(update);
	const objectRotationZ = new UINumber()
		.setStep(10)
		.setNudge(0.1)
		.setUnit("°")
		.setWidth("40px")
		.onChange(update);

	// 旋转复制粘贴按钮
	const rotationCopyButton = new UIButton("")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				const rotationData = new THREE.Euler(
					objectRotationX.getValue() * THREE.MathUtils.DEG2RAD,
					objectRotationY.getValue() * THREE.MathUtils.DEG2RAD,
					objectRotationZ.getValue() * THREE.MathUtils.DEG2RAD
				);

				// 同时更新两个剪贴板
				singlePropertyClipboard.rotation = rotationData;
				clipboard.rotation = rotationData;

				editor.showNotification("旋转数据复制成功");
			}
		});

	rotationCopyButton.dom.title = "复制";

	// 添加复制图标
	const rotationCopyIcon = document.createElement("img");
	rotationCopyIcon.src = "images/copy.png";
	rotationCopyIcon.style.width = "12px";
	rotationCopyIcon.style.height = "12px";
	rotationCopyIcon.style.display = "block";
	rotationCopyIcon.style.margin = "0 auto";
	rotationCopyButton.dom.appendChild(rotationCopyIcon);

	const rotationPasteButton = new UIButton("")
		.setMarginLeft("2px")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				// 优先使用单一属性剪贴板，如果没有则使用全局剪贴板
				const rotationData =
					singlePropertyClipboard.rotation || clipboard.rotation;

				if (rotationData !== null) {
					editor.execute(
						new SetRotationCommand(
							editor,
							editor.selected,
							rotationData.clone()
						)
					);
					editor.showNotification("旋转数据粘贴成功");
				}
			}
		});

	rotationPasteButton.dom.title = "粘贴";

	// 添加粘贴图标
	const rotationPasteIcon = document.createElement("img");
	rotationPasteIcon.src = "images/paste.png";
	rotationPasteIcon.style.width = "12px";
	rotationPasteIcon.style.height = "12px";
	rotationPasteIcon.style.display = "block";
	rotationPasteIcon.style.margin = "0 auto";
	rotationPasteButton.dom.appendChild(rotationPasteIcon);

	// 默认隐藏复制粘贴按钮
	rotationCopyButton.dom.style.display = "none";
	rotationPasteButton.dom.style.display = "none";

	// 添加鼠标悬停事件
	objectRotationRow.dom.addEventListener("mouseenter", function () {
		rotationCopyButton.dom.style.display = "";
		rotationPasteButton.dom.style.display = "";
	});
	objectRotationRow.dom.addEventListener("mouseleave", function () {
		rotationCopyButton.dom.style.display = "none";
		rotationPasteButton.dom.style.display = "none";
	});

	objectRotationRow.add(
		new UIText(strings.getKey("sidebar/object/rotation")).setWidth("90px")
	);
	objectRotationRow.add(objectRotationX, objectRotationY, objectRotationZ);
	objectRotationRow.add(rotationCopyButton, rotationPasteButton);

	container.add(objectRotationRow);

	// scale

	const objectScaleRow = new UIRow();
	const objectScaleX = new UINumber(1)
		.setPrecision(3)
		.setWidth("40px")
		.onChange(update);
	const objectScaleY = new UINumber(1)
		.setPrecision(3)
		.setWidth("40px")
		.onChange(update);
	const objectScaleZ = new UINumber(1)
		.setPrecision(3)
		.setWidth("40px")
		.onChange(update);

	// 缩放复制粘贴按钮
	const scaleCopyButton = new UIButton("")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				const scaleData = new THREE.Vector3(
					objectScaleX.getValue(),
					objectScaleY.getValue(),
					objectScaleZ.getValue()
				);

				// 同时更新两个剪贴板
				singlePropertyClipboard.scale = scaleData;
				clipboard.scale = scaleData;

				editor.showNotification("缩放数据复制成功");
			}
		});

	scaleCopyButton.dom.title = "复制";

	// 添加复制图标
	const scaleCopyIcon = document.createElement("img");
	scaleCopyIcon.src = "images/copy.png";
	scaleCopyIcon.style.width = "12px";
	scaleCopyIcon.style.height = "12px";
	scaleCopyIcon.style.display = "block";
	scaleCopyIcon.style.margin = "0 auto";
	scaleCopyButton.dom.appendChild(scaleCopyIcon);

	const scalePasteButton = new UIButton("")
		.setMarginLeft("2px")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				// 优先使用单一属性剪贴板，如果没有则使用全局剪贴板
				const scaleData = singlePropertyClipboard.scale || clipboard.scale;

				if (scaleData !== null) {
					editor.execute(
						new SetScaleCommand(editor, editor.selected, scaleData.clone())
					);
					editor.showNotification("缩放数据粘贴成功");
				}
			}
		});

	scalePasteButton.dom.title = "粘贴";

	// 添加粘贴图标
	const scalePasteIcon = document.createElement("img");
	scalePasteIcon.src = "images/paste.png";
	scalePasteIcon.style.width = "12px";
	scalePasteIcon.style.height = "12px";
	scalePasteIcon.style.display = "block";
	scalePasteIcon.style.margin = "0 auto";
	scalePasteButton.dom.appendChild(scalePasteIcon);

	// 默认隐藏复制粘贴按钮
	scaleCopyButton.dom.style.display = "none";
	scalePasteButton.dom.style.display = "none";

	// 添加鼠标悬停事件
	objectScaleRow.dom.addEventListener("mouseenter", function () {
		scaleCopyButton.dom.style.display = "";
		scalePasteButton.dom.style.display = "";
	});
	objectScaleRow.dom.addEventListener("mouseleave", function () {
		scaleCopyButton.dom.style.display = "none";
		scalePasteButton.dom.style.display = "none";
	});

	objectScaleRow.add(
		new UIText(strings.getKey("sidebar/object/scale")).setWidth("90px")
	);
	objectScaleRow.add(objectScaleX, objectScaleY, objectScaleZ);
	objectScaleRow.add(scaleCopyButton, scalePasteButton);

	container.add(objectScaleRow);

	// 添加重置位置/旋转/缩放按钮行
	const objectResetRow = new UIRow();

	// 重置位置按钮
	const resetPositionButton = new UIButton("重置位置")
		.setWidth("80px")
		.onClick(function () {
			if (editor.selected !== null) {
				const newPosition = new THREE.Vector3(0, 0, 0);
				editor.execute(
					new SetPositionCommand(editor, editor.selected, newPosition)
				);
				editor.showNotification("位置已重置");
			}
		});

	// 重置旋转按钮
	const resetRotationButton = new UIButton("重置旋转")
		.setWidth("80px")
		.onClick(function () {
			if (editor.selected !== null) {
				const newRotation = new THREE.Euler(0, 0, 0);
				editor.execute(
					new SetRotationCommand(editor, editor.selected, newRotation)
				);
				editor.showNotification("旋转已重置");
			}
		});

	// 重置缩放按钮
	const resetScaleButton = new UIButton("重置缩放")
		.setWidth("80px")
		.onClick(function () {
			if (editor.selected !== null) {
				const newScale = new THREE.Vector3(1, 1, 1);
				editor.execute(new SetScaleCommand(editor, editor.selected, newScale));
				editor.showNotification("缩放已重置");
			}
		});

	objectResetRow.add(resetPositionButton);
	objectResetRow.add(resetRotationButton);
	objectResetRow.add(resetScaleButton);

	container.add(objectResetRow);

	// 添加全部变换数据的复制粘贴行
	const transformActionsRow = new UIRow();

	// 全部变换数据复制按钮
	const transformCopyButton = new UIButton("")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				const positionData = new THREE.Vector3(
					objectPositionX.getValue(),
					objectPositionY.getValue(),
					objectPositionZ.getValue()
				);
				const rotationData = new THREE.Euler(
					objectRotationX.getValue() * THREE.MathUtils.DEG2RAD,
					objectRotationY.getValue() * THREE.MathUtils.DEG2RAD,
					objectRotationZ.getValue() * THREE.MathUtils.DEG2RAD
				);
				const scaleData = new THREE.Vector3(
					objectScaleX.getValue(),
					objectScaleY.getValue(),
					objectScaleZ.getValue()
				);

				// 更新全局剪贴板
				clipboard.position = positionData;
				clipboard.rotation = rotationData;
				clipboard.scale = scaleData;

				editor.showNotification("全部数据复制成功");
			}
		});

	transformCopyButton.dom.title = "复制全部数据";

	// 添加复制图标
	const transformCopyIcon = document.createElement("img");
	transformCopyIcon.src = "images/copy.png";
	transformCopyIcon.style.width = "12px";
	transformCopyIcon.style.height = "12px";
	transformCopyIcon.style.display = "block";
	transformCopyIcon.style.margin = "0 auto";
	transformCopyButton.dom.appendChild(transformCopyIcon);

	// 全部变换数据粘贴按钮
	const transformPasteButton = new UIButton("")
		.setMarginLeft("2px")
		.setWidth("24px")
		.onClick(function () {
			if (editor.selected !== null) {
				if (clipboard.position !== null) {
					editor.execute(
						new SetPositionCommand(
							editor,
							editor.selected,
							clipboard.position.clone()
						)
					);
				}
				if (clipboard.rotation !== null) {
					editor.execute(
						new SetRotationCommand(
							editor,
							editor.selected,
							clipboard.rotation.clone()
						)
					);
				}
				if (clipboard.scale !== null) {
					editor.execute(
						new SetScaleCommand(
							editor,
							editor.selected,
							clipboard.scale.clone()
						)
					);
				}
				editor.showNotification("全部数据粘贴成功");
			}
		});

	transformPasteButton.dom.title = "粘贴全部数据";

	// 添加粘贴图标
	const transformPasteIcon = document.createElement("img");
	transformPasteIcon.src = "images/paste.png";
	transformPasteIcon.style.width = "12px";
	transformPasteIcon.style.height = "12px";
	transformPasteIcon.style.display = "block";
	transformPasteIcon.style.margin = "0 auto";
	transformPasteButton.dom.appendChild(transformPasteIcon);

	transformActionsRow.add(transformCopyButton);
	transformActionsRow.add(transformPasteButton);

	// 默认隐藏复制粘贴按钮行
	transformActionsRow.setDisplay("none");

	container.add(transformActionsRow);

	// 创建变换组边框div
	const createTransformBorder = function () {
		// 移除旧的边框（如果存在）
		const oldBorder = container.dom.querySelector(".transform-border");
		if (oldBorder) {
			container.dom.removeChild(oldBorder);
		}

		// 创建新的边框
		const transformBorder = document.createElement("div");
		transformBorder.className = "transform-border";
		transformBorder.style.position = "absolute";
		transformBorder.style.border = "1px dashed #888";
		transformBorder.style.borderRadius = "4px";
		transformBorder.style.pointerEvents = "none";
		transformBorder.style.display = "none";
		transformBorder.style.zIndex = "0";
		container.dom.appendChild(transformBorder);

		return transformBorder;
	};

	// 创建并获取边框元素
	let transformBorder = createTransformBorder();

	// 创建空白间隙行变量
	let spacerRow = null;

	// 更新边框位置和大小
	const updateBorderPosition = function () {
		if (!objectPositionRow.dom || !objectScaleRow.dom) return;

		// 计算数据区域的位置（标签宽度是90px）
		const labelWidth = 90;
		const paddingLeft = 5;

		// 获取数据区域的左边界（标签宽度+一些padding）
		const dataAreaLeft = labelWidth + paddingLeft;

		// 获取位置行的输入框区域
		const posInputX = objectPositionX.dom;
		const posInputZ = objectPositionZ.dom;
		const scaleInputZ = objectScaleZ.dom;

		// 计算数据区域的顶部和底部位置
		const posRowTop = objectPositionRow.dom.offsetTop;
		const scaleRowBottom =
			objectScaleRow.dom.offsetTop + objectScaleRow.dom.offsetHeight;

		// 计算数据区域的宽度（从第一个输入框到最后一个输入框，不包括单属性复制按钮的宽度）
		// 排除单一属性复制粘贴按钮的宽度(约52px)
		const dataAreaWidth =
			posInputZ.offsetLeft + posInputZ.offsetWidth - posInputX.offsetLeft;

		// 设置边框位置和大小，只包围数据区域（不包括单一属性复制粘贴按钮）
		transformBorder.style.top = posRowTop - 5 + "px";
		transformBorder.style.left = dataAreaLeft + "px";
		transformBorder.style.width = dataAreaWidth + "px";
		transformBorder.style.height = scaleRowBottom - posRowTop + 10 + "px";

		// 更新按钮位置，放在数据区域的正下方并水平居中
		const buttonWidth =
			transformCopyButton.dom.offsetWidth +
			transformPasteButton.dom.offsetWidth +
			2; // +2是按钮间距
		const buttonLeft = dataAreaLeft + (dataAreaWidth - buttonWidth) / 2;

		transformActionsRow.dom.style.position = "absolute";
		transformActionsRow.dom.style.left = buttonLeft + "px";
		transformActionsRow.dom.style.top = scaleRowBottom + 5 + "px";
	};

	// 创建或获取间隙行
	const getSpacerRow = function () {
		if (!spacerRow) {
			spacerRow = new UIPanel();
			spacerRow.setDisplay("none");
			spacerRow.dom.style.border = "none";
			spacerRow.dom.style.marginTop = "0";
			spacerRow.dom.style.marginBottom = "0";

			// 将间隙行插入到适当位置（在objectResetRow前）
			if (container.dom.contains(objectResetRow.dom)) {
				container.dom.insertBefore(spacerRow.dom, objectResetRow.dom);
			} else {
				container.add(spacerRow);
			}
		}
		return spacerRow;
	};

	// 显示变换操作和边框
	const showTransformActions = function () {
		transformActionsRow.setDisplay("");
		transformBorder.style.display = "block";
		updateBorderPosition();

		// 显示间隙空白行
		getSpacerRow().setDisplay("");
	};

	// 隐藏变换操作和边框
	const hideTransformActions = function () {
		transformActionsRow.setDisplay("none");
		transformBorder.style.display = "none";

		// 隐藏间隙空白行
		if (spacerRow) {
			spacerRow.setDisplay("none");
		}
	};

	// 创建一个透明的悬停区域覆盖三个变换行的数据区域
	const createHoverArea = function () {
		// 移除旧的悬停区域（如果存在）
		const oldHoverArea = container.dom.querySelector(".transform-hover-area");
		if (oldHoverArea) {
			container.dom.removeChild(oldHoverArea);
		}

		// 移除所有旧的事件监听器
		removeAllEventListeners();

		if (!objectPositionRow.dom || !objectScaleRow.dom) return;

		// 添加鼠标事件到各行而不是使用覆盖层
		// 这样就不会阻止与输入框的交互
		const rows = [objectPositionRow, objectRotationRow, objectScaleRow];

		// 计算数据区域的位置信息（用于检测鼠标是否在数据区域）
		const labelWidth = 90;
		const paddingLeft = 5;
		const dataAreaLeft = labelWidth + paddingLeft;
		const posInputX = objectPositionX.dom;
		const posInputZ = objectPositionZ.dom;
		const dataAreaWidth =
			posInputZ.offsetLeft + posInputZ.offsetWidth - posInputX.offsetLeft;

		// 用于跟踪鼠标是否在相关区域内
		let isMouseInRelevantArea = false;

		// 检查鼠标是否要隐藏工具栏的定时器
		let hideTimeout = null;

		// 检查鼠标是否在数据区域（不包括单一属性复制粘贴按钮）
		const isInDataArea = function (event, element) {
			const rect = element.getBoundingClientRect();
			const relativeX = event.clientX - rect.left;

			// 判断鼠标X坐标是否在数据区域范围内
			return (
				relativeX >= dataAreaLeft && relativeX <= dataAreaLeft + dataAreaWidth
			);
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

		// 创建一个覆盖整个变换数据区域的透明层（包括行与行之间的间隙）
		const transformAreaOverlay = document.createElement("div");
		transformAreaOverlay.className = "transform-area-overlay";
		transformAreaOverlay.style.position = "absolute";
		transformAreaOverlay.style.top = objectPositionRow.dom.offsetTop - 5 + "px";
		transformAreaOverlay.style.left = dataAreaLeft + "px";
		transformAreaOverlay.style.width = dataAreaWidth + "px";
		transformAreaOverlay.style.height =
			objectScaleRow.dom.offsetTop +
			objectScaleRow.dom.offsetHeight -
			objectPositionRow.dom.offsetTop +
			10 +
			"px";
		transformAreaOverlay.style.zIndex = "1";
		transformAreaOverlay.style.pointerEvents = "none"; // 不要阻止下层元素的事件

		container.dom.appendChild(transformAreaOverlay);

		// 全局鼠标移动事件
		const handleGlobalMouseMove = function (event) {
			// 计算鼠标是否在变换数据区域内
			const overlayRect = transformAreaOverlay.getBoundingClientRect();
			const inOverlayArea =
				event.clientX >= overlayRect.left &&
				event.clientX <= overlayRect.right &&
				event.clientY >= overlayRect.top &&
				event.clientY <= overlayRect.bottom;

			const inButtonArea = isInButtonArea(event);

			// 更新状态
			isMouseInRelevantArea =
				inOverlayArea ||
				inButtonArea ||
				transformActionsRow.dom.contains(event.target) ||
				transformCopyButton.dom.contains(event.target) ||
				transformPasteButton.dom.contains(event.target);

			// 根据鼠标位置决定显示或隐藏
			if (isMouseInRelevantArea) {
				safeShowTransformActions();
			} else if (transformActionsRow.dom.style.display !== "none") {
				safeHideTransformActions();
			}
		};

		// 为document添加鼠标移动事件
		addEventListenerWithRef(document, "mousemove", handleGlobalMouseMove);

		// 为复制粘贴按钮添加单独的鼠标事件
		addEventListenerWithRef(transformCopyButton.dom, "mouseenter", function () {
			isMouseInRelevantArea = true;
			safeShowTransformActions();
		});

		addEventListenerWithRef(
			transformPasteButton.dom,
			"mouseenter",
			function () {
				isMouseInRelevantArea = true;
				safeShowTransformActions();
			}
		);

		// 为按钮行添加事件
		addEventListenerWithRef(transformActionsRow.dom, "mouseenter", function () {
			isMouseInRelevantArea = true;
			safeShowTransformActions();
		});

		// 在document上添加全局点击事件，用于处理点击按钮后的状态
		addEventListenerWithRef(document, "click", function (event) {
			if (
				transformCopyButton.dom.contains(event.target) ||
				transformPasteButton.dom.contains(event.target)
			) {
				// 如果点击的是复制或粘贴按钮，保持显示一小段时间后隐藏
				setTimeout(function () {
					isMouseInRelevantArea = false;
					hideTransformActions();
				}, 200);
			}
		});
	};

	// 在选择对象时更新UI并创建悬停区域
	signals.objectSelected.add(function () {
		// 延迟执行以确保DOM已更新
		setTimeout(function () {
			createHoverArea();
			transformBorder = createTransformBorder();
		}, 100);
	});

	// fov

	const objectFovRow = new UIRow();
	const objectFov = new UINumber().onChange(update);

	objectFovRow.add(
		new UIText(strings.getKey("sidebar/object/fov")).setWidth("90px")
	);
	objectFovRow.add(objectFov);

	container.add(objectFovRow);

	// left

	const objectLeftRow = new UIRow();
	const objectLeft = new UINumber().onChange(update);

	objectLeftRow.add(
		new UIText(strings.getKey("sidebar/object/left")).setWidth("90px")
	);
	objectLeftRow.add(objectLeft);

	container.add(objectLeftRow);

	// right

	const objectRightRow = new UIRow();
	const objectRight = new UINumber().onChange(update);

	objectRightRow.add(
		new UIText(strings.getKey("sidebar/object/right")).setWidth("90px")
	);
	objectRightRow.add(objectRight);

	container.add(objectRightRow);

	// top

	const objectTopRow = new UIRow();
	const objectTop = new UINumber().onChange(update);

	objectTopRow.add(
		new UIText(strings.getKey("sidebar/object/top")).setWidth("90px")
	);
	objectTopRow.add(objectTop);

	container.add(objectTopRow);

	// bottom

	const objectBottomRow = new UIRow();
	const objectBottom = new UINumber().onChange(update);

	objectBottomRow.add(
		new UIText(strings.getKey("sidebar/object/bottom")).setWidth("90px")
	);
	objectBottomRow.add(objectBottom);

	container.add(objectBottomRow);

	// near

	const objectNearRow = new UIRow();
	const objectNear = new UINumber().onChange(update);

	objectNearRow.add(
		new UIText(strings.getKey("sidebar/object/near")).setWidth("90px")
	);
	objectNearRow.add(objectNear);

	container.add(objectNearRow);

	// far

	const objectFarRow = new UIRow();
	const objectFar = new UINumber().onChange(update);

	objectFarRow.add(
		new UIText(strings.getKey("sidebar/object/far")).setWidth("90px")
	);
	objectFarRow.add(objectFar);

	container.add(objectFarRow);

	// intensity

	const objectIntensityRow = new UIRow();
	const objectIntensity = new UINumber().onChange(update);

	objectIntensityRow.add(
		new UIText(strings.getKey("sidebar/object/intensity")).setWidth("90px")
	);
	objectIntensityRow.add(objectIntensity);

	container.add(objectIntensityRow);

	// color

	const objectColorRow = new UIRow();
	const objectColor = new UIColor().onInput(update);

	objectColorRow.add(
		new UIText(strings.getKey("sidebar/object/color")).setWidth("90px")
	);
	objectColorRow.add(objectColor);

	container.add(objectColorRow);

	// ground color

	const objectGroundColorRow = new UIRow();
	const objectGroundColor = new UIColor().onInput(update);

	objectGroundColorRow.add(
		new UIText(strings.getKey("sidebar/object/groundcolor")).setWidth("90px")
	);
	objectGroundColorRow.add(objectGroundColor);

	container.add(objectGroundColorRow);

	// distance

	const objectDistanceRow = new UIRow();
	const objectDistance = new UINumber().setRange(0, Infinity).onChange(update);

	objectDistanceRow.add(
		new UIText(strings.getKey("sidebar/object/distance")).setWidth("90px")
	);
	objectDistanceRow.add(objectDistance);

	container.add(objectDistanceRow);

	// angle

	const objectAngleRow = new UIRow();
	const objectAngle = new UINumber()
		.setPrecision(3)
		.setRange(0, Math.PI / 2)
		.onChange(update);

	objectAngleRow.add(
		new UIText(strings.getKey("sidebar/object/angle")).setWidth("90px")
	);
	objectAngleRow.add(objectAngle);

	container.add(objectAngleRow);

	// penumbra

	const objectPenumbraRow = new UIRow();
	const objectPenumbra = new UINumber().setRange(0, 1).onChange(update);

	objectPenumbraRow.add(
		new UIText(strings.getKey("sidebar/object/penumbra")).setWidth("90px")
	);
	objectPenumbraRow.add(objectPenumbra);

	//container.add(objectPenumbraRow)

	// decay

	const objectDecayRow = new UIRow();
	const objectDecay = new UINumber().setRange(0, Infinity).onChange(update);

	objectDecayRow.add(
		new UIText(strings.getKey("sidebar/object/decay")).setWidth("90px")
	);
	objectDecayRow.add(objectDecay);

	//container.add(objectDecayRow)

	// shadow

	const objectShadowRow = new UIRow();

	objectShadowRow.add(
		new UIText(strings.getKey("sidebar/object/shadow")).setWidth("90px")
	);

	const objectCastShadow = new UIBoolean(
		false,
		strings.getKey("sidebar/object/cast")
	).onChange(update);
	objectShadowRow.add(objectCastShadow);

	const objectReceiveShadow = new UIBoolean(
		false,
		strings.getKey("sidebar/object/receive")
	).onChange(update);
	objectShadowRow.add(objectReceiveShadow);

	//container.add(objectShadowRow)

	// shadow bias

	const objectShadowBiasRow = new UIRow();

	objectShadowBiasRow.add(
		new UIText(strings.getKey("sidebar/object/shadowBias")).setWidth("90px")
	);

	const objectShadowBias = new UINumber(0)
		.setPrecision(5)
		.setStep(0.0001)
		.setNudge(0.00001)
		.onChange(update);
	objectShadowBiasRow.add(objectShadowBias);

	//container.add(objectShadowBiasRow)

	// shadow normal offset

	const objectShadowNormalBiasRow = new UIRow();

	objectShadowNormalBiasRow.add(
		new UIText(strings.getKey("sidebar/object/shadowNormalBias")).setWidth(
			"90px"
		)
	);

	const objectShadowNormalBias = new UINumber(0).onChange(update);
	objectShadowNormalBiasRow.add(objectShadowNormalBias);

	//container.add(objectShadowNormalBiasRow)

	// shadow radius

	const objectShadowRadiusRow = new UIRow();

	objectShadowRadiusRow.add(
		new UIText(strings.getKey("sidebar/object/shadowRadius")).setWidth("90px")
	);

	const objectShadowRadius = new UINumber(1).onChange(update);
	objectShadowRadiusRow.add(objectShadowRadius);

	//container.add(objectShadowRadiusRow)

	// visible

	const objectVisibleRow = new UIRow();
	const objectVisible = new UICheckbox().onChange(update);

	objectVisibleRow.add(
		new UIText(strings.getKey("sidebar/object/visible")).setWidth("90px")
	);
	objectVisibleRow.add(objectVisible);

	container.add(objectVisibleRow);

	// loop
	const objectLoopRow = new UIRow();
	const objectLoop = new UICheckbox().onChange(update);

	objectLoopRow.add(
		new UIText(strings.getKey("sidebar/object/loop")).setWidth("90px")
	);
	objectLoopRow.add(objectLoop);

	container.add(objectLoopRow);

	// frustumCulled

	const objectFrustumCulledRow = new UIRow();
	const objectFrustumCulled = new UICheckbox().onChange(update);

	objectFrustumCulledRow.add(
		new UIText(strings.getKey("sidebar/object/frustumcull")).setWidth("90px")
	);
	objectFrustumCulledRow.add(objectFrustumCulled);

	//！！	container.add(objectFrustumCulledRow)

	// renderOrder

	const objectRenderOrderRow = new UIRow();
	const objectRenderOrder = new UIInteger().setWidth("50px").onChange(update);

	objectRenderOrderRow.add(
		new UIText(strings.getKey("sidebar/object/renderorder")).setWidth("90px")
	);
	objectRenderOrderRow.add(objectRenderOrder);

	//container.add(objectRenderOrderRow)

	// 文本组件的文本输入
	const objectTextRow = new UIRow();
	const objectText = new UIInput()
		.setWidth("150px")
		.setFontSize("12px")
		.onChange(function () {
			if (editor.selected && editor.selected.type === "Text") {
				const newText = objectText.getValue();

				const userData = JSON.parse(objectUserData.getValue());
				userData.text = newText;

				objectUserData.setValue(JSON.stringify(userData, null, "  "));

				editor.execute(
					new SetValueCommand(editor, editor.selected, "userData", userData)
				);

				updateTextObject(editor.selected, newText);
			}
		});

	objectTextRow.add(
		new UIText(strings.getKey("sidebar/object/text")).setWidth("90px")
	);
	objectTextRow.add(objectText);
	container.add(objectTextRow);
	objectTextRow.setDisplay("none"); // 默认隐藏，仅当是文本组件时显示

	// user data

	const objectUserDataRow = new UIRow();
	const objectUserData = new UITextArea()
		.setWidth("150px")
		.setHeight("40px")
		.setFontSize("12px")
		.onChange(update);
	objectUserData.onKeyUp(function () {
		try {
			JSON.parse(objectUserData.getValue());
			objectUserData.dom.classList.add("success");
			objectUserData.dom.classList.remove("fail");
		} catch (error) {
			objectUserData.dom.classList.remove("success");
			objectUserData.dom.classList.add("fail");
		}
	});

	objectUserDataRow.add(
		new UIText(strings.getKey("sidebar/object/userdata")).setWidth("90px")
	);
	objectUserDataRow.add(objectUserData);
	objectUserDataRow.readOnly = true;
	container.add(objectUserDataRow);

	function updateTextObject(textObject, newText) {
		const oldGeometry = textObject.geometry;
		const oldMaterial = textObject.material;

		const factory = new MetaFactory(editor);
		const newMesh = factory.createTextMesh(newText);

		textObject.geometry.dispose(); // 释放旧几何体
		textObject.geometry = newMesh.geometry;

		if (oldMaterial.map) {
			oldMaterial.map.dispose();
		}
		textObject.material = newMesh.material;

		textObject.userData._textContent = newText;

		editor.signals.objectChanged.dispatch(textObject);
	}

	//

	function update() {
		const object = editor.selected;

		if (object !== null) {
			const newPosition = new THREE.Vector3(
				objectPositionX.getValue(),
				objectPositionY.getValue(),
				objectPositionZ.getValue()
			);
			if (object.position.distanceTo(newPosition) >= 0.01) {
				editor.execute(new SetPositionCommand(editor, object, newPosition));
			}

			const newRotation = new THREE.Euler(
				objectRotationX.getValue() * THREE.MathUtils.DEG2RAD,
				objectRotationY.getValue() * THREE.MathUtils.DEG2RAD,
				objectRotationZ.getValue() * THREE.MathUtils.DEG2RAD
			);
			if (
				new THREE.Vector3()
					.setFromEuler(object.rotation)
					.distanceTo(new THREE.Vector3().setFromEuler(newRotation)) >= 0.01
			) {
				editor.execute(new SetRotationCommand(editor, object, newRotation));
			}

			const newScale = new THREE.Vector3(
				objectScaleX.getValue(),
				objectScaleY.getValue(),
				objectScaleZ.getValue()
			);
			if (object.scale.distanceTo(newScale) >= 0.01) {
				editor.execute(new SetScaleCommand(editor, object, newScale));
			}

			if (
				object.fov !== undefined &&
				Math.abs(object.fov - objectFov.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "fov", objectFov.getValue())
				);
				object.updateProjectionMatrix();
			}

			if (
				object.left !== undefined &&
				Math.abs(object.left - objectLeft.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "left", objectLeft.getValue())
				);
				object.updateProjectionMatrix();
			}

			if (
				object.right !== undefined &&
				Math.abs(object.right - objectRight.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "right", objectRight.getValue())
				);
				object.updateProjectionMatrix();
			}

			if (
				object.top !== undefined &&
				Math.abs(object.top - objectTop.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "top", objectTop.getValue())
				);
				object.updateProjectionMatrix();
			}

			if (
				object.bottom !== undefined &&
				Math.abs(object.bottom - objectBottom.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "bottom", objectBottom.getValue())
				);
				object.updateProjectionMatrix();
			}

			if (
				object.near !== undefined &&
				Math.abs(object.near - objectNear.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "near", objectNear.getValue())
				);
				if (object.isOrthographicCamera) {
					object.updateProjectionMatrix();
				}
			}

			if (
				object.far !== undefined &&
				Math.abs(object.far - objectFar.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "far", objectFar.getValue())
				);
				if (object.isOrthographicCamera) {
					object.updateProjectionMatrix();
				}
			}

			if (
				object.intensity !== undefined &&
				Math.abs(object.intensity - objectIntensity.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"intensity",
						objectIntensity.getValue()
					)
				);
			}

			if (
				object.color !== undefined &&
				object.color.getHex() !== objectColor.getHexValue()
			) {
				editor.execute(
					new SetColorCommand(
						editor,
						object,
						"color",
						objectColor.getHexValue()
					)
				);
			}

			if (
				object.groundColor !== undefined &&
				object.groundColor.getHex() !== objectGroundColor.getHexValue()
			) {
				editor.execute(
					new SetColorCommand(
						editor,
						object,
						"groundColor",
						objectGroundColor.getHexValue()
					)
				);
			}

			if (
				object.distance !== undefined &&
				Math.abs(object.distance - objectDistance.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"distance",
						objectDistance.getValue()
					)
				);
			}

			if (
				object.angle !== undefined &&
				Math.abs(object.angle - objectAngle.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "angle", objectAngle.getValue())
				);
			}

			if (
				object.penumbra !== undefined &&
				Math.abs(object.penumbra - objectPenumbra.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"penumbra",
						objectPenumbra.getValue()
					)
				);
			}

			if (
				object.decay !== undefined &&
				Math.abs(object.decay - objectDecay.getValue()) >= 0.01
			) {
				editor.execute(
					new SetValueCommand(editor, object, "decay", objectDecay.getValue())
				);
			}

			if (object.visible !== objectVisible.getValue()) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"visible",
						objectVisible.getValue()
					)
				);
			}

			if (object.frustumCulled !== objectFrustumCulled.getValue()) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"frustumCulled",
						objectFrustumCulled.getValue()
					)
				);
			}

			if (object.renderOrder !== objectRenderOrder.getValue()) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"renderOrder",
						objectRenderOrder.getValue()
					)
				);
			}

			if (
				object.castShadow !== undefined &&
				object.castShadow !== objectCastShadow.getValue()
			) {
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"castShadow",
						objectCastShadow.getValue()
					)
				);
			}

			if (object.receiveShadow !== objectReceiveShadow.getValue()) {
				if (object.material !== undefined) object.material.needsUpdate = true;
				editor.execute(
					new SetValueCommand(
						editor,
						object,
						"receiveShadow",
						objectReceiveShadow.getValue()
					)
				);
			}

			if (object.shadow !== undefined) {
				if (object.shadow.bias !== objectShadowBias.getValue()) {
					editor.execute(
						new SetValueCommand(
							editor,
							object.shadow,
							"bias",
							objectShadowBias.getValue()
						)
					);
				}

				if (object.shadow.normalBias !== objectShadowNormalBias.getValue()) {
					editor.execute(
						new SetValueCommand(
							editor,
							object.shadow,
							"normalBias",
							objectShadowNormalBias.getValue()
						)
					);
				}

				if (object.shadow.radius !== objectShadowRadius.getValue()) {
					editor.execute(
						new SetValueCommand(
							editor,
							object.shadow,
							"radius",
							objectShadowRadius.getValue()
						)
					);
				}
			}

			try {
				const userData = JSON.parse(objectUserData.getValue());
				if (JSON.stringify(object.userData) != JSON.stringify(userData)) {
					editor.execute(
						new SetValueCommand(editor, object, "userData", userData)
					);
				}
			} catch (exception) {
				console.warn(exception);
			}

			if (isMediaType(object)) {
				if (object.userData.loop !== objectLoop.getValue()) {
					const userData = JSON.parse(JSON.stringify(object.userData));
					userData.loop = objectLoop.getValue();

					editor.execute(
						new SetValueCommand(
							editor,
							object,
							"userData",
							userData
						)
					);
				}
			}
		}
	}

	function updateRows(object) {
		const properties = {
			fov: objectFovRow,
			left: objectLeftRow,
			right: objectRightRow,
			top: objectTopRow,
			bottom: objectBottomRow,
			near: objectNearRow,
			far: objectFarRow,
			intensity: objectIntensityRow,
			color: objectColorRow,
			groundColor: objectGroundColorRow,
			distance: objectDistanceRow,
			angle: objectAngleRow,
			penumbra: objectPenumbraRow,
			decay: objectDecayRow,
			castShadow: objectShadowRow,
			receiveShadow: objectReceiveShadow,
			shadow: [
				objectShadowBiasRow,
				objectShadowNormalBiasRow,
				objectShadowRadiusRow,
			],
		};

		for (const property in properties) {
			const uiElement = properties[property];

			if (Array.isArray(uiElement) === true) {
				for (let i = 0; i < uiElement.length; i++) {
					uiElement[i].setDisplay(object[property] !== undefined ? "" : "none");
				}
			} else {
				uiElement.setDisplay(object[property] !== undefined ? "" : "none");
			}
		}

		const isMediaObject = isMediaType(object);
		objectLoopRow.setDisplay(isMediaObject ? "" : "none");

		//

		if (object.isLight) {
			objectReceiveShadow.setDisplay("none");
		}

		if (object.isAmbientLight || object.isHemisphereLight) {
			objectShadowRow.setDisplay("none");
		}
	}

	// 判断对象是否为音频或视频类型
	function isMediaType(object) {
		if (object.userData && object.userData.type) {
			const type = object.userData.type.toLowerCase();
			if (type === 'video' || type === 'sound') return true;


			// if (type === 'particle') {
			// 	if (object.userData.isVideo || object.userData.isAudio) return true;
			// }
		}

		if (object.name) {
			const name = object.name.toLowerCase();
			if (name.includes('[video]') || name.includes('[sound]')) return true;

		}

		return false;
	}

	function updateTransformRows(object) {
		if (
			object.isLight ||
			(object.isObject3D && object.userData.targetInverse)
		) {
			objectRotationRow.setDisplay("none");
			objectScaleRow.setDisplay("none");
		} else {
			objectRotationRow.setDisplay("");
			objectScaleRow.setDisplay("");
		}
	}

	// events

	signals.objectSelected.add(function (object) {
		if (object !== null) {
			const selectedObjects = editor.getSelectedObjects();

			if (selectedObjects.length > 1) {
				// 多选模式，隐藏单对象面板
				container.setDisplay("none");
			} else {
				// 单选模式，显示单对象面板
				container.setDisplay("block");
				updateRows(object);
				updateUI(object);
			}
		} else {
			container.setDisplay("none");
		}
	});

	signals.objectChanged.add(function (object) {
		if (object !== editor.selected) return;

		updateUI(object);
	});

	signals.refreshSidebarObject3D.add(function (object) {
		if (object !== editor.selected) return;

		updateUI(object);
	});

	function updateUI(object) {
		objectType.setValue(object.type);

		objectUUID.setValue(object.uuid);
		objectName.setValue(object.name);

		objectPositionX.setValue(object.position.x);
		objectPositionY.setValue(object.position.y);
		objectPositionZ.setValue(object.position.z);

		objectRotationX.setValue(object.rotation.x * THREE.MathUtils.RAD2DEG);
		objectRotationY.setValue(object.rotation.y * THREE.MathUtils.RAD2DEG);
		objectRotationZ.setValue(object.rotation.z * THREE.MathUtils.RAD2DEG);

		objectScaleX.setValue(object.scale.x);
		objectScaleY.setValue(object.scale.y);
		objectScaleZ.setValue(object.scale.z);

		if (object.fov !== undefined) {
			objectFov.setValue(object.fov);
		}

		if (object.left !== undefined) {
			objectLeft.setValue(object.left);
		}

		if (object.right !== undefined) {
			objectRight.setValue(object.right);
		}

		if (object.top !== undefined) {
			objectTop.setValue(object.top);
		}

		if (object.bottom !== undefined) {
			objectBottom.setValue(object.bottom);
		}

		if (object.near !== undefined) {
			objectNear.setValue(object.near);
		}

		if (object.far !== undefined) {
			objectFar.setValue(object.far);
		}

		if (object.intensity !== undefined) {
			objectIntensity.setValue(object.intensity);
		}

		if (object.color !== undefined) {
			objectColor.setHexValue(object.color.getHexString());
		}

		if (object.groundColor !== undefined) {
			objectGroundColor.setHexValue(object.groundColor.getHexString());
		}

		if (object.distance !== undefined) {
			objectDistance.setValue(object.distance);
		}

		if (object.angle !== undefined) {
			objectAngle.setValue(object.angle);
		}

		if (object.penumbra !== undefined) {
			objectPenumbra.setValue(object.penumbra);
		}

		if (object.decay !== undefined) {
			objectDecay.setValue(object.decay);
		}

		if (object.castShadow !== undefined) {
			objectCastShadow.setValue(object.castShadow);
		}

		if (object.receiveShadow !== undefined) {
			objectReceiveShadow.setValue(object.receiveShadow);
		}

		if (object.shadow !== undefined) {
			objectShadowBias.setValue(object.shadow.bias);
			objectShadowNormalBias.setValue(object.shadow.normalBias);
			objectShadowRadius.setValue(object.shadow.radius);
		}

		//console.error( 'object', object );
		objectVisible.setValue(object.visible);
		objectFrustumCulled.setValue(object.frustumCulled);
		objectRenderOrder.setValue(object.renderOrder);

		try {
			objectUserData.setValue(JSON.stringify(object.userData, null, "  "));
		} catch (error) {
			console.log(error);
		}

		objectUserData.setBorderColor("transparent");
		objectUserData.setBackgroundColor("");

		if (object.type.toLowerCase() === "text") {
			objectTextRow.setDisplay("");

			let textContent = "";
			if (object.userData) {
				if (object.userData.text) {
					textContent = object.userData.text;
				} else if (object.userData._textContent) {
					textContent = object.userData._textContent;
					object.userData.text = textContent;
					objectUserData.setValue(JSON.stringify(object.userData, null, "  "));
				}
			}
			objectText.setValue(textContent);
		} else {
			objectTextRow.setDisplay("none");
		}

		updateTransformRows(object);

		if (isMediaType(object)) {
			if (object.userData && object.userData.loop !== undefined) {
				objectLoop.setValue(object.userData.loop);
			}
			else {
				objectLoop.setValue(false);
			}
		}
	}

	return container;
}

export { SidebarObject };
