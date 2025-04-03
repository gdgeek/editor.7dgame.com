import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule, UISelect } from '../../libs/ui.js';
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
        action: '',
        parameter: ''
      }
    };
    return component;
  }

  named(container) {
    container.add(new UIBreak());
    container.add(new UIBreak());
    const strings = this.editor.strings;

    {
      const row = new UIRow();
      this.uuid = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(true);

      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      row.add(this.uuid);
      container.add(row);
    }

    {
      const row = new UIRow();
      const voiceLabel = new UIText(strings.getKey("sidebar/command/voice/label")).setWidth('90px');

      const voiceOptions = {
        scaleUp: strings.getKey('sidebar/command/voice/scaleUp'),
        scaleDown: strings.getKey('sidebar/command/voice/scaleDown'),
        decompose: strings.getKey('sidebar/command/voice/decompose'),
        reset: strings.getKey('sidebar/command/voice/reset'),
        nextStep: strings.getKey('sidebar/command/voice/nextStep'),
        returnMain: strings.getKey('sidebar/command/voice/returnMain'),
        closeTooltip: strings.getKey('sidebar/command/voice/closeTooltip'),
        openTooltip: strings.getKey('sidebar/command/voice/openTooltip'),
      };

      this.voiceSelect = new UISelect().setWidth('150px').setFontSize('12px');
      this.voiceSelect.setOptions(voiceOptions).onChange(this.update.bind(this));

      row.add(voiceLabel);
      row.add(this.voiceSelect);
      container.add(row);
    }
  }

  update() {
    this.component.parameters.action = this.voiceSelect.getValue();

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'voice',
      this.component.parameters.action
    );

    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updateUI() {
    this.uuid.setValue(this.component.parameters.uuid);
    this.voiceSelect.setValue(this.component.parameters.action);
  }

  renderer(container) {
    this.named(container);
    this.updateUI();
  }
}

export { VoiceCommand };
