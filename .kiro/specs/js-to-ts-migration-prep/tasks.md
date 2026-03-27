# 实施计划：JS → TS 迁移前准备工作

## 概述

将 `plugin/` 目录的 JS 代码进行迁移前准备：构造函数转 class、JSDoc 类型注释、全局变量声明、Object3D 扩展属性标注、tsconfig 配置、测试配置更新。所有工作在纯 JavaScript 环境下完成，不引入 `.ts` 文件。

## Tasks

- [x] 1. 构造函数转 class 语法（3 个文件）
  - [x] 1.1 将 `plugin/mrpp/MetaLoader.js` 从 Constructor_Function 转换为 ES6 class
    - 将 `function MetaLoader(editor) { ... }` 改写为 `class MetaLoader { constructor(editor) { ... } }`
    - 将所有 `this.xxx = function()` 提升为 class 方法
    - 消除 `const self = this`，信号回调改为箭头函数 `() => { this.xxx(); }`
    - `editor` 局部变量改为 `this.editor` 实例属性
    - 保持对外接口不变：`load`、`save`、`getMeta`、`getLoadingStatus`、`changed`、`isChanged`、`write`、`writeEntity`、`clear`、`initLoading`
    - export 语句保持 `export { MetaLoader }`
    - _需求: 1.1, 1.2, 1.4, 1.6_

  - [x] 1.2 将 `plugin/mrpp/VerseLoader.js` 从 Constructor_Function 转换为 ES6 class
    - 将 `function VerseLoader(editor) { ... }` 改写为 `class VerseLoader { constructor(editor) { ... } }`
    - 将所有 `this.xxx = function()` 提升为 class 方法
    - 消除 `const self = this`，信号回调改为箭头函数
    - `editor` 局部变量改为 `this.editor` 实例属性
    - 保持对外接口不变：`load`、`save`、`publish`、`getVerse`、`getLoadingStatus`、`changed`、`isChanged`、`write`、`writeData`、`read`、`clear`
    - export 语句保持 `export { VerseLoader }`
    - _需求: 1.1, 1.3, 1.4, 1.6_

  - [x] 1.3 将 `plugin/mrpp/EditorLoader.js` 从 Constructor_Function 转换为 ES6 class
    - 将 `function EditorLoader(editor) { ... }` 改写为 `class EditorLoader { constructor(editor) { ... } }`
    - 将 `this.load = function()` 提升为 class 方法
    - `creater` 改为 `this.creater` 实例属性
    - export 语句保持 `export { EditorLoader }`
    - _需求: 1.1, 1.5, 1.6_

  - [ ]* 1.4 编写属性测试：无构造函数模式（Property 1）
    - **Property 1: 无构造函数模式**
    - 创建 `three.js/editor/test/properties/no-constructor-function.test.js`
    - 随机采样 `plugin/` 中的 JS 文件，正则检测 `function Foo(` + `this.` 模式
    - 使用 `fc.integer` 索引到文件列表，至少 100 次迭代
    - **验证: 需求 1.1, 1.5**

  - [ ]* 1.5 编写属性测试：无 self = this 模式（Property 2）
    - **Property 2: 无 self = this 模式**
    - 创建 `three.js/editor/test/properties/no-self-this.test.js`
    - 随机采样 `plugin/` 中的 JS 文件，正则检测 `const self = this` 或 `var self = this`
    - 使用 `fc.integer` 索引到文件列表，至少 100 次迭代
    - **验证: 需求 1.4**

- [x] 2. Checkpoint — 确认构造函数转换完成
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 3. JSDoc 类型注释
  - [x] 3.1 为 `MetaLoader.js` 的所有方法添加完整 JSDoc 类型注释
    - constructor: `@param {object} editor`
    - 所有 public 方法添加 `@param` 和 `@returns` 注释
    - THREE 类型使用 `{import('three').Scene}` 等形式
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 为 `VerseLoader.js` 的所有方法添加完整 JSDoc 类型注释
    - constructor: `@param {object} editor`
    - 所有 public 方法添加 `@param` 和 `@returns` 注释
    - THREE 类型使用 `{import('three').Scene}` 等形式
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 3.3 为 `Factory.js`、`MetaFactory.js`、`ComponentContainer.js`、`CommandContainer.js`、`EventContainer.js` 添加 JSDoc 类型注释
    - 所有 class 的 constructor 添加 `@param` 注释
    - 所有 public 方法添加 `@param` 和 `@returns` 注释
    - _需求: 2.1, 2.2, 2.7_

  - [x] 3.4 为 `Access.js` 添加 JSDoc 类型注释
    - constructor: `@param {object} editor`
    - `can(ability)`: `@param {string} ability` `@returns {boolean}`
    - `is(role)`: `@param {string} role` `@returns {boolean}`
    - `atLeast(role)`: `@param {string} role` `@returns {boolean}`
    - _需求: 2.1, 2.2, 2.8_

  - [x] 3.5 为 `EditorLoader.js` 和其余 class 文件的 constructor 及 public 方法添加 JSDoc
    - 包括 `EditorPatches.js` 中的函数、各 Command 类、各 Component 类等
    - _需求: 2.1, 2.2_

  - [ ]* 3.6 编写属性测试：类方法 JSDoc 覆盖（Property 3）
    - **Property 3: 类方法 JSDoc 覆盖**
    - 创建 `three.js/editor/test/properties/jsdoc-coverage.test.js`
    - 随机采样 `plugin/` 中 class 定义的方法，检测 JSDoc `@param` 注释存在
    - 使用 `fc.integer` 索引到方法列表，至少 100 次迭代
    - **验证: 需求 2.1, 2.2, 2.5, 2.6, 2.7, 2.8**

- [x] 4. 全局变量显式声明
  - [x] 4.1 为使用全局 THREE 但未 import 的文件添加声明注释
    - 在 `Factory.js` 顶部添加 `/* global THREE */` 和 `/** @type {typeof import('three')} */`
    - 在 `Sidebar.Events.js`、`Sidebar.Animation.js` 等使用全局 THREE 的文件顶部添加同样的声明注释
    - 逐文件检查 `plugin/` 中所有使用 `THREE.` 但未 `import * as THREE from 'three'` 的文件
    - _需求: 3.1, 3.3_

  - [x] 4.2 为 `EditorPatches.js` 添加全局 signals 声明注释
    - 在文件顶部添加 `/* global signals */` 注释
    - 添加说明注释：signals 库通过 `<script>` 标签加载为全局变量
    - _需求: 3.2_

  - [x] 4.3 检查并消除 import/全局 THREE 混用
    - 检查 `plugin/` 中是否有文件同时存在 `import * as THREE from 'three'` 和全局 THREE 声明
    - 如有混用，统一为只使用 import 方式
    - _需求: 3.4_

  - [ ]* 4.4 编写属性测试：全局 THREE 声明完整性（Property 4）
    - **Property 4: 全局 THREE 声明完整性**
    - 创建 `three.js/editor/test/properties/global-three-declaration.test.js`
    - 随机采样使用 `THREE.` 的文件，验证有 import 或全局声明注释
    - **验证: 需求 3.1, 3.3**

  - [ ]* 4.5 编写属性测试：无 import/全局 THREE 混用（Property 5）
    - **Property 5: 无 import/全局 THREE 混用**
    - 创建 `three.js/editor/test/properties/no-three-mixuse.test.js`
    - 随机采样文件，验证不同时存在 import 和全局声明
    - **验证: 需求 3.4**

- [x] 5. Checkpoint — 确认全局变量声明和 JSDoc 完成
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 6. Object3D 扩展属性标注
  - [x] 6.1 在 `EditorPatches.js` 中标注 `object.commands = []` 扩展属性
    - 在 `patchSetScene` 和 `patchAddObject` 中初始化 `object.commands` 的位置添加 JSDoc 注释
    - 说明这是 MRPP 对 Object3D 的扩展属性
    - _需求: 4.2, 4.4_

  - [x] 6.2 在 `MetaLoader.js` 中标注 `node.components` 和 `node.commands` 扩展属性
    - 在 `writeEntity` 方法中读取 `node.components` 和 `node.commands` 的位置添加 JSDoc 注释
    - _需求: 4.1, 4.2, 4.5_

  - [x] 6.3 在 `MetaLoader.js` 中标注 `scene.events` 扩展属性
    - 在 `load` 方法中赋值 `scene.events` 的位置添加 JSDoc 注释
    - _需求: 4.3_

  - [x] 6.4 检查其他文件中的 Object3D 扩展属性读写位置并添加标注
    - 检查 `MetaFactory.js`、`VerseLoader.js`、`ComponentContainer.js`、`CommandContainer.js` 等文件
    - 在首次赋值处添加 JSDoc 注释
    - _需求: 4.1, 4.2, 4.3_

- [x] 7. tsconfig.json 配置
  - [x] 7.1 在项目根目录创建 `tsconfig.json`
    - 配置 `allowJs: true`、`checkJs: false`、`strict: true`、`target: "ES2022"`、`module: "ESNext"`、`moduleResolution: "bundler"`
    - 配置 `noEmit: true`
    - 配置 `include: ["plugin/**/*"]`
    - 配置 `paths: { "three": ["./three.js/build/three.module.js"] }` 和 `baseUrl: "."`
    - 配置 `exclude: ["node_modules", "three.js/editor/test/node_modules"]`
    - 每个关键配置项添加注释说明用途和迁移策略
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 8. 测试配置更新
  - [x] 8.1 更新 `three.js/editor/test/vitest.config.js` 支持 TypeScript
    - `include` 增加 `**/*.test.ts` 和 `**/*.spec.ts`
    - `coverage.include` 增加 `plugin/**/*.ts` 路径模式
    - _需求: 6.1, 6.2_

  - [x] 8.2 更新 `three.js/editor/test/package.json` 添加 TypeScript 依赖
    - 在 `devDependencies` 中添加 `"typescript": "^5.0.0"`
    - _需求: 6.3_

  - [x] 8.3 更新 `three.js/editor/test/eslint.config.js` 支持 TypeScript
    - 增加 `plugin/**/*.ts` 的文件匹配规则
    - 使用 `@typescript-eslint` 解析器
    - 启用 `@typescript-eslint/no-explicit-any` 规则（warn 级别）
    - _需求: 6.4, 6.6_

- [x] 9. no-typescript 测试更新
  - [x] 9.1 将 `no-typescript.test.js` 重命名为 `typescript-migration.test.js` 并更新内容
    - 保留"迁移前状态"测试：验证 `plugin/` 中不存在 `.ts` 文件（保持原有逻辑）
    - 添加 `describe.skip` 的"迁移后状态"测试：验证 `plugin/` 中存在 `.ts` 文件
    - 添加注释说明该测试在迁移前后的不同用途
    - 更新测试描述和 Feature 标签为 `js-to-ts-migration-prep`
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10. 导出接口不变性验证
  - [ ]* 10.1 编写属性测试：导出接口不变（Property 6）
    - **Property 6: 导出接口不变**
    - 创建 `three.js/editor/test/properties/export-interface-stable.test.js`
    - 随机采样 `plugin/` 中的文件，比较 export 名称与基线快照
    - 需要先生成基线快照（在准备工作开始前记录所有文件的 export 名称）
    - **验证: 需求 8.5**

- [x] 11. 最终 Checkpoint — 确保所有测试通过
  - 运行全部属性测试（包括 4 个原有测试 + 新增属性测试），确保全部通过
  - 确认 `import-paths.test.js`、`i18n-completeness.test.js`、`three-reference.test.js`、`typescript-migration.test.js` 全部通过
  - 如有问题请向用户确认
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

## 备注

- 标记 `*` 的子任务为可选，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号，确保可追溯性
- Checkpoint 任务用于增量验证，确保每个阶段的正确性
- 属性测试验证跨所有文件的通用正确性属性
- 单元测试验证特定文件的具体行为和边界情况
