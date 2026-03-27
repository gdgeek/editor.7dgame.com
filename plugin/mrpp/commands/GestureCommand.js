/* global THREE */
/** @type {typeof import('three')} */
// eslint-disable-next-line no-unused-vars -- THREE is loaded via import map in the HTML host

import { UIBreak, UIText, UIRow, UIInput, UISelect } from '../../../three.js/editor/js/libs/ui.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';

class GestureCommand {

  /**
   * @param {object} editor - Editor 实例
   * @param {import('three').Object3D} object - 目标 3D 对象
   * @param {object} component - 命令数据对象
   */
  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
    // 当全局命令变更时也刷新选项（保证全局唯一性生效）
    if (this.editor.signals) {
      if (this.editor.signals.commandAdded) this.editor.signals.commandAdded.add(() => { if (this.gestureSelect) this.reloadOptions(); });
      if (this.editor.signals.commandRemoved) this.editor.signals.commandRemoved.add(() => { if (this.gestureSelect) this.reloadOptions(); });
      if (this.editor.signals.commandChanged) this.editor.signals.commandChanged.add(() => { if (this.gestureSelect) this.reloadOptions(); });
    }
  }

  /**
   * 创建默认的 Gesture 命令数据。
   * @returns {object} 命令数据对象
   */
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

  /**
   * 构建命令 UI 并添加到容器中。
   * @param {object} container - UI 容器
   */
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

      // 延迟默认选中逻辑：保持外观为空，但在用户展开下拉时，让小勾指向第一个可用项。
      // 不在此处保存到组件参数，只有用户在下拉中显式选择才会触发保存（onChange -> update）。
      try {
        this._wasEmptyAction = !this.component.parameters.action;
        this._autoDefaultApplied = false;

        const applyTempDefault = () => {
          try {
            if (!this._wasEmptyAction) return;
            const options = this.gestureSelect.dom && this.gestureSelect.dom.options;
            if (!options) return;
            for (let k = 0; k < options.length; k++) {
              const opt = options[k];
              if (opt && !opt.disabled && opt.value) {
                this.gestureSelect.dom.selectedIndex = k;
                this._autoDefaultApplied = true;
                break;
              }
            }
          } catch (e) {
            console.warn('GestureCommand: applyTempDefault failed', e);
          }
        };

        const clearTempDefaultIfUnchanged = () => {
          try {
            if (this._wasEmptyAction && this._autoDefaultApplied && !this.component.parameters.action) {
              this.gestureSelect.dom.value = '';
              this.gestureSelect.dom.selectedIndex = -1;
            }
            this._autoDefaultApplied = false;
          } catch (e) {
            console.warn('GestureCommand: clearTempDefaultIfUnchanged failed', e);
          }
        };

        if (this.gestureSelect && this.gestureSelect.dom) {
          this.gestureSelect.dom.addEventListener('mousedown', applyTempDefault);
          this.gestureSelect.dom.addEventListener('focus', applyTempDefault);
          this.gestureSelect.dom.addEventListener('click', (_event) => {
            try {
              if (this._wasEmptyAction && this._autoDefaultApplied && !this.component.parameters.action) {
                const val = this.gestureSelect.dom.value;
                if (val) {
                  const cmd = new SetValueCommand(this.editor, this.component.parameters, 'action', val);
                  this.editor.execute(cmd);
                  if (this.editor.signals && this.editor.signals.componentChanged) {
                    this.editor.signals.componentChanged.dispatch(this.component);
                  }
                  this._wasEmptyAction = false;
                  this._autoDefaultApplied = false;
                }
              }
            } catch (e) {
              console.warn('GestureCommand: click persistence failed', e);
            }
          });
          this.gestureSelect.dom.addEventListener('blur', clearTempDefaultIfUnchanged);
        }
      } catch (e) {
        console.warn('GestureCommand: failed to attach delayed default handlers', e);
      }

      row.add(gestureLabel);
      row.add(this.gestureSelect);
      container.add(row);
    }
  }

  /** 重新加载下拉选项并禁用已使用的手势 */
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

    // 全局检查：如果场景中已有某个 Gesture action 被使用，则将对应选项设为不可用（除非它是当前正在编辑的值）
    try {
      const usedActions = new Set();

      if (this.editor && this.editor.scene && typeof this.editor.scene.traverse === 'function') {
        this.editor.scene.traverse(function(obj) {
          if (!obj) return;
          if (obj.commands && Array.isArray(obj.commands)) {
            for (let i = 0; i < obj.commands.length; i++) {
              const cmd = obj.commands[i];
              if (!cmd) continue;
              const action = (cmd.parameters && cmd.parameters.action) || cmd.action || '';
              if (cmd.type && cmd.type.toLowerCase() === 'gesture' && action) {
                usedActions.add(action);
              }
            }
          }
        });
      }

      const options = this.gestureSelect.dom && this.gestureSelect.dom.options;
      if (options) {
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const optVal = opt.value;
          if (optVal && usedActions.has(optVal) && optVal !== currentValue) {
            opt.disabled = true;
            opt.style.color = '#888';
          } else {
            opt.disabled = false;
            opt.style.color = '';
          }
        }
      }
    } catch (e) {
      console.warn('GestureCommand.reloadOptions: failed to compute global used actions', e);
    }

    this.gestureSelect.onChange(this.update.bind(this));
  }

  /** 将 UI 选择值更新到命令数据 */
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

  /** 从命令数据同步 UI 显示 */
  updateUI() {
    if (this.uuid) this.uuid.setValue(this.component.parameters.uuid);
    if (this.gestureSelect) this.gestureSelect.setValue(this.component.parameters.action);
  }

  /**
   * 渲染命令 UI。
   * @param {object} container - UI 容器
   */
  renderer(container) {
    this.named(container);
    this.updateUI();
  }
}

export { GestureCommand };
