import { UIButton, UIInput } from '../../three.js/editor/js/libs/ui.js';
import { RemoveEventCommand } from '../commands/RemoveEventCommand.js';
import { SetEventValueCommand } from '../commands/SetEventValueCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

class EventContainer {

	editor: MrppEditor;
	event: { title: string; uuid: string; [key: string]: any };
	mode: string;

	constructor(editor: MrppEditor, event: { title: string; uuid: string; [key: string]: any }, mode: string) {
		this.editor = editor;
		this.event = event;
		this.mode = mode;
	}

	renderer(container: any): void {
		const strings = this.editor.strings;

		container.dom.style.display = 'flex';
		container.dom.style.alignItems = 'center';
		container.dom.style.gap = '6px';
		container.dom.style.boxSizing = 'border-box';
		container.dom.classList.add('mrpp-event-item-content');

		const titleInput = new UIInput(this.event.title || '');
		titleInput.setWidth('calc(100% - 58px)');
		titleInput.dom.style.flex = '1 1 auto';
		titleInput.dom.style.minWidth = '0';
		titleInput.dom.style.fontSize = '12px';
		titleInput.dom.style.height = '24px';
		titleInput.dom.style.lineHeight = '24px';
		titleInput.dom.style.padding = '0 8px';
		titleInput.dom.style.borderRadius = '4px';
		titleInput.dom.style.boxSizing = 'border-box';
		titleInput.dom.classList.add('mrpp-events-input');
		titleInput.dom.addEventListener('keydown', function (event: KeyboardEvent) {

			if (event.key === 'Enter') {

				titleInput.dom.blur();

			}

		});
		titleInput.onChange(function (this: EventContainer) {

			const value = titleInput.getValue().trim();
			const currentValue = this.event && this.event.title ? this.event.title : '';

			if (value === '') {

				titleInput.setValue(currentValue);
				return;

			}

			if (value === currentValue) return;

			this.editor.execute(new SetEventValueCommand(this.editor, this.event, this.mode, 'title', value));
			this.editor.showNotification(strings.getKey('sidebar/events/rename/success'));

		}.bind(this));
		container.add(titleInput);

		const remove = new UIButton(strings.getKey('sidebar/events/remove'));
		remove.dom.style.fontSize = '11px';
		remove.dom.style.padding = '0 8px';
		remove.dom.style.height = '24px';
		remove.dom.style.lineHeight = '24px';
		remove.dom.style.borderRadius = '4px';
		remove.dom.style.flexShrink = '0';
		remove.dom.classList.add('mrpp-events-button', 'mrpp-events-remove-button');

		remove.onClick(function (this: EventContainer, event: Event) {
			this.editor.showConfirmation(strings.getKey('sidebar/events/remove/confirm'),
				function (this: EventContainer) {
					this.editor.execute(new RemoveEventCommand(this.editor, this.event, this.mode));
					this.editor.showNotification(strings.getKey('sidebar/events/delete/success'));
				}.bind(this),
				null,
				event,
				true
			);
		}.bind(this));

		container.add(remove);

	}
}
export { EventContainer };
