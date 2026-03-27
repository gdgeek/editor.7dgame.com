# 需求文档：plugin/ 目录 JS → TS 实际迁移

## 简介

本 spec 描述将 `plugin/` 目录中约 45 个 JavaScript 文件实际迁移为 TypeScript 文件的工作。前置准备工作（`js-to-ts-migration-prep` spec）已完成，包括：构造函数转 class 语法、JSDoc 类型注释、全局变量显式声明、Object3D 扩展属性标注、tsconfig.json 配置、测试配置更新。

迁移采用逐文件、分批次的策略，按依赖层级从底层（无依赖的工具类、组件类）向上层（Loader、Bootstrap）推进。每个文件的迁移包括：重命名 `.js` → `.ts`、将 JSDoc 类型注释转换为 TypeScript 原生类型标注、添加接口/类型定义、更新所有引用该文件的 import 路径。

**关键约束**：
- 无 bundler（无 webpack/vite/esbuild），使用浏览器原生 ES modules + import map
- 转译策略：纯 `tsc`（TypeScript 编译器），将 `plugin/` 中的 `.ts` 源文件编译为 `plugin-dist/` 中的 `.js` 文件，保持 1:1 目录结构
- `tsconfig.json` 当前配置 `noEmit: true`，迁移时需要调整为 `noEmit: false` + `outDir: "plugin-dist"`
- `.ts` 源文件中的 import 路径保持 `.js` 后缀（tsc 在 `moduleResolution: "bundler"` 下能正确解析 `.ts` 源文件但输出时保持 `.js` 后缀，浏览器加载编译产物时路径自然正确）
- HTML 入口文件的 import 路径指向 `plugin-dist/`（编译产物），而非 `plugin/`（源文件）
- 测试框架：vitest + fast-check，位于 `three.js/editor/test/`
- 现有属性测试必须在迁移过程中保持通过（或适当更新）

## 术语表

- **Plugin_Layer**：`plugin/` 目录中的所有 MRPP 自定义文件（约 45 个 JS 文件，迁移后为 TS 文件）
- **Migration_Batch**：一组可以同时迁移的文件，同一批次内的文件之间无循环依赖
- **Type_Declaration**：TypeScript 类型声明文件（`.d.ts`），用于为无法直接迁移的外部依赖提供类型信息
- **Interface**：TypeScript 接口定义，用于描述对象的结构（如 editor 实例、Object3D 扩展属性）
- **Import_Path**：ES module 的 import 语句中的模块路径（如 `'./MetaLoader.js'`）。迁移后 `.ts` 源文件中保持 `.js` 后缀（tsc 在 bundler 模式下正确解析），编译产物中路径不变
- **Transpile_Step**：使用 `tsc`（TypeScript 编译器）将 `.ts` 文件编译为浏览器可执行的 `.js` 文件，不引入其他转译工具
- **Output_Directory**：`tsc` 编译输出的目标目录 `plugin-dist/`，存放编译后的 `.js`、`.js.map`、`.d.ts` 文件
- **Source_Map**：将编译后的 `.js` 代码映射回原始 `.ts` 源码的文件（`.js.map`），用于调试
- **Object3D_Extension**：对 `THREE.Object3D` 实例添加的非标准属性（`components`、`commands`、`events`）
- **Bare_Specifier**：不以 `./`、`../` 或 `/` 开头的模块路径（如 `'three'`），通过 import map 解析
- **Global_Declaration**：TypeScript 全局类型声明（`declare global` 或 `.d.ts` 文件），用于描述通过 `<script>` 标签加载的全局变量（如 `THREE`、`signals`）

## 需求

### 需求 1：转译与构建策略

**用户故事：** 作为开发者，我希望使用纯 `tsc` 作为唯一的转译工具，将 `.ts` 源文件编译为浏览器可执行的 `.js` 文件，同时保持现有的无 bundler 约束。

#### 验收标准

1. THE tsconfig.json SHALL 更新 `noEmit` 为 `false`，并配置 `"outDir": "plugin-dist"`，使 `tsc` 将 Plugin_Layer 的 `.ts` 文件编译为 `.js` 文件输出到 `plugin-dist/` 目录
2. THE tsconfig.json SHALL 配置 `"declaration": true`，在 `plugin-dist/` 中同时生成 `.d.ts` 类型声明文件
3. THE tsconfig.json SHALL 配置 `"sourceMap": true`，生成 `.js.map` 文件以支持浏览器调试时映射回 `.ts` 源码
4. WHEN `tsc` 编译完成时，THE `plugin-dist/` 中的文件 SHALL 保持与 `plugin/` 相同的目录结构（即 `plugin-dist/mrpp/MetaLoader.js` 对应 `plugin/mrpp/MetaLoader.ts`）
5. THE HTML 入口文件（`meta-editor.html`、`verse-editor.html`）SHALL 更新 bootstrap import 路径，从 `../../plugin/bootstrap/xxx.js` 改为 `../../plugin-dist/bootstrap/xxx.js`
6. THE 项目根目录 SHALL 包含 `package.json`，其中定义 npm script `"build": "tsc -p tsconfig.json"` 和 `"typecheck": "tsc --noEmit -p tsconfig.json"`
7. THE `.gitignore` SHALL 添加 `plugin-dist/`（编译产物不提交到版本控制）
8. THE `.dockerignore` SHALL 不排除 `plugin-dist/`（Docker 构建需要包含编译产物）
9. THE Dockerfile SHALL 在 COPY 之前或之后不需要额外的构建步骤（CI/CD 流程中先运行 `npm run build`，再构建 Docker 镜像）

### 需求 2：共享类型定义文件

**用户故事：** 作为开发者，我希望有一组共享的 TypeScript 类型定义，描述 editor 实例、Object3D 扩展属性、全局变量等跨文件使用的类型，以便迁移后的 `.ts` 文件可以引用统一的类型定义，避免重复声明。

#### 验收标准

1. THE Plugin_Layer SHALL 包含一个类型定义文件（如 `plugin/types/mrpp.d.ts`），定义 Object3D_Extension 的类型接口（`components`、`commands`、`events` 属性）
2. THE 类型定义文件 SHALL 定义 `MrppObject3D` 接口（或使用 `declare module` 扩展 `THREE.Object3D`），包含 `components: MrppComponent[]` 和 `commands: MrppCommand[]` 属性
3. THE 类型定义文件 SHALL 定义 `MrppScene` 接口（或扩展 `THREE.Scene`），包含 `events: { inputs: MrppEventIO[], outputs: MrppEventIO[] }` 属性
4. THE 类型定义文件 SHALL 定义 `MrppEditor` 接口，描述 editor 实例的扩展属性和方法（`type`、`resources`、`access`、`metaLoader`、`verseLoader`、`save()`、`showNotification()` 等）
5. THE 类型定义文件 SHALL 包含全局变量声明，为通过 `<script>` 标签加载的 `signals` 库提供类型定义（`declare const signals: { Signal: new () => Signal }`）
6. WHEN Plugin_Layer 中的文件使用全局 `THREE` 变量（未通过 import 导入）时，THE 类型定义文件 SHALL 提供 `declare const THREE: typeof import('three')` 全局声明
7. THE tsconfig.json 的 `include` SHALL 包含类型定义文件的路径（如 `plugin/types/**/*.d.ts`）

### 需求 3：第一批迁移 — 无依赖的底层文件

**用户故事：** 作为开发者，我希望先迁移不依赖其他 Plugin_Layer 文件的底层模块（工具类、组件类、命令类），以便建立迁移模式并验证转译流程。

#### 验收标准

1. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`DialogUtils.js`、`TextUtils.js`、`WebpUtils.js`、`ScreenshotUtils.js`、`GlobalShortcuts.js`、`UnsavedEntityGuard.js`
2. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`ActionComponent.js`、`MovedComponent.js`、`RotateComponent.js`、`TooltipComponent.js`、`TriggerComponent.js`
3. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`GestureCommand.js`、`VoiceCommand.js`
4. WHEN 每个文件迁移为 `.ts` 时，THE 文件中的 JSDoc 类型注释 SHALL 转换为 TypeScript 原生类型标注（函数参数类型、返回值类型、变量类型）
5. WHEN 每个文件迁移为 `.ts` 时，THE 文件 SHALL 通过 `tsc --noEmit` 检查，不产生类型错误
6. THE 迁移后的 `.ts` 文件 SHALL 保持与原 `.js` 文件完全相同的 export 名称和签名

### 需求 4：第二批迁移 — 中间层文件

**用户故事：** 作为开发者，我希望在底层文件迁移完成后，迁移依赖底层文件的中间层模块（容器类、工厂类、命令类），逐步扩大 TypeScript 覆盖范围。

#### 验收标准

1. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`ComponentContainer.js`、`CommandContainer.js`、`EventContainer.js`
2. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`Factory.js`、`MetaFactory.js`、`VerseFactory.js`、`Builder.js`
3. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`AddCommandCommand.js`、`AddComponentCommand.js`、`AddEventCommand.js`、`RemoveCommandCommand.js`、`RemoveComponentCommand.js`、`RemoveEventCommand.js`、`SetCommandValueCommand.js`、`SetComponentValueCommand.js`、`SetEventValueCommand.js`、`MoveMultipleObjectsCommand.js`、`MultiTransformCommand.js`
4. THE `Access.js` SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注
5. THE `MrppStrings.js` SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注
6. WHEN 中间层文件引用已迁移的底层 `.ts` 文件时，THE import 路径 SHALL 保持 `.js` 后缀不变（tsc bundler 模式自动解析）
7. WHEN 每个文件迁移为 `.ts` 时，THE 文件 SHALL 通过 `tsc --noEmit` 检查，不产生类型错误

### 需求 5：第三批迁移 — 上层文件

**用户故事：** 作为开发者，我希望在中间层文件迁移完成后，迁移上层模块（Loader、Patches、UI 组件、Bootstrap），完成整个 Plugin_Layer 的 TypeScript 迁移。

#### 验收标准

1. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`MetaLoader.js`、`VerseLoader.js`、`EditorLoader.js`
2. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`EditorPatches.js`、`LoaderPatches.js`、`MenubarPatches.js`、`SidebarPatches.js`、`UIThreePatches.js`、`ViewportPatches.js`
3. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：所有 `plugin/ui/sidebar/Sidebar.*.js` 文件（11 个）和所有 `plugin/ui/menubar/Menubar.*.js` 文件（9 个）
4. THE 以下文件 SHALL 从 `.js` 重命名为 `.ts` 并添加 TypeScript 类型标注：`meta-bootstrap.js`、`verse-bootstrap.js`
5. WHEN Sidebar 和 Menubar 工厂函数迁移为 `.ts` 时，THE 函数参数和返回值 SHALL 添加 TypeScript 类型标注（参数 `editor: MrppEditor`，返回值为包含 `container` 和可选 `update` 方法的对象类型）
6. WHEN `EditorPatches.js` 迁移为 `.ts` 时，THE 全局 `signals` 变量 SHALL 使用类型定义文件中的全局声明，移除 `/* global signals */` 注释
7. WHEN 使用全局 `THREE` 的文件迁移为 `.ts` 时，THE 全局 `THREE` 引用 SHALL 使用类型定义文件中的全局声明，移除 `/* global THREE */` 和 JSDoc 全局声明注释
8. WHEN 每个文件迁移为 `.ts` 时，THE 文件 SHALL 通过 `tsc --noEmit` 检查，不产生类型错误

### 需求 6：Import 路径更新

**用户故事：** 作为开发者，我希望所有 import 路径在迁移过程中保持正确，确保模块之间的引用关系不被破坏。

#### 验收标准

1. WHEN 一个文件从 `.js` 迁移为 `.ts` 时，THE `.ts` 源文件中的 import 路径 SHALL 保持 `.js` 后缀不变（如 `import { MetaLoader } from '../mrpp/MetaLoader.js'`），因为 tsc 在 `moduleResolution: "bundler"` 下能正确解析 `.ts` 源文件，且编译产物中路径自然指向 `.js` 文件
2. WHEN Plugin_Layer 内部文件互相引用时，THE import 路径的相对层级 SHALL 保持正确（遵循 import-path-conventions 规则）
3. WHEN Plugin_Layer 文件引用 `three.js/editor/js/` 中的文件时，THE import 路径 SHALL 保持不变（这些文件不在迁移范围内）
4. THE HTML 入口文件中的 bootstrap import 路径 SHALL 指向 `../../plugin-dist/bootstrap/xxx.js`（编译产物）
5. WHEN 迁移完成时，THE import-paths 属性测试 SHALL 通过（所有 import 路径指向存在的文件）

### 需求 7：TypeScript 严格模式合规

**用户故事：** 作为开发者，我希望迁移后的 TypeScript 文件在 `strict: true` 模式下通过类型检查，确保代码质量和类型安全。

#### 验收标准

1. THE 迁移后的所有 `.ts` 文件 SHALL 在 `tsconfig.json` 的 `strict: true` 配置下通过 `tsc --noEmit` 检查，不产生类型错误
2. THE 迁移后的 `.ts` 文件 SHALL 不使用 `any` 类型，除非在以下情况：（a）与 three.js editor 的动态 API 交互时，（b）JSON 数据解析结果，（c）第三方库缺少类型定义时
3. WHEN 使用 `any` 类型时，THE 代码 SHALL 添加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 注释或等效的抑制注释，并附带说明使用 `any` 的原因
4. THE 迁移后的 `.ts` 文件 SHALL 不使用 `@ts-ignore` 或 `@ts-expect-error` 注释，除非有明确的技术原因并附带说明
5. WHEN Object3D_Extension 属性被访问时，THE 代码 SHALL 使用类型断言（如 `(object as MrppObject3D).components`）或类型守卫，而非直接访问未声明的属性

### 需求 8：tsconfig 迁移完成配置

**用户故事：** 作为开发者，我希望在所有文件迁移完成后，tsconfig.json 的配置反映最终状态，启用完整的类型检查。

#### 验收标准

1. WHEN 所有 Plugin_Layer 文件迁移完成时，THE tsconfig.json SHALL 更新 `checkJs` 为 `true`（如果仍有 `.js` 文件残留）或移除该选项（如果所有文件已迁移为 `.ts`）
2. WHEN 所有 Plugin_Layer 文件迁移完成时，THE tsconfig.json 的 `include` SHALL 更新为 `["plugin/**/*.ts", "plugin/types/**/*.d.ts"]`
3. WHEN `tsc` 以最终配置运行时，THE 编译 SHALL 成功完成，不产生任何错误
4. THE tsconfig.json SHALL 移除 `allowJs: true` 配置（因为所有文件已迁移为 `.ts`，不再需要处理 `.js` 文件）

### 需求 9：测试更新与验证

**用户故事：** 作为开发者，我希望迁移过程中和迁移完成后，所有属性测试保持通过或适当更新，确保迁移没有破坏代码的正确性。

#### 验收标准

1. WHEN 迁移完成时，THE `typescript-migration.test.js` 中的"迁移前状态"测试 SHALL 被移除或跳过，"迁移后状态"测试 SHALL 被启用（移除 `describe.skip`）
2. WHEN 迁移完成时，THE import-paths 属性测试 SHALL 更新以支持 `.ts` 文件扩展名的 import 路径检测
3. WHEN 迁移完成时，THE three-reference 属性测试 SHALL 更新以扫描 `.ts` 文件（而非仅 `.js` 文件）
4. WHEN 迁移完成时，THE i18n-completeness 属性测试 SHALL 更新以处理 `MrppStrings.ts`（而非 `MrppStrings.js`）
5. WHEN 每个 Migration_Batch 完成时，THE 运行 `npm test` SHALL 通过所有属性测试（允许在批次迁移过程中临时更新测试以适应 `.js` 和 `.ts` 混合状态）
6. THE 迁移完成后 SHALL 运行 `tsc --noEmit` 验证所有 `.ts` 文件无类型错误

### 需求 10：迁移过程中的渐进兼容

**用户故事：** 作为开发者，我希望迁移过程中 `.js` 和 `.ts` 文件可以共存，每个批次迁移完成后系统仍然可以正常运行。

#### 验收标准

1. WHILE 迁移过程中 `.js` 和 `.ts` 文件共存时，THE tsconfig.json SHALL 保持 `allowJs: true` 配置，确保 TypeScript 编译器能同时处理两种文件
2. WHILE 迁移过程中 `.js` 和 `.ts` 文件共存时，THE 已迁移的 `.ts` 文件 SHALL 能够 import 尚未迁移的 `.js` 文件，反之亦然
3. WHEN 一个 Migration_Batch 完成时，THE `tsc -p tsconfig.json` 编译 SHALL 成功完成，`plugin-dist/` 中的编译产物可被浏览器正常加载（允许来自未迁移 `.js` 文件的类型推断警告，但不允许编译错误）
4. THE 迁移过程 SHALL 不修改 `three.js/editor/js/` 目录中的任何文件（这些文件不在迁移范围内）
