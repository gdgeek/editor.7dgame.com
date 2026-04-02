import * as THREE from 'three';
import { UINumber, UIBreak, UIText, UIRow, UICheckbox, UIButton } from '../../../three.js/editor/js/libs/ui.js';
import { SetValueCommand } from '../../../three.js/editor/js/commands/SetValueCommand.js';
import type { MrppEditor, MrppComponent } from '../../types/mrpp.js';

/** Extended Object3D type with rotation (defined via Object.defineProperties in three.js) and preview state */
interface RotateObject3D extends THREE.Object3D {
  rotation: THREE.Euler;
  previewRotate?: {
    active: boolean;
    startTime: number;
    lastTime: number;
    originalRotation: THREE.Euler;
    requestId?: number;
  };
}

class RotateComponent {

  editor: MrppEditor;
  object: RotateObject3D;
  component: MrppComponent;
  objectRotationRow!: any;
  objectRotationX!: any;
  objectRotationY!: any;
  objectRotationZ!: any;

  constructor(editor: MrppEditor, object: THREE.Object3D, component: MrppComponent) {
    this.editor = editor;
    this.object = object as RotateObject3D;
    this.component = component;
  }

  /**
   * 创建默认的 Rotate 组件数据。
   */
  static Create(): MrppComponent {
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

  startPreview(): void {
    this.stopPreview(false, false);

    const state = {
      active: true,
      startTime: performance.now(),
      lastTime: performance.now(),
      originalRotation: this.object.rotation.clone(),
      requestId: undefined as number | undefined
    };

    this.object.previewRotate = state;
    this.object.rotation.reorder('ZXY');

    const tick = (now: number): void => {
      const previewState = this.object.previewRotate;
      if (!previewState || !previewState.active) return;

      const deltaSeconds = Math.max(0, (now - previewState.lastTime) / 1000);
      previewState.lastTime = now;

      const speed = this.component.parameters.speed || { x: 0, y: 0, z: 0 };
      this.object.rotation.x += THREE.MathUtils.degToRad(Number(speed.x) || 0) * deltaSeconds;
      this.object.rotation.y += THREE.MathUtils.degToRad(Number(speed.y) || 0) * deltaSeconds;
      this.object.rotation.z += THREE.MathUtils.degToRad(Number(speed.z) || 0) * deltaSeconds;

      this.editor.signals.objectChanged.dispatch(this.object);

      if (now - previewState.startTime >= 8000) {
        this.stopPreview(true, true);
        return;
      }

      previewState.requestId = requestAnimationFrame(tick);
    };

    state.requestId = requestAnimationFrame(tick);
    this.editor.signals.componentChanged.dispatch(this.component);
    this.editor.signals.objectChanged.dispatch(this.object);
  }

  stopPreview(restoreOriginalRotation: boolean = true, refreshComponent: boolean = true): void {
    const previewState = this.object.previewRotate;
    if (!previewState) return;

    if (previewState.requestId !== undefined) {
      cancelAnimationFrame(previewState.requestId);
    }

    if (restoreOriginalRotation && previewState.originalRotation) {
      this.object.rotation.copy(previewState.originalRotation);
    }

    delete this.object.previewRotate;

    this.editor.signals.objectChanged.dispatch(this.object);
    if (refreshComponent) {
      this.editor.signals.componentChanged.dispatch(this.component);
    }
  }

  /**
   * 构建旋转 UI 并添加到容器中。
   */
  rotate(container: any): void {
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

    const speedLabel = new UIText(`${strings.getKey('sidebar/components/rotate/speed')} (°/s)`).setWidth('92px');
    const axisSpacer = new UIText('').setWidth('6px');
    this.objectRotationRow.add(speedLabel, axisSpacer);
    this.objectRotationRow.add(new UIText('X').setWidth('15px').setColor('#EA5555'), this.objectRotationX, new UIText('Y').setWidth('15px').setColor('#8AC651'), this.objectRotationY, new UIText('Z').setWidth('15px').setColor('#5588EA'), this.objectRotationZ);
    container.add(this.objectRotationRow);


    const isPreviewing = this.object.previewRotate && this.object.previewRotate.active;
    const buttonText = isPreviewing ? strings.getKey('sidebar/components/rotate/stop') : strings.getKey('sidebar/components/rotate/preview');

    const buttonRow = new UIRow();
    const previewButton = new UIButton(buttonText).onClick(() => {
      if (!this.object.previewRotate || !this.object.previewRotate.active) {
        this.startPreview();
      } else {
        this.stopPreview(true, true);
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

  /** 将 UI 输入值更新到组件数据 */
  update(): void {

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
      const proxyHandler: ProxyHandler<any> = {
        set(target, prop, value) {
          if (prop === 'speed') {
            target[prop] = { x: value.x, y: value.y, z: value.z };

          } else {
            target[prop] = value;
          }
          self.updateUI();

          self.editor.signals.componentChanged.dispatch(self.component);
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

  /** 从组件数据同步 UI 显示 */
  updateUI(): void {

    this.objectRotationX.setValue(this.component.parameters.speed.x);
    this.objectRotationY.setValue(this.component.parameters.speed.y);
    this.objectRotationZ.setValue(this.component.parameters.speed.z);

  }

  /**
   * 渲染组件 UI。
   */
  renderer(container: any): void {

    this.rotate(container);
    this.updateUI();
  }

}
export { RotateComponent };
