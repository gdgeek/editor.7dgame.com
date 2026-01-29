import { UIPanel, UIBreak, UIText, UIButton, UIRow, UISelect, UIInput, UIHorizontalRule } from './libs/ui.js';

import { AddComponentCommand } from './commands/AddComponentCommand.js';
import { ComponentContainer } from './mrpp/ComponentContainer.js';

function SidebarComponent(editor) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setDisplay('none');

	const topContainer = new UIRow();
	container.add(topContainer);

	// 定义互斥组件类型
	const mutuallyExclusiveTypes = ['Action', 'Moved', 'Trigger'];

	// 添加组件选择容器
	const addComponentContainer = new UIRow();
	container.add(addComponentContainer);

	// 组件实例容器
	const componentsContainer = new UIRow();
	container.add(componentsContainer);

	function update() {
		topContainer.clear();
		topContainer.setDisplay('none');
		componentsContainer.clear();
		componentsContainer.setDisplay('none');
		addComponentContainer.clear();
		addComponentContainer.setDisplay('none');

		// 获取选中的对象
		const selectedObjects = editor.getSelectedObjects();

		// 判断是否为多选模式
		const isMultiSelect = selectedObjects.length > 1;

		// 如果没有选中对象，不显示组件面板
		if (selectedObjects.length === 0) {
			return;
		}

		// 只有当编辑器类型为meta时才显示组件模块
		if (!(editor.type && editor.type.toLowerCase() === 'meta')) {
			return;
		}

		// 检查所有选中对象的类型是否合法
		const validObjectTypes = ['polygen', 'voxel', 'picture'];
		const invalidObjects = [];

		for (let i = 0; i < selectedObjects.length; i++) {
			const object = selectedObjects[i];
			const objectType = object.type ? object.type.toLowerCase() : '';
			if (!validObjectTypes.includes(objectType)) {
				invalidObjects.push(object);
			}
		}

		// 如果所有对象都是无效类型，则不显示组件面板
		if (invalidObjects.length === selectedObjects.length) {
			return;
		}

		// 对于单选模式，直接使用选中的对象
		const object = isMultiSelect ? null : editor.selected;

		// 确保所有对象都有components属性
		for (let i = 0; i < selectedObjects.length; i++) {
			if (selectedObjects[i].components === undefined) {
				selectedObjects[i].components = [];
			}
		}

		topContainer.setDisplay('block');
		componentsContainer.setDisplay('block');
		addComponentContainer.setDisplay('block');
		container.setDisplay('block');

		// 显示组件标题
		topContainer.add(new UIText(strings.getKey('sidebar/components/new').toUpperCase()));

		// 添加新组件的界面
		//addComponentContainer.add(new UIBreak());

		const label = new UIText(strings.getKey('sidebar/components/select')).setWidth('90px');
		addComponentContainer.add(label);

		// 创建下拉框
		const select = new UISelect().setWidth('130px');
		select.setOptions({
			'Rotate': strings.getKey('sidebar/components/select/rotate'),
			'Action': strings.getKey('sidebar/components/select/action'),
			'Moved': strings.getKey('sidebar/components/select/moved'),
			'Trigger': strings.getKey('sidebar/components/select/trigger'),
			'Tooltip': strings.getKey('sidebar/components/select/tooltip')
		});
		select.setValue('Rotate');
		addComponentContainer.add(select);

		const newComponent = new UIButton(strings.getKey('sidebar/components/select/button'));
		newComponent.onClick(function() {
			const selectedType = select.getValue();

			// 获取当前选中的对象
			const selectedObjects = editor.getSelectedObjects();

			// 多选对象处理
			if (selectedObjects.length > 1) {
				// 首先验证对象类型
				const validObjects = [];
				const invalidTypeObjects = [];

				for (let i = 0; i < selectedObjects.length; i++) {
					const object = selectedObjects[i];
					const objectType = object.type ? object.type.toLowerCase() : '';
					if (['polygen', 'voxel', 'picture'].includes(objectType)) {
						validObjects.push(object);
					} else {
						invalidTypeObjects.push(object.name || strings.getKey('sidebar/components/object_name_with_index').replace('{0}', i+1));
					}
				}

				// 如果没有有效对象，显示错误并返回
				if (validObjects.length === 0) {
					if (invalidTypeObjects.length > 0) {
						const invalidNames = invalidTypeObjects.length > 3
							? invalidTypeObjects.slice(0, 3).join(', ') + `...等${invalidTypeObjects.length}个对象`
							: invalidTypeObjects.join(', ');
						editor.showNotification(
							strings.getKey('sidebar/components/notification/invalid_objects').replace('{0}', invalidNames),
							true
						);
					}
					return;
				}

				// 检查互斥组件
				if (mutuallyExclusiveTypes.includes(selectedType)) {
					// 检查是否有对象已经存在互斥组件
					let objectsWithExclusiveComponents = [];

					for (let i = 0; i < validObjects.length; i++) {
						const object = validObjects[i];

						// 确保对象有components属性
						if (object.components === undefined) {
							object.components = [];
						}

						for (let j = 0; j < object.components.length; j++) {
							const compType = object.components[j].type;
							if (mutuallyExclusiveTypes.includes(compType) && compType !== selectedType) {
								objectsWithExclusiveComponents.push(object.name || strings.getKey('sidebar/components/object_name_with_index').replace('{0}', i+1));
								break;
							}
						}
					}

					if (objectsWithExclusiveComponents.length > 0) {
						// 已存在互斥组件，显示提示信息
						const conflictNames = objectsWithExclusiveComponents.length > 3
							? objectsWithExclusiveComponents.slice(0, 3).join(', ') + `...等${objectsWithExclusiveComponents.length}个对象`
							: objectsWithExclusiveComponents.join(', ');

						editor.showNotification(
							(strings.getKey('sidebar/components/notification/mutually_exclusive') || '只能选择一个互斥组件') +
							`\n以下对象已存在互斥组件: ${conflictNames}`,
							true
						);
						return;
					}
				}

				// 首先为所有有效对象添加组件
				for (let i = 0; i < validObjects.length; i++) {
					const object = validObjects[i];
					if (object.components === undefined) {
						object.components = [];
					}

					const component = ComponentContainer.Create(selectedType, editor);
					if (component !== undefined) {
						const command = new AddComponentCommand(editor, object, component);
						editor.execute(command);
					}
				}

				// 显示成功消息
				const componentName = select.getSelectedHtml();
				editor.showNotification(
					strings.getKey('sidebar/components/notification/add_success')
						.replace('{0}', validObjects.length)
						.replace('{1}', componentName),
					false
				);

				// 如果有无效对象，延迟显示警告消息
				if (invalidTypeObjects.length > 0) {
					setTimeout(() => {
						const invalidNames = invalidTypeObjects.length > 3
							? invalidTypeObjects.slice(0, 3).join(', ') + `...等${invalidTypeObjects.length}个对象`
							: invalidTypeObjects.join(', ');
						editor.showNotification(
							strings.getKey('sidebar/components/notification/skip_invalid_objects').replace('{0}', invalidNames),
							true
						);
					}, 3000);
				}
			} else {
				// 单选对象处理（原有逻辑）
				// 检查互斥组件
				if (mutuallyExclusiveTypes.includes(selectedType)) {
					// 检查是否已经存在互斥组件
					let hasExclusiveComponent = false;
					let existingType = null;

					for (let i = 0; i < editor.selected.components.length; i++) {
						const compType = editor.selected.components[i].type;
						if (mutuallyExclusiveTypes.includes(compType) && compType !== selectedType) {
							hasExclusiveComponent = true;
							existingType = compType;
							break;
						}
					}

					if (hasExclusiveComponent) {
						// 已存在互斥组件，显示提示信息
						editor.showNotification(
							strings.getKey('sidebar/components/notification/mutually_exclusive') ||
							'只能选择一个互斥组件：点击触发、可移动或碰撞触发',
							true
						);
						return;
					}
				}

				const component = ComponentContainer.Create(selectedType, editor);

				if (component !== undefined) {
					const command = new AddComponentCommand(editor, editor.selected, component);
					editor.execute(command);

					const successMessage = strings.getKey('menubar/component/success').replace('{0}', select.getSelectedHtml());
					editor.showNotification(successMessage, false);
				}
			}
		});
		addComponentContainer.add(newComponent);

		// 在多选模式下，显示所有选中对象共有的组件
		if (isMultiSelect) {
			addComponentContainer.add(new UIHorizontalRule());
			// 找出所有选中对象中的互斥组件类型
			const exclusiveTypes = new Set();

			for (let i = 0; i < selectedObjects.length; i++) {
				const object = selectedObjects[i];
				if (object.components) {
					for (let j = 0; j < object.components.length; j++) {
						const compType = object.components[j].type;
						if (mutuallyExclusiveTypes.includes(compType)) {
							exclusiveTypes.add(compType);
						}
					}
				}
			}

			// 获取下拉选项的DOM元素
			const options = select.dom.options;

			// 如果找到多种互斥组件类型，则禁用所有互斥组件选项
			if (exclusiveTypes.size > 1) {
				for (let i = 0; i < options.length; i++) {
					const optionValue = options[i].value;
					if (mutuallyExclusiveTypes.includes(optionValue)) {
						options[i].disabled = true;
						options[i].style.color = '#888';
					}
				}
			}
			// 如果只找到一种互斥组件类型，则只允许选择该类型
			else if (exclusiveTypes.size === 1) {
				const existingType = Array.from(exclusiveTypes)[0];
				for (let i = 0; i < options.length; i++) {
					const optionValue = options[i].value;
					if (mutuallyExclusiveTypes.includes(optionValue) && optionValue !== existingType) {
						options[i].disabled = true;
						options[i].style.color = '#888';
					}
				}
			}
		} else if (object) {
			// 单选模式下，更新下拉框中互斥组件的可用性
			updateMutuallyExclusiveOptions(select, object.components);
		}

		// 在多选模式下，显示所有选中对象共有的组件
		if (isMultiSelect) {
			// 显示多选对象的组件摘要
			const summaryTitle = new UIRow();
			summaryTitle.add(new UIText(`${selectedObjects.length}${strings.getKey('sidebar/components/multi_selection_summary')}`));
			componentsContainer.add(summaryTitle);

			// 对每个选中对象显示其名字和已添加的组件类型列表
			for (let i = 0; i < selectedObjects.length; i++) {
				const object = selectedObjects[i];
				const types = (object.components && object.components.length > 0)
					? object.components.map(c => c.type).join(', ')
					: strings.getKey('sidebar/components/no_components');

				const row = new UIRow();
				row.add(new UIText(`${object.name || strings.getKey('sidebar/components/object_name_with_index').replace('{0}', i+1)}: ${types}`));
				componentsContainer.add(row);
			}

			componentsContainer.add(new UIBreak());
		}
		// 单选模式下显示该对象的所有组件
		else if (object && object.components && object.components.length > 0) {
			// 显示已有组件列表
			componentsContainer.setDisplay('block');

			for (let i = 0; i < object.components.length; i++) {
				(function(object, component) {
					componentsContainer.add(new UIHorizontalRule());
					const cc = new ComponentContainer(editor, object, component);
					cc.renderer(componentsContainer);
					componentsContainer.add(new UIBreak());
				})(object, object.components[i]);
			}
		}
	}

	// 更新互斥组件选项的可用状态
	function updateMutuallyExclusiveOptions(select, components) {
		if (!components) return;

		// 检查是否已存在互斥组件
		let existingExclusiveType = null;

		for (let i = 0; i < components.length; i++) {
			const compType = components[i].type;
			if (mutuallyExclusiveTypes.includes(compType)) {
				existingExclusiveType = compType;
				break;
			}
		}

		// 获取下拉选项的DOM元素
		const options = select.dom.options;

		// 更新互斥组件的可用状态
		if (existingExclusiveType) {
			for (let i = 0; i < options.length; i++) {
				const optionValue = options[i].value;
				if (mutuallyExclusiveTypes.includes(optionValue) && optionValue !== existingExclusiveType) {
					// 禁用其他互斥组件选项
					options[i].disabled = true;
					options[i].style.color = '#888';
				} else {
					// 启用非互斥组件选项
					options[i].disabled = false;
					options[i].style.color = '';
				}
			}
		} else {
			// 启用所有选项
			for (let i = 0; i < options.length; i++) {
				options[i].disabled = false;
				options[i].style.color = '';
			}
		}
	}

	signals.componentAdded.add(update);
	signals.componentRemoved.add(update);
	signals.componentChanged.add(update);

	return { container, update };
}

export { SidebarComponent };