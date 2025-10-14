import {
  UIPanel,
  UISelect,
  UINumber,
  UIBreak,
  UICheckbox,
  UIText,
  UIButton,
  UIRow,
  UIInput,
  UIHorizontalRule
} from '../../libs/ui.js';

import { SetValueCommand } from '../../commands/SetValueCommand.js';

class TriggerComponent {
  constructor(editor, object, component) {
    this.editor = editor;
    const node = editor.scene;
    const types = ['Voxel', 'Polygen'];
    this.list = [];

    node.traverse((child) => {
      if (types.includes(child.type) && child.uuid != object.uuid) {
        this.list.push(child);
      }
    });

    this.object = object;
    this.component = component;
  }

  static Create() {
    const component = {
      type: 'Trigger',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        target: [], // 数组，保持字段名为 target
        action: ''
      }
    };
    return component;
  }

  refresh(container) {
    container.add(new UIBreak());
    container.add(new UIBreak());
    const strings = this.editor.strings;

    // UUID
    {
      const row = new UIRow();

      this.uuid = new UIInput()
        .setWidth('150px')
        .setFontSize('12px')
        .setDisabled(true);
      this.uuid.setValue(this.component.parameters.uuid);
      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      row.add(this.uuid);
      container.add(row);
    }

    // Action
    {
      const row = new UIRow();

      this.action = new UIInput()
        .setWidth('150px')
        .setFontSize('12px')
        .setDisabled(false)
        .onChange(this.update.bind(this));

      this.action.setValue(this.component.parameters.action);
      row.add(new UIText('action').setWidth('90px'));
      row.add(this.action);
      container.add(row);
    }

    // Multi-select targets as checkbox list
    {
      const row = new UIRow();
      row.add(new UIText('target').setWidth('90px'));

      // 容器显示复选框
      this.checkboxContainer = new UIPanel();
      this.checkboxContainer.setWidth('156px');
      this.checkboxContainer.setFontSize('12px');

      const dom = this.checkboxContainer.dom;
      dom.style.backgroundColor = '#ffffffff';     // 白底
      dom.style.border = '1px solid #ffffffff';   // 边框
      dom.style.height = '120px';             // 固定高度
      dom.style.overflowY = 'auto';           // 滚动条
      dom.style.padding = '4px';
      dom.style.boxSizing = 'border-box';

      this.checkboxes = [];
      const targets = this.component.parameters.target || [];

      this.list.forEach((item) => {
        const optionRow = new UIRow();
        const checkbox = new UICheckbox()
          .setValue(targets.includes(item.uuid))
          .onChange(() => this.update());
        const label = new UIText(item.name || item.type || 'Unnamed').setWidth('120px');
        optionRow.add(checkbox);
        optionRow.add(label);
        this.checkboxContainer.add(optionRow);

        this.checkboxes.push({ uuid: item.uuid, checkbox });
      });

      row.add(this.checkboxContainer);
      container.add(row);
    }
  }

  update() {
    // 获取所有勾选的对象 UUID
    const selectedValues = this.checkboxes
      .filter(c => c.checkbox.getValue())
      .map(c => c.uuid);

    this.editor.execute(
      new SetValueCommand(this.editor, this.component.parameters, 'target', selectedValues)
    );

    this.editor.execute(
      new SetValueCommand(this.editor, this.component.parameters, 'action', this.action.getValue())
    );

    this.editor.signals.componentChanged.dispatch(this.component);
  }

  renderer(container) {
    this.refresh(container);
  }
}

export { TriggerComponent };