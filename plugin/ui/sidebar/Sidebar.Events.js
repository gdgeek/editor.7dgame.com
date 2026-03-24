import { UIPanel, UIText, UIButton, UIRow, UIInput, UIHorizontalRule } from '../../../three.js/editor/js/libs/ui.js';
import { AddEventCommand } from '../../commands/AddEventCommand.js';
import { EventContainer } from '../../mrpp/EventContainer.js';

function SidebarEvents(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('10px');
	
	// --- 辅助函数：创建一个带标题的分组 ---
	function createSectionHeader(text) {
		const header = new UIRow();
		header.setPadding('4px 0');
		header.setMarginBottom('8px');
		header.dom.style.border = 'none'; 
		const label = new UIText(text);
		label.setFontSize('12px');
		label.setColor('#777');
		header.add(label);
		return header;
	}

	// --- 辅助函数：创建添加行 ---
	function createAddRow(onAdd) {
		const row = new UIRow();
		row.setMarginBottom('10px');
		row.setDisplay('flex');
		row.dom.style.alignItems = 'center';
		row.dom.style.gap = '4px';
		row.dom.style.border = 'none'; 
		const input = new UIInput();
		input.setWidth('calc(100% - 49px)');
		input.setValue('');		
		const addButton = new UIButton(strings.getKey('sidebar/events/add') || 'ADD');
		addButton.setWidth('45px');
		addButton.dom.style.flexShrink = '0';
		addButton.onClick(() => {
			const value = input.getValue();
			if (value.trim() !== "") {
				onAdd(value);
				input.setValue("");
			}
		});

		row.add(input);
		row.add(addButton);
		return row;
	}

	const inputSection = new UIPanel();
	inputSection.dom.style.borderTop = 'none';
	const outputSection = new UIPanel();
	outputSection.dom.style.borderTop = 'none';
	container.add(inputSection, outputSection);

	function update() {
		inputSection.clear();
		outputSection.clear();

		if (editor.scene.events === undefined) {
			editor.scene.events = { inputs: [], outputs: [] };
		}

		// --- 输入事件部分 ---
		inputSection.add(createSectionHeader(strings.getKey('sidebar/events/inputs')));
		inputSection.add(createAddRow((value) => {
			const command = new AddEventCommand(editor, { title: value, uuid: THREE.MathUtils.generateUUID() }, 'input');
			editor.execute(command);
		}));

		const inputListContainer = new UIPanel();
		inputListContainer.dom.style.display = 'block';
		inputListContainer.dom.style.border = 'none';
		inputSection.add(inputListContainer);

		const inputs = editor.scene.events.inputs;
		if (inputs && inputs.length > 0) {
			inputs.forEach((event) => {
				const row = new UIRow();
				row.dom.style.width = '100%';
				row.dom.style.margin = '0 0 6px 0';
				row.dom.style.border = 'none';
				row.setPadding('8px 6px');
				row.dom.style.minHeight = '32px';
				
				row.setBackgroundColor('#dddddd');
				row.dom.style.borderRadius = '3px';
				
				const ec = new EventContainer(editor, event, 'input');
				ec.renderer(row);
				
				inputListContainer.add(row);
			});
		}
		const divider = new UIHorizontalRule();
		divider.setMarginTop('4px');
		divider.setMarginBottom('12px');
		inputSection.add(divider);

		// --- 输出事件部分 ---
		outputSection.add(createSectionHeader(strings.getKey('sidebar/events/outputs')));
		outputSection.add(createAddRow((value) => {
			const command = new AddEventCommand(editor, { title: value, uuid: THREE.MathUtils.generateUUID() }, 'output');
			editor.execute(command);
		}));

		const outputListContainer = new UIPanel();
		outputListContainer.dom.style.display = 'block';
		outputListContainer.dom.style.border = 'none';
		outputSection.add(outputListContainer);

		const outputs = editor.scene.events.outputs;
		if (outputs && outputs.length > 0) {
			outputs.forEach((event) => {
				const row = new UIRow();
				row.dom.style.width = '100%';
				row.dom.style.margin = '0 0 6px 0';
				row.dom.style.border = 'none';
				row.setPadding('8px 6px');
				row.dom.style.minHeight = '32px';
				
				row.setBackgroundColor('#dddddd');
				row.dom.style.borderRadius = '3px';

				const ec = new EventContainer(editor, event, 'output');
				ec.renderer(row);

				outputListContainer.add(row);
			});
		}
	}

	signals.eventAdded.add(update);
	signals.eventRemoved.add(update);
	signals.eventChanged.add(update);
	signals.editorCleared.add(update);
	signals.sceneGraphChanged.add(update);
	signals.objectSelected.add(update); 

	update();

	return { container, update };
}

export { SidebarEvents };
