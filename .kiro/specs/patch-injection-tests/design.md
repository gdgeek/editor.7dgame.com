# 设计文档：Patch 注入集成测试

## Overview

本 feature 为 GDGeek Editor 的 patch 注入机制建立一套静态分析集成测试，运行于现有的 `three.js/editor/test/properties/` vitest + fast-check 框架中。

测试策略是**纯静态文件系统分析**：读取 TypeScript/JavaScript 源文件内容，通过字符串匹配和正则表达式验证结构性前提条件，无需运行时环境或浏览器 DOM。这使得测试可以在 CI 阶段快速执行，将 patch 注入失败从"运行时静默"变为"构建时可见"。

覆盖范围：11 个需求，涉及 patch 导出验证、bootstrap 调用顺序、Editor/Loader API 存在性、LANGUAGE_MAPPING 完整性、自定义信号名称、UIOutliner 存在性、导入路径合法性、幂等性守卫。

---

## Architecture

```
three.js/editor/test/properties/
├── patch-exports.test.js          # 需求 1, 2, 3, 8（导出、bootstrap、Editor API、信号）
├── patch-language-signals.test.js # 需求 4, 5（LANGUAGE_MAPPING、自定义信号）
├── patch-dependencies.test.js     # 需求 6, 7, 9（UIOutliner、Loader API、导入路径）
└── patch-idempotency.test.js      # 需求 10（幂等性守卫）
```

四个文件按关注点分组，每个文件独立可运行，共享相同的工具函数模式（不提取公共模块，保持与现有测试风格一致）。

---

## Components and Interfaces

### 核心工具函数（每个测试文件内部定义）

所有测试文件共享相同的工具函数模式，直接内联定义（不抽取共享模块，与现有测试风格一致）。

**路径解析**

```js
const PROJECT_ROOT = path.resolve(process.cwd(), '../../..');
const PLUGIN_DIR   = path.join(PROJECT_ROOT, 'plugin');
const EDITOR_JS    = path.join(PROJECT_ROOT, 'three.js', 'editor', 'js');
```

**文件读取**

```js
function readSource(relPath) {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}
```

**导出名称提取**（复用 export-names-preserved.test.js 中已验证的正则）

```js
function extractExportNames(content) {
  const names = [];
  // export { A, B }
  const braceRe = /^export\s*\{([^}]+)\}/gm;
  // export function/class/const/let/var name
  const declRe  = /^export\s+(?:async\s+)?(?:function\*?\s+|class\s+|(?:const|let|var)\s+)(\w+)/gm;
  // ... (同 export-names-preserved.test.js)
  return names.sort();
}
```

**相对导入路径提取**

```js
function extractRelativeImports(content) {
  const re = /^import\s+[^'"]*from\s+['"](\.[^'"]+)['"]/gm;
  const paths = [];
  let m;
  while ((m = re.exec(content)) !== null) paths.push(m[1]);
  return paths;
}
```

**导入路径解析**（处理 `.js` 导入对应 `.ts` 文件的情况）

```js
function resolveImportPath(sourceFile, importPath) {
  const sourceDir = path.dirname(path.join(PROJECT_ROOT, sourceFile));
  const resolved  = path.resolve(sourceDir, importPath);
  // 尝试原始路径、.ts 替换 .js、直接加 .ts
  const candidates = [
    resolved,
    resolved.replace(/\.js$/, '.ts'),
    resolved + '.ts',
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}
```

**行号查找**（用于调用顺序验证）

```js
function findCallLine(content, fnName) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(fnName + '(')) return i;
  }
  return -1;
}
```

---

## Data Models

### 测试数据常量

**patch 文件 → 期望导出名称映射**

```js
const PATCH_EXPORTS = {
  'plugin/patches/EditorPatches.ts':   ['applyEditorPatches', 'LANGUAGE_MAPPING'],
  'plugin/patches/SidebarPatches.ts':  ['applySidebarPatches', 'applySidebarPropertiesPatches'],
  'plugin/patches/MenubarPatches.ts':  ['applyMenubarPatches'],
  'plugin/patches/LoaderPatches.ts':   ['applyLoaderPatches'],
  'plugin/patches/UIThreePatches.ts':  ['applyUIThreePatches'],
  'plugin/patches/ViewportPatches.ts': ['applyViewportPatches', 'computeEnhancedBoundingBox',
                                        'computeMultiSelectionBoundingBox'],
};
```

**bootstrap 文件 → 期望调用函数列表**

```js
const BOOTSTRAP_CALLS = {
  'plugin/bootstrap/meta-bootstrap.ts':  [
    'applyEditorPatches', 'applyLoaderPatches', 'applyViewportPatches',
    'applyUIThreePatches', 'applyDeferredUIPatches',
  ],
  'plugin/bootstrap/verse-bootstrap.ts': [
    'applyEditorPatches', 'applyLoaderPatches', 'applyViewportPatches',
    'applyUIThreePatches', 'applyDeferredUIPatches',
  ],
};
```

**Editor.js 期望存在的方法/属性/信号**

```js
const EDITOR_METHODS   = ['setScene', 'addObject', 'removeObject', 'select', 'clear', 'fromJSON', 'toJSON'];
const EDITOR_PROPS     = ['signals', 'config', 'sceneHelpers'];
const EDITOR_SIGNALS   = ['objectSelected', 'objectChanged', 'transformModeChanged',
                          'sceneGraphChanged', 'sceneHelpers'];
```

**Loader.js 期望存在的方法**

```js
const LOADER_METHODS = ['loadFiles', 'loadFile'];
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Patch 文件导出名称完整性

*For any* (patch 文件路径, 期望导出名称) 对，从该文件源码中提取的导出名称集合应包含该期望名称。

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**

### Property 2: Bootstrap 调用覆盖完整性

*For any* (bootstrap 文件路径, 期望调用函数名) 对，该 bootstrap 文件的源码中应包含对该函数的调用（即源码中出现 `fnName(`）。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

### Property 3: Bootstrap 调用顺序不变量

*For any* bootstrap 文件，`applyEditorPatches` 的调用行号应严格小于 `applyLoaderPatches` 的调用行号。

**Validates: Requirements 2.11, 2.12**

### Property 4: Editor.js API 完整性

*For any* 期望的方法名/属性名/信号名（来自 `EDITOR_METHODS ∪ EDITOR_PROPS ∪ EDITOR_SIGNALS`），该名称应出现在 `three.js/editor/js/Editor.js` 的源码中。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

### Property 5: LANGUAGE_MAPPING 目标值完整性

*For any* `LANGUAGE_MAPPING` 中的 (源语言码, 目标语言码) 条目，目标语言码应出现在 `Strings.js` 提取的语言码列表中，且目标语言码本身应是非空字符串。

**Validates: Requirements 4.2, 4.5**

### Property 6: 信号名称格式不变量

*For any* 从 `EditorPatches.ts` 的 `registerCustomSignals` 函数中提取的信号名称，该名称应匹配合法 JavaScript 标识符的正则 `/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`。

**Validates: Requirements 5.4**

### Property 7: Loader.js API 完整性

*For any* 期望的 Loader 方法名（`loadFiles`、`loadFile`），该方法名应出现在 `three.js/editor/js/Loader.js` 的源码中。

**Validates: Requirements 7.2, 7.3**

### Property 8: Patch 文件导入路径完整性

*For any* patch 文件中的相对导入路径，将该路径相对于源文件目录解析后（优先尝试 `.ts` 替换 `.js`），对应的文件应在文件系统中存在。

**Validates: Requirements 9.2, 9.5**

---

## Error Handling

所有测试在失败时应在错误信息中包含足够的上下文：

- **文件不存在**：报告期望路径的绝对路径
- **导出名称缺失**：报告源文件相对路径 + 缺失的导出名称
- **调用缺失**：报告 bootstrap 文件路径 + 缺失的函数调用名
- **调用顺序错误**：报告两个函数的实际行号
- **导入路径悬空**：报告源文件路径 + 导入路径 + 解析后的绝对路径

错误信息格式参考现有测试（`export-names-preserved.test.js`）：

```js
throw new Error(
  `Export name missing in ${relPath}:\n` +
  `  expected: ${expectedName}\n` +
  `  actual exports: ${JSON.stringify(actualExports)}`
);
```

---

## Testing Strategy

### 双轨测试方法

**单元测试（具体示例）**：验证特定的已知值和边界条件

- `LANGUAGE_MAPPING` 包含 5 个必需源语言码（`zh-CN`、`en-US`、`ja-JP`、`ko-KR`、`fr-FR`）
- 信号名称集合非空，至少包含 `upload`、`release`、`objectsChanged`
- `savingStarted`/`savingFinished` 使用条件守卫 `if (!editor.signals.XXX)`
- `UIOutliner` 在 `ui.three.js` 中存在且被导出
- `ui.three.js` 中存在 `prototype` 关键字
- `UIThreePatches.ts` 从 `ui.three.js` 导入 `UIOutliner`
- 导入路径总数 > 0（验证提取逻辑有效）
- `_mrppMultiSelectPatched` 守卫的读取和写入均存在
- `_mrppDropPatched` 守卫存在
- `DeferredUIPatches.ts` 中存在 `sidebarPatched` 和 `menubarPatched` 变量

**属性测试（fast-check）**：验证对所有输入都成立的不变量

每个属性测试使用 `fc.integer` 从预定义数组中随机采样索引，确保覆盖所有条目。

### 属性测试配置

- 最少 100 次迭代（`numRuns: Math.max(100, entries.length * 2)`）
- `endOnFailure: true` 快速失败
- `verbose: 1` 显示失败示例

每个属性测试的注释标签格式：

```js
// Feature: patch-injection-tests, Property N: <property_text>
```

### 测试文件分配

| 文件 | 属性测试 | 单元测试 | 覆盖需求 |
|------|---------|---------|---------|
| `patch-exports.test.js` | P1, P2, P3, P4 | bootstrap 文件存在性 | 1, 2, 3, 8 |
| `patch-language-signals.test.js` | P5, P6 | 4.4, 5.2, 5.3 | 4, 5 |
| `patch-dependencies.test.js` | P7, P8 | 6.1-6.4, 9.4 | 6, 7, 9 |
| `patch-idempotency.test.js` | — | 10.1-10.3, 10.5 | 10 |

### 属性测试库

使用 `fast-check`（项目已安装，现有测试已使用），无需额外依赖。

### 与现有框架集成

- 文件扩展名 `.test.js`，放置于 `three.js/editor/test/properties/`
- 使用 `vitest describe/it/expect` + `fc.assert/fc.property`
- 使用 Node.js `fs`/`path`，不依赖浏览器 DOM
- 通过 `path.resolve(process.cwd(), '../../..')` 计算项目根目录
- 在 `vitest --run` 单次执行模式下完成，不依赖 watch 模式
- 与 `three.js/editor/test/eslint.config.js` 兼容（纯 ESM，无 TypeScript）
