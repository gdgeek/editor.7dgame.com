import { UIButton, UIInput } from '../../three.js/editor/js/libs/ui.js';
import { RemoveEventCommand } from '../commands/RemoveEventCommand.js';
import { SetEventValueCommand } from '../commands/SetEventValueCommand.js';

class EventContainer {


	/**
	 * @param {object} editor
	 * @param {{title: string, uuid: string, [key: string]: any}} event
	 * @param {string} mode
	 */
	constructor(editor, event, mode) {
		this.editor = editor;
		this.event = event;
		this.mode = mode;
	}

	/**
	 * @param {object} container
	 * @returns {void}
	 */
	renderer(container) {
		const strings = this.editor.strings;

		container.dom.style.display = 'flex';
		container.dom.style.alignItems = 'center';
		container.dom.style.gap = '4px';
		container.dom.style.boxSizing = 'border-box'; // 确保 padding 不撑开宽度

		const titleInput = new UIInput(this.event.title || '');
		titleInput.setWidth('calc(100% - 49px)');
		titleInput.dom.style.flex = '1 1 auto';
		titleInput.dom.style.minWidth = '0';
		titleInput.dom.style.fontSize = '12px';
		titleInput.dom.addEventListener('keydown', function (event) {

			if (event.key === 'Enter') {

				titleInput.dom.blur();

			}

		});
		titleInput.onChange(function () {

			const value = titleInput.getValue().trim();
			const currentValue = this.event && this.event.title ? this.event.title : '';

			if (value === '') {

				titleInput.setValue(currentValue);
				return;

			}

			if (value === currentValue) return;

			this.editor.execute(new SetEventValueCommand(this.editor, this.event, this.mode, 'title', value));

		}.bind(this));
		container.add(titleInput);

		const remove = new UIButton(strings.getKey('sidebar/events/remove'));
		remove.dom.style.fontSize = '10px';
		remove.dom.style.padding = '2px 4px';
		remove.dom.style.flexShrink = '0'; // 防止按钮被压缩

		remove.onClick(function (event) {
			this.editor.showConfirmation(strings.getKey('sidebar/events/remove/confirm'),
				function () {
					this.editor.execute(new RemoveEventCommand(this.editor, this.event, this.mode));
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
