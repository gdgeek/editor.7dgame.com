import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule, UISelect } from '../../libs/ui.js';
import { RemoveComponentCommand } from '../../commands/RemoveComponentCommand.js';
import { SetComponentValueCommand } from '../../commands/SetComponentValueCommand.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';

class VoiceCommand {

  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;

    // 监听用户信息变化，在角色改变时重新加载选项
    this.editor.signals.messageReceive.add((params) => {
      if (params.action === 'user-info' && this.voiceSelect) {
        this.reloadOptions();
      }
    });

    // 当全局命令变更时也刷新选项（保证全局唯一性生效）
    if (this.editor.signals) {
      if (this.editor.signals.commandAdded) this.editor.signals.commandAdded.add(() => { if (this.voiceSelect) this.reloadOptions(); });
      if (this.editor.signals.commandRemoved) this.editor.signals.commandRemoved.add(() => { if (this.voiceSelect) this.reloadOptions(); });
      if (this.editor.signals.commandChanged) this.editor.signals.commandChanged.add(() => { if (this.voiceSelect) this.reloadOptions(); });
    }
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

      this.voiceSelect = new UISelect().setWidth('150px').setFontSize('12px');
      this.reloadOptions();

      // 延迟默认选中逻辑：保持外观为空，但在用户展开下拉时，让小勾指向第一个可用项。
      // 不在此处保存到组件参数，只有用户在下拉中显式选择才会触发保存（onChange -> update）。
      try {
        this._wasEmptyAction = !this.component.parameters.action;
        this._autoDefaultApplied = false;

        const applyTempDefault = () => {
          try {
            if (!this._wasEmptyAction) return; // 只有新建/空的情况下才应用
            const options = this.voiceSelect.dom && this.voiceSelect.dom.options;
            if (!options) return;
            for (let k = 0; k < options.length; k++) {
              const opt = options[k];
              if (opt && !opt.disabled && opt.value) {
                // 临时在 DOM 上设置 selectedIndex，使下拉展开时有小勾
                this.voiceSelect.dom.selectedIndex = k;
                this._autoDefaultApplied = true;
                break;
              }
            }
          } catch (e) {
            console.warn('VoiceCommand: applyTempDefault failed', e);
          }
        };

        const clearTempDefaultIfUnchanged = () => {
          try {
            // 如果原本为空且用户未实际改变组件参数（仍为空），则清除临时选中
            if (this._wasEmptyAction && this._autoDefaultApplied && !this.component.parameters.action) {
              this.voiceSelect.dom.value = '';
              this.voiceSelect.dom.selectedIndex = -1;
            }
            this._autoDefaultApplied = false;
          } catch (e) {
            console.warn('VoiceCommand: clearTempDefaultIfUnchanged failed', e);
          }
        };

        // 在用户按下鼠标或通过键盘聚焦打开下拉之前，应用临时默认
        if (this.voiceSelect && this.voiceSelect.dom) {
          this.voiceSelect.dom.addEventListener('mousedown', applyTempDefault);
          this.voiceSelect.dom.addEventListener('focus', applyTempDefault);
          // 用户实际在下拉中点击时，如果之前应用了临时默认且组件仍为空，则将该临时值持久化
          this.voiceSelect.dom.addEventListener('click', (event) => {
            try {
              if (this._wasEmptyAction && this._autoDefaultApplied && !this.component.parameters.action) {
                const val = this.voiceSelect.dom.value;
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
              console.warn('VoiceCommand: click persistence failed', e);
            }
          });
          // 失去焦点时如果没有实际保存值则清除临时默认
          this.voiceSelect.dom.addEventListener('blur', clearTempDefaultIfUnchanged);
        }
      } catch (e) {
        console.warn('VoiceCommand: failed to attach delayed default handlers', e);
      }

      row.add(voiceLabel);
      row.add(this.voiceSelect);
      container.add(row);
    }
  }

  reloadOptions() {
    const strings = this.editor.strings;
    const currentValue = this.voiceSelect.getValue();

    // 普通用户user可选
    const voiceOptions = {
      scaleUp: strings.getKey('sidebar/command/voice/scaleUp'),
      scaleDown: strings.getKey('sidebar/command/voice/scaleDown'),
      decompose: strings.getKey('sidebar/command/voice/decompose'),
      reset: strings.getKey('sidebar/command/voice/reset'),
      goBack: strings.getKey('sidebar/command/voice/goBack'),
    };

    // user以上角色可选
    const userRole = this.editor.data.user.role || '';
    if (userRole !== 'user') {
      Object.assign(voiceOptions, {
        //教育项目
        nextStep: '下一步',
        returnMain: '返回主界面',
        closeTooltip: '关闭说明卡',
        openTooltip: '显示说明卡',
        vertical: '垂直展示',
        horizontal: '水平展示',
        hidden: '隐藏模式',
        visible: '显示模式',
        showYuelu: '展示岳麓山校区',
        showLunan: '展示麓南校区',
        showXiaoxiang: '展示潇湘校区',
        showTianxin: '展示天心校区',
        showXinglin: '展示杏林校区',
        showKaifu: '展示开福校区',
        bgmOn: '打开背景音乐',
        bgmOff: '关闭背景音乐',
        sandboxFxOn: '打开沙盘特效',
        sandboxFxOff: '关闭沙盘特效',
        sandboxRotateOn: '打开沙盘旋转',
        sandboxRotateOff: '关闭沙盘旋转',
        campusIntroOn: '打开校区介绍',
        campusIntroOff: '关闭校区介绍',
        //反欺凌项目
        mockFace: '像怪物',
        almostCrying: '他快哭了',
        stopBullying: '别再欺负他',
        carefulHeard: '小心被听到',
        stillResisting: '还想反抗',
        goCheck: '东西被拿了去看看',
        wishfulThinking: '想得美',
        tooMuch: '太过分了',
        ostracizing: '在搞孤立',
        whatsHappening: '出事了去看看',

      });
    }

    // 清除并重新设置选项
    this.voiceSelect.setOptions(voiceOptions);

    // 如果当前值在新选项中存在，则保持选中状态
    if (currentValue && voiceOptions[currentValue]) {
      this.voiceSelect.setValue(currentValue);
    }

    // 全局检查：如果场景中已有某个 Voice action 被使用，则将对应选项设为不可用（除非它是当前正在编辑的值）
    try {
      const usedActions = new Set();

      if (this.editor && this.editor.scene && typeof this.editor.scene.traverse === 'function') {
        this.editor.scene.traverse(function(obj) {
          if (!obj) return;
          if (obj.commands && Array.isArray(obj.commands)) {
            for (let i = 0; i < obj.commands.length; i++) {
              const cmd = obj.commands[i];
              if (!cmd) continue;
              // 支持旧结构或 parameters 存在的情况
              const action = (cmd.parameters && cmd.parameters.action) || cmd.action || '';
              if (cmd.type && cmd.type.toLowerCase() === 'voice' && action) {
                usedActions.add(action);
              }
            }
          }
        });
      }

      // 遍历 select 的 DOM options，将已使用的项禁用（但保留当前值可用以便编辑）
      const options = this.voiceSelect.dom && this.voiceSelect.dom.options;
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
      console.warn('VoiceCommand.reloadOptions: failed to compute global used actions', e);
    }

    this.voiceSelect.onChange(this.update.bind(this));
  }

  update() {
    this.component.parameters.action = this.voiceSelect.getValue();

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
    this.uuid.setValue(this.component.parameters.uuid);
    this.voiceSelect.setValue(this.component.parameters.action);
  }

  renderer(container) {
    this.named(container);
    this.updateUI();
  }
}

export { VoiceCommand };
