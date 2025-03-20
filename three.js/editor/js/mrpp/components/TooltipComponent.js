import { UIPanel, UISelect, UIBreak, UIText, UIRow, UITextArea, UINumber } from '../../libs/ui.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';
import { Strings } from '../../Strings.js';

class TooltipComponent {
  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
    this.targetList = []; // 仅包含 'Voxel', 'Polygen'
    this.strings = new Strings(editor.config);

    // 遍历所有子节点，分类存入 targetList
    const traverseChildren = (node) => {
      if (node.type === 'Voxel' || node.type === 'Polygen') {
        this.targetList.push(node);
      }
      node.children.forEach(traverseChildren);
    };

    traverseChildren(editor.scene);

    // 监听对象变更，确保 target 坐标随模型更新
    this.editor.signals.objectChanged.add((changedObject) => {
      if (this.targetList.some(item => item.uuid === changedObject.uuid)) {
        console.log(`Object changed: ${changedObject.uuid}, updating target position...`);
        this.updateNodePosition('target', changedObject);
      }
    });
  }

	static Create(editor) {

    const selectedObject = editor.selected;
    let target = { uuid: '', x: 0, y: 0, z: 0 };

    if (selectedObject && (selectedObject.type.toLowerCase() === 'polygen' || selectedObject.type.toLowerCase() === 'voxel')) {
      const box = new THREE.Box3().setFromObject(selectedObject);
      const center = new THREE.Vector3();
      box.getCenter(center);

      target = {
        uuid: selectedObject.uuid,
        x: center.x,
        y: center.y,
        z: center.z
      };
    }

		console.log("target", target);

    return {
      type: 'Tooltip',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        text: '',
        target: target,
        length: 0.25, // 默认长度
        action: 'tooltip'
      }
    };
  }

  refresh(container) {
    container.add(new UIBreak());
    container.add(new UIBreak());

    // Text input
    const textRow = new UIRow();
    this.textInput = new UITextArea().setWidth('150px').setHeight('60px').setFontSize('12px')
      .onChange(() => this.update('text', this.textInput.getValue()));
    this.textInput.setValue(this.component.parameters.text);
    textRow.add(new UIText(this.strings.getKey('sidebar/components/tooltip/text')).setWidth('90px'));
    textRow.add(this.textInput);
    container.add(textRow);

    // Length input
    const lengthRow = new UIRow();
    this.lengthInput = new UINumber(this.component.parameters.length).setWidth('150px').setStep(0.1)
      .onChange(() => this.update('length', this.lengthInput.getValue()));
    lengthRow.add(new UIText(this.strings.getKey('sidebar/components/tooltip/length')).setWidth('90px'));
    lengthRow.add(this.lengthInput);
    container.add(lengthRow);

    // Target position selection
    const targetRow = new UIRow();
    this.targetSelect = new UISelect().setWidth('150px');
    const targetOptions = { '': 'None' };
    this.targetList.forEach(item => {
      targetOptions[item.uuid] = item.name || item.uuid;
    });
    this.targetSelect.setOptions(targetOptions);
    this.targetSelect.setValue(this.getSelectedUUID('target'));
    this.targetSelect.onChange(() => this.updatePosition('target'));
    targetRow.add(new UIText(this.strings.getKey('sidebar/components/tooltip/target')).setWidth('90px'));
    targetRow.add(this.targetSelect);
    container.add(targetRow);
  }

  getSelectedUUID(type) {
    return this.component.parameters[type]?.uuid || '';
  }

  updateNodePosition(type, object) {
    if (!object) return;

    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);

    console.log(`Updating ${type} position to center of object ${object.uuid}:`, center);

    this.update(type, {
      uuid: object.uuid,
      x: center.x,
      y: center.y,
      z: center.z
    });
  }

  update(key, value) {
    console.log(`Updating parameter: ${key} ->`, value);
    this.component.parameters[key] = value;
    this.editor.execute(new SetValueCommand(this.editor, this.component.parameters, key, value));
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updatePosition(type) {
    const selectedUUID = this.targetSelect.getValue();
    const selectedObject = this.targetList.find(item => item.uuid === selectedUUID);

    if (selectedObject) {
      console.log(`Target selected: ${selectedUUID}, updating position...`);
      this.updateNodePosition(type, selectedObject);
    } else {
      console.log(`No valid target selected.`);
    }
  }

  renderer(container) {
    this.refresh(container);
  }
}

export { TooltipComponent };
