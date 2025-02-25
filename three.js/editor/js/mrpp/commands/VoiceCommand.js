import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule, UICheckbox } from '../../libs/ui.js';
import { RemoveComponentCommand } from '../../commands/RemoveComponentCommand.js';
import { SetComponentValueCommand } from '../../commands/SetComponentValueCommand.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';
class VoiceCommand {

  constructor(editor, object, component) {

    this.editor = editor;
    this.object = object;
    this.component = component;

  }
  static Create() {
    const component = {
      type: 'Voice',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        voice: '',
        parameter: ''
      }
    }
    return component;
  }
  named(container) {
    container.add(new UIBreak())
    container.add(new UIBreak())
    const strings = this.editor.strings;
    {
      const row = new UIRow()
      this.uuid = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(true);
      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      row.add(this.uuid);
      container.add(row)
    }

    {
      const row = new UIRow()
      row.add(new UIText("voice").setWidth('90px'));

      const checkboxContainer = document.createElement('div');
      checkboxContainer.style.display = 'flex';
      checkboxContainer.style.gap = '10px';

      this.voiceCheckboxes = {
        A: new UICheckbox().onChange(this.update.bind(this)),
        B: new UICheckbox().onChange(this.update.bind(this)),
        C: new UICheckbox().onChange(this.update.bind(this)),
        D: new UICheckbox().onChange(this.update.bind(this))
      };

      for (const [option, checkbox] of Object.entries(this.voiceCheckboxes)) {
        const optionContainer = document.createElement('div');
        optionContainer.style.display = 'flex';
        optionContainer.style.alignItems = 'center';
        optionContainer.style.gap = '5px';

        const label = document.createElement('span');
        label.textContent = option;

        optionContainer.appendChild(checkbox.dom);
        optionContainer.appendChild(label);
        checkboxContainer.appendChild(optionContainer);
      }

      row.dom.appendChild(checkboxContainer);
      container.add(row)
    }
  }
  update() {
    const selectedOptions = Object.entries(this.voiceCheckboxes)
      .filter(([_, checkbox]) => checkbox.getValue())
      .map(([option]) => option)
      .join(',');

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'voice',
      selectedOptions
    );

    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }
  updateUI() {
    this.uuid.setValue(this.component.parameters.uuid);
    const selectedOptions = this.component.parameters.voice.split(',');

    for (const [option, checkbox] of Object.entries(this.voiceCheckboxes)) {
      checkbox.setValue(selectedOptions.includes(option));
    }
  }
  renderer(container) {

    this.named(container);
    this.updateUI();
  }

}
export { VoiceCommand };
