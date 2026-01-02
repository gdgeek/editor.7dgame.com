# Three.js Editor 修改代码质量评审报告

> 本文档对项目中的自定义修改进行代码质量评审，找出问题并给出改进建议。

---

## 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ⭐⭐⭐⭐ | 功能实现完整，满足业务需求 |
| 代码规范 | ⭐⭐⭐ | 部分代码风格不一致，存在遗留调试代码 |
| 可维护性 | ⭐⭐⭐ | 模块划分合理，但耦合度较高 |
| 错误处理 | ⭐⭐ | 错误处理不够完善，容易失败静默 |
| 性能 | ⭐⭐⭐ | 存在一些性能隐患 |
| 安全性 | ⭐⭐⭐ | 基本安全，但有改进空间 |

---

## 问题清单

### 🔴 严重问题 (High Priority)

#### 1. 错误处理不完善

**文件**: `MetaFactory.js` (第 200-230 行)

**问题**: `loadVoxel` 函数的 Promise 结构错误，reject 和 error 处理在错误的位置。

```javascript
// ❌ 当前代码
async loadVoxel(url) {
    url = convertToHttps(url);
    return new Promise((resolve, reject) => {
        const loader = new VOXLoader();
        loader.load(
            url,
            function (chunks) {
                const chunk = chunks[0];
                const mesh = new VOXMesh(chunk);
                resolve(mesh);
            }
        );
    }, function (xhr) {  // ⚠️ 这不是 Promise 的有效参数！
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded!');
    }, function (error) {
        reject(error);  // ⚠️ 这里的 reject 无效
        alert(error);
        console.error('An error happened');
    });
}
```

**建议修复**:

```javascript
// ✅ 正确写法
async loadVoxel(url) {
    url = convertToHttps(url);
    return new Promise((resolve, reject) => {
        const loader = new VOXLoader();
        loader.load(
            url,
            (chunks) => {
                const chunk = chunks[0];
                const mesh = new VOXMesh(chunk);
                resolve(mesh);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + '% loaded!');
            },
            (error) => {
                console.error('VOX加载失败:', error);
                reject(error);
            }
        );
    });
}
```

---

#### 2. 全局变量污染

**文件**: `Menubar.Add.js` (第 18-19 行), `Builder.js` (第 24 行)

**问题**: 直接在 window 上挂载对象，造成全局污染。

```javascript
// ❌ 当前代码
const resources = new Map();
window.resources = resources;  // 全局污染

// Builder.js 中直接使用
uuid: THREE.MathUtils.generateUUID(),  // THREE 未导入，依赖全局变量
```

**建议修复**:

```javascript
// ✅ 方案1: 使用 Editor 实例管理
// 在 Editor.js 中
this.resources = new Map();

// 在需要的地方通过 editor 访问
editor.resources.get(id);

// ✅ 方案2: 如果必须全局，使用命名空间
window.MRPP = window.MRPP || {};
window.MRPP.resources = resources;

// ✅ Builder.js 需要导入 THREE
import * as THREE from 'three';
```

---

#### 3. 错误静默失败

**文件**: `MetaFactory.js` (第 310-320 行)

**问题**: 模型加载失败时返回 null 而不抛出异常，调用方无法知道失败原因。

```javascript
// ❌ 当前代码
loader.load(
    url,
    function (gltf) { resolve(gltf.scene); },
    function (xhr) {},
    function (error) {
        resolve(null);  // ⚠️ 失败也 resolve，调用方无法区分
        console.error('An error happened');
    }
);
```

**建议修复**:

```javascript
// ✅ 方案1: 返回结果对象
async loadPolygen(url, alpha = 1) {
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => resolve({ success: true, data: gltf.scene }),
            (xhr) => {},
            (error) => resolve({ success: false, error: error.message })
        );
    });
}

// ✅ 方案2: 使用 reject 并在调用处 try-catch
async loadPolygen(url, alpha = 1) {
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => resolve(gltf.scene),
            (xhr) => {},
            (error) => reject(new Error(`模型加载失败: ${url}`))
        );
    });
}
```

---

### 🟠 中等问题 (Medium Priority)

#### 4. 遗留调试代码

**文件**: 多个文件

**问题**: 代码中存在大量 `console.error` 和 `console.log` 调试语句。

```javascript
// MetaFactory.js
console.error('addMetaData', data);  // 第 130 行
console.log('获取到的数据:', data);   // 第 28 行

// VerseLoader.js
console.warn('Cannot save while modules are still loading');
console.log('No changes detected, sending save-verse-none');

// TriggerComponent.js
console.error(this.list);  // 第 16 行 - 明显的调试代码
```

**建议修复**:

```javascript
// ✅ 创建统一的日志工具
// utils/Logger.js
const LOG_LEVEL = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

class Logger {
    static level = process.env.NODE_ENV === 'production' 
        ? LOG_LEVEL.WARN 
        : LOG_LEVEL.DEBUG;
    
    static debug(...args) {
        if (this.level <= LOG_LEVEL.DEBUG) console.log('[DEBUG]', ...args);
    }
    
    static error(...args) {
        if (this.level <= LOG_LEVEL.ERROR) console.error('[ERROR]', ...args);
    }
}

export { Logger };
```

---

#### 5. 代码风格不一致

**问题**: 混用多种代码风格。

| 位置 | 问题 |
|------|------|
| `MetaFactory.js` | 混用 `function` 和箭头函数 |
| `VerseLoader.js` | 混用 `this` 和 `self` 引用 |
| 多个文件 | 有些用分号，有些不用 |
| 缩进 | 有些用 Tab，有些用空格 |

```javascript
// ❌ 当前代码 - 风格混乱
const self = this;
this.save = async function () {
    if (this.isLoading) {  // 使用 this
        console.warn('...');
    }
};

self.compareObjectsAndPrintDifferences = function (obj1, obj2) {
    // 内部又用 self
    self.compareObjectsAndPrintDifferences(val1, val2, currentPath);
};
```

**建议修复**:

```javascript
// ✅ 统一使用箭头函数和类语法
class VerseLoader {
    constructor(editor) {
        this.editor = editor;
        this.json = null;
        this.isLoading = true;
    }
    
    async save() {
        if (this.isLoading) {
            console.warn('...');
            return;
        }
        // ...
    }
}
```

---

#### 6. 魔法数字和硬编码字符串

**文件**: 多个文件

**问题**: 代码中存在未解释的魔法数字。

```javascript
// MetaFactory.js
mesh.scale.set(0.1, 0.1, 0.1);  // 为什么是 0.1?
mesh.rotation.set(Math.PI / 2, Math.PI / 2, 0);  // 为什么是这个角度?

// TextUtils.js
const PIXEL_SCALE = 0.005;  // ✅ 好的做法，有命名
const SCALE_FACTOR = 4;     // ✅ 好的做法

// WebpUtils.js
maxDimension = 1024  // 为什么是 1024?
quality = 0.8        // 为什么是 0.8?
```

**建议修复**:

```javascript
// ✅ 使用常量配置
// config/constants.js
export const GIZMO_CONFIG = {
    SCALE: 0.1,
    ROTATION: { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
};

export const TEXTURE_CONFIG = {
    MAX_DIMENSION: 1024,  // 防止显存溢出
    WEBP_QUALITY: 0.8,    // 平衡质量和大小
    PIXEL_SCALE: 0.005    // 物理单位转换
};
```

---

#### 7. 组件间紧耦合

**文件**: `Sidebar.Component.js`, `TriggerComponent.js`

**问题**: 组件直接遍历场景树获取对象，而不是通过统一的接口。

```javascript
// ❌ TriggerComponent.js
constructor(editor, object, component) {
    const node = editor.scene;
    const types = ['Voxel', 'Polygen'];
    this.list = [];
    node.traverse((child) => {
        if (types.includes(child.type) && child.uuid != object.uuid) {
            this.list.push(child);
        }
    });
}
```

**建议修复**:

```javascript
// ✅ 在 Editor 中提供查询接口
// Editor.js
getObjectsByTypes(types, excludeUuid = null) {
    const result = [];
    this.scene.traverse((child) => {
        if (types.includes(child.type) && child.uuid !== excludeUuid) {
            result.push(child);
        }
    });
    return result;
}

// TriggerComponent.js
constructor(editor, object, component) {
    this.list = editor.getObjectsByTypes(['Voxel', 'Polygen'], object.uuid);
}
```

---

#### 8. 类型检查不严格

**问题**: 大量使用 `toLowerCase()` 进行类型比较，容易出错。

```javascript
// ❌ 分散在多处的类型检查
if (editor.type.toLowerCase() == 'meta') { }
if (data.type.toLowerCase() === 'polygen') { }
if (['polygen', 'voxel', 'picture'].includes(objectType.toLowerCase())) { }
```

**建议修复**:

```javascript
// ✅ 统一类型定义
// constants/EntityTypes.js
export const ENTITY_TYPES = {
    META: 'meta',
    VERSE: 'verse',
    POLYGEN: 'polygen',
    VOXEL: 'voxel',
    PICTURE: 'picture',
    VIDEO: 'video',
    SOUND: 'sound',
    TEXT: 'text',
    PARTICLE: 'particle'
};

export const COMPONENT_VALID_TYPES = [
    ENTITY_TYPES.POLYGEN,
    ENTITY_TYPES.VOXEL,
    ENTITY_TYPES.PICTURE
];

// 使用
import { ENTITY_TYPES, COMPONENT_VALID_TYPES } from './constants/EntityTypes.js';

if (editor.type === ENTITY_TYPES.META) { }
if (COMPONENT_VALID_TYPES.includes(object.type)) { }
```

---

### 🟡 低优先级问题 (Low Priority)

#### 9. 注释不足

**问题**: 关键业务逻辑缺少注释说明。

```javascript
// ❌ 缺少注释
const exclude = ['name', 'title', 'uuid', 'transform', 'active'];
Object.keys(data.parameters).forEach(key => {
    if (!exclude.includes(key)) {
        userData[key] = data.parameters[key];
    }
});
```

**建议修复**:

```javascript
// ✅ 添加说明注释
/**
 * 将 data.parameters 中的自定义属性复制到 userData
 * 排除系统保留字段：name, title, uuid, transform, active
 * 这些字段已在 node 的标准属性中设置
 */
const RESERVED_FIELDS = ['name', 'title', 'uuid', 'transform', 'active'];
Object.keys(data.parameters).forEach(key => {
    if (!RESERVED_FIELDS.includes(key)) {
        userData[key] = data.parameters[key];
    }
});
```

---

#### 10. 重复代码

**文件**: `MetaFactory.js`, `VerseLoader.js`

**问题**: HTTP/HTTPS 转换逻辑重复。

```javascript
// MetaFactory.js 中定义
const convertToHttps = (url) => { ... };

// 可能在其他地方也有类似实现
```

**建议修复**:

```javascript
// ✅ 提取到工具文件
// utils/UrlUtils.js
export const isHttps = () => window.location.protocol === 'https:';

export const ensureProtocol = (url) => {
    if (!url) return '';
    
    if (isHttps()) {
        return url.replace(/^http:/, 'https:');
    } else {
        return url.replace(/^https:/, 'http:');
    }
};
```

---

#### 11. 未使用的导入和代码

**文件**: `MetaFactory.js` (第 6 行)

```javascript
//import { Editor } from './js/Editor.js';  // 注释掉的代码
```

**建议**: 删除所有注释掉的无用代码。

---

#### 12. alert() 的使用

**文件**: `MetaFactory.js`

**问题**: 生产代码中使用 `alert()` 显示错误。

```javascript
// ❌ 当前代码
alert(error);
```

**建议修复**:

```javascript
// ✅ 使用 DialogUtils
import { DialogUtils } from '../utils/DialogUtils.js';
DialogUtils.showMessage(error.message, true);
```

---

## 架构改进建议

### 1. 引入依赖注入

当前多个组件直接依赖 `editor` 实例，建议通过依赖注入解耦：

```javascript
// ✅ 服务注册
class ServiceContainer {
    constructor() {
        this.services = new Map();
    }
    
    register(name, service) {
        this.services.set(name, service);
    }
    
    get(name) {
        return this.services.get(name);
    }
}

// 使用
const container = new ServiceContainer();
container.register('factory', new MetaFactory(editor));
container.register('resources', new Map());
```

### 2. 事件总线解耦

当前信号系统可以进一步抽象：

```javascript
// ✅ 事件总线
class EventBus {
    constructor() {
        this.events = {};
    }
    
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data));
        }
    }
}
```

### 3. 状态管理

考虑引入简单的状态管理，特别是对于多选对象：

```javascript
// ✅ 简单状态管理
class EditorState {
    constructor() {
        this.state = {
            selected: null,
            selectedObjects: [],
            isLoading: false,
            resources: new Map()
        };
        this.listeners = [];
    }
    
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }
    
    subscribe(listener) {
        this.listeners.push(listener);
    }
    
    notify() {
        this.listeners.forEach(l => l(this.state));
    }
}
```

---

## 优先级行动计划

### 立即修复 (本周)

1. ✅ 修复 `loadVoxel` 的 Promise 结构错误
2. ✅ 移除 `console.error` 调试代码
3. ✅ 在 `Builder.js` 中添加 `import * as THREE`

### 短期改进 (本月)

1. 统一代码风格，配置 ESLint
2. 创建 `constants/` 目录，统一管理类型和配置
3. 创建 `utils/Logger.js` 替换零散的 console 调用
4. 将 `window.resources` 移到 `editor.resources`

### 长期优化 (下个版本)

1. 将 `VerseLoader` 重构为 class 语法
2. 引入 TypeScript 类型定义
3. 添加单元测试
4. 抽取公共工具函数

---

## 代码规范建议

建议在项目根目录添加 `.eslintrc.js`:

```javascript
module.exports = {
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        'no-console': 'warn',
        'no-unused-vars': 'warn',
        'no-undef': 'error',
        'eqeqeq': ['error', 'always'],
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'indent': ['error', 'tab']
    },
    globals: {
        'THREE': 'readonly',
        'signals': 'readonly'
    }
};
```

---

## 总结

这套修改整体上功能实现完整，架构设计合理（mrpp 模块、组件系统、指令系统的分离很好）。主要问题集中在：

1. **错误处理不规范** - Promise 结构错误、静默失败
2. **代码规范不统一** - 需要引入 ESLint
3. **调试代码残留** - 需要清理或替换为日志系统
4. **全局变量污染** - 需要通过 editor 实例管理

建议按照优先级逐步改进，同时在后续开发中遵循统一的编码规范。
