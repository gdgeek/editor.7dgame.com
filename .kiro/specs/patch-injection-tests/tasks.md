# 实现计划：Patch 注入集成测试

## 概述

在 `three.js/editor/test/properties/` 目录下创建 4 个测试文件，使用 vitest + fast-check 对 patch 注入机制进行纯静态文件系统分析，覆盖 11 个需求、8 个属性测试（P1–P8）。

## 任务

- [x] 1. 创建 patch-exports.test.js
  - [x] 1.1 实现工具函数：`readSource`、`extractExportNames`、`findCallLine`
    - 路径基准：`path.resolve(process.cwd(), '../../..')`
    - `extractExportNames` 复用 `export-names-preserved.test.js` 中已验证的正则
    - _需求：11.4, 11.5_
  - [ ]* 1.2 属性测试 P1：Patch 文件导出名称完整性
    - **Property 1: Patch 文件导出名称完整性**
    - 用 `fc.integer` 从 `PATCH_EXPORTS` 条目数组随机采样，验证每个期望导出名称都出现在提取结果中
    - **Validates: Requirements 1.1–1.9**
  - [ ]* 1.3 属性测试 P2：Bootstrap 调用覆盖完整性
    - **Property 2: Bootstrap 调用覆盖完整性**
    - 用 `fc.integer` 从 `BOOTSTRAP_CALLS` 条目数组随机采样，验证每个期望函数调用出现在 bootstrap 源码中
    - **Validates: Requirements 2.1–2.10**
  - [ ]* 1.4 属性测试 P3：Bootstrap 调用顺序不变量
    - **Property 3: Bootstrap 调用顺序不变量**
    - 对 `meta-bootstrap.ts` 和 `verse-bootstrap.ts`，验证 `applyEditorPatches` 行号 < `applyLoaderPatches` 行号
    - **Validates: Requirements 2.11, 2.12**
  - [ ]* 1.5 属性测试 P4：Editor.js API 完整性
    - **Property 4: Editor.js API 完整性**
    - 用 `fc.integer` 从 `EDITOR_METHODS ∪ EDITOR_PROPS ∪ EDITOR_SIGNALS` 随机采样，验证每个名称出现在 `Editor.js` 源码中
    - **Validates: Requirements 3.1–3.9, 8.1–8.6**

- [x] 2. 创建 patch-language-signals.test.js
  - [x] 2.1 实现工具函数：`readSource`、`extractExportNames`（内联，与文件 1 相同模式）
    - _需求：11.4_
  - [x] 2.2 单元测试：LANGUAGE_MAPPING 必需源语言码存在性
    - 验证 `LANGUAGE_MAPPING` 包含 `zh-CN`、`en-US`、`ja-JP`、`ko-KR`、`fr-FR` 这 5 个键
    - _需求：4.4_
  - [x] 2.3 单元测试：自定义信号集合非空且包含必需信号
    - 从 `EditorPatches.ts` 提取 `registerCustomSignals` 内的信号名称
    - 验证集合非空，且包含 `upload`、`release`、`objectsChanged`、`componentAdded`、`componentChanged`、`componentRemoved`
    - _需求：5.2_
  - [x] 2.4 单元测试：savingStarted/savingFinished 条件守卫
    - 验证 `EditorPatches.ts` 源码中对这两个信号的注册使用了 `if (!editor.signals.XXX)` 形式
    - _需求：5.3_
  - [ ]* 2.5 属性测试 P5：LANGUAGE_MAPPING 目标值完整性
    - **Property 5: LANGUAGE_MAPPING 目标值完整性**
    - 用 `fc.integer` 从 `LANGUAGE_MAPPING` 条目随机采样，验证目标语言码出现在 `Strings.js` 语言码列表中，且目标值为非空字符串
    - **Validates: Requirements 4.2, 4.5**
  - [ ]* 2.6 属性测试 P6：信号名称格式不变量
    - **Property 6: 信号名称格式不变量**
    - 用 `fc.integer` 从提取的信号名称数组随机采样，验证每个名称匹配 `/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`
    - **Validates: Requirements 5.4**

- [x] 3. 创建 patch-dependencies.test.js
  - [x] 3.1 实现工具函数：`readSource`、`extractRelativeImports`、`resolveImportPath`
    - `resolveImportPath` 依次尝试原始路径、`.js` → `.ts` 替换、追加 `.ts`
    - _需求：9.2, 11.4_
  - [x] 3.2 单元测试：UIOutliner 存在性与 prototype 模式
    - 验证 `ui.three.js` 文件存在
    - 验证源码中存在 `UIOutliner` 定义或导出
    - 验证源码中存在 `prototype` 关键字
    - 验证 `UIThreePatches.ts` 导入语句中包含从 `ui.three.js` 导入 `UIOutliner`
    - _需求：6.1–6.4_
  - [x] 3.3 单元测试：Loader.js 文件存在性
    - 验证 `three.js/editor/js/Loader.js` 文件存在
    - 验证 `LoaderPatches.ts` 导入语句中包含 `KTX2Loader.js` 的导入
    - _需求：7.1, 7.4_
  - [x] 3.4 单元测试：patch 文件导入路径总数 > 0
    - 遍历 6 个 patch 文件，累计提取到的相对导入路径总数，断言 > 0
    - _需求：9.4_
  - [ ]* 3.5 属性测试 P7：Loader.js API 完整性
    - **Property 7: Loader.js API 完整性**
    - 用 `fc.integer` 从 `['loadFiles', 'loadFile']` 随机采样，验证每个方法名出现在 `Loader.js` 源码中
    - **Validates: Requirements 7.2, 7.3**
  - [ ]* 3.6 属性测试 P8：Patch 文件导入路径完整性
    - **Property 8: Patch 文件导入路径完整性**
    - 构建所有 (patch 文件, 相对导入路径) 对的数组，用 `fc.integer` 随机采样，验证每个路径解析后文件存在
    - **Validates: Requirements 9.2, 9.5**

- [x] 4. 创建 patch-idempotency.test.js
  - [x] 4.1 单元测试：UIThreePatches 多选 patch 守卫
    - 验证 `UIThreePatches.ts` 源码中存在 `_mrppMultiSelectPatched` 的读取检查（`if` 条件）
    - 验证 `UIThreePatches.ts` 源码中存在 `_mrppMultiSelectPatched` 的写入赋值
    - _需求：10.1, 10.2_
  - [x] 4.2 单元测试：UIThreePatches drop handler 守卫
    - 验证 `UIThreePatches.ts` 源码中存在 `_mrppDropPatched` 守卫标志
    - _需求：10.3_
  - [x] 4.3 单元测试：DeferredUIPatches 布尔守卫变量
    - 验证 `DeferredUIPatches.ts` 源码中存在 `sidebarPatched` 变量
    - 验证 `DeferredUIPatches.ts` 源码中存在 `menubarPatched` 变量
    - _需求：10.5_

- [x] 5. 验证：运行全部测试
  - 在 `three.js/editor/test/` 目录下执行 `npx vitest --run`，确认 4 个新测试文件全部通过
  - 确认无回归（现有测试仍通过）
  - _需求：11.1–11.7_

## 备注

- 标有 `*` 的子任务为可选属性测试，可跳过以加快 MVP 交付
- 每个测试文件内联工具函数，不抽取共享模块（与现有测试风格一致）
- 属性测试配置：`numRuns: Math.max(100, entries.length * 2)`，`endOnFailure: true`，`verbose: 1`
- 注释标签格式：`// Feature: patch-injection-tests, Property N: <property_text>`
