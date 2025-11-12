import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UICheckbox, UIHorizontalRule } from '../../libs/ui.js';
import { RemoveComponentCommand } from '../../commands/RemoveComponentCommand.js';
import { SetComponentValueCommand } from '../../commands/SetComponentValueCommand.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';

class ActionComponent {

  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
  }

  static Create() {
    const component = {
      type: 'Action',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        action: '',
        parameter: '',
        mode: ['pinch']  // 新增 mode 参数, 默认包含 'pinch'
      }
    }
    return component;
  }

  named(container) {
    container.add(new UIBreak())
    container.add(new UIBreak())
    const strings = this.editor.strings;

    // UUID
    {
      const row = new UIRow()
      this.uuid = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(true);
      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      row.add(this.uuid);
      container.add(row)
    }
    // Mode 勾选框
    {
      const row = new UIRow();
      row.add(new UIText(strings.getKey('sidebar/components/select/action/mode')).setWidth('90px'));

      this.modeClick = new UICheckbox(true).onChange(() => this.updateMode());
      row.add(this.modeClick);
      row.add(new UIText(strings.getKey('sidebar/components/select/action/mode/pinch')).setWidth('50px'));
      row.setMarginRight('20px');

      this.modeTouch = new UICheckbox(false).onChange(() => this.updateMode());
      row.add(this.modeTouch);
      row.add(new UIText(strings.getKey('sidebar/components/select/action/mode/touch')).setWidth('50px'));

      container.add(row);
    }
    
    // Action 输入框
    {
      const row = new UIRow()
      this.action = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(false)
        .onChange(this.update.bind(this));
      row.add(new UIText(strings.getKey('sidebar/components/select/action/name')).setWidth('90px'));
      row.add(this.action);
      container.add(row)
    }

  }

  updateMode() {
    const modeArray = [];
    if (this.modeClick.getValue()) modeArray.push('pinch');
    if (this.modeTouch.getValue()) modeArray.push('touch');

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'mode',
      modeArray
    );
    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  update() {
    const action = this.action.getValue();
    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'action',
      action
    );
    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updateUI() {
    this.uuid.setValue(this.component.parameters.uuid);
    this.action.setValue(this.component.parameters.action);

    const modeArray = this.component.parameters.mode || [];
    this.modeClick.setValue(modeArray.includes('pinch'));
    this.modeTouch.setValue(modeArray.includes('touch'));
  }

  renderer(container) {
    this.named(container);
    this.updateUI();
  }

}

export { ActionComponent };
