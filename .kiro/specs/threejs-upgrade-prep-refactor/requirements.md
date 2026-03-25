# 需求文档：Three.js 升级前期重构准备

## 简介

GDGeek Editor 基于 three.js r140 Editor 深度定制，已完成 MRPP 代码分离（spec: mrpp-code-separation），将 45 个 MRPP 业务文件迁移到 `plugin/` 目录。但 12 个 three.js editor 原版文件中仍有 77 处侵入式 MRPP 修改标记（`// --- MRPP MODIFICATION START/END ---`），直接修改了原版代码内部逻辑。

本次重构的目标是：将这些侵入式修改转变为非侵入式或低侵入式的方式（wrapper、monkey-patch、事件钩子、plugin 注册等），使升级 three.js 时可以尽量直接替换原版文件，然后只需重新连接 plugin 层。

**核心原则**：
- 减少原版文件中的 MRPP 修改行数，降低升级时的合并冲突
- 功能表现与重构前完全一致
- 保持纯 JavaScript、无构建工具、浏览器原生 ES modules
- 不做 three.js 版本升级（保持 r140）

## 术语表

- **Editor**：three.js r140 自带的 3D 编辑器应用，位于 `three.js/editor/` 目录
- **MRPP**：Meta Reality Presentation Platform，本项目的自定义业务逻辑总称
- **Original_File**：three.js r140 Editor 自带的原版 JavaScript 文件
- **Invasive_Modification**：在 Original_File 中为支持 MRPP 功能而添加或修改的代码段，以 `// --- MRPP MODIFICATION START/END ---` 标记
- **Plugin_Layer**：`plugin/` 目录中的所有 MRPP 自定义代码
- **Editor_Plugin_System**：本次重构引入的插件注册机制，允许 Plugin_Layer 通过 API 向 Editor 注册扩展，而非直接修改 Original_File
- **Bootstrap_Module**：`plugin/bootstrap/` 中的初始化模块（meta-bootstrap.js、verse-bootstrap.js）
- **Wrapper_Pattern**：用一个包装函数/类包裹原版模块，在外部添加扩展逻辑，不修改原版代码内部
- **Monkey_Patch**：在运行时动态修改已有对象的方法或属性，在 Bootstrap_Module 中执行

## 需求

### 需求 1：Editor.js 信号与属性扩展外部化

**用户故事：** 作为开发者，我希望 Editor.js 中的 MRPP 自定义信号和属性通过外部注册方式添加，以便升级 three.js 时 Editor.js 可以直接替换为新版本。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过运行时赋值方式向 editor.signals 对象添加所有 MRPP 自定义信号（upload、release、savingStarted、savingFinished、objectsChanged、componentAdded、componentChanged、componentRemoved、eventAdded、eventChanged、eventRemoved、commandAdded、commandChanged、commandRemoved、showGroundChanged、messageSend、messageReceive、notificationAdded、doneLoadObject、multipleObjectsTransformChanged），而非在 Editor.js 构造函数中硬编码
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过运行时赋值方式向 editor 对象添加所有 MRPP 自定义属性（type、resources、selectedObjects、access、multiSelectGroup），而非在 Editor.js 构造函数中硬编码
3. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过运行时赋值方式向 editor 对象添加所有 MRPP 自定义方法（save、showNotification、showConfirmation、getSelectedObjects、clearSelection），而非在 Editor.prototype 中硬编码
4. WHEN 重构完成时，THE Editor.js SHALL 不包含任何 MRPP 自定义信号定义、MRPP 自定义属性初始化或 MRPP 自定义方法定义的代码
5. IF Editor.js 中存在无法外部化的 MRPP 修改（如 addObject 方法中的 commands 初始化和 parent/index 参数支持），THEN THE Editor.js SHALL 仅保留这些最小必要修改，并保持 MRPP 标记注释

### 需求 2：Editor.js 语言映射与 DialogUtils/Access 导入外部化

**用户故事：** 作为开发者，我希望 Editor.js 中的语言映射逻辑和 MRPP 模块导入移到 Bootstrap_Module 中，以便 Editor.js 不再依赖 plugin/ 目录。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 执行 URL 参数语言映射逻辑（将 zh-CN 映射为 zh-cn 等），并通过 `editor.config.setKey('language', ...)` 设置语言，而非在 Editor.js 模块顶层执行
2. WHEN 重构完成时，THE Editor.js SHALL 不包含 `import { DialogUtils }` 和 `import { Access }` 语句
3. WHEN 重构完成时，THE Editor.js SHALL 不包含语言映射常量和 URL 参数解析代码

### 需求 3：Editor.js addObject/removeObject/select 方法扩展外部化

**用户故事：** 作为开发者，我希望 Editor.js 中 addObject、removeObject、select 等方法的 MRPP 扩展逻辑通过 monkey-patch 方式在 Bootstrap_Module 中应用，以便 Editor.js 的这些方法保持原版实现。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.addObject 方法，添加 commands 数组初始化、parent/index 参数支持、资源同步逻辑，同时保留原版 addObject 的核心行为
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.removeObject 方法，添加从 selectedObjects 数组中移除对象的逻辑
3. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.select 方法，添加多选（multiSelect）支持逻辑
4. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.clear 方法，添加 selectedObjects 清空逻辑
5. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.setScene 方法，添加 commands 数组初始化遍历逻辑
6. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.fromJSON 方法，添加 resources 保存逻辑
7. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.toJSON 方法，添加 resources 字段到输出
8. WHEN 重构完成时，THE Editor.js 中的 addObject、removeObject、select、clear、setScene、fromJSON、toJSON 方法 SHALL 恢复为 three.js r140 原版实现，不包含任何 MRPP 修改

### 需求 4：Sidebar.js 面板注册外部化

**用户故事：** 作为开发者，我希望 Sidebar.js 中的 MRPP 自定义面板通过外部注册方式添加，以便 Sidebar.js 可以直接替换为新版本。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 在 Sidebar 构建完成后，通过 DOM 操作或 Sidebar API 动态添加 MRPP 自定义面板（Events、Screenshot 等），而非在 Sidebar.js 中硬编码 import 和条件分支
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 动态设置 Sidebar 的层级标签（getHierarchyLabel 逻辑），而非在 Sidebar.js 中硬编码
3. WHEN 重构完成时，THE Sidebar.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
4. WHEN 重构完成时，THE Sidebar.js SHALL 不包含 editor.type 条件分支或 getHierarchyLabel 函数

### 需求 5：Sidebar.Properties.js 面板注册外部化

**用户故事：** 作为开发者，我希望 Sidebar.Properties.js 中的 MRPP 自定义属性面板通过外部注册方式添加，以便该文件可以直接替换为新版本。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过外部方式注册 MRPP 自定义属性面板（MultipleObjects、Component、Command、Text、Animation），而非在 Sidebar.Properties.js 中硬编码 import 和条件逻辑
2. WHEN 重构完成时，THE Sidebar.Properties.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
3. WHEN 重构完成时，THE Sidebar.Properties.js SHALL 恢复为 three.js r140 原版实现

### 需求 6：Menubar.js 菜单注册外部化

**用户故事：** 作为开发者，我希望 Menubar.js 中的 MRPP 自定义菜单通过外部注册方式添加，以便 Menubar.js 可以直接替换为新版本。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 在 Menubar 构建完成后，通过 DOM 操作动态添加 MRPP 自定义菜单项（Screenshot/Scene、Goto 等），而非在 Menubar.js 中硬编码 import 和条件分支
2. WHEN 重构完成时，THE Menubar.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
3. WHEN 重构完成时，THE Menubar.js SHALL 不包含 editor.type 条件分支

### 需求 7：Menubar.Add.js 资源菜单外部化

**用户故事：** 作为开发者，我希望 Menubar.Add.js 中的 MRPP 资源类型菜单逻辑移到 Plugin_Layer 中，以便 Menubar.Add.js 可以直接替换为新版本。

#### 验收标准

1. THE Plugin_Layer SHALL 包含一个独立的 MRPP 资源菜单模块（如 `plugin/ui/menubar/Menubar.MrppAdd.js`），封装所有 Meta/Verse 模式下的资源类型菜单项创建、loadResource、loadPhototype、messageReceive 处理等逻辑
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 在 Menubar.Add 构建完成后，通过 DOM 操作将 MRPP 资源菜单项插入到 Add 菜单中
3. WHEN 重构完成时，THE Menubar.Add.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
4. WHEN 重构完成时，THE Menubar.Add.js SHALL 不包含 editor.type 条件分支、MetaFactory/Builder 实例化、loadResource 函数等 MRPP 逻辑

### 需求 8：Menubar.Edit.js 克隆/替换/删除逻辑外部化

**用户故事：** 作为开发者，我希望 Menubar.Edit.js 中的 MRPP 扩展逻辑（多选克隆、资源替换、多选删除、复制粘贴）移到 Plugin_Layer 中，以便 Menubar.Edit.js 可以直接替换为新版本。

#### 验收标准

1. THE Plugin_Layer SHALL 包含一个独立的 MRPP 编辑菜单扩展模块，封装多选克隆（含 components/commands 复制）、资源替换（replace-resource 消息处理）、多选删除、Ctrl+C/V 复制粘贴等逻辑
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 在 Menubar.Edit 构建完成后，通过 DOM 操作和信号监听方式注入 MRPP 编辑功能
3. WHEN 重构完成时，THE Menubar.Edit.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
4. WHEN 重构完成时，THE Menubar.Edit.js SHALL 恢复为 three.js r140 原版实现

### 需求 9：Sidebar.Object.js MRPP 扩展外部化

**用户故事：** 作为开发者，我希望 Sidebar.Object.js 中的 MRPP 扩展逻辑（变换复制粘贴、重置按钮、媒体控制、sortingOrder、类型本地化、编辑实体按钮、Access 权限检查）移到 Plugin_Layer 中，以便 Sidebar.Object.js 可以直接替换为新版本。

#### 验收标准

1. THE Plugin_Layer SHALL 包含一个独立的 MRPP 对象面板扩展模块，封装变换数据复制粘贴 UI、重置位置/旋转/缩放按钮、悬停边框效果、媒体 loop 控制、sortingOrder 选择器、对象类型本地化（getLocalizedObjectType）、编辑实体按钮、Access 权限检查等逻辑
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 或信号监听方式将 MRPP 对象面板扩展注入到 Sidebar.Object 中
3. WHEN 重构完成时，THE Sidebar.Object.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
4. WHEN 重构完成时，THE Sidebar.Object.js 中的 MRPP 修改行数 SHALL 大幅减少（目标：从 22 处降至 5 处以内，仅保留无法外部化的最小钩子）

### 需求 10：Loader.js KTX2 扩展外部化

**用户故事：** 作为开发者，我希望 Loader.js 中的 KTX2 加载支持通过外部方式注入，以便 Loader.js 可以直接替换为新版本。

#### 验收标准

1. THE Plugin_Layer SHALL 包含一个独立的 KTX2 加载扩展模块，封装 KTX2Loader 的懒初始化、ensureKTX2 函数、以及在 GLTFLoader 上设置 KTX2Loader 的逻辑
2. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式扩展 editor.loader 的 loadFiles 和 loadFile 方法，在加载 glb/gltf/ktx2 文件时自动初始化 KTX2 支持
3. WHEN 重构完成时，THE Loader.js SHALL 不包含 KTX2Loader 的 import 语句和 ensureKTX2 函数
4. WHEN 重构完成时，THE Loader.js SHALL 恢复为 three.js r140 原版实现（或仅保留最小必要钩子）

### 需求 11：Strings.js MRPP 字符串合并保持现有方式

**用户故事：** 作为开发者，我理解 Strings.js 中的 MRPP 字符串合并（spread 运算符）是当前最简洁的方式，升级时只需重新添加 import 和 spread 行即可。

#### 验收标准

1. THE Strings.js SHALL 保持现有的 MRPP 字符串合并方式（import mrppStrings + spread 运算符），不做进一步重构
2. THE Strings.js 中的 MRPP 修改 SHALL 保持为 6 处标记（1 处 import + 5 处 spread），这是该文件的最小侵入方式

### 需求 12：Commands.js 注册表保持现有方式

**用户故事：** 作为开发者，我理解 Commands.js 中的 MRPP 命令 re-export 是当前最简洁的方式，升级时只需重新添加 export 行即可。

#### 验收标准

1. THE Commands.js SHALL 保持现有的 MRPP 命令 re-export 方式，不做进一步重构
2. THE Commands.js 中的 MRPP 修改 SHALL 保持为 1 处标记（包含 11 个 export 语句）

### 需求 13：ui.three.js MoveMultipleObjectsCommand 导入外部化

**用户故事：** 作为开发者，我希望 ui.three.js 中的 MRPP 命令导入通过外部方式注入，以便该文件可以直接替换为新版本。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 方式将 MoveMultipleObjectsCommand 注入到 UIOutliner 的拖拽处理逻辑中，而非在 ui.three.js 中硬编码 import
2. WHEN 重构完成时，THE ui.three.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录

### 需求 14：Viewport.js MultiTransformCommand 导入外部化

**用户故事：** 作为开发者，我希望 Viewport.js 中的 MRPP 命令导入和多选变换逻辑通过外部方式注入，以便 Viewport.js 可以直接替换为新版本。

#### 验收标准

1. WHEN Bootstrap_Module 初始化时，THE Bootstrap_Module SHALL 通过 monkey-patch 或信号监听方式将多选变换逻辑（MultiTransformCommand 使用、multiSelectGroup 管理、多选包围盒计算）注入到 Viewport 中
2. WHEN 重构完成时，THE Viewport.js SHALL 不包含任何 `import` 语句指向 `plugin/` 目录
3. WHEN 重构完成时，THE Viewport.js 中的多选相关 MRPP 修改 SHALL 大幅减少

### 需求 15：功能完整性保证

**用户故事：** 作为开发者，我希望重构后编辑器的所有功能表现与重构前完全一致。

#### 验收标准

1. WHEN 通过 `node server.js` 启动服务后访问 `meta-editor.html` 时，THE Editor SHALL 正常加载 Meta 编辑模式，所有功能正常工作
2. WHEN 通过 `node server.js` 启动服务后访问 `verse-editor.html` 时，THE Editor SHALL 正常加载 Verse 编辑模式，所有功能正常工作
3. THE Editor SHALL 保持 three.js r140 版本不变
4. THE Editor SHALL 保持所有 JavaScript 文件使用 JavaScript 语言
5. THE Editor SHALL 不引入新的构建工具或包管理器

### 需求 16：升级友好度量化目标

**用户故事：** 作为开发者，我希望重构后原版文件中的 MRPP 修改数量显著减少，以便量化升级难度的降低。

#### 验收标准

1. WHEN 重构完成时，THE Editor 中 12 个原版文件的 MRPP 修改标记总数 SHALL 从 77 处降至 20 处以内
2. WHEN 重构完成时，以下文件 SHALL 不包含任何 MRPP 修改标记：Sidebar.js、Menubar.js、Sidebar.Properties.js、Menubar.Edit.js（可直接替换为新版本）
3. WHEN 重构完成时，以下文件的 MRPP 修改标记 SHALL 降至最小：Editor.js（目标 0-2 处）、Sidebar.Object.js（目标 0-5 处）、Menubar.Add.js（目标 0 处）、Loader.js（目标 0 处）、Viewport.js（目标 0 处）、ui.three.js（目标 0 处）
4. WHEN 重构完成时，仅 Strings.js（6 处）和 Commands.js（1 处）SHALL 保持现有的最小侵入式修改

### 需求 17：现有属性测试保持通过

**用户故事：** 作为开发者，我希望重构后现有的 4 个属性测试继续通过，以便验证重构没有破坏基本正确性。

#### 验收标准

1. WHEN 重构完成时，THE import-paths 属性测试 SHALL 通过（所有 import 路径指向存在的文件）
2. WHEN 重构完成时，THE i18n-completeness 属性测试 SHALL 通过（所有 MRPP 字符串在所有语言中存在且值正确）
3. WHEN 重构完成时，THE three-reference 属性测试 SHALL 通过（plugin/ 中的 three.js 引用使用 bare specifier）
4. WHEN 重构完成时，THE no-typescript 属性测试 SHALL 通过（plugin/ 中无 TypeScript 文件）
