import * as THREE from 'three';
import { UIBreak, UICheckbox, UIText, UIRow, UIInput } from '../../../three.js/editor/js/libs/ui.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';
import type { MrppEditor, MrppComponent } from '../../types/mrpp.js';

class MovedComponent {

  editor: MrppEditor;
  object: THREE.Object3D;
  component: MrppComponent;
  actionInput: any;

  constructor(editor: MrppEditor, object: THREE.Object3D, component: MrppComponent) {
    this.editor = editor;
    this.object = object;
    this.component = component;
    this.actionInput = null; // 添加对action输入框的引用
  }

  /**
   * 创建默认的 Moved 组件数据。
   */
  static Create(): MrppComponent {
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

  /**
   * 构建组件 UI 并添加到容器中。
   */
  refresh(container: any): void {
    container.add(new UIBreak());
    container.add(new UIBreak());

    const strings = this.editor.strings;
    // 可缩放部分
    {
      const row = new UIRow();
      const scalable = new UICheckbox().setValue(this.component.parameters.scalable)
        .onChange((_item: any) => {
          this.editor.execute(new SetValueCommand(this.editor, this.component.parameters, 'scalable', scalable.getValue()));
        });
      row.add(
        new UIText(strings.getKey('sidebar/components/moved/scalable')).setWidth('90px')
      );
      row.add(scalable);
      container.add(row);
    }

    // 磁力部分
    {
      const row = new UIRow();
      const magneticRow = this.magneticTrigger(row, this.component.parameters.magnetic, this.component.parameters.action);
      container.add(magneticRow);
    }

  }

  /**
   * 磁力触发 UI 构建方法。
   */
  magneticTrigger(container: any, magneticValue: boolean, action: string): any {
    const strings = this.editor.strings;

    // 添加磁力标签
    container.add(new UIText(strings.getKey('sidebar/components/moved/magnetic')).setWidth('90px'));

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

  /** 更新组件数据 */
  update(): void {
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

  /** 从组件数据同步 UI 显示 */
  updateUI(): void {
    // 更新action输入框的值
    if (this.actionInput) {
      this.actionInput.setValue(this.component.parameters.action || '');
    }
  }

  /**
   * 渲染组件 UI。
   */
  renderer(container: any): void {
    this.refresh(container);
    this.updateUI();
  }
}

export { MovedComponent };
