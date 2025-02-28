import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule, UICheckbox } from '../../libs/ui.js';
import { RemoveComponentCommand } from '../../commands/RemoveComponentCommand.js';
import { SetComponentValueCommand } from '../../commands/SetComponentValueCommand.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';

class VoiceCommand {

  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
  }

  static Create() {
    const component = {
      type: 'Voice',
      parameters: {
        uuid: '', // 初始化为空，后续会动态生成
        voice: '',
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

      // 获取当前 voice 的值并与生成的 UUID 拼接
      const voice = this.component.parameters.voice || 'default';  // 默认为 'default'，如果 voice 为空
      const newUUID = THREE.MathUtils.generateUUID() + '-' + voice; // 先生成 UUID，再拼接 'voice'
      row.add(new UIText(strings.getKey('sidebar/geometry/uuid')).setWidth('90px'));
      this.uuid.setValue(newUUID); // 设置为 UUID + 'voice'
      row.add(this.uuid);
      container.add(row);

      // 更新组件中的 uuid
      this.component.parameters.uuid = newUUID;  // 确保 uuid 存储到组件的 parameters 中
    }

    {
      const row = new UIRow();
      const voiceLabel = new UIText(strings.getKey("sidebar/command/voice/label")).setWidth('90px'); // 为"语音"设置标签

      const checkboxContainer = document.createElement('div');
      checkboxContainer.style.display = 'grid';
      checkboxContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
      checkboxContainer.style.gap = '10px';
      checkboxContainer.style.width = '200px';

      // 选项和对应的翻译键值
      const voiceOptions = {
        scaleUp: strings.getKey('sidebar/command/voice/scaleUp'),
        scaleDown: strings.getKey('sidebar/command/voice/scaleDown'),
        decompose: strings.getKey('sidebar/command/voice/decompose'),
        reset: strings.getKey('sidebar/command/voice/reset')
      };

      // 创建复选框及其标签
      this.voiceCheckboxes = {
        scaleUp: new UICheckbox().onChange(this.update.bind(this)),
        scaleDown: new UICheckbox().onChange(this.update.bind(this)),
        decompose: new UICheckbox().onChange(this.update.bind(this)),
        reset: new UICheckbox().onChange(this.update.bind(this))
      };

      // 按照2x2网格布局排列复选框及标签
      for (const [option, label] of Object.entries(voiceOptions)) {
        const optionContainer = document.createElement('div');
        optionContainer.style.display = 'flex';
        optionContainer.style.alignItems = 'center';
        optionContainer.style.gap = '5px';

        const labelElement = document.createElement('span');
        labelElement.textContent = label;
        labelElement.style.fontSize = '12px';

        optionContainer.appendChild(this.voiceCheckboxes[option].dom);
        optionContainer.appendChild(labelElement);
        checkboxContainer.appendChild(optionContainer);
      }

      row.add(voiceLabel);  // 添加"语音"标签
      row.dom.appendChild(checkboxContainer);  // 将复选框容器添加到 row 中
      container.add(row);  // 将这一行加入到 container 中
    }
  }

  update() {
    const selectedOptions = Object.entries(this.voiceCheckboxes)
      .filter(([_, checkbox]) => checkbox.getValue())
      .map(([option]) => option)
      .join(',');

    // 更新 voice 值
    this.component.parameters.voice = selectedOptions;

    // 生成新的 UUID，并更新 uuid 值
    const newUUID = THREE.MathUtils.generateUUID() + '-' + selectedOptions; // 先生成 UUID，再拼接 voice
    this.uuid.setValue(newUUID);

    // 将新的 uuid 更新到 component.parameters 中
    this.component.parameters.uuid = newUUID;

    const command = new SetValueCommand(
      this.editor,
      this.component.parameters,
      'voice',
      selectedOptions
    );

    this.editor.execute(command);
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updateUI() {
    const voice = this.component.parameters.voice || 'default';
    const uuid = this.component.parameters.uuid || '';

    // 设置 UI 显示的 uuid，格式为 "uuid-voice"
    this.uuid.setValue(uuid + '-' + voice);

    console.log(this.component.parameters);
    const selectedOptions = this.component.parameters.voice.split(',');

    for (const [option, checkbox] of Object.entries(this.voiceCheckboxes)) {
      checkbox.setValue(selectedOptions.includes(option));
    }
  }

  renderer(container) {
    this.named(container);
    this.updateUI();
  }
}

export { VoiceCommand };
