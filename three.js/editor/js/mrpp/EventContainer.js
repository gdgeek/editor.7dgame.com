import { UIText, UIButton, UIRow } from '../libs/ui.js'; // 引入 UIRow 辅助布局
import { RemoveEventCommand } from '../commands/RemoveEventCommand.js';

class EventContainer {


	constructor(editor, event, mode) {
		this.editor = editor;
		this.event = event;
		this.mode = mode;
	}

	renderer(container) {
		const strings = this.editor.strings;

		container.dom.style.display = 'flex';
		container.dom.style.alignItems = 'center';
		container.dom.style.justifyContent = 'space-between';
		container.dom.style.boxSizing = 'border-box'; // 确保 padding 不撑开宽度

		const titleText = new UIText(this.event.title || '');
		titleText.dom.style.color = '#8a8a8a';
		titleText.dom.style.flex = '1'; // 让文字占据剩余空间
		titleText.dom.style.textOverflow = 'ellipsis';
		titleText.dom.style.overflow = 'hidden';
		titleText.dom.style.whiteSpace = 'nowrap';
		titleText.dom.style.fontSize = '12px';
		titleText.dom.style.lineHeight = '1';
		container.add(titleText);

		const remove = new UIButton(strings.getKey('sidebar/script/remove'));
		remove.setMarginLeft('4px');
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
		container.add(new UIBreak());

	}
}
export { EventContainer };