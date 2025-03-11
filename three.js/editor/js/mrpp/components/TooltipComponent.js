import { UIPanel, UISelect, UINumber, UIBreak, UIText, UIRow, UIInput, UITextArea } from '../../libs/ui.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';

class TooltipComponent {
  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
    this.fromList = []; // 仅包含 'Voxel', 'Polygen'
    this.toList = []; // 仅包含 'Entity'

    // 递归遍历所有子节点
    const traverseChildren = (node) => {
      if (node.type === 'Voxel' || node.type === 'Polygen') {
        this.fromList.push(node);
      } else if (node.type === 'Entity') {
        this.toList.push(node);
      }
      node.children.forEach(traverseChildren);
    };

    traverseChildren(editor.scene); // 从根节点开始遍历
  }

  static Create() {
    return {
      type: 'Tooltip',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        text: '',
        from: { uuid: '', x: 0, y: 0, z: 0 },
        to: { uuid: '', x: 0, y: 0, z: 0 },
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
    textRow.add(new UIText('Text').setWidth('90px'));
    textRow.add(this.textInput);
    container.add(textRow);

    // From position selection
    const fromRow = new UIRow();
    this.fromSelect = new UISelect().setWidth('150px');
    const fromOptions = { '': 'None' };
    this.fromList.forEach(item => {
      fromOptions[item.uuid] = item.name || item.uuid;
    });
    this.fromSelect.setOptions(fromOptions);
    this.fromSelect.setValue(this.getSelectedUUID('from'));
    this.fromSelect.onChange(() => this.updatePosition('from'));
    fromRow.add(new UIText('From Position').setWidth('90px'));
    fromRow.add(this.fromSelect);
    container.add(fromRow);

    // To position selection
    const toRow = new UIRow();
    this.toSelect = new UISelect().setWidth('150px');
    const toOptions = { '': 'None' };
    this.toList.forEach(item => {
      toOptions[item.uuid] = item.name || item.uuid;
    });
    this.toSelect.setOptions(toOptions);
    this.toSelect.setValue(this.getSelectedUUID('to'));
    this.toSelect.onChange(() => this.updatePosition('to'));
    toRow.add(new UIText('To Position').setWidth('90px'));
    toRow.add(this.toSelect);
    container.add(toRow);
  }

  getSelectedUUID(type) {
    return this.component.parameters[type]?.uuid || ''; // 直接返回 UUID
  }

  getBoundingBoxCenter(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center); // 计算中心点
    return center;
  }

  update(key, value) {
    this.component.parameters[key] = value;
    this.editor.execute(new SetValueCommand(this.editor, this.component.parameters, key, value));
    this.editor.signals.componentChanged.dispatch(this.component);
  }

  updatePosition(type) {
    const selectedUUID = type === 'from' ? this.fromSelect.getValue() : this.toSelect.getValue();
    const selectedObject = (type === 'from' ? this.fromList : this.toList).find(item => item.uuid === selectedUUID);

    // from：获取模型碰撞盒中心
    // to：获取空节点位置
    if (selectedObject) {
      let newPosition;
      if (type === 'from') {
        const center = this.getBoundingBoxCenter(selectedObject); // 获取碰撞盒中心
        newPosition = {
          uuid: selectedObject.uuid,
          x: center.x, // 使用碰撞盒中心
          y: center.y,
          z: center.z
        };
      } else {
        newPosition = {
          uuid: selectedObject.uuid,
          x: selectedObject.position.x,
          y: selectedObject.position.y,
          z: selectedObject.position.z
        };
      }
      this.update(type, newPosition);
    }
  }

  renderer(container) {
    this.refresh(container);
  }
}

export { TooltipComponent };