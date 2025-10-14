import { UIPanel, UINumber, UIBreak, UICheckbox, UIText, UIButton, UIRow, UIInput, UIHorizontalRule } from '../../libs/ui.js';

import { SetValueCommand } from '../../commands/SetValueCommand.js';

class MovedComponent {
  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
    this.actionInput = null; // 添加对action输入框的引用
  }

  static Create() {
    const component = {
      type: 'Moved',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        magnetic: false,
        scalable: false,
        limit: {
          x: { enable: false, min: 0, max: 0 },
          y: { enable: false, min: 0, max: 0 },
          z: { enable: false, min: 0, max: 0 }
        },
        action: ''
      }
    };
    return component;
  }

  refresh(container) {
    container.add(new UIBreak());
    container.add(new UIBreak());

    const strings = this.editor.strings;
    // UUID行
    {
      const row = new UIRow();

      this.uuid = new UIInput()
        .setWidth('150px')
        .setFontSize('12px')
        .setDisabled(true);
      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      row.add(this.uuid);
      container.add(row);
    }

    // 可缩放部分
    /* {
      const row = new UIRow()
      const scalable = new UICheckbox().setValue(this.component.parameters.scalable)
        .onChange((item) => {
          console.error(item)
          this.editor.execute(new SetValueCommand(this.editor, this.component.parameters, 'scalable', scalable.getValue()));
        });
      row.add(
        new UIText('可缩放').setWidth('90px')
      )
      row.add(scalable)
      container.add(row)
    } */

    // 磁力部分
    {
      let row = new UIRow();
      const magneticRow = this.magneticTrigger(row, this.component.parameters.magnetic, this.component.parameters.action);
      container.add(magneticRow);
    }


    // 限位部分
    /* {
      let row = new UIRow()

      if (!this.component.parameters.limit) {
        this.component.parameters.limit = {}
      }

      if (!this.component.parameters.limit.x) {
        this.component.parameters.limit.x = { enable: false }
      }
      if (!this.component.parameters.limit.y) {
        this.component.parameters.limit.y = { enable: false }
      }
      if (!this.component.parameters.limit.z) {
        this.component.parameters.limit.z = { enable: false }
      }

      container.add(row)
    }
    {

      const limitX = this.limitIt(
        new UIRow().add(
          new UIText('X限位').setWidth('90px')
        ), 'x')
      container.add(limitX)
    }

    {

      const limitY = this.limitIt(
        new UIRow().add(
          new UIText('Y限位').setWidth('90px')
        ), 'y')
      container.add(limitY)
    }

    {

      const limitZ = this.limitIt(
        new UIRow().add(
          new UIText('Z限位').setWidth('90px')
        ), 'z')
      container.add(limitZ)
    } */

  }

  // 磁力触发方法
  magneticTrigger(container, magneticValue, action) {
    const strings = this.editor.strings;

    // 添加磁力标签
    container.add(new UIText(strings.getKey('sidebar/components/select/moved/magnetic')).setWidth('90px'));

    // 磁力复选框
    const magnetic = new UICheckbox()
      .setValue(magneticValue)
      .onChange(() => {
        this.editor.execute(new SetValueCommand(
          this.editor,
          this.component.parameters,
          'magnetic',
          magnetic.getValue()
        ));

        // 如果取消磁力，清空action
        if (!magnetic.getValue()) {
          this.editor.execute(new SetValueCommand(
            this.editor,
            this.component.parameters,
            'action',
            ''
          ));
        }

        // 更新UI并发送变更信号
        this.updateUI();
        this.editor.signals.componentChanged.dispatch(this.component);
      });

    container.add(magnetic);
    const spacer = new UIText('').setWidth('15px');
    container.add(spacer);
    // 如果磁力启用，显示action输入框
    if (magneticValue) {
      this.actionInput = new UIInput()
        .setValue(action || '')
        .setWidth('112px')
        .setFontSize('12px')
        .onChange(() => {
          this.update();
        });
      container.add(this.actionInput);
    }

    return container;
  }
  /* limitIt(container, prop) {
    const item = this.component.parameters.limit[prop];

    const enable = new UICheckbox()
      .setWidth('50px')
      .setValue(item.enable)
      .onChange(() => {
        if (enable.getValue()) {
          this.editor.execute(new SetValueCommand(
            this.editor,
            this.component.parameters.limit,
            prop,
            { enable: true, min: 0, max: 0 }
          ));
        } else {
          this.editor.execute(new SetValueCommand(
            this.editor,
            this.component.parameters.limit,
            prop,
            { enable: false }
          ));
        }
        this.editor.signals.componentChanged.dispatch(this.component);
      });

    container.add(enable);

    if (item.enable) {
      const min = new UINumber()
        .setValue(item.min)
        .setStep(1)
        .setRange(-9999, 0)
        .setWidth('50px')
        .onChange(() => {
          item.min = min.getValue();
          this.editor.execute(new SetValueCommand(
            this.editor,
            this.component.parameters.limit,
            prop,
            item
          ));
        });

      const max = new UINumber()
        .setValue(item.max)
        .setStep(1)
        .setRange(0, 9999)
        .setWidth('50px')
        .onChange(() => {
          item.max = max.getValue();
          this.editor.execute(new SetValueCommand(
            this.editor,
            this.component.parameters.limit,
            prop,
            item
          ));
        });

      container.add(min, max);
    }
    return container;
  } */

  // 更新数据
  update() {
    const action = this.actionInput ? this.actionInput.getValue() : '';

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'action',
      action
    );

    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  // 更新UI显示
  updateUI() {
    this.uuid.setValue(this.component.parameters.uuid);

    // 更新action输入框的值
    if (this.actionInput) {
      this.actionInput.setValue(this.component.parameters.action || '');
    }
  }

  renderer(container) {
    this.refresh(container);
    this.updateUI();
    //console.log('MovedComponent:',this.component.parameters);
  }
}

export { MovedComponent };