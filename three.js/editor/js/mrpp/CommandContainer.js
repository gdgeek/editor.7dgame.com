import { UIBreak, UIText, UIButton } from '../libs/ui.js';
import { RemoveCommandCommand } from '../commands/RemoveCommandCommand.js';

import { VoiceCommand } from './commands/VoiceCommand.js';
import { GestureCommand } from './commands/GestureCommand.js';

class CommandContainer {

	static Create(type) {
		switch (type.toLowerCase()) {
			case 'voice':
				return VoiceCommand.Create();
			case 'gesture':
				return GestureCommand.Create();
		}
	}

	constructor(editor, object, command) {
		this.editor = editor;
		this.object = object;
		this.command = command;

		switch (command.type.toLowerCase()) {
			case 'voice':
				this.handler = new VoiceCommand(editor, object, command);
				break;
			case 'gesture':
				this.handler = new GestureCommand(editor, object, command);
				break;
			default:
				console.error('CommandContainer: Unknown command type.');
		}
	}

	renderer(container) {
		const strings = this.editor.strings;
		container.add(new UIText(this.command.type));

		if (this.handler !== undefined) {
			this.handler.renderer(container);
		}

		const remove = new UIButton(strings.getKey('sidebar/command/remove'));
		remove.setMarginLeft('4px');
		remove.onClick(function(event) {
			this.editor.showConfirmation(strings.getKey('sidebar/command/remove/confirm'),
				function() {
					this.editor.execute(new RemoveCommandCommand(this.editor, this.object, this.command));
				}.bind(this),
				null,
				event,
				true
			);
		}.bind(this));
		container.add(remove);
		container.add(new UIBreak());
	}
}

export { CommandContainer };
