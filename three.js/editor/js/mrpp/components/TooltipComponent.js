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

    // 监听对象选中，当选中Voxel或Polygen类型对象时自动更新target
    this.editor.signals.objectSelected.add((selectedObject) => {
      if (selectedObject && (selectedObject.type === 'Voxel' || selectedObject.type === 'Polygen')) {
        if (this.targetSelect) {
          const currentUUID = this.targetSelect.getValue();
          if (!currentUUID || currentUUID !== selectedObject.uuid) {
            this.targetSelect.setValue(selectedObject.uuid);
          }
        }
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
		console.log("object", object);
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 保留原始uuid，仅更新位置坐标
    const originalUUID = this.component.parameters[type]?.uuid || object.uuid;

    this.update(type, {
      uuid: originalUUID,
      x: center.x,
      y: center.y,
      z: center.z
    });
  }

  update(key, value) {
    this.component.parameters[key] = value;
    this.editor.execute(new SetValueCommand(this.editor, this.component.parameters, key, value));
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updatePosition(type) {
    const selectedUUID = this.targetSelect.getValue();
    const currentUUID = this.component.parameters[type]?.uuid || '';

    // 选择"None"，清空target
    if (selectedUUID === '') {
      this.update(type, { uuid: '', x: 0, y: 0, z: 0 });
      return;
    }

    // 目标变化时才更新位置
    if (selectedUUID !== currentUUID) {
      const selectedObject = this.targetList.find(item => item.uuid === selectedUUID);

      if (selectedObject) {
        // 获取当前选中对象的中心点坐标
        const box = new THREE.Box3().setFromObject(selectedObject);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // 更新目标和位置
        this.update(type, {
          uuid: selectedUUID,
          x: center.x,
          y: center.y,
          z: center.z
        });
      } else {
        console.log(`No valid target selected.`);
      }
    }
  }

  renderer(container) {
    this.refresh(container);
  }
}

export { TooltipComponent };
