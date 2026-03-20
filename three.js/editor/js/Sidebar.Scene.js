import {
	UIPanel,
	UIRow,
	UIInput,
	UISelect,
	UIButton
} from './libs/ui.js';
import { UIOutliner } from './libs/ui.three.js';
import { RemoveObjectCommand } from './commands/RemoveObjectCommand.js';

function SidebarScene(editor) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('10px');

	// outliner

	const nodeStates = new WeakMap();

	function hasVisibleChildren(object) {

		return object.children.some(child => !(child.userData && child.userData.hidden === true));

	}

	function isSelectableObject(object) {

		if (editor.selector == null) return !(object.userData && object.userData.hidden === true);

		return editor.selector(object);

	}

	function getNormalizedObjectType(object) {

		if (object.isScene) return 'scene';
		if (object.isCamera || object.isLight) return object.type.toLowerCase();

		const type = object.type.toLowerCase();

		if (type === 'entity') return 'point';
		if (type === 'sound') return 'audio';

		return type;

	}

	function getObjectTypeTranslationKey(type) {

		const typeKeyMap = {
			scene: 'sidebar/object/type_value/scene',
			group: 'sidebar/object/type_value/group',
			object3d: 'sidebar/object/type_value/object3d',
			mesh: 'sidebar/object/type_value/mesh',
			line: 'sidebar/object/type_value/line',
			linesegments: 'sidebar/object/type_value/linesegments',
			points: 'sidebar/object/type_value/points',
			sprite: 'sidebar/object/type_value/sprite',
			camera: 'sidebar/object/type_value/camera',
			perspectivecamera: 'sidebar/object/type_value/perspectivecamera',
			orthographiccamera: 'sidebar/object/type_value/orthographiccamera',
			light: 'sidebar/object/type_value/light',
			ambientlight: 'sidebar/object/type_value/ambientlight',
			directionallight: 'sidebar/object/type_value/directionallight',
			hemispherelight: 'sidebar/object/type_value/hemispherelight',
			pointlight: 'sidebar/object/type_value/pointlight',
			spotlight: 'sidebar/object/type_value/spotlight',
			module: 'sidebar/object/type_value/module',
			entity: 'sidebar/object/type_value/entity',
			point: 'sidebar/object/type_value/point',
			text: 'sidebar/object/type_value/text',
			polygen: 'sidebar/object/type_value/polygen',
			picture: 'sidebar/object/type_value/picture',
			video: 'sidebar/object/type_value/video',
			audio: 'sidebar/object/type_value/audio',
			prototype: 'sidebar/object/type_value/prototype',
			voxel: 'sidebar/object/type_value/voxel',
			phototype: 'sidebar/object/type_value/phototype',
			prefab: 'sidebar/object/type_value/prefab',
		};

		return typeKeyMap[type] || null;

	}

	function getLocalizedObjectTypeLabel(type) {

		const translationKey = getObjectTypeTranslationKey(type);

		if (translationKey) {

			const localizedType = strings.getKey(translationKey);
			if (localizedType !== '???') return localizedType;

		}

		return type;

	}

	function getFilterTypeLabel(type) {

		const filterTypeKeyMap = {
			module: 'sidebar/scene/filter/type/module',
			point: 'sidebar/scene/filter/type/point',
			text: 'sidebar/scene/filter/type/text',
			polygen: 'sidebar/scene/filter/type/polygen',
			picture: 'sidebar/scene/filter/type/picture',
			video: 'sidebar/scene/filter/type/video',
			audio: 'sidebar/scene/filter/type/audio',
			prototype: 'sidebar/scene/filter/type/prototype',
		};

		const translationKey = filterTypeKeyMap[type];

		if (translationKey) {

			const localizedType = strings.getKey(translationKey);
			if (localizedType !== '???') return localizedType;

		}

		return getLocalizedObjectTypeLabel(type);

	}

	const componentFilterOptions = [
		{ value: 'rotate', type: 'Rotate', label: strings.getKey('sidebar/components/select/rotate') },
		{ value: 'action', type: 'Action', label: strings.getKey('sidebar/components/select/action') },
		{ value: 'moved', type: 'Moved', label: strings.getKey('sidebar/components/select/moved') },
		{ value: 'trigger', type: 'Trigger', label: strings.getKey('sidebar/components/select/trigger') },
		{ value: 'tooltip', type: 'Tooltip', label: strings.getKey('sidebar/components/select/tooltip') },
	];

	function getSceneTypeFilterOptions() {

		if (editor.type && editor.type.toLowerCase() === 'verse') {

			return [
				{
					value: 'type:module',
					label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('module')}`
				}
			];

		}

		return [
			{
				value: 'type:point',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('point')}`
			},
			{
				value: 'type:text',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('text')}`
			},
			{
				value: 'type:polygen',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('polygen')}`
			},
			{
				value: 'type:picture',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('picture')}`
			},
			{
				value: 'type:video',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('video')}`
			},
			{
				value: 'type:audio',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('audio')}`
			},
			{
				value: 'type:prototype',
				label: `${strings.getKey('sidebar/scene/filter/type_prefix')}: ${getFilterTypeLabel('prototype')}`
			},
		];

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

		if (nodeStates.has(object) && !isEntityLikeObject(object)) {

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
		if (type === 'point') return 'Point';
		if (type === 'text') return 'Text';
		if (type === 'polygen') return 'Polygen'
		if (type === 'picture') return 'Picture';
		if (type === 'video') return 'Video';
		if (type === 'sound') return 'Audio';
		if (type === 'prototype') return 'Prototype';

		return 'Object3D_4';

	}

	function isEntityLikeObject(object) {

		const type = object && object.type ? object.type.toLowerCase() : '';
		const isVerseEditor = !!(editor.type && editor.type.toLowerCase() === 'verse');
		if (!isVerseEditor) return false;
		return type === 'module' || type === 'entity';

	}

	function buildHTML(object) {

		let html = '';
		if (isEntityLikeObject(object)) {

			html = `<span class="entity-mini-icon"></span> ${escapeHTML(object.name)}`;

		} else {

			// 只保留前面的类型指示器圆点
			html = `<span class="type ${getObjectType(
				object
			)}"></span> ${escapeHTML(object.name)}`;

		}

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
	let subtreeFilterMatchCache = new WeakMap();
	const showFilter = !(editor.type && editor.type.toLowerCase() === 'verse');
	const enableSceneReorderOnly = !!(editor.type && editor.type.toLowerCase() === 'verse');

	const searchRow = new UIRow();
	searchRow.setDisplay('flex');
	searchRow.setMarginBottom('8px');
	searchRow.dom.style.alignItems = 'center';
	searchRow.dom.style.gap = '10px';
	searchRow.dom.style.border = 'none';

	const searchInputContainer = new UIRow();
	searchInputContainer.setDisplay('block');
	searchInputContainer.setMarginBottom('0');
	searchInputContainer.dom.style.position = 'relative';
	searchInputContainer.dom.style.flex = '1 1 auto';
	searchInputContainer.dom.style.minWidth = '0';
	searchInputContainer.dom.style.border = 'none';

	const searchInput = new UIInput('');
	searchInput.setWidth('100%');
	searchInput.dom.style.boxSizing = 'border-box';
	searchInput.dom.style.paddingRight = '22px';
	searchInput.dom.placeholder = strings.getKey('sidebar/scene/search_placeholder');
	searchInputContainer.add(searchInput);

	const clearSearchButton = new UIButton('×');
	clearSearchButton.setWidth('18px');
	clearSearchButton.dom.style.position = 'absolute';
	clearSearchButton.dom.style.right = '4px';
	clearSearchButton.dom.style.top = '50%';
	clearSearchButton.dom.style.transform = 'translateY(-50%)';
	clearSearchButton.dom.style.padding = '0';
	clearSearchButton.dom.style.lineHeight = '1';
	clearSearchButton.dom.style.minHeight = '18px';
	clearSearchButton.dom.style.border = '0';
	clearSearchButton.dom.style.background = 'transparent';
	clearSearchButton.dom.style.color = '#999';
	clearSearchButton.dom.style.display = 'none';
	clearSearchButton.dom.title = strings.getKey('sidebar/scene/search_clear');
	clearSearchButton.onClick(function () {

		searchInput.setValue('');
		updateClearSearchButtonVisibility();
		searchInput.dom.focus();
		refreshUI();

	});
	searchInputContainer.add(clearSearchButton);

	function updateClearSearchButtonVisibility() {

		clearSearchButton.dom.style.display = searchInput.getValue() ? 'block' : 'none';

	}

	searchInput.onInput(function () {

		updateClearSearchButtonVisibility();
		refreshUI();

	});
	searchRow.add(searchInputContainer);

	const filterSelect = new UISelect();
	filterSelect.setWidth('auto');
	filterSelect.dom.style.flex = '1 1 0';
	filterSelect.dom.style.minWidth = '0';
	filterSelect.onChange(refreshUI);
	if (showFilter) {

		searchInputContainer.dom.style.flex = '1 1 0';
		searchRow.add(filterSelect);

	}

	container.add(searchRow);

	const outliner = new UIOutliner(editor);
	outliner.setId('outliner');
	if (editor.type && editor.type.toLowerCase() === 'verse') {
		outliner.dom.classList.add('scene-verse-outliner');
	}
	outliner.reorderOnly = !!(editor.type && editor.type.toLowerCase() === 'verse');
	outliner.dom.style.height = 'clamp(250px, 35vh, 390px)';
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

	function buildFilterOptions() {

		if (!showFilter) return;

		const currentValue = filterSelect.getValue() || 'all';
		const optionDefinitions = [
			{ value: 'all', label: strings.getKey('sidebar/scene/filter/all') },
			...getSceneTypeFilterOptions(),
			...componentFilterOptions.map(function (component) {

				return {
					value: `component:${component.value}`,
					label: `${strings.getKey('sidebar/scene/filter/component_prefix')}: ${component.label}`
				};

			})
		];

		while (filterSelect.dom.children.length > 0) {

			filterSelect.dom.removeChild(filterSelect.dom.firstChild);

		}

		optionDefinitions.forEach(function (definition) {

			const option = document.createElement('option');
			option.value = definition.value;
			option.innerHTML = definition.label;

			if (definition.disabled === true) {

				option.disabled = true;

			}

			filterSelect.dom.appendChild(option);

		});

		const hasCurrentValue = optionDefinitions.some(function (definition) {

			return definition.disabled !== true && definition.value === currentValue;

		});

		filterSelect.setValue(hasCurrentValue ? currentValue : 'all');

	}

	function getSearchText() {

		return searchInput.getValue().trim().toLowerCase();

	}

	function getActiveFilter() {

		if (!showFilter) return 'all';

		return filterSelect.getValue() || 'all';

	}

	function hasActiveFilters() {

		return getSearchText() !== '' || getActiveFilter() !== 'all';

	}

	function objectMatchesSearchText(object, searchText) {

		if (searchText === '') return true;

		const componentLabels = Array.isArray(object.components)
			? object.components
				.map(component => component && component.type ? component.type.toLowerCase() : '')
				.map(function (type) {

					const component = componentFilterOptions.find(item => item.value === type);
					return component ? component.label : type;

				})
				.filter(Boolean)
				.join(' ')
			: '';

		const haystack = [
			object.name || '',
			getLocalizedObjectTypeLabel(getNormalizedObjectType(object)),
			getFilterTypeLabel(getNormalizedObjectType(object)),
			componentLabels
		].join(' ').toLowerCase();

		return haystack.includes(searchText);

	}

	function objectMatchesDropdownFilter(object, activeFilter) {

		if (activeFilter === 'all') return true;

		if (activeFilter.startsWith('type:')) {

			return getNormalizedObjectType(object) === activeFilter.slice(5);

		}

		if (activeFilter.startsWith('component:')) {

			const componentType = activeFilter.slice(10);

			return Array.isArray(object.components) && object.components.some(function (component) {

				return component && component.type && component.type.toLowerCase() === componentType;

			});

		}

		return true;

	}

	function objectMatchesFilters(object) {

		const searchText = getSearchText();
		const activeFilter = getActiveFilter();

		return objectMatchesSearchText(object, searchText) && objectMatchesDropdownFilter(object, activeFilter);

	}

	function subtreeMatchesFilters(object) {

		if (subtreeFilterMatchCache.has(object)) {

			return subtreeFilterMatchCache.get(object);

		}

		if (!isSelectableObject(object)) return false;
		if (objectMatchesFilters(object)) {

			subtreeFilterMatchCache.set(object, true);
			return true;

		}

		for (let i = 0; i < object.children.length; i++) {

			if (subtreeMatchesFilters(object.children[i])) {

				subtreeFilterMatchCache.set(object, true);
				return true;

			}

		}

		subtreeFilterMatchCache.set(object, false);
		return false;

	}

	function refreshUI() {

		const scene = editor.scene;
		const filtersActive = hasActiveFilters();
		subtreeFilterMatchCache = new WeakMap();

		const options = [];

		(function addObjects(objects, pad) {

			for (let i = 0, l = objects.length; i < l; i++) {

				const object = objects[i];

				if (nodeStates.has(object) === false) {

					nodeStates.set(object, false);

				}

				if (isSelectableObject(object) && (!filtersActive || subtreeMatchesFilters(object))) {

					const isRootSceneNode = object === scene;
					const draggable = enableSceneReorderOnly
						? !isRootSceneNode
						: (object.userData.draggable != undefined ? object.userData.draggable : true);

					const option = buildOption(object, draggable);
					option.style.paddingLeft = pad * 18 + 'px';
					options.push(option);
				}


				if ((filtersActive && subtreeMatchesFilters(object)) || nodeStates.get(object) === true) {

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

	buildFilterOptions();
	refreshUI();

	// events

	signals.editorCleared.add(function () {

		buildFilterOptions();
		refreshUI();

	});

	signals.sceneGraphChanged.add(function () {

		buildFilterOptions();
		refreshUI();

	});

	// 监听资源变化，触发UI刷新
	signals.messageReceive.add(function (params) {
		if (params.action === 'load-resource' || params.action === 'replace-resource') {
			buildFilterOptions();
			refreshUI();
		}
	});

	// 当对象被添加到场景时，刷新UI
	signals.objectAdded.add(function () {

		buildFilterOptions();
		refreshUI();

	});

	signals.objectRemoved.add(function () {

		buildFilterOptions();
		refreshUI();

	});

	signals.objectChanged.add(function (object) {

		refreshUI();

	});

	signals.componentAdded.add(function () {

		buildFilterOptions();
		refreshUI();

	});

	signals.componentRemoved.add(function () {

		buildFilterOptions();
		refreshUI();

	});

	signals.componentChanged.add(refreshUI);

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
