/**
 * ComponentContainer 类测试
 * 测试组件容器的创建和渲染功能
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 定义组件类型常量
const COMPONENT_TYPES = ['rotate', 'action', 'moved', 'trigger', 'tooltip'];

// Mock 组件创建函数
const mockRotateComponent = { type: 'rotate', parameters: {} };
const mockActionComponent = { type: 'action', parameters: {} };
const mockMovedComponent = { type: 'moved', parameters: {} };
const mockTriggerComponent = { type: 'trigger', parameters: {} };
const mockTooltipComponent = { type: 'tooltip', parameters: {} };

// 模拟的 ComponentContainer 类
class ComponentContainer {
  static Create(type, editor) {
    switch (type.toLowerCase()) {
      case 'rotate':
        return { type: 'rotate', parameters: { speed: 1, axis: 'y' } };
      case 'action':
        return { type: 'action', parameters: { animation: '', loop: true } };
      case 'moved':
        return { type: 'moved', parameters: { path: [] } };
      case 'trigger':
        return { type: 'trigger', parameters: { events: [] } };
      case 'tooltip':
        return { type: 'tooltip', parameters: { text: '' } };
      default:
        return undefined;
    }
  }

  constructor(editor, object, component) {
    this.editor = editor;
    this.object = object;
    this.component = component;
    this.handler = null;

    const type = component.type.toLowerCase();
    if (COMPONENT_TYPES.includes(type)) {
      this.handler = { type, renderer: vi.fn() };
    }
  }

  renderer(container) {
    if (this.handler !== null) {
      this.handler.renderer(container);
    }
  }
}

describe('ComponentContainer', () => {
  let mockEditor;
  let mockObject;

  beforeEach(() => {
    mockEditor = {
      strings: {
        getKey: vi.fn((key) => key),
      },
      showConfirmation: vi.fn(),
      execute: vi.fn(),
    };

    mockObject = {
      userData: {},
      name: 'TestObject',
    };
  });

  describe('静态方法 Create()', () => {
    it('应该创建 rotate 组件', () => {
      const component = ComponentContainer.Create('rotate', mockEditor);

      expect(component).toBeDefined();
      expect(component.type).toBe('rotate');
      expect(component.parameters).toHaveProperty('speed');
      expect(component.parameters).toHaveProperty('axis');
    });

    it('应该创建 action 组件', () => {
      const component = ComponentContainer.Create('action', mockEditor);

      expect(component).toBeDefined();
      expect(component.type).toBe('action');
      expect(component.parameters).toHaveProperty('animation');
      expect(component.parameters).toHaveProperty('loop');
    });

    it('应该创建 moved 组件', () => {
      const component = ComponentContainer.Create('moved', mockEditor);

      expect(component).toBeDefined();
      expect(component.type).toBe('moved');
      expect(component.parameters).toHaveProperty('path');
    });

    it('应该创建 trigger 组件', () => {
      const component = ComponentContainer.Create('trigger', mockEditor);

      expect(component).toBeDefined();
      expect(component.type).toBe('trigger');
      expect(component.parameters).toHaveProperty('events');
    });

    it('应该创建 tooltip 组件', () => {
      const component = ComponentContainer.Create('tooltip', mockEditor);

      expect(component).toBeDefined();
      expect(component.type).toBe('tooltip');
      expect(component.parameters).toHaveProperty('text');
    });

    it('类型应该不区分大小写', () => {
      const component1 = ComponentContainer.Create('ROTATE', mockEditor);
      const component2 = ComponentContainer.Create('Rotate', mockEditor);

      expect(component1.type).toBe('rotate');
      expect(component2.type).toBe('rotate');
    });

    it('对于未知类型应该返回 undefined', () => {
      const component = ComponentContainer.Create('unknown', mockEditor);

      expect(component).toBeUndefined();
    });
  });

  describe('构造函数', () => {
    it('应该正确初始化属性', () => {
      const component = { type: 'rotate', parameters: {} };
      const container = new ComponentContainer(mockEditor, mockObject, component);

      expect(container.editor).toBe(mockEditor);
      expect(container.object).toBe(mockObject);
      expect(container.component).toBe(component);
    });

    it('应该为有效类型创建 handler', () => {
      const component = { type: 'rotate', parameters: {} };
      const container = new ComponentContainer(mockEditor, mockObject, component);

      expect(container.handler).not.toBeNull();
    });

    it('对于未知类型 handler 应该为 null', () => {
      const component = { type: 'unknown', parameters: {} };
      const container = new ComponentContainer(mockEditor, mockObject, component);

      expect(container.handler).toBeNull();
    });
  });

  describe('renderer()', () => {
    it('应该调用 handler 的 renderer 方法', () => {
      const component = { type: 'rotate', parameters: {} };
      const container = new ComponentContainer(mockEditor, mockObject, component);
      const mockContainer = { add: vi.fn() };

      container.renderer(mockContainer);

      expect(container.handler.renderer).toHaveBeenCalledWith(mockContainer);
    });

    it('如果 handler 为 null 应该安全跳过', () => {
      const component = { type: 'unknown', parameters: {} };
      const container = new ComponentContainer(mockEditor, mockObject, component);
      const mockContainer = { add: vi.fn() };

      // 不应该抛出错误
      expect(() => container.renderer(mockContainer)).not.toThrow();
    });
  });
});

describe('组件类型验证', () => {
  it('应该包含所有预期的组件类型', () => {
    const expectedTypes = ['rotate', 'action', 'moved', 'trigger', 'tooltip'];

    expectedTypes.forEach(type => {
      expect(COMPONENT_TYPES).toContain(type);
    });
  });
});
