# 需求文档：JS → TS 迁移前准备工作

## 简介

`plugin/` 目录包含约 45 个 JavaScript 文件，是 MRPP 业务代码的核心。在将这些文件迁移到 TypeScript 之前，需要完成一系列准备工作，以降低迁移风险、提升迁移质量。

本 spec 描述的是**迁移前的准备阶段**，准备工作本身不引入 TypeScript——所有文件在本阶段结束时仍为 `.js` 文件。准备工作的目标是：消除代码中的隐式类型依赖、统一语法风格、配置好工具链，使后续的 JS → TS 迁移可以逐文件、低风险地进行。

**约束条件**：
- 准备阶段全程保持纯 JavaScript，不引入 `.ts` 文件
- 无构建工具（无 webpack/vite），使用浏览器原生 ES modules + import map
- 测试框架：vitest + fast-check，位于 `three.js/editor/test/`
- 现有 4 个属性测试在准备阶段结束时必须全部通过

## 术语表

- **Plugin_Layer**：`plugin/` 目录中的所有 MRPP 自定义 JavaScript 文件（约 45 个）
- **Constructor_Function**：使用 `function Foo(args) { this.xxx = ... }` 语法定义的旧式构造函数（如 `MetaLoader`、`VerseLoader`）
- **Class_Syntax**：使用 ES6 `class Foo { constructor(args) { ... } }` 语法定义的类
- **JSDoc**：JavaScript 文档注释规范，使用 `/** @param {Type} name */` 等标签描述类型信息
- **Global_Variable**：通过 `<script>` 标签或 import map 加载、在模块中直接使用但未显式 import 的变量（如 `THREE`、`signals`）
- **Implicit_Any**：在 TypeScript 中，因缺少类型注释而被推断为 `any` 类型的变量或参数
- **tsconfig**：TypeScript 编译器配置文件 `tsconfig.json`，控制编译行为和类型检查严格度
- **allowJs**：tsconfig 选项，允许 TypeScript 编译器处理 `.js` 文件，是渐进式迁移的关键配置
- **checkJs**：tsconfig 选项，对 `.js` 文件启用类型检查（依赖 JSDoc 注释）
- **THREE**：three.js 库的命名空间，在 Plugin_Layer 中部分文件通过 import map bare specifier `'three'` 导入，部分文件直接使用全局 `THREE`
- **signals**：JS Signals 库，通过 `<script>` 标签加载为全局变量，Plugin_Layer 中通过 `signals.Signal` 使用
- **Object3D_Extension**：对 `THREE.Object3D` 实例添加的非标准属性（如 `object.components`、`object.commands`、`object.events`），这些属性不在 three.js 类型定义中
- **Test_Suite**：`three.js/editor/test/` 目录下的 vitest 测试套件，包含 4 个属性测试文件


## 需求

### 需求 1：构造函数转 class 语法

**用户故事：** 作为开发者，我希望 Plugin_Layer 中所有使用旧式 Constructor_Function 语法的文件统一改写为 Class_Syntax，以便 TypeScript 迁移时可以直接为 class 添加类型注释，而无需同时处理语法转换。

#### 验收标准

1. THE Plugin_Layer SHALL 不包含任何使用 `function Foo(args) { this.xxx = ... }` 模式定义的 Constructor_Function（即不存在通过 `new` 调用的普通函数）
2. WHEN `MetaLoader.js` 被重写为 Class_Syntax 时，THE MetaLoader SHALL 保持与原版完全相同的对外接口（`load`、`save`、`getMeta`、`getLoadingStatus`、`changed`、`isChanged`、`write`、`writeEntity`、`clear`、`initLoading` 方法）
3. WHEN `VerseLoader.js` 被重写为 Class_Syntax 时，THE VerseLoader SHALL 保持与原版完全相同的对外接口（`load`、`save`、`publish`、`getVerse`、`getLoadingStatus`、`changed`、`isChanged`、`write`、`writeData`、`read`、`clear` 方法）
4. WHEN Constructor_Function 中使用了 `const self = this` 模式时，THE 重写后的 Class_Syntax SHALL 使用箭头函数或显式 `this` 绑定替代 `self` 引用，消除 `self` 变量
5. IF Plugin_Layer 中存在其他使用 Constructor_Function 模式的文件，THEN THE 对应文件 SHALL 同样转换为 Class_Syntax
6. WHEN 转换完成时，THE import-paths 属性测试 SHALL 通过（所有 import 路径仍指向存在的文件）

### 需求 2：关键函数和方法添加 JSDoc 类型注释

**用户故事：** 作为开发者，我希望 Plugin_Layer 中的关键函数和方法都有 JSDoc 类型注释，以便在启用 `checkJs` 时 TypeScript 能够推断类型，减少迁移后需要手动补充的类型注释数量。

#### 验收标准

1. THE Plugin_Layer 中每个 class 的 `constructor` 方法 SHALL 包含 JSDoc `@param` 注释，标注每个参数的类型
2. THE Plugin_Layer 中每个 public 方法 SHALL 包含 JSDoc `@param` 注释（如有参数）和 `@returns` 注释（如有返回值）
3. WHEN 方法参数类型为 `THREE.Object3D` 或其子类时，THE JSDoc 注释 SHALL 使用 `{import('three').Object3D}` 或等效的类型引用形式，而非裸写 `{Object3D}`
4. WHEN 方法参数类型为 editor 实例时，THE JSDoc 注释 SHALL 使用 `{object}` 或专门定义的 `@typedef` 描述 editor 的结构
5. THE `MetaLoader` class 的所有方法 SHALL 包含完整的 JSDoc 类型注释
6. THE `VerseLoader` class 的所有方法 SHALL 包含完整的 JSDoc 类型注释
7. THE `Factory.js`、`MetaFactory.js`、`ComponentContainer.js`、`CommandContainer.js`、`EventContainer.js` 中的所有 public 方法 SHALL 包含 JSDoc 类型注释
8. THE `Access.js` 中的所有方法 SHALL 包含 JSDoc 类型注释，包括 `can`、`is`、`atLeast` 方法的参数和返回值类型

### 需求 3：显式声明全局变量依赖

**用户故事：** 作为开发者，我希望 Plugin_Layer 中对全局变量（`THREE`、`signals`）的依赖被显式标注或处理，以便 TypeScript 迁移时能够明确知道哪些文件需要添加全局类型声明，哪些文件需要改为显式 import。

#### 验收标准

1. THE Plugin_Layer 中每个直接使用全局 `THREE` 变量（未通过 `import * as THREE from 'three'` 导入）的文件 SHALL 在文件顶部添加 JSDoc 注释 `/** @type {typeof import('three')} */` 或等效的全局声明注释，明确标注 `THREE` 来自全局作用域
2. THE Plugin_Layer 中每个使用 `signals.Signal` 的文件 SHALL 在文件顶部添加注释，说明 `signals` 是通过 `<script>` 标签加载的全局变量
3. THE `Factory.js` 中直接使用 `THREE.MathUtils`、`THREE.Matrix4` 等的代码 SHALL 添加对应的全局变量声明注释（因为 `Factory.js` 未 import THREE）
4. WHEN Plugin_Layer 中某文件同时存在 `import * as THREE from 'three'` 和直接使用全局 `THREE` 的情况时，THE 该文件 SHALL 统一为只使用 import 方式，消除混用
5. THE three-reference 属性测试 SHALL 在本需求完成后继续通过（plugin/ 中的 three.js 引用使用 bare specifier）

### 需求 4：标注 Object3D 扩展属性

**用户故事：** 作为开发者，我希望代码中对 `THREE.Object3D` 实例添加的非标准属性（`components`、`commands`、`events`）有明确的文档说明，以便 TypeScript 迁移时能够为这些扩展属性创建正确的类型声明。

#### 验收标准

1. THE Plugin_Layer 中所有读写 `object.components` 属性的位置 SHALL 在首次赋值处添加 JSDoc 注释，说明该属性是对 `THREE.Object3D` 的扩展，类型为组件对象数组
2. THE Plugin_Layer 中所有读写 `object.commands` 属性的位置 SHALL 在首次赋值处添加 JSDoc 注释，说明该属性是对 `THREE.Object3D` 的扩展，类型为命令对象数组
3. THE Plugin_Layer 中所有读写 `object.events` 属性的位置 SHALL 在首次赋值处添加 JSDoc 注释，说明该属性是对 `THREE.Object3D` 的扩展
4. THE `EditorPatches.js` 中初始化 `object.commands = []` 的位置 SHALL 包含 JSDoc 注释，说明这是 MRPP 对 Object3D 的扩展属性初始化
5. THE `MetaLoader.js` 中读取 `node.components` 和 `node.commands` 的位置 SHALL 包含 JSDoc 注释，说明这些是 MRPP 扩展属性

### 需求 5：tsconfig.json 配置准备

**用户故事：** 作为开发者，我希望在迁移开始前就准备好 `tsconfig.json`，并验证其配置对现有 JS 代码有效，以便迁移时可以立即启用类型检查，而不需要花时间调试配置。

#### 验收标准

1. THE 项目根目录 SHALL 包含一个 `tsconfig.json` 文件，配置 `"allowJs": true`、`"checkJs": false`（初始阶段不对 JS 文件强制类型检查）、`"strict": true`、`"target": "ES2022"`、`"module": "ESNext"`、`"moduleResolution": "bundler"`
2. THE `tsconfig.json` SHALL 配置 `"include": ["plugin/**/*"]`，将 Plugin_Layer 纳入编译范围
3. THE `tsconfig.json` SHALL 配置 `"noEmit": true`，仅用于类型检查，不生成输出文件（保持无构建工具约束）
4. THE `tsconfig.json` SHALL 配置 `"paths"` 或 `"baseUrl"`，使 `'three'` bare specifier 能够被 TypeScript 解析（对应 import map 中的 three.js 路径）
5. WHEN `tsconfig.json` 配置完成时，在 Plugin_Layer 的 `.js` 文件上运行 `tsc --noEmit` SHALL 不产生与配置本身相关的错误（允许存在因缺少类型注释导致的类型错误，但不允许模块解析错误）
6. THE `tsconfig.json` SHALL 包含注释（使用 `//` 或 `/* */`），说明每个关键配置项的用途和迁移策略

### 需求 6：测试配置更新以支持 TypeScript

**用户故事：** 作为开发者，我希望测试框架配置在迁移开始前就支持 `.ts` 文件，以便迁移后的 TypeScript 文件可以立即被测试覆盖，而不需要单独更新测试配置。

#### 验收标准

1. THE `three.js/editor/test/vitest.config.js` SHALL 更新 `include` 配置，在现有 `**/*.test.js` 和 `**/*.spec.js` 基础上增加 `**/*.test.ts` 和 `**/*.spec.ts`
2. THE `three.js/editor/test/vitest.config.js` SHALL 更新 `coverage.include` 配置，在现有 JS 路径基础上增加对应的 `.ts` 路径模式（`plugin/**/*.ts`）
3. THE `three.js/editor/test/package.json` SHALL 在 `devDependencies` 中添加 TypeScript 相关依赖：`typescript`（版本 5.x）
4. THE `three.js/editor/test/eslint.config.js` SHALL 更新 `files` 配置，在现有 `plugin/**/*.js` 基础上增加 `plugin/**/*.ts` 的支持规则（使用 `@typescript-eslint` 解析器）
5. WHEN 测试配置更新完成时，运行 `npm test` SHALL 继续通过现有的 4 个属性测试，不引入新的测试失败
6. WHERE TypeScript 支持已添加到 eslint 配置时，THE eslint 配置 SHALL 为 `.ts` 文件启用 `@typescript-eslint/no-explicit-any` 规则（warn 级别）

### 需求 7：no-typescript 属性测试反转

**用户故事：** 作为开发者，我希望将现有的 `no-typescript.test.js` 属性测试更新为验证迁移后的状态，以便该测试在 JS → TS 迁移完成后能够作为验收测试使用。

#### 验收标准

1. THE `three.js/editor/test/properties/no-typescript.test.js` SHALL 被重命名或替换为 `typescript-migration.test.js`（或在同文件中更新测试描述）
2. WHEN 准备阶段完成（所有文件仍为 `.js`）时，THE 更新后的测试 SHALL 包含一个"迁移前状态"测试用例，验证 `plugin/` 中当前不存在 `.ts` 文件（保持原有验证逻辑，作为基线）
3. THE 更新后的测试文件 SHALL 包含一个被跳过（`it.skip` 或 `describe.skip`）的"迁移后状态"测试用例，验证 `plugin/` 中存在 `.ts` 文件，该用例在实际迁移完成后启用
4. THE 更新后的测试文件 SHALL 包含注释，说明该测试在迁移前后的不同用途
5. WHEN 准备阶段完成时，THE 更新后的测试 SHALL 通过（迁移前状态验证通过，迁移后状态验证被跳过）

### 需求 8：现有属性测试全部保持通过

**用户故事：** 作为开发者，我希望所有准备工作完成后现有的属性测试继续通过，以便验证准备工作没有破坏代码的基本正确性。

#### 验收标准

1. WHEN 所有准备工作完成时，THE import-paths 属性测试 SHALL 通过（所有 import 路径指向存在的文件）
2. WHEN 所有准备工作完成时，THE i18n-completeness 属性测试 SHALL 通过（所有 MRPP 字符串在所有语言中存在且值正确）
3. WHEN 所有准备工作完成时，THE three-reference 属性测试 SHALL 通过（plugin/ 中的 three.js 引用使用 bare specifier）
4. WHEN 所有准备工作完成时，THE no-typescript（或更新后的 typescript-migration）属性测试 SHALL 通过
5. THE 准备工作 SHALL 不修改 `plugin/` 目录中任何文件的对外接口（export 的名称和签名保持不变），以确保 bootstrap 模块和其他调用方无需修改
