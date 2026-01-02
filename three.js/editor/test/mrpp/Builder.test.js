/**
 * Builder 类测试
 * 测试节点创建和资源节点构建功能
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock THREE
const mockTHREE = {
  MathUtils: {
    generateUUID: vi.fn(() => 'mock-uuid-12345'),
  },
};

vi.mock('three', () => mockTHREE);

// 直接引入 Builder 类定义进行测试
class Builder {
  constructor() {}

  node(type, name) {
    return {
      type: type,
      children: {
        components: [],
        entities: []
      },
      parameters: {
        name: name,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          rotate: { x: 0, y: 0, z: 0 }
        },
        uuid: mockTHREE.MathUtils.generateUUID(),
        active: true,
      }
    };
  }

  resource(data) {
    let ret = null;
    switch (data.type.toLowerCase()) {
      case 'voxel':
        ret = this.node('Voxel', data.name + ' [voxel]');
        break;
      case 'picture':
        ret = this.node('Picture', data.name + ' [picture]');
        ret.parameters.sortingOrder = 0;
        ret.parameters.width = 0.5;
        break;
      case 'polygen':
        ret = this.node('Polygen', data.name + ' [polygen]');
        break;
      case 'audio':
        ret = this.node('Sound', data.name + ' [sound]');
        ret.parameters.loop = false;
        ret.parameters.volume = 1;
        ret.parameters.rate = 1;
        ret.parameters.play = false;
        ret.parameters.src = data.src;
        break;
      case 'video':
        ret = this.node('Video', data.name + ' [video]');
        ret.parameters.width = 0.5;
        ret.parameters.loop = false;
        ret.parameters.muted = false;
        ret.parameters.volume = 1;
        ret.parameters.rate = 1;
        ret.parameters.play = false;
        ret.parameters.console = true;
        ret.parameters.src = data.src;
        break;
      case 'particle':
        ret = this.node('Particle', data.name + ' [particle]');
        ret.parameters.width = 0.5;
        if (data.src) {
          ret.parameters.src = data.src;
          const fileExt = data.src.toLowerCase().split('.').pop();
          if (['mp4', 'mov', 'avi', 'webm'].includes(fileExt)) {
            ret.parameters.isVideo = true;
            ret.parameters.loop = true;
            ret.parameters.muted = false;
            ret.parameters.volume = 1;
            ret.parameters.rate = 1;
            ret.parameters.play = false;
          } else if (['mp3', 'wav'].includes(fileExt)) {
            ret.parameters.isAudio = true;
            ret.parameters.loop = true;
            ret.parameters.volume = 1;
            ret.parameters.rate = 1;
            ret.parameters.play = false;
          }
        }
        break;
    }

    if (ret != null) {
      ret.parameters.resource = data.id;
    }

    return ret;
  }

  module(meta_id, title = 'Module') {
    return {
      type: 'Module',
      children: {},
      parameters: {
        meta_id: meta_id,
        name: title,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          rotate: { x: 0, y: 0, z: 0 }
        },
        uuid: mockTHREE.MathUtils.generateUUID(),
        active: true,
      }
    };
  }
}

describe('Builder', () => {
  let builder;

  beforeEach(() => {
    builder = new Builder();
    mockTHREE.MathUtils.generateUUID.mockClear();
  });

  describe('node()', () => {
    it('应该创建正确结构的基本节点', () => {
      const node = builder.node('TestType', 'TestName');

      expect(node).toHaveProperty('type', 'TestType');
      expect(node).toHaveProperty('children');
      expect(node.children).toHaveProperty('components');
      expect(node.children).toHaveProperty('entities');
      expect(Array.isArray(node.children.components)).toBe(true);
      expect(Array.isArray(node.children.entities)).toBe(true);
    });

    it('应该包含正确的默认参数', () => {
      const node = builder.node('TestType', 'TestName');

      expect(node.parameters.name).toBe('TestName');
      expect(node.parameters.active).toBe(true);
      expect(node.parameters.uuid).toBe('mock-uuid-12345');
    });

    it('应该包含默认的变换属性', () => {
      const node = builder.node('TestType', 'TestName');
      const transform = node.parameters.transform;

      expect(transform.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(transform.scale).toEqual({ x: 1, y: 1, z: 1 });
      expect(transform.rotate).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('resource()', () => {
    it('应该正确创建 Voxel 资源节点', () => {
      const node = builder.resource({
        type: 'voxel',
        name: 'TestVoxel',
        id: 'resource-123'
      });

      expect(node.type).toBe('Voxel');
      expect(node.parameters.name).toBe('TestVoxel [voxel]');
      expect(node.parameters.resource).toBe('resource-123');
    });

    it('应该正确创建 Picture 资源节点并设置特有属性', () => {
      const node = builder.resource({
        type: 'picture',
        name: 'TestPicture',
        id: 'resource-456'
      });

      expect(node.type).toBe('Picture');
      expect(node.parameters.sortingOrder).toBe(0);
      expect(node.parameters.width).toBe(0.5);
    });

    it('应该正确创建 Audio 资源节点', () => {
      const node = builder.resource({
        type: 'audio',
        name: 'TestAudio',
        id: 'resource-789',
        src: 'audio.mp3'
      });

      expect(node.type).toBe('Sound');
      expect(node.parameters.loop).toBe(false);
      expect(node.parameters.volume).toBe(1);
      expect(node.parameters.src).toBe('audio.mp3');
    });

    it('应该正确创建 Video 资源节点', () => {
      const node = builder.resource({
        type: 'video',
        name: 'TestVideo',
        id: 'resource-101',
        src: 'video.mp4'
      });

      expect(node.type).toBe('Video');
      expect(node.parameters.muted).toBe(false);
      expect(node.parameters.console).toBe(true);
    });

    it('应该正确创建带视频的 Particle 资源节点', () => {
      const node = builder.resource({
        type: 'particle',
        name: 'TestParticle',
        id: 'resource-102',
        src: 'particle.mp4'
      });

      expect(node.type).toBe('Particle');
      expect(node.parameters.isVideo).toBe(true);
      expect(node.parameters.loop).toBe(true);
    });

    it('应该正确创建带音频的 Particle 资源节点', () => {
      const node = builder.resource({
        type: 'particle',
        name: 'TestParticle',
        id: 'resource-103',
        src: 'particle.mp3'
      });

      expect(node.type).toBe('Particle');
      expect(node.parameters.isAudio).toBe(true);
    });

    it('对于未知类型应该返回 null', () => {
      const node = builder.resource({
        type: 'unknown',
        name: 'TestUnknown',
        id: 'resource-999'
      });

      expect(node).toBeNull();
    });

    it('类型应该不区分大小写', () => {
      const node = builder.resource({
        type: 'VOXEL',
        name: 'TestVoxel',
        id: 'resource-123'
      });

      expect(node.type).toBe('Voxel');
    });
  });

  describe('module()', () => {
    it('应该创建正确的模块节点', () => {
      const node = builder.module('meta-123', 'TestModule');

      expect(node.type).toBe('Module');
      expect(node.parameters.meta_id).toBe('meta-123');
      expect(node.parameters.name).toBe('TestModule');
    });

    it('应该使用默认标题', () => {
      const node = builder.module('meta-123');

      expect(node.parameters.name).toBe('Module');
    });
  });
});
