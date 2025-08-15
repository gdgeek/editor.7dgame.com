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
    };

    // user以上角色可选
    const userRole = this.editor.userRole || '';
    if (userRole !== 'user') {
      Object.assign(voiceOptions, {
        nextStep: strings.getKey('sidebar/command/voice/nextStep'),
        returnMain: strings.getKey('sidebar/command/voice/returnMain'),
        closeTooltip: strings.getKey('sidebar/command/voice/closeTooltip'),
        openTooltip: strings.getKey('sidebar/command/voice/openTooltip'),
        vertical: strings.getKey('sidebar/command/voice/vertical'),
        horizontal: strings.getKey('sidebar/command/voice/horizontal'),
        hidden: strings.getKey('sidebar/command/voice/hidden'),
        visible: strings.getKey('sidebar/command/voice/visible'),
        showYuelu: strings.getKey('sidebar/command/voice/showYuelu'),
        showLunan: strings.getKey('sidebar/command/voice/showLunan'),
        showXiaoxiang: strings.getKey('sidebar/command/voice/showXiaoxiang'),
        showTianxin: strings.getKey('sidebar/command/voice/showTianxin'),
        showXinglin: strings.getKey('sidebar/command/voice/showXinglin'),
        showKaifu: strings.getKey('sidebar/command/voice/showKaifu'),
        goBack: strings.getKey('sidebar/command/voice/goBack'),
        bgmOn: strings.getKey('sidebar/command/voice/bgmOn'),
        bgmOff: strings.getKey('sidebar/command/voice/bgmOff'),
        sandboxFxOn: strings.getKey('sidebar/command/voice/sandboxFxOn'),
        sandboxFxOff: strings.getKey('sidebar/command/voice/sandboxFxOff'),
        sandboxRotateOn: strings.getKey('sidebar/command/voice/sandboxRotateOn'),
        sandboxRotateOff: strings.getKey('sidebar/command/voice/sandboxRotateOff'),
        campusIntroOn: strings.getKey('sidebar/command/voice/campusIntroOn'),
        campusIntroOff: strings.getKey('sidebar/command/voice/campusIntroOff'),

      });
    }

    // 清除并重新设置选项
    this.voiceSelect.setOptions(voiceOptions);

    // 如果当前值在新选项中存在，则保持选中状态
    if (currentValue && voiceOptions[currentValue]) {
      this.voiceSelect.setValue(currentValue);
    }

    this.voiceSelect.onChange(this.update.bind(this));
  }

  update() {
    this.component.parameters.action = this.voiceSelect.getValue();

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'voice',
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
