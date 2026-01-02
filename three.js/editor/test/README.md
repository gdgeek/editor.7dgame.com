# MRPP Editor 测试指南

## 概述

本项目使用 [Vitest](https://vitest.dev/) 作为测试框架，它是一个快速、现代的测试运行器，对 ES 模块有很好的支持。

## 快速开始

### 安装依赖

```bash
cd three.js/editor/test
npm install
```

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 使用 UI 界面
npm run test:ui
```

## 测试文件结构

```
test/
├── package.json          # 测试依赖配置
├── vitest.config.js      # Vitest 配置
├── setup.js              # 测试环境设置
├── README.md             # 本文档
├── mrpp/                 # MRPP 模块测试
│   ├── Builder.test.js
│   ├── Factory.test.js
│   └── ComponentContainer.test.js
├── utils/                # 工具函数测试
│   └── utils.test.js
└── integration/          # 集成测试
    └── scene-flow.test.js
```

## 测试类型

### 1. 单元测试 (Unit Tests)

测试单个函数或类的行为：

```javascript
import { describe, it, expect } from 'vitest';

describe('Builder', () => {
  it('应该创建正确的节点', () => {
    const builder = new Builder();
    const node = builder.node('Voxel', 'Test');
    expect(node.type).toBe('Voxel');
  });
});
```

### 2. 集成测试 (Integration Tests)

测试多个模块之间的协作：

```javascript
describe('场景数据流', () => {
  it('应该正确加载和渲染场景', async () => {
    const loader = new SceneLoader();
    const scene = await loader.load(sceneData);
    expect(scene.children.length).toBeGreaterThan(0);
  });
});
```

## 编写测试

### 基本结构

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('模块名称', () => {
  let instance;

  beforeEach(() => {
    // 每个测试前的设置
    instance = new MyClass();
  });

  describe('方法名称()', () => {
    it('应该做某件事', () => {
      const result = instance.method();
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Mock 使用

```javascript
// Mock 模块
vi.mock('three', () => ({
  MathUtils: {
    generateUUID: () => 'mock-uuid',
  },
}));

// Mock 函数
const mockFn = vi.fn();
mockFn.mockReturnValue(42);

// Mock 定时器
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
```

### 常用断言

```javascript
expect(value).toBe(expected);           // 严格相等
expect(value).toEqual(expected);        // 深度相等
expect(value).toBeDefined();            // 已定义
expect(value).toBeNull();               // 为 null
expect(array).toContain(item);          // 包含元素
expect(fn).toHaveBeenCalled();          // 函数被调用
expect(fn).toHaveBeenCalledWith(args);  // 带参数调用
expect(() => fn()).toThrow();           // 抛出异常
```

## 测试覆盖的模块

### MRPP 核心模块

| 模块 | 测试文件 | 覆盖内容 |
|------|---------|---------|
| Builder | Builder.test.js | 节点创建、资源节点、模块节点 |
| Factory | Factory.test.js | 变换设置、矩阵计算、节点锁定 |
| ComponentContainer | ComponentContainer.test.js | 组件创建、渲染 |

### 工具函数

| 模块 | 测试文件 | 覆盖内容 |
|------|---------|---------|
| Utils | utils.test.js | 对话框、文本处理、数据验证 |

### 集成测试

| 测试 | 文件 | 覆盖内容 |
|------|------|---------|
| 场景数据流 | scene-flow.test.js | 数据验证、序列化、资源加载、消息通信 |

## 添加新测试

1. 在相应目录创建 `*.test.js` 文件
2. 导入必要的测试工具和被测模块
3. 使用 `describe` 和 `it` 组织测试
4. 运行 `npm test` 验证

## 最佳实践

1. **命名清晰**：测试名称使用中文描述预期行为
2. **单一职责**：每个测试只验证一个行为
3. **隔离性**：使用 `beforeEach` 重置状态
4. **Mock 外部依赖**：隔离被测代码
5. **覆盖边界情况**：测试空值、异常、边界条件

## 常见问题

### Q: 如何测试异步代码？

```javascript
it('应该异步加载数据', async () => {
  const result = await loader.load();
  expect(result).toBeDefined();
});
```

### Q: 如何测试 DOM 操作？

Vitest 配置了 jsdom 环境，可以直接使用 DOM API：

```javascript
it('应该创建 DOM 元素', () => {
  const div = document.createElement('div');
  div.textContent = 'Hello';
  expect(div.textContent).toBe('Hello');
});
```

### Q: 如何调试测试？

```bash
# 使用 --reporter=verbose 查看详细输出
npx vitest run --reporter=verbose

# 使用 UI 模式调试
npm run test:ui
```
