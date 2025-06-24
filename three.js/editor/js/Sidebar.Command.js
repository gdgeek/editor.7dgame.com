import { UIPanel, UIBreak, UIText, UIButton, UIRow, UISelect, UIInput, UIHorizontalRule } from './libs/ui.js';

import { AddCommandCommand } from './commands/AddCommandCommand.js';
import { CommandContainer } from './mrpp/CommandContainer.js';

function SidebarCommand(editor) {

	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setDisplay('none');

	// 标题容器
	const topContainer = new UIRow();
	container.add(topContainer);

	// 指令选择容器
	const addCommandContainer = new UIRow();
	container.add(addCommandContainer);

	// 指令实例容器
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
		const isMultiSelect = selectedObjects.length > 1;

		if (selectedObjects.length === 0) return;
		if (!(editor.type && editor.type.toLowerCase() === 'meta')) return;

		const validObjectTypes = ['mesh', 'polygen', 'voxel', 'entity'];
		let allValidType = true;
		for (let i = 0; i < selectedObjects.length; i++) {
			const objectType = selectedObjects[i].type ? selectedObjects[i].type.toLowerCase() : '';
			if (!validObjectTypes.includes(objectType)) {
				allValidType = false;
				break;
			}
		}
		if (!allValidType) return;

		const object = isMultiSelect ? null : editor.selected;
		for (let i = 0; i < selectedObjects.length; i++) {
			if (selectedObjects[i].commands === undefined) {
				selectedObjects[i].commands = [];
			}
		}

		topContainer.setDisplay('block');
		addCommandContainer.setDisplay('block');
		commandsContainer.setDisplay('block');
		container.setDisplay('block');

		// 标题
		topContainer.add(new UIText(strings.getKey('sidebar/command').toUpperCase()));

		// 选择项部分
		addCommandContainer.add(new UIBreak());
		const label = new UIText(strings.getKey('sidebar/command/select') || '选择项').setWidth('90px');
		addCommandContainer.add(label);
		const select = new UISelect().setWidth('100px');
		select.setOptions({
			'Voice': strings.getKey('sidebar/command/select/voice') || '语音指令'
		});
		select.setValue('Voice');
		addCommandContainer.add(select);
		const newCommand = new UIButton(strings.getKey('sidebar/command/select/button') || '添加指令');
		addCommandContainer.add(newCommand);

		// 多选模式下，选择项下方加分割线
		if (isMultiSelect) {
			addCommandContainer.add(new UIHorizontalRule());
		}

		// 新建指令按钮逻辑
		newCommand.onClick(function() {
			if (!isMultiSelect && object) {
				let hasVoiceCommand = false;
				if (object.commands) {
					for (let i = 0; i < object.commands.length; i++) {
						if (object.commands[i].type === 'Voice') {
							hasVoiceCommand = true;
							break;
						}
					}
				}
				if (hasVoiceCommand) {
					const message = strings.getKey('menubar/command/already_exists') || '此对象已添加语音指令，不能重复添加';
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
			} else if (isMultiSelect) {
				const objectsWithVoiceCommand = [];
				const objectsToAddCommand = [];
				for (let i = 0; i < selectedObjects.length; i++) {
					const object = selectedObjects[i];
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
				if (objectsWithVoiceCommand.length > 0) {
					const conflictNames = objectsWithVoiceCommand.length > 3
						? objectsWithVoiceCommand.slice(0, 3).join(', ') + `...等${objectsWithVoiceCommand.length}个对象`
						: objectsWithVoiceCommand.join(', ');
					editor.showNotification(`以下对象已存在语音指令: ${conflictNames}，将跳过这些对象`, true);
				}
				if (objectsToAddCommand.length > 0) {
					for (let i = 0; i < objectsToAddCommand.length; i++) {
						const object = objectsToAddCommand[i];
						const command = CommandContainer.Create('Voice');
						if (command !== undefined) {
							const cmd = new AddCommandCommand(editor, object, command);
							editor.execute(cmd);
						}
					}
					editor.showNotification(`已为${objectsToAddCommand.length}个对象添加语音指令`, false);
				} else if (objectsToAddCommand.length === 0 && objectsWithVoiceCommand.length > 0) {
					editor.showNotification('所有选中对象都已有语音指令', false);
				}
			}
		});

		// 按钮禁用状态
		if (isMultiSelect) {
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
			if (allHaveVoiceCommand) {
				newCommand.setDisabled(true);
				newCommand.dom.style.opacity = '0.5';
				newCommand.dom.style.cursor = 'not-allowed';
			}
			// 统计信息和提示信息
			if (objectsWithVoiceCommand > 0) {
				commandsContainer.add(new UIHorizontalRule());
				const statsRow = new UIRow();
				statsRow.add(new UIText(`${selectedObjects.length}个选中对象中，${objectsWithVoiceCommand}个对象有语音指令`));
				commandsContainer.add(statsRow);
				const noteRow = new UIRow();
				noteRow.add(new UIText('注意：指令实例是各对象独立的，无法一次编辑所有'));
				commandsContainer.add(noteRow);
				commandsContainer.add(new UIBreak());
			} else {
				commandsContainer.add(new UIHorizontalRule());
				const noteRow = new UIRow();
				noteRow.add(new UIText('选中的对象中没有语音指令'));
				commandsContainer.add(noteRow);
				commandsContainer.add(new UIBreak());
			}
		} else if (object && object.commands && object.commands.length > 0) {
			for (let i = 0; i < object.commands.length; i++) {
				(function(object, command) {
					commandsContainer.add(new UIHorizontalRule());
					const cc = new CommandContainer(editor, object, command);
					cc.renderer(commandsContainer);
					commandsContainer.add(new UIBreak());
				})(object, object.commands[i]);
			}
		}
	}

	// signals
	signals.objectSelected.add(function(object) {
		if (object !== null && editor.camera !== object) {
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
