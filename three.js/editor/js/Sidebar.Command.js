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
		topContainer.add(new UIText(strings.getKey('sidebar/command').toUpperCase()));

		// 单选对象模式
		if (!isMultiSelect && object) {
			const commands = object.commands;

			// 添加"添加指令"的UI部分 - 与组件部分风格保持一致
			addCommandContainer.setDisplay('block');
			addCommandContainer.add(new UIBreak());

			const label = new UIText(strings.getKey('sidebar/command/select') || '选择项').setWidth('90px');
			addCommandContainer.add(label);

			// 创建下拉框
			const select = new UISelect().setWidth('100px');
			select.setOptions({
				'Voice': strings.getKey('sidebar/command/select/voice') || '语音指令'
			});
			select.setValue('Voice');
			addCommandContainer.add(select);

			// 添加按钮
			const newCommand = new UIButton(strings.getKey('sidebar/command/select/button') || '添加指令');
			newCommand.onClick(function() {
				// 检查是否已经有语音指令
				let hasVoiceCommand = false;
				if (object.commands) {
					for (let i = 0; i < object.commands.length; i++) {
						if (object.commands[i].type === 'Voice') {
							hasVoiceCommand = true;
							break;
						}
					}
				}

				// 如果已有语音指令，显示提示并不创建新的指令
				if (hasVoiceCommand) {
					const message = strings.getKey('menubar/command/already_exists') ||
								   '此对象已添加语音指令，不能重复添加';
					editor.showNotification(message, true);
					return;
				}

				const command = CommandContainer.Create(select.getValue());

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

						// 将水平分隔线添加到容器中
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

			const label = new UIText(strings.getKey('sidebar/command/select') || '选择项').setWidth('90px');
			addCommandContainer.add(label);

			// 创建下拉框
			const select = new UISelect().setWidth('100px');
			select.setOptions({
				'Voice': strings.getKey('sidebar/command/select/voice') || '语音指令'
			});
			select.setValue('Voice');
			addCommandContainer.add(select);

			// 添加按钮
			const newCommand = new UIButton(strings.getKey('sidebar/command/select/button') || '添加指令');
			newCommand.onClick(function() {
				// 检查哪些对象已经有语音指令
				const objectsWithVoiceCommand = [];
				const objectsToAddCommand = [];

				for (let i = 0; i < selectedObjects.length; i++) {
					const object = selectedObjects[i];

					// 检查是否已经有语音指令
					let hasVoiceCommand = false;
					for (let j = 0; j < object.commands.length; j++) {
						if (object.commands[j].type === 'Voice') {
							hasVoiceCommand = true;
							break;
						}
					}

					if (hasVoiceCommand) {
						objectsWithVoiceCommand.push(object.name || `对象 ${i+1}`);
					} else {
						objectsToAddCommand.push(object);
					}
				}

				// 如果有对象已经有语音指令，显示提示
				if (objectsWithVoiceCommand.length > 0) {
					const conflictNames = objectsWithVoiceCommand.length > 3
						? objectsWithVoiceCommand.slice(0, 3).join(', ') + `...等${objectsWithVoiceCommand.length}个对象`
						: objectsWithVoiceCommand.join(', ');

					editor.showNotification(
						`以下对象已存在语音指令: ${conflictNames}，将跳过这些对象`,
						true
					);
				}

				// 为没有语音指令的对象添加
				if (objectsToAddCommand.length > 0) {
					for (let i = 0; i < objectsToAddCommand.length; i++) {
						const object = objectsToAddCommand[i];
						const command = CommandContainer.Create('Voice');

						if (command !== undefined) {
							const cmd = new AddCommandCommand(editor, object, command);
							editor.execute(cmd);
						}
					}

					editor.showNotification(
						`已为${objectsToAddCommand.length}个对象添加语音指令`,
						false
					);
				} else if (objectsToAddCommand.length === 0 && objectsWithVoiceCommand.length > 0) {
					editor.showNotification('所有选中对象都已有语音指令', false);
				}
			});
			addCommandContainer.add(newCommand);

			// 更新按钮启用状态
			// 检查是否所有对象都已经有语音指令
			let allHaveVoiceCommand = true;
			let objectsWithVoiceCommand = 0;

			for (let i = 0; i < selectedObjects.length; i++) {
				const object = selectedObjects[i];
				let hasVoiceCommand = false;

				for (let j = 0; j < object.commands.length; j++) {
					if (object.commands[j].type === 'Voice') {
						hasVoiceCommand = true;
						objectsWithVoiceCommand++;
						break;
					}
				}

				if (!hasVoiceCommand) {
					allHaveVoiceCommand = false;
				}
			}

			// 如果所有对象都已有语音指令，禁用添加按钮
			if (allHaveVoiceCommand) {
				newCommand.setDisabled(true);
				newCommand.dom.style.opacity = '0.5';
				newCommand.dom.style.cursor = 'not-allowed';
			}

			// 显示多选对象的指令信息 - 与组件部分风格保持一致
			if (objectsWithVoiceCommand > 0) {
				commandsContainer.add(new UIHorizontalRule());

				// 添加统计信息
				const statsRow = new UIRow();
				statsRow.add(new UIText(`${selectedObjects.length}个选中对象中，${objectsWithVoiceCommand}个对象有语音指令`));
				commandsContainer.add(statsRow);

				// 添加提示信息
				const noteRow = new UIRow();
				noteRow.add(new UIText('注意：指令实例是各对象独立的，无法一次编辑所有'));
				commandsContainer.add(noteRow);
				commandsContainer.add(new UIBreak());
			} else {
				commandsContainer.add(new UIHorizontalRule());

				// 添加提示信息
				const noteRow = new UIRow();
				noteRow.add(new UIText('选中的对象中没有语音指令'));
				commandsContainer.add(noteRow);
				commandsContainer.add(new UIBreak());
			}
		}
	}

	// signals
	signals.objectSelected.add(function(object) {
		if (object !== null && editor.camera !== object) {
			// 修改为与组件部分一致的显示逻辑
			if (editor.type && editor.type.toLowerCase() === 'meta') {
				const objectType = object.type ? object.type.toLowerCase() : '';
				if (objectType === 'mesh' || objectType === 'polygen' || objectType === 'voxel' || objectType === 'entity') {
					container.setDisplay('block');
					update();
					return;
				}
			}
			container.setDisplay('none');
		} else {
			container.setDisplay('none');
		}
	});

	signals.commandAdded.add(update);
	signals.commandRemoved.add(update);
	signals.commandChanged.add(update);

	return container;
}

export { SidebarCommand };
