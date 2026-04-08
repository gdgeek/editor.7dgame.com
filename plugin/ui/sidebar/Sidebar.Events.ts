import { UIPanel, UIButton, UIRow, UIInput } from '../../../three.js/editor/js/libs/ui.js';
import { AddEventCommand } from '../../commands/AddEventCommand.js';
import { EventContainer } from '../../mrpp/EventContainer.js';
import type { MrppEditor } from '../../types/mrpp.js';

function SidebarEvents(editor: MrppEditor): { container: InstanceType<typeof UIPanel>; update: () => void } {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('12px');
	container.dom.style.display = 'flex';
	container.dom.style.flexDirection = 'column';
	container.dom.style.gap = '12px';
	container.dom.classList.add('mrpp-events-panel');
	
	// --- 辅助函数：创建添加行 ---
	function createAddRow(placeholder: string, onAdd: (value: string) => void): InstanceType<typeof UIRow> {
		const row = new UIRow();
		row.setMarginBottom('0');
		row.setDisplay('flex');
		row.dom.style.alignItems = 'center';
		row.dom.style.gap = '6px';
		row.dom.style.border = 'none';
		row.dom.style.padding = '0';
		row.dom.classList.add('mrpp-events-add-row');
		const input = new UIInput();
		input.setWidth('calc(100% - 54px)');
		input.setValue('');
		(input.dom as HTMLInputElement).placeholder = placeholder;
		input.dom.style.height = '24px';
		input.dom.style.lineHeight = '24px';
		input.dom.style.padding = '0 8px';
		input.dom.style.borderRadius = '4px';
		input.dom.style.boxSizing = 'border-box';
		input.dom.classList.add('mrpp-events-input');
		const addButton = new UIButton(strings.getKey('sidebar/events/add') || 'ADD');
		addButton.setWidth('48px');
		addButton.dom.style.flexShrink = '0';
		addButton.dom.style.height = '24px';
		addButton.dom.style.lineHeight = '24px';
		addButton.dom.style.padding = '0';
		addButton.dom.style.borderRadius = '4px';
		addButton.dom.style.fontSize = '12px';
		addButton.dom.classList.add('mrpp-events-button');
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
	inputSection.dom.style.border = 'none';
	inputSection.dom.style.display = 'flex';
	inputSection.dom.style.flexDirection = 'column';
	inputSection.dom.style.gap = '8px';
	inputSection.dom.style.borderRadius = '8px';
	inputSection.dom.style.padding = '10px';
	inputSection.dom.style.boxSizing = 'border-box';
	inputSection.dom.classList.add('mrpp-events-section');
	const outputSection = new UIPanel();
	outputSection.dom.style.borderTop = 'none';
	outputSection.dom.style.border = 'none';
	outputSection.dom.style.display = 'flex';
	outputSection.dom.style.flexDirection = 'column';
	outputSection.dom.style.gap = '8px';
	outputSection.dom.style.borderRadius = '8px';
	outputSection.dom.style.padding = '10px';
	outputSection.dom.style.boxSizing = 'border-box';
	outputSection.dom.classList.add('mrpp-events-section');
	container.add(inputSection, outputSection);

	function update(): void {
		inputSection.clear();
		outputSection.clear();

		if (editor.scene.events === undefined) {
			(editor.scene as any).events = { inputs: [], outputs: [] };
		}

		// --- 输入事件部分 ---
		inputSection.add(createAddRow(strings.getKey('sidebar/events/inputs') || '输入信号', (value) => {
			const command = new AddEventCommand(editor, { title: value, uuid: THREE.MathUtils.generateUUID() }, 'input');
			editor.execute(command);
			editor.showNotification(strings.getKey('sidebar/events/add/success'));
		}));

		const inputListContainer = new UIPanel();
		inputListContainer.dom.style.display = 'flex';
		inputListContainer.dom.style.flexDirection = 'column';
		inputListContainer.dom.style.border = 'none';
		inputListContainer.dom.style.padding = '0';
		inputListContainer.dom.style.background = 'transparent';
		inputListContainer.dom.style.borderRadius = '6px';
		inputListContainer.dom.style.overflow = 'hidden';
		inputListContainer.dom.classList.add('mrpp-events-list');
		inputSection.add(inputListContainer);

		const inputs = (editor.scene as any).events.inputs;
		if (inputs && inputs.length > 0) {
			inputs.forEach((event: any) => {
				const row = new UIRow();
				row.dom.style.width = '100%';
				row.dom.style.margin = '0';
				row.dom.style.border = 'none';
				row.setPadding('6px 8px');
				row.dom.style.minHeight = '0';
				row.dom.classList.add('mrpp-event-item');
				
				const ec = new EventContainer(editor, event, 'input');
				ec.renderer(row);
				
				inputListContainer.add(row);
			});
		}
		// --- 输出事件部分 ---
		outputSection.add(createAddRow(strings.getKey('sidebar/events/outputs') || '输出信号', (value) => {
			const command = new AddEventCommand(editor, { title: value, uuid: THREE.MathUtils.generateUUID() }, 'output');
			editor.execute(command);
			editor.showNotification(strings.getKey('sidebar/events/add/success'));
		}));

		const outputListContainer = new UIPanel();
		outputListContainer.dom.style.display = 'flex';
		outputListContainer.dom.style.flexDirection = 'column';
		outputListContainer.dom.style.border = 'none';
		outputListContainer.dom.style.padding = '0';
		outputListContainer.dom.style.background = 'transparent';
		outputListContainer.dom.style.borderRadius = '6px';
		outputListContainer.dom.style.overflow = 'hidden';
		outputListContainer.dom.classList.add('mrpp-events-list');
		outputSection.add(outputListContainer);

		const outputs = (editor.scene as any).events.outputs;
		if (outputs && outputs.length > 0) {
			outputs.forEach((event: any) => {
				const row = new UIRow();
				row.dom.style.width = '100%';
				row.dom.style.margin = '0';
				row.dom.style.border = 'none';
				row.setPadding('6px 8px');
				row.dom.style.minHeight = '0';
				row.dom.classList.add('mrpp-event-item');

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
