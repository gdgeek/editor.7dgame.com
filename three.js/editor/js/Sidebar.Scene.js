import {
	UIPanel
} from './libs/ui.js';
import { UIOutliner } from './libs/ui.three.js';
import { RemoveObjectCommand } from './commands/RemoveObjectCommand.js';

function SidebarScene(editor) {

	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('10px');

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
	outliner.dom.style.height = 'clamp(280px, 39vh, 420px)';
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

	function refreshUI() {

		const scene = editor.scene;

		const options = [];

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

		const selectedObjects = editor.getSelectedObjects();
		const selectedIds = selectedObjects.map( ( object ) => object.id );
		const primaryId = editor.selected !== null ? editor.selected.id : null;
		const anchorValue = outliner.getAnchorValue();
		outliner.setValues( selectedIds, primaryId, anchorValue );

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

			const selectedObjects = editor.getSelectedObjects();
			const selectedIds = selectedObjects.map( ( obj ) => obj.id );
			const anchorValue = outliner.getAnchorValue();
			outliner.setValues( selectedIds, object.id, anchorValue );

		} else {

			outliner.setValue( null );

		}

	});

	return container;

}

export { SidebarScene };
