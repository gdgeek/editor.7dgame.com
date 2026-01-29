import { UIPanel, UIBreak, UIText, UIButton, UIRow, UISelect, UIInput, UIHorizontalRule } from './libs/ui.js';

import { AddCommandCommand } from './commands/AddCommandCommand.js';
import { CommandContainer } from './mrpp/CommandContainer.js';

function SidebarCommand(editor) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setDisplay('none');

	const topContainer = new UIRow();
	container.add(topContainer);

	// 添加指令选择容器
	const addCommandContainer = new UIRow();
	container.add(addCommandContainer);

	const commandsContainer = new UIRow();
	container.add(commandsContainer);

	function update() {
		topContainer.clear();
		topContainer.setDisplay('none');
		addCommandContainer.clear();
		addCommandContainer.setDisplay('none');
		commandsContainer.clear();
		commandsContainer.setDisplay('none');

		// 获取选中的对象
		const selectedObjects = editor.getSelectedObjects();

		// 判断是否为多选模式
		const isMultiSelect = selectedObjects.length > 1;

		// 如果没有选中对象，不显示指令面板
		if (selectedObjects.length === 0) {
			return;
		}

		// 只有当编辑器类型为meta且选中对象类型为合法类型时才显示
		if (!(editor.type && editor.type.toLowerCase() === 'meta')) {
			return;
		}

		// 检查所有选中对象的类型是否合法
		const validObjectTypes = ['mesh', 'polygen', 'voxel', 'entity'];
		let allValidType = true;

		for (let i = 0; i < selectedObjects.length; i++) {
			const objectType = selectedObjects[i].type ? selectedObjects[i].type.toLowerCase() : '';
			if (!validObjectTypes.includes(objectType)) {
				allValidType = false;
				break;
			}
		}

		if (!allValidType) {
			return;
		}

		// 对于单选模式，直接使用选中的对象
		const object = isMultiSelect ? null : editor.selected;

		// 确保所有对象都有commands属性
		for (let i = 0; i < selectedObjects.length; i++) {
			if (selectedObjects[i].commands === undefined) {
				selectedObjects[i].commands = [];
			}
		}

		topContainer.setDisplay('block');
		commandsContainer.setDisplay('block');
		container.setDisplay('block');

		// 显示指令标题
		topContainer.add(new UIText(strings.getKey('sidebar/command/new').toUpperCase()));

		// 单选对象模式
		if (!isMultiSelect && object) {
			const commands = object.commands;

			// 添加"添加指令"的UI部分 - 与组件部分风格保持一致
			addCommandContainer.setDisplay('block');
			//addCommandContainer.add(new UIBreak());

			const label = new UIText(strings.getKey('sidebar/command/select')).setWidth('90px');
			addCommandContainer.add(label);

			// 创建下拉框
			const select = new UISelect().setWidth('130px');
			select.setOptions({
				'Voice': strings.getKey('sidebar/command/select/voice'),
				'Gesture': strings.getKey('sidebar/command/select/gesture'),
			});
			select.setValue('Voice');
			addCommandContainer.add(select);

			// 添加按钮
			const newCommand = new UIButton(strings.getKey('sidebar/command/select/button'));
			newCommand.onClick(function() {
				const chosenType = select.getValue();
				const command = CommandContainer.Create(chosenType);

				if (command !== undefined) {
					const cmd = new AddCommandCommand(editor, object, command);
					editor.execute(cmd);

					const successMessage = strings.getKey('menubar/command/success').replace('{0}', select.getSelectedHtml());
					editor.showNotification(successMessage, false);
				}
			});
			addCommandContainer.add(newCommand);

			if (commands !== undefined && commands.length > 0) {
				for (let i = 0; i < commands.length; i++) {
					(function(object, command) {
						commandsContainer.add(new UIHorizontalRule());
						const cc = new CommandContainer(editor, object, command);
						cc.renderer(commandsContainer);
						commandsContainer.add(new UIBreak());
					})(object, commands[i]);
				}
			}
		}
		// 多选对象模式
		else if (isMultiSelect) {
			// 添加"添加指令"的UI部分 - 与组件部分风格保持一致
			addCommandContainer.setDisplay('block');
			addCommandContainer.add(new UIBreak());

			const label = new UIText(strings.getKey('sidebar/command/select')).setWidth('90px');
			addCommandContainer.add(label);

			// 创建下拉框
			const select = new UISelect().setWidth('100px');
			select.setOptions({
				'Voice': strings.getKey('sidebar/command/select/voice'),
				'Gesture': strings.getKey('sidebar/command/select/gesture'),
			});
			select.setValue('Voice');
			addCommandContainer.add(select);

			// 添加按钮
			const newCommand = new UIButton(strings.getKey('sidebar/command/select/button'));
			newCommand.onClick(function() {
				// 多选时按下拉选择的类型执行批量添加
				const chosenType = select.getValue();
				const validObjects = selectedObjects.filter(obj => obj.type && obj.type.toLowerCase() === 'entity');
				const invalidObjects = selectedObjects.filter(obj => !obj.type || obj.type.toLowerCase() !== 'entity');

				// 如果没有有效对象，显示错误并返回
				if (validObjects.length === 0) {
					if (invalidObjects.length > 0) {
						const names = invalidObjects.map((obj, i) => obj.name || strings.getKey('sidebar/command/object_name_with_index').replace('{0}', i+1));
						const displayNames = names.length > 3
							? names.slice(0, 3).join(', ') + `...等${names.length}个对象`
							: names.join(', ');
						editor.showNotification(
							strings.getKey('sidebar/command/notification/invalid_objects').replace('{0}', displayNames),
							true
						);
					}
					return;
				}

				// 首先为所有有效对象添加指令
				for (let i = 0; i < validObjects.length; i++) {
					const object = validObjects[i];
					if (object.commands === undefined) object.commands = [];
					const command = CommandContainer.Create(chosenType);

					if (command !== undefined) {
						const cmd = new AddCommandCommand(editor, object, command);
						editor.execute(cmd);
					}
				}

				// 显示成功消息
				const commandName = strings.getKey('sidebar/command/select/' + chosenType.toLowerCase()) || chosenType;
				editor.showNotification(
					strings.getKey('sidebar/command/notification/add_success')
						.replace('{0}', validObjects.length)
						.replace('{1}', commandName),
					false
				);

				// 如果有无效对象，延迟显示警告消息
				if (invalidObjects.length > 0) {
					setTimeout(() => {
						const names = invalidObjects.map((obj, i) => obj.name || strings.getKey('sidebar/command/object_name_with_index').replace('{0}', i+1));
						const displayNames = names.length > 3
							? names.slice(0, 3).join(', ') + `...等${names.length}个对象`
							: names.join(', ');
						editor.showNotification(
							strings.getKey('sidebar/command/notification/skip_invalid_objects').replace('{0}', displayNames),
							true
						);
					}, 3000);
				}
			});
			addCommandContainer.add(newCommand);

			// 显示多选对象的指令摘要
			commandsContainer.add(new UIHorizontalRule());

			const summaryTitle = new UIRow();
			summaryTitle.add(new UIText(`${selectedObjects.length}${strings.getKey('sidebar/command/multi_selection_summary')}`));
			commandsContainer.add(summaryTitle);

			// 对每个选中对象显示其名字和已添加的指令类型列表
			for (let i = 0; i < selectedObjects.length; i++) {
				const object = selectedObjects[i];
				const types = (object.commands && object.commands.length > 0)
					? object.commands.map(c => c.type).join(', ')
					: strings.getKey('sidebar/command/no_commands');

				const row = new UIRow();
				row.add(new UIText(`${object.name || strings.getKey('sidebar/command/object_name_with_index').replace('{0}', i+1)}: ${types}`));
				commandsContainer.add(row);
			}

			commandsContainer.add(new UIBreak());
		}
	}

	signals.commandAdded.add(update);
	signals.commandRemoved.add(update);
	signals.commandChanged.add(update);

	return { container, update };
}

export { SidebarCommand };