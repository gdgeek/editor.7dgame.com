import { UIBreak, UIText, UIRow, UICheckbox, UIInput } from '../../libs/ui.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';
import { ROLES } from '../../Access.js';

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
    };
    return component;
  }

  named(container) {
    container.add(new UIBreak());
    container.add(new UIBreak());
    const strings = this.editor.strings;

    // UUID
    {
      const row = new UIRow();
      this.uuid = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(true);
      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      row.add(this.uuid);
      container.add(row);
    }

    // Mode 勾选框
    {
      const row = new UIRow();
      row.add(new UIText(strings.getKey('sidebar/components/select/action/mode')).setWidth('90px'));

      // pinch 复选框：始终显示。特权用户可修改，非特权用户只读
      this.modePinch = new UICheckbox(true);
      if (this.editor.access.atLeast(ROLES.MANAGER)) {
        this.modePinch.onChange(() => this.updateMode());
      } else {
        this.modePinch.setDisabled(true);
      }
      row.add(this.modePinch);
      row.add(new UIText(strings.getKey('sidebar/components/select/action/mode/pinch')).setWidth('50px'));
      row.setMarginRight('20px');

      // touch 复选框：只有特权用户可见并可编辑
      if (this.editor.access.atLeast(ROLES.MANAGER)) {
        this.modeTouch = new UICheckbox(false).onChange(() => this.updateMode());
        row.add(this.modeTouch);
        row.add(new UIText(strings.getKey('sidebar/components/select/action/mode/touch')).setWidth('50px'));
      }

      container.add(row);
    }

    // Action 输入框
    {
      const row = new UIRow();
      this.action = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(false)
        .onChange(this.updateAction.bind(this));
      row.add(new UIText(strings.getKey('sidebar/components/select/action/name')).setWidth('90px'));
      row.add(this.action);
      container.add(row);
    }

  }

  updateMode() {
    const modeArray = [];
    if (this.modePinch && this.modePinch.getValue()) modeArray.push('pinch');
    if (this.modeTouch && this.modeTouch.getValue()) modeArray.push('touch');

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'mode',
      modeArray
    );
    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updateAction() {
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
    if (this.modePinch) this.modePinch.setValue(modeArray.includes('pinch'));
    if (this.modeTouch) this.modeTouch.setValue(modeArray.includes('touch'));
  }

  renderer(container) {
    this.named(container);
    this.updateUI();
  }

}

export { ActionComponent };
