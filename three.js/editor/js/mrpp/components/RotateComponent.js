import { UINumber, UIBreak, UIText, UIRow, UICheckbox, UIButton } from '../../libs/ui.js';
import { SetValueCommand } from '../../commands/SetValueCommand.js';
class RotateComponent {

  constructor(editor, object, component) {

    this.editor = editor;
    this.object = object;
    this.component = component;

  }
  static Create() {
    const component = {
      type: 'Rotate',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(),
        speed: { x: 0, y: 0, z: 0 },
        isRotating: true,
        action: 'rotate'
      }
    };
    return component;
  }
  rotate(container) {
    const strings = this.editor.strings;
    container.add(new UIBreak());
    container.add(new UIBreak());

    const row = new UIRow();
    const label = new UIText(strings.getKey('sidebar/components/rotate/rotateOnLaunch')).setWidth('90px');
    const checkbox = new UICheckbox(this.component.parameters.isRotating);

    checkbox.onChange(() => {
      const value = checkbox.getValue();
      const command = new SetValueCommand(
        this.editor,
        this.component.parameters,
        'isRotating',
        value
      );
      this.editor.execute(command);
    });

    row.add(label, checkbox);
    container.add(row);

    this.objectRotationRow = new UIRow();
    this.objectRotationX = new UINumber()
      .setPrecision(2)
      .setStep(10)
      .setNudge(0.1)
      .setUnit('°')
      .setWidth('50px')
      .onChange(this.update.bind(this));
    this.objectRotationY = new UINumber()
      .setPrecision(2)
      .setStep(10)
      .setNudge(0.1)
      .setUnit('°')
      .setWidth('50px')
      .onChange(this.update.bind(this));
    this.objectRotationZ = new UINumber()
      .setPrecision(2)
      .setStep(10)
      .setNudge(0.1)
      .setUnit('°')
      .setWidth('50px')
      .onChange(this.update.bind(this));

    this.objectRotationRow.add(
      new UIText(strings.getKey('sidebar/components/rotate/speed')).setWidth('90px')
    );
    this.objectRotationRow.add(new UIText('X').setWidth('15px').setColor('#EA5555'), this.objectRotationX, new UIText('Y').setWidth('15px').setColor('#8AC651'), this.objectRotationY, new UIText('Z').setWidth('15px').setColor('#5588EA'), this.objectRotationZ);

    container.add(this.objectRotationRow);


    const isPreviewing = this.object.previewRotate && this.object.previewRotate.active;
    const buttonText = isPreviewing ? strings.getKey('sidebar/components/rotate/stop') : strings.getKey('sidebar/components/rotate/preview');

    const buttonRow = new UIRow();
    const previewButton = new UIButton(buttonText).onClick(() => {
      if (!this.object.previewRotate) {
        // Start Preview
        this.object.previewRotate = {
          active: true,
          startTime: performance.now(),
          originalRotation: this.object.rotation.clone()
        };
        this.object.rotation.reorder('ZXY');
        // Force UI update to change button text to 'Stop'
        this.editor.signals.componentChanged.dispatch(this.component);
      } else {
        // Stop Preview Manually
        const state = this.object.previewRotate;
        this.object.rotation.copy(state.originalRotation);
        delete this.object.previewRotate;

        this.editor.signals.objectChanged.dispatch(this.object);
        // Force UI update to change button text back to 'Preview'
        this.editor.signals.componentChanged.dispatch(this.component);
      }
    }).setWidth('100%');

    if (isPreviewing) {
      previewButton.setBackgroundColor('#FC6666');
      previewButton.setColor('#fff');
    } else {
      previewButton.setBackgroundColor('');
      previewButton.setColor('');
    }
    buttonRow.add(previewButton);
    container.add(buttonRow);
  }
  update() {

    const newRotation = new THREE.Euler(
      this.objectRotationX.getValue(),
      this.objectRotationY.getValue(),
      this.objectRotationZ.getValue()
    );
    const oldRotation = new THREE.Euler(
      this.component.parameters.speed.x,
      this.component.parameters.speed.y,
      this.component.parameters.speed.z
    );
    if (
      new THREE.Vector3()
        .setFromEuler(oldRotation)
        .distanceTo(new THREE.Vector3().setFromEuler(newRotation)) >= 0.01
    ) {
      const self = this;
      const proxyHandler = {
        set(target, prop, value) {
          if (prop === 'speed') {
            target[prop] = { x: value.x, y: value.y, z: value.z };

          } else {
            target[prop] = value;
          }
          self.updateUI();

          self.editor.signals.componentChanged.dispatch(this.component);
          //self.refresh()
          return true;
        },
      };
      const proxy = new Proxy(this.component.parameters, proxyHandler);

      const command = new SetValueCommand(
        this.editor,
        proxy,
        'speed',
        newRotation
      );

      this.editor.execute(command);
    }

  }
  updateUI() {

    this.objectRotationX.setValue(this.component.parameters.speed.x);
    this.objectRotationY.setValue(this.component.parameters.speed.y);
    this.objectRotationZ.setValue(this.component.parameters.speed.z);

  }
  renderer(container) {

    this.rotate(container);
    this.updateUI();
  }

}
export { RotateComponent };
