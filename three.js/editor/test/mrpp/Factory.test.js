/**
 * Factory 类测试
 * 测试节点变换和矩阵计算功能
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock THREE 对象
const mockTHREE = {
  Math: {
    degToRad: vi.fn((deg) => deg * (Math.PI / 180)),
  },
  MathUtils: {
    degToRad: vi.fn((deg) => deg * (Math.PI / 180)),
  },
  Matrix4: vi.fn().mockImplementation(() => ({
    makeRotationFromEuler: vi.fn().mockReturnThis(),
    makeScale: vi.fn().mockReturnThis(),
    multiply: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
  })),
  Euler: vi.fn().mockImplementation((x, y, z, order) => ({ x, y, z, order })),
};

globalThis.THREE = mockTHREE;

// Factory 类定义
class Factory {
  constructor() {}

  lockNode(node) {
    node.userData.hidden = true;
    node.children.forEach(item => {
      this.lockNode(item);
    });
  }

  setTransform(node, transform) {
    const p = transform.position;
    const s = transform.scale;
    const r = transform.rotate;
    node.position.set(p.x, p.y, p.z);
    node.scale.set(s.x, s.y, s.z);
    node.rotation.set(
      THREE.Math.degToRad(r.x),
      THREE.Math.degToRad(r.y),
      THREE.Math.degToRad(r.z)
    );
  }

  getMatrix4(transform) {
    const p = transform.position;
    const s = transform.scale;
    const r = transform.rotate;
    const rotate = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(
        THREE.Math.degToRad(r.x),
        THREE.Math.degToRad(r.y),
        THREE.Math.degToRad(r.z),
        'XYZ'
      )
    );
    const scale = new THREE.Matrix4().makeScale(s.x, s.y, s.z);
    rotate.multiply(scale).setPosition(p.x, p.y, p.z);
    return rotate;
  }
}

describe('Factory', () => {
  let factory;

  beforeEach(() => {
    factory = new Factory();
    vi.clearAllMocks();
  });

  describe('lockNode()', () => {
    it('应该设置节点的 hidden 属性为 true', () => {
      const node = {
        userData: {},
        children: []
      };

      factory.lockNode(node);

      expect(node.userData.hidden).toBe(true);
    });

    it('应该递归锁定所有子节点', () => {
      const node = {
        userData: {},
        children: [
          {
            userData: {},
            children: [
              { userData: {}, children: [] }
            ]
          },
          { userData: {}, children: [] }
        ]
      };

      factory.lockNode(node);

      expect(node.userData.hidden).toBe(true);
      expect(node.children[0].userData.hidden).toBe(true);
      expect(node.children[0].children[0].userData.hidden).toBe(true);
      expect(node.children[1].userData.hidden).toBe(true);
    });
  });

  describe('setTransform()', () => {
    it('应该正确设置节点的位置、缩放和旋转', () => {
      const node = {
        position: { set: vi.fn() },
        scale: { set: vi.fn() },
        rotation: { set: vi.fn() }
      };

      const transform = {
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 2, y: 2, z: 2 },
        rotate: { x: 90, y: 45, z: 0 }
      };

      factory.setTransform(node, transform);

      expect(node.position.set).toHaveBeenCalledWith(1, 2, 3);
      expect(node.scale.set).toHaveBeenCalledWith(2, 2, 2);
      expect(node.rotation.set).toHaveBeenCalled();
    });

    it('应该将角度转换为弧度', () => {
      const node = {
        position: { set: vi.fn() },
        scale: { set: vi.fn() },
        rotation: { set: vi.fn() }
      };

      const transform = {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 180, y: 90, z: 45 }
      };

      factory.setTransform(node, transform);

      expect(THREE.Math.degToRad).toHaveBeenCalledWith(180);
      expect(THREE.Math.degToRad).toHaveBeenCalledWith(90);
      expect(THREE.Math.degToRad).toHaveBeenCalledWith(45);
    });
  });

  describe('getMatrix4()', () => {
    it('应该返回一个矩阵对象', () => {
      const transform = {
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 2, y: 2, z: 2 },
        rotate: { x: 90, y: 45, z: 0 }
      };

      const matrix = factory.getMatrix4(transform);

      expect(matrix).toBeDefined();
    });

    it('应该创建 Matrix4 实例', () => {
      const transform = {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 }
      };

      factory.getMatrix4(transform);

      expect(THREE.Matrix4).toHaveBeenCalled();
    });

    it('应该创建 Euler 实例用于旋转', () => {
      const transform = {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 90, y: 45, z: 0 }
      };

      factory.getMatrix4(transform);

      expect(THREE.Euler).toHaveBeenCalled();
    });
  });
});
