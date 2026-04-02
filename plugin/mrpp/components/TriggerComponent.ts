import * as THREE from 'three';
import { UISelect, UIBreak, UIText, UIRow, UIInput } from '../../../three.js/editor/js/libs/ui.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';
import { MultiCmdsCommand } from '../../../three.js/editor/js/commands/MultiCmdsCommand.js';
import type { MrppEditor, MrppComponent } from '../../types/mrpp.js';

class TriggerComponent {

  editor: MrppEditor;
  object: THREE.Object3D;
  component: MrppComponent;
  list: THREE.Object3D[];
  action!: any;
  select!: any;

  constructor(editor: MrppEditor, object: THREE.Object3D, component: MrppComponent) {
    this.editor = editor;
    const node = editor.scene;
    this.list = [];
    node.traverse((child: THREE.Object3D) => {
      const rawType = ((child as any).userData && (child as any).userData.type) || child.type || '';
      const normalizedType = String(rawType).toLowerCase();
      const isColliderTarget = normalizedType === 'voxel' || normalizedType === 'polygen' || normalizedType === 'picture';
      if (isColliderTarget && child.uuid !== object.uuid) {
        this.list.push(child);
      }
    });
    this.object = object;
    this.component = component;
  }

  /**
   * 创建默认的 Trigger 组件数据。
   */
  static Create(): MrppComponent {
    const component = {
      type: 'Trigger',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        target: null,
        action: '',
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

    {
      const row = new UIRow();

      this.action = new UIInput().setWidth('150px').setFontSize('12px').setDisabled(false)
        .onChange(this.update.bind(this));
      this.action.setValue(this.component.parameters.action);
      row.add(new UIText(strings.getKey('sidebar/components/action/name')).setWidth('90px'));
      row.add(this.action);
      container.add(row);

    }
    {
      const row = new UIRow();
      // 创建下拉框
      this.select = new UISelect().setWidth('150px');

      const options: Record<string, string> = {};
      this.list.forEach(item => {
        options[item.uuid] = item.name || item.uuid;
      });
      this.select.setOptions(options);
      this.select.setValue(this.component.parameters.target);
      this.select.onChange(this.update.bind(this));
      row.add(new UIText(strings.getKey('sidebar/components/trigger/target')).setWidth('90px'));
      row.add(this.select);
      container.add(row);
    }

  }

  /** 将 UI 输入值更新到组件数据 */
  update(): void {
    const commands: any[] = [];

    // Target update logic
    const newTargetUuid = this.select.getValue();
    const oldTargetUuid = this.component.parameters.target;

    if (newTargetUuid !== oldTargetUuid) {
      commands.push(new SetValueCommand(this.editor, this.component.parameters, 'target', newTargetUuid));

      if (oldTargetUuid) {
        const oldObject = this.editor.objectByUuid(oldTargetUuid);
        if (oldObject && oldObject.userData) {
          commands.push(new SetValueCommand(this.editor, oldObject.userData, 'isCollider', false));
        }
      }

      if (newTargetUuid) {
        const newObject = this.editor.objectByUuid(newTargetUuid);
        if (newObject && newObject.userData) {
          commands.push(new SetValueCommand(this.editor, newObject.userData, 'isCollider', true));
        }
      }
    }

    // Action update logic
    const newAction = this.action.getValue();
    if (newAction !== this.component.parameters.action) {
      commands.push(new SetValueCommand(this.editor, this.component.parameters, 'action', newAction));
    }

    if (commands.length > 0) {
      this.editor.execute(new MultiCmdsCommand(this.editor, commands));
    }

    this.editor.signals.componentChanged.dispatch(this.component);

  }

  /**
   * 渲染组件 UI。
   */
  renderer(container: any): void {
    this.refresh(container);
  }
}
export { TriggerComponent };
