/* global THREE */
/** @type {typeof import('three')} */
// eslint-disable-next-line no-unused-vars -- THREE is loaded via import map in the HTML host

import { UIBreak, UIText, UIRow, UICheckbox, UIInput } from '../../../three.js/editor/js/libs/ui.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';
import { ROLES } from '../../access/Access.js';

class ActionComponent {

  /**
   * @param {object} editor - Editor 实例
   * @param {import('three').Object3D} object - 目标 3D 对象
   * @param {object} component - 组件数据对象
   */
  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
  }

  /**
   * 创建默认的 Action 组件数据。
   * @returns {object} 组件数据对象
   */
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

  /**
   * 构建组件 UI 并添加到容器中。
   * @param {object} container - UI 容器
   */
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
      row.add(new UIText(strings.getKey('sidebar/components/action/mode')).setWidth('90px'));

      // pinch 复选框：始终显示。特权用户可修改，非特权用户只读
      this.modePinch = new UICheckbox(true);
      if (this.editor.access.atLeast(ROLES.MANAGER)) {
        this.modePinch.onChange(() => this.updateMode());
      } else {
        this.modePinch.setDisabled(true);
      }
      row.add(this.modePinch);
      row.add(new UIText(strings.getKey('sidebar/components/action/mode/pinch')).setWidth('50px'));
      row.setMarginRight('20px');

      // touch 复选框：只有特权用户可见并可编辑
      if (this.editor.access.atLeast(ROLES.MANAGER)) {
        this.modeTouch = new UICheckbox(false).onChange(() => this.updateMode());
        row.add(this.modeTouch);
        row.add(new UIText(strings.getKey('sidebar/components/action/mode/touch')).setWidth('50px'));
      }

      container.add(row);
    }

    // Action 输入框
    {
      const row = new UIRow();
      this.action = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(false)
        .onChange(this.updateAction.bind(this));
      row.add(new UIText(strings.getKey('sidebar/components/action/name')).setWidth('90px'));
      row.add(this.action);
      container.add(row);
    }

  }

  /** 更新 mode 参数到组件数据 */
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

  /** 更新 action 参数到组件数据 */
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

  /** 从组件数据同步 UI 显示 */
  updateUI() {
    this.uuid.setValue(this.component.parameters.uuid);
    this.action.setValue(this.component.parameters.action);

    const modeArray = this.component.parameters.mode || [];
    if (this.modePinch) this.modePinch.setValue(modeArray.includes('pinch'));
    if (this.modeTouch) this.modeTouch.setValue(modeArray.includes('touch'));
  }

  /**
   * 渲染组件 UI。
   * @param {object} container - UI 容器
   */
  renderer(container) {
    this.named(container);
    this.updateUI();
  }

}

export { ActionComponent };