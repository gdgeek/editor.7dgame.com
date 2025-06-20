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

	const commandsContainer = new UIRow();
	container.add(commandsContainer);

	function update() {
		topContainer.clear();
		topContainer.setDisplay('none');
		commandsContainer.clear();
		commandsContainer.setDisplay('none');

		const object = editor.selected;

		if (object === null) {
			return;
		}

		const commands = object.commands;

		if (commands !== undefined) {
			// 只有当有指令实例时才显示指令标题和内容
			if (commands.length > 0) {
				topContainer.setDisplay('block');
				topContainer.add(new UIText(strings.getKey('sidebar/command').toUpperCase()));
			} else {
				// 没有指令时整个容器不显示
				container.setDisplay('none');
				return;
			}

			/*
			topContainer.add(new UIBreak());
			topContainer.add(new UIBreak());

			const label = new UIText(strings.getKey('sidebar/command/select')).setWidth('90px');
			topContainer.add(label);

			// 创建下拉框
			const select = new UISelect().setWidth('100px');
			select.setOptions({
				'Voice': strings.getKey('sidebar/command/select/voice')
			});
			select.setValue('Voice');
			select.onChange(function() {
				console.log('Selected option:', select.getValue());
			});
			topContainer.add(select);

			const newCommand = new UIButton(strings.getKey('sidebar/command/select/button'));
			newCommand.onClick(function() {
				const command = CommandContainer.Create(select.getValue());

				if (command != undefined) {
					const cmd = new AddCommandCommand(editor, editor.selected, command);
					editor.execute(cmd);
				}
			}.bind(this));
			topContainer.add(newCommand);
			*/
		} else {
			// 没有指令属性时整个容器不显示
			container.setDisplay('none');
			return;
		}

		if (commands !== undefined && commands.length > 0) {
			container.setDisplay('block');
			commandsContainer.setDisplay('block');
			for (let i = 0; i < commands.length; i++) {
				(function(object, command) {
					commandsContainer.add(new UIHorizontalRule());

					const cc = new CommandContainer(editor, object, command);
					cc.renderer(commandsContainer);

					// 将水平分隔线添加到容器中
					commandsContainer.add(new UIBreak());
				})(object, commands[i]);
			}
		} else {
			// 没有指令时整个容器不显示
			container.setDisplay('none');
		}
	}

	// signals
	signals.objectSelected.add(function(object) {
		if (object !== null && editor.camera !== object) {
			container.setDisplay('block');
			update();
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
