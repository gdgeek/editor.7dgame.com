import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule, UISelect } from '../../libs/ui.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';

class GestureCommand {

  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
  }

  static Create() {
    const component = {
      type: 'Gesture',
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
      const gestureLabel = new UIText(strings.getKey("sidebar/command/gesture/label") ).setWidth('90px');

      this.gestureSelect = new UISelect().setWidth('150px').setFontSize('12px');
      this.reloadOptions();

      row.add(gestureLabel);
      row.add(this.gestureSelect);
      container.add(row);
    }
  }

  reloadOptions() {
    const strings = this.editor.strings;
    const currentValue = this.gestureSelect ? this.gestureSelect.getValue() : '';

    const gestureOptions = {
      'ok': strings.getKey('sidebar/command/gesture/ok'),
      'fist': strings.getKey('sidebar/command/gesture/fist'),
    };

    this.gestureSelect.setOptions(gestureOptions);

    if (currentValue && gestureOptions[currentValue]) {
      this.gestureSelect.setValue(currentValue);
    }

    this.gestureSelect.onChange(this.update.bind(this));
  }

  update() {
    this.component.parameters.action = this.gestureSelect.getValue();

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'action',
      this.component.parameters.action
    );

    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updateUI() {
    if (this.uuid) this.uuid.setValue(this.component.parameters.uuid);
    if (this.gestureSelect) this.gestureSelect.setValue(this.component.parameters.action);
  }

  renderer(container) {
    this.named(container);
    this.updateUI();
  }
}

export { GestureCommand };
