import { UIPanel, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule } from './libs/ui.js';
import { AddEventCommand } from './commands/AddEventCommand.js';
import { EventContainer } from './mrpp/EventContainer.js';

function SidebarEvents(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setPadding('10px');
	
	// const top = new UIRow();
	// top.dom.style.borderBottom = 'none';
	// container.add(top);
	// top.setDisplay('block');
	// 			top.add(new UIText(strings.getKey('sidebar/events')).setTextTransform('uppercase'));
	
	// --- 辅助函数：创建一个带标题的分组 ---
	function createSectionHeader(text) {
		const header = new UIRow();
		header.setPadding('4px 8px');
		header.setMarginBottom('10px');
		header.dom.style.border = 'none'; 
		const label = new UIText(text).setTextTransform('uppercase');
		header.add(label);
		return header;
	}

	// --- 辅助函数：创建添加行 ---
	function createAddRow(type, onAdd) {
		const row = new UIRow();
		row.setMarginBottom('10px');
		row.setDisplay('flex');
		row.dom.style.border = 'none'; 
		const input = new UIInput().setMarginRight('4px');
		input.setValue('');		
		const addButton = new UIButton(strings.getKey('sidebar/events/add') || 'ADD');
		addButton.setWidth('45px');
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
	// outputSection.dom.style.borderTop = 'none'; 
	container.add(inputSection, outputSection);

	function update() {
		inputSection.clear();
		outputSection.clear();

		const object = editor.selected;
		if (object !== editor.scene) {
			container.setDisplay('none');
			return;
		}
		container.setDisplay('block');

		if (editor.scene.events === undefined) {
			editor.scene.events = { inputs: [], outputs: [] };
		}

		// --- 输入事件部分 ---
		inputSection.add(createSectionHeader(strings.getKey('sidebar/events/inputs')));
		inputSection.add(createAddRow('input', (value) => {
			const command = new AddEventCommand(editor, { title: value, uuid: THREE.MathUtils.generateUUID() }, 'input');
			editor.execute(command);
		}));

		const inputListContainer = new UIPanel();
		inputListContainer.dom.style.display = 'flex';
		inputListContainer.dom.style.flexWrap = 'wrap';
		inputListContainer.dom.style.gap = '6px'; 
		inputListContainer.dom.style.border = 'none';
		inputSection.add(inputListContainer);

		const inputs = editor.scene.events.inputs;
		if (inputs && inputs.length > 0) {
			inputs.forEach((event) => {
				const row = new UIRow();
				row.dom.style.width = 'calc(50% - 3px)'; 
				row.dom.style.margin = '0';
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
		inputSection.add(new UIBreak());

		// --- 输出事件部分 ---
		outputSection.add(createSectionHeader(strings.getKey('sidebar/events/outputs')));
		outputSection.add(createAddRow('output', (value) => {
			const command = new AddEventCommand(editor, { title: value, uuid: THREE.MathUtils.generateUUID() }, 'output');
			editor.execute(command);
		}));

		const outputListContainer = new UIPanel();
		outputListContainer.dom.style.display = 'flex';
		outputListContainer.dom.style.flexWrap = 'wrap';
		outputListContainer.dom.style.gap = '6px';
		outputListContainer.dom.style.border = 'none';
		outputSection.add(outputListContainer);

		const outputs = editor.scene.events.outputs;
		if (outputs && outputs.length > 0) {
			outputs.forEach((event) => {
				const row = new UIRow();
				row.dom.style.width = 'calc(50% - 3px)';
				row.dom.style.margin = '0';
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
	signals.objectSelected.add(update); 

	return { container, update };
}

export { SidebarEvents };