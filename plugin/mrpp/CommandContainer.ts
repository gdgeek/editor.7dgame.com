import * as THREE from 'three';
import { UIBreak, UIText, UIButton } from '../../three.js/editor/js/libs/ui.js';
import { RemoveCommandCommand } from '../commands/RemoveCommandCommand.js';

import { VoiceCommand } from './commands/VoiceCommand.js';
import { GestureCommand } from './commands/GestureCommand.js';
import type { MrppEditor, MrppCommand, MrppObject3D } from '../types/mrpp.js';

class CommandContainer {

	editor: MrppEditor;
	object: MrppObject3D;
	command: MrppCommand;
	handler?: VoiceCommand | GestureCommand;

	static Create(type: string): MrppCommand | undefined {
		switch (type.toLowerCase()) {
			case 'voice':
				return VoiceCommand.Create();
			case 'gesture':
				return GestureCommand.Create();
		}
	}

	constructor(editor: MrppEditor, object: MrppObject3D, command: MrppCommand) {
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

	renderer(container: any): void {
		const strings = this.editor.strings;
		const localizedType = strings.getKey(`sidebar/command/select/${this.command.type.toLowerCase()}`) || this.command.type;
		container.add(new UIText(localizedType));

		if (this.handler !== undefined) {
			this.handler.renderer(container);
		}

		const remove = new UIButton(strings.getKey('sidebar/command/remove'));
		remove.setMarginLeft('4px');
		remove.onClick(function (this: CommandContainer, event: Event) {
			this.editor.showConfirmation(strings.getKey('sidebar/command/remove/confirm'),
				function (this: CommandContainer) {
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
