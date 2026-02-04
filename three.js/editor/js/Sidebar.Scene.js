import * as THREE from 'three';

import {
	UIPanel,
	UIBreak,
	UIRow,
	UIColor,
	UISelect,
	UIText,
	UINumber
} from './libs/ui.js';
import { UIOutliner, UITexture } from './libs/ui.three.js';
import { RemoveObjectCommand } from './commands/RemoveObjectCommand.js';

function SidebarScene(editor) {

	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('20px');

	// outliner

	const nodeStates = new WeakMap();

	function hasVisibleChildren(object) {

		return object.children.some(child => !(child.userData && child.userData.hidden === true));

	}

	function buildOption(object, draggable) {

		const option = document.createElement('div');
		option.draggable = draggable;
		option.innerHTML = buildHTML(object);
		option.value = object.id;

		// 检查资源是否存在
		if (object.userData && object.userData.resource) {
			const resourceId = object.userData.resource;
			// 检查资源是否存在
			let resourceExists = false;

			// 检查资源是否在editor.resources或window.resources中存在
			if (editor.data.resources && Array.isArray(editor.data.resources)) {
				resourceExists = editor.data.resources.some(resource =>
					resource && resource.id === parseInt(resourceId)
				);
			}

			// 如果在全局资源集合中存在
			if (!resourceExists && window.resources) {
				resourceExists = window.resources.has(resourceId.toString());
			}

			// 如果资源不存在，添加禁用状态
			if (!resourceExists) {
				option.classList.add('resource-missing');
				option.style.opacity = '0.5';
				// option.style.pointerEvents = 'none';
				// option.style.cursor = 'not-allowed';
				// 允许选择缺失资源的对象，去掉pointerEvents: none
				option.setAttribute('title', '该资源不存在');
				option.dataset.tooltip = '该资源不存在';

				// 添加删除按钮
				const deleteButton = document.createElement('img');
				deleteButton.src = 'images/delete.png';
				deleteButton.style.float = 'right';
				deleteButton.style.width = '16px';
				deleteButton.style.height = '16px';
				deleteButton.style.margin = '2px';
				deleteButton.style.cursor = 'pointer';
				deleteButton.style.pointerEvents = 'auto';
				deleteButton.title = '删除';

				// 确保删除按钮不会覆盖整个选项的悬停提示
				deleteButton.addEventListener('mouseover', function (event) {
					event.stopPropagation();
				});

				// 阻止事件冒泡，让删除按钮可点击
				deleteButton.addEventListener('click', function (event) {
					event.stopPropagation();
					event.preventDefault();

					if (object !== null && object.parent !== null) {
						editor.execute(new RemoveObjectCommand(editor, object));
					}
				});

				option.appendChild(deleteButton);
			}
		}

		// opener

		if (nodeStates.has(object)) {

			const state = nodeStates.get(object);

			const opener = document.createElement('span');
			opener.classList.add('opener');

			if (object.children.length > 0 && (object.isScene || hasVisibleChildren(object))) {

				opener.classList.add(state ? 'open' : 'closed');

			}


			opener.addEventListener('click', function () {

				nodeStates.set(object, nodeStates.get(object) === false); // toggle
				refreshUI();

			});

			option.insertBefore(opener, option.firstChild);

		}

		return option;

	}

	function getMaterialName(material) {

		if (Array.isArray(material)) {

			const array = [];

			for (let i = 0; i < material.length; i++) {

				array.push(material[i].name);

			}

			return array.join(',');

		}

		return material.name;

	}

	function escapeHTML(html) {

		return html
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

	}

	function getObjectType(object) {

		if (object.isScene) return 'Scene';
		if (object.isCamera) return 'Camera';
		if (object.isLight) return 'Light';
		// if (object.isMesh) return 'Mesh';
		// if (object.isLine) return 'Line';
		// if (object.isPoints) return 'Points';
		//const type = object.userData && object.userData.type ? object.userData.type.toLowerCase() : '';
		const type = object.type.toLowerCase();
		if (type === 'module') return 'Module';
		if (type === 'entity') return 'Point'
		if (type === 'text') return 'Text';
		if (type === 'polygen') return 'Polygen'
		if (type === 'picture') return 'Picture';
		if (type === 'video') return 'Video';
		if (type === 'sound') return 'Audio';
		if (type === 'prototype') return 'Prototype';

		return 'Object3D_4';

	}

	function buildHTML(object) {

		// 只保留前面的类型指示器圆点
		let html = `<span class="type ${getObjectType(
			object
		)}"></span> ${escapeHTML(object.name)}`;

		// --- 隐藏关于 Mesh 的 Geometry 和 Material 的额外圆点代码 ---
		// if (object.isMesh) {
		// 	const geometry = object.geometry;
		// 	const material = object.material;

		// 	html += ` <span class="type Geometry"></span> ${escapeHTML(
		// 		geometry.name
		// 	)}`;
		// 	html += ` <span class="type Material"></span> ${escapeHTML(
		// 		getMaterialName(material)
		// 	)}`;

		// }

		// --- 隐藏关于 Script 的额外圆点代码 ---
		// html += getScript(object.uuid);

		return html;

	}

	function getScript(uuid) {

		if (editor.scripts[uuid] !== undefined) {

			return ' <span class="type Script"></span>';

		}

		return '';

	}

	let ignoreObjectSelectedSignal = false;

	const outliner = new UIOutliner(editor);
	outliner.setId('outliner');
	outliner.onChange(function () {
		ignoreObjectSelectedSignal = true;

		const selectedValues = outliner.getValues();
		const mainValue = outliner.getValue();
		const mainId = mainValue ? parseInt(mainValue) : null;

		// 暂时禁用信号以避免多次触发
		const originalActive = editor.signals.objectSelected.active;
		editor.signals.objectSelected.active = false;

		// 清除当前选择
		editor.deselect();

		// 添加所有选中项（除了主选中项）
		for (const val of selectedValues) {
			const id = parseInt(val);
			if (id !== mainId) {
				const obj = editor.scene.getObjectById(id);
				if (obj) editor.select(obj, true);
			}
		}

		// 最后添加主选中项，确保它成为editor.selected
		if (mainId) {
			const obj = editor.scene.getObjectById(mainId);
			if (obj) editor.select(obj, true);
		}

		// 恢复信号并发送最终选择
		editor.signals.objectSelected.active = originalActive;
		editor.signals.objectSelected.dispatch(editor.selected);

		ignoreObjectSelectedSignal = false;
	});

	outliner.onDblClick(function () {

		editor.focusById(parseInt(outliner.getValue()));

	});
	container.add(outliner);
	container.add(new UIBreak());

	// background

	const backgroundRow = new UIRow();

	const backgroundType = new UISelect()
		.setOptions({
			None: '',
			Color: 'Color',
			Texture: 'Texture',
			Equirectangular: 'Equirect'
		})
		.setWidth('150px');
	backgroundType.onChange(function () {

		onBackgroundChanged();
		refreshBackgroundUI();

	});

	backgroundRow.add(
		new UIText(strings.getKey('sidebar/scene/background')).setWidth('90px')
	);
	backgroundRow.add(backgroundType);

	const backgroundColor = new UIColor()
		.setValue('#000000')
		.setMarginLeft('8px')
		.onInput(onBackgroundChanged);
	backgroundRow.add(backgroundColor);

	const backgroundTexture = new UITexture()
		.setMarginLeft('8px')
		.onChange(onBackgroundChanged);
	backgroundTexture.setDisplay('none');
	backgroundRow.add(backgroundTexture);

	const backgroundEquirectangularTexture = new UITexture()
		.setMarginLeft('8px')
		.onChange(onBackgroundChanged);
	backgroundEquirectangularTexture.setDisplay('none');
	backgroundRow.add(backgroundEquirectangularTexture);

	container.add(backgroundRow);

	function onBackgroundChanged() {

		signals.sceneBackgroundChanged.dispatch(
			backgroundType.getValue(),
			backgroundColor.getHexValue(),
			backgroundTexture.getValue(),
			backgroundEquirectangularTexture.getValue()
		);

	}

	function refreshBackgroundUI() {

		const type = backgroundType.getValue();

		backgroundType.setWidth(type === 'None' ? '150px' : '110px');
		backgroundColor.setDisplay(type === 'Color' ? '' : 'none');
		backgroundTexture.setDisplay(type === 'Texture' ? '' : 'none');
		backgroundEquirectangularTexture.setDisplay(
			type === 'Equirectangular' ? '' : 'none'
		);

	}

	// environment

	const environmentRow = new UIRow();

	const environmentType = new UISelect()
		.setOptions({
			None: '',
			Equirectangular: 'Equirect',
			ModelViewer: 'ModelViewer'
		})
		.setWidth('150px');
	environmentType.setValue('None');
	environmentType.onChange(function () {

		onEnvironmentChanged();
		refreshEnvironmentUI();

	});

	environmentRow.add(
		new UIText(strings.getKey('sidebar/scene/environment')).setWidth('90px')
	);
	environmentRow.add(environmentType);

	const environmentEquirectangularTexture = new UITexture()
		.setMarginLeft('8px')
		.onChange(onEnvironmentChanged);
	environmentEquirectangularTexture.setDisplay('none');
	environmentRow.add(environmentEquirectangularTexture);

	//container.add(environmentRow);

	function onEnvironmentChanged() {

		signals.sceneEnvironmentChanged.dispatch(
			environmentType.getValue(),
			environmentEquirectangularTexture.getValue()
		);

	}

	function refreshEnvironmentUI() {

		const type = environmentType.getValue();

		environmentType.setWidth(type !== 'Equirectangular' ? '150px' : '110px');
		environmentEquirectangularTexture.setDisplay(
			type === 'Equirectangular' ? '' : 'none'
		);

	}

	// fog

	function onFogChanged() {

		signals.sceneFogChanged.dispatch(
			fogType.getValue(),
			fogColor.getHexValue(),
			fogNear.getValue(),
			fogFar.getValue(),
			fogDensity.getValue()
		);

	}

	function onFogSettingsChanged() {

		signals.sceneFogSettingsChanged.dispatch(
			fogType.getValue(),
			fogColor.getHexValue(),
			fogNear.getValue(),
			fogFar.getValue(),
			fogDensity.getValue()
		);

	}

	const fogTypeRow = new UIRow();
	const fogType = new UISelect()
		.setOptions({
			None: '',
			Fog: 'Linear',
			FogExp2: 'Exponential'
		})
		.setWidth('150px');
	fogType.onChange(function () {

		onFogChanged();
		refreshFogUI();

	});

	fogTypeRow.add(
		new UIText(strings.getKey('sidebar/scene/fog')).setWidth('90px')
	);
	fogTypeRow.add(fogType);

	//container.add(fogTypeRow);

	// fog color

	const fogPropertiesRow = new UIRow();
	fogPropertiesRow.setDisplay('none');
	fogPropertiesRow.setMarginLeft('90px');
	container.add(fogPropertiesRow);

	const fogColor = new UIColor().setValue('#aaaaaa');
	fogColor.onInput(onFogSettingsChanged);
	fogPropertiesRow.add(fogColor);

	// fog near

	const fogNear = new UINumber(0.1)
		.setWidth('40px')
		.setRange(0, Infinity)
		.onChange(onFogSettingsChanged);
	fogPropertiesRow.add(fogNear);

	// fog far

	const fogFar = new UINumber(50)
		.setWidth('40px')
		.setRange(0, Infinity)
		.onChange(onFogSettingsChanged);
	fogPropertiesRow.add(fogFar);

	// fog density

	const fogDensity = new UINumber(0.05)
		.setWidth('40px')
		.setRange(0, 0.1)
		.setStep(0.001)
		.setPrecision(3)
		.onChange(onFogSettingsChanged);
	fogPropertiesRow.add(fogDensity);

	//

	function refreshUI() {

		const camera = editor.camera;
		const scene = editor.scene;

		const options = [];

		//options.push(buildOption(camera, false));
		options.push(buildOption(scene, false));
		(function addObjects(objects, pad) {

			for (let i = 0, l = objects.length; i < l; i++) {

				const object = objects[i];

				if (nodeStates.has(object) === false) {

					nodeStates.set(object, false);

				}

				if (editor.selector(object)) {

					if (object.userData.draggable != undefined) {

						const option = buildOption(object, object.userData.draggable);
						option.style.paddingLeft = pad * 18 + 'px';
						options.push(option);

					} else {

						const option = buildOption(object, true);
						option.style.paddingLeft = pad * 18 + 'px';
						options.push(option);

					}
				}


				if (nodeStates.get(object) === true) {

					addObjects(object.children, pad + 1);

				}

			}

		})(scene.children, 0);

		outliner.setOptions(options);

		// 获取所有选中对象
		const selectedObjects = editor.getSelectedObjects();

		// 先设置主选中对象
		if (editor.selected !== null) {
			outliner.setValue(editor.selected.id);
		}

		// 如果是多选，恢复所有选中状态
		if (selectedObjects.length > 1) {
			// 恢复多选状态，遍历所有选中对象
			for (let i = 0; i < selectedObjects.length; i++) {
				const object = selectedObjects[i];
				if (object !== editor.selected) { // 主选中对象已在上面处理
					outliner.addToSelection(object.id);
				}
			}
		}

		if (scene.background) {

			if (scene.background.isColor) {

				backgroundType.setValue('Color');
				backgroundColor.setHexValue(scene.background.getHex());

			} else if (scene.background.isTexture) {

				if (
					scene.background.mapping === THREE.EquirectangularReflectionMapping
				) {

					backgroundType.setValue('Equirectangular');
					backgroundEquirectangularTexture.setValue(scene.background);

				} else {

					backgroundType.setValue('Texture');
					backgroundTexture.setValue(scene.background);

				}

			}

		} else {

			backgroundType.setValue('None');

		}

		if (scene.environment) {

			if (
				scene.environment.mapping === THREE.EquirectangularReflectionMapping
			) {

				environmentType.setValue('Equirectangular');
				environmentEquirectangularTexture.setValue(scene.environment);

			}

		} else {

			environmentType.setValue('None');

		}

		if (scene.fog) {

			fogColor.setHexValue(scene.fog.color.getHex());

			if (scene.fog.isFog) {

				fogType.setValue('Fog');
				fogNear.setValue(scene.fog.near);
				fogFar.setValue(scene.fog.far);

			} else if (scene.fog.isFogExp2) {

				fogType.setValue('FogExp2');
				fogDensity.setValue(scene.fog.density);

			}

		} else {

			fogType.setValue('None');

		}

		refreshBackgroundUI();
		refreshEnvironmentUI();
		refreshFogUI();

	}

	function refreshFogUI() {

		const type = fogType.getValue();

		fogPropertiesRow.setDisplay(type === 'None' ? 'none' : '');
		fogNear.setDisplay(type === 'Fog' ? '' : 'none');
		fogFar.setDisplay(type === 'Fog' ? '' : 'none');
		fogDensity.setDisplay(type === 'FogExp2' ? '' : 'none');

	}

	refreshUI();

	// events

	signals.editorCleared.add(refreshUI);

	signals.sceneGraphChanged.add(refreshUI);

	// 监听资源变化，触发UI刷新
	signals.messageReceive.add(function (params) {
		if (params.action === 'load-resource' || params.action === 'replace-resource') {
			refreshUI();
		}
	});

	// 当对象被添加到场景时，刷新UI
	signals.objectAdded.add(refreshUI);

	/*
	signals.objectChanged.add( function ( object ) {

		let options = outliner.options;

		for ( let i = 0; i < options.length; i ++ ) {

			let option = options[ i ];

			if ( option.value === object.id ) {

				option.innerHTML = buildHTML( object );
				return;

			}

		}

	} );
	*/

	signals.objectSelected.add(function (object) {

		if (ignoreObjectSelectedSignal === true) return;

		if (object !== null && object.parent !== null) {

			let needsRefresh = false;
			let parent = object.parent;

			while (parent !== editor.scene) {

				if (nodeStates.get(parent) !== true) {

					nodeStates.set(parent, true);
					needsRefresh = true;

				}

				parent = parent.parent;

			}

			if (needsRefresh) refreshUI();

			// 获取所有选中对象
			const selectedObjects = editor.getSelectedObjects();

			if (selectedObjects.length > 1) {
				// 多选模式

				// 先清除outliner中的选中状态
				outliner.clearSelection();

				// 设置主选择对象
				outliner.setValue(object.id);

				// 添加其余对象到选择
				for (let i = 0; i < selectedObjects.length; i++) {
					const obj = selectedObjects[i];
					if (obj !== object) { // 跳过主选中对象
						outliner.addToSelection(obj.id);
					}
				}
			} else {
				// 单选模式
				outliner.setValue(object.id);
			}

		} else {
			outliner.setValue(null);
		}

	});

	return container;

}

export { SidebarScene };
