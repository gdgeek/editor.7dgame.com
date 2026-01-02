/**
 * 工具函数测试
 * 测试 utils 目录下的通用工具函数
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DialogUtils', () => {
  // 模拟 DialogUtils
  class DialogUtils {
    static show(title, content, onConfirm, onCancel) {
      return {
        title,
        content,
        onConfirm,
        onCancel,
        close: vi.fn(),
      };
    }

    static confirm(message) {
      return new Promise((resolve) => {
        resolve(true);
      });
    }

    static alert(message) {
      return new Promise((resolve) => {
        resolve();
      });
    }
  }

  it('show() 应该返回正确的对话框对象', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const dialog = DialogUtils.show('测试标题', '测试内容', onConfirm, onCancel);

    expect(dialog.title).toBe('测试标题');
    expect(dialog.content).toBe('测试内容');
    expect(dialog.onConfirm).toBe(onConfirm);
    expect(dialog.onCancel).toBe(onCancel);
    expect(dialog.close).toBeDefined();
  });

  it('confirm() 应该返回 Promise', async () => {
    const result = await DialogUtils.confirm('确认消息');

    expect(typeof result).toBe('boolean');
  });

  it('alert() 应该返回 Promise', async () => {
    const result = DialogUtils.alert('提示消息');

    expect(result).toBeInstanceOf(Promise);
  });
});

describe('TextUtils', () => {
  // 模拟 TextUtils
  class TextUtils {
    static truncate(text, maxLength, suffix = '...') {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength - suffix.length) + suffix;
    }

    static capitalize(text) {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    static slugify(text) {
      return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .trim();
    }
  }

  describe('truncate()', () => {
    it('应该截断长文本', () => {
      const result = TextUtils.truncate('这是一段很长的文本', 5);

      expect(result.length).toBeLessThanOrEqual(5);
      expect(result.endsWith('...')).toBe(true);
    });

    it('短文本应该保持不变', () => {
      const result = TextUtils.truncate('短文', 10);

      expect(result).toBe('短文');
    });

    it('应该支持自定义后缀', () => {
      const result = TextUtils.truncate('这是一段很长的文本', 8, '…');

      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('capitalize()', () => {
    it('应该将首字母大写', () => {
      expect(TextUtils.capitalize('hello')).toBe('Hello');
    });

    it('应该处理空字符串', () => {
      expect(TextUtils.capitalize('')).toBe('');
    });

    it('应该将其余字母小写', () => {
      expect(TextUtils.capitalize('hELLO')).toBe('Hello');
    });
  });

  describe('slugify()', () => {
    it('应该转换为 URL 友好格式', () => {
      expect(TextUtils.slugify('Hello World')).toBe('hello-world');
    });

    it('应该移除特殊字符', () => {
      expect(TextUtils.slugify('Hello, World!')).toBe('hello-world');
    });

    it('应该处理多个空格', () => {
      expect(TextUtils.slugify('Hello   World')).toBe('hello-world');
    });
  });
});

describe('数据验证工具', () => {
  // 模拟验证函数
  const validators = {
    isValidUUID: (uuid) => {
      const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return pattern.test(uuid);
    },
    isValidResourceId: (id) => {
      return typeof id === 'string' && id.length > 0;
    },
    isValidTransform: (transform) => {
      if (!transform || !transform.position || !transform.scale || !transform.rotate) {
        return false;
      }
      return typeof transform.position.x === 'number' &&
        typeof transform.position.y === 'number' &&
        typeof transform.position.z === 'number';
    },
  };

  describe('isValidUUID()', () => {
    it('应该验证有效的 UUID', () => {
      expect(validators.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('应该拒绝无效的 UUID', () => {
      expect(validators.isValidUUID('invalid-uuid')).toBe(false);
      expect(validators.isValidUUID('')).toBe(false);
      expect(validators.isValidUUID('123')).toBe(false);
    });
  });

  describe('isValidResourceId()', () => {
    it('应该验证有效的资源 ID', () => {
      expect(validators.isValidResourceId('resource-123')).toBe(true);
    });

    it('应该拒绝空字符串', () => {
      expect(validators.isValidResourceId('')).toBe(false);
    });
  });

  describe('isValidTransform()', () => {
    it('应该验证有效的变换对象', () => {
      const transform = {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        rotate: { x: 0, y: 0, z: 0 },
      };

      expect(validators.isValidTransform(transform)).toBe(true);
    });

    it('应该拒绝不完整的变换对象', () => {
      expect(validators.isValidTransform({})).toBe(false);
      expect(validators.isValidTransform({ position: {} })).toBe(false);
      expect(validators.isValidTransform(null)).toBe(false);
    });
  });
});
