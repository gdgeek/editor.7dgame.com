# 需求文档：MRPP 业务代码与 Three.js Editor 结构分离

## 简介

GDGeek Editor 是一个基于 three.js r140 Editor 深度定制的 3D 元宇宙场景编辑器，支持 Meta（实体编辑）和 Verse（场景编辑）两种模式。当前项目中，MRPP 自定义业务代码与 three.js Editor 原版源码高度耦合，散布在 `three.js/editor/js/` 目录下，导致未来升级 three.js 版本时难以区分原版代码与自定义代码。

本次重构的目标是：将所有 MRPP 自定义业务代码从 three.js Editor 源码中分离出来，迁移到独立的 `plugin/` 目录，使 Editor 原版文件尽量保持干净，方便未来升级。

**关键约束**：只做结构分离，不做 three.js 升级、不做 TypeScript 迁移、不引入新的构建工具或包管理器，所有文件保持 JavaScript，功能表现与重构前完全一致。

## 术语表

- **Editor**：three.js r140 自带的 3D 编辑器应用，位于 `three.js/editor/` 目录
- **MRPP**：Meta Reality Presentation Platform，本项目的自定义业务逻辑总称
- **Plugin_Directory**：重构后存放所有 MRPP 自定义代码的顶层目录 `plugin/`
- **Meta_Mode**：实体编辑模式，入口为 `meta-editor.html`
- **Verse_Mode**：场景编辑模式，入口为 `verse-editor.html`
- **Original_File**：three.js r140 Editor 自带的原版 JavaScript 文件
- **Custom_File**：GDGeek 项目完全新增的 JavaScript 文件（非 three.js 原版）
- **Invasive_Modification**：在 Original_File 中为支持 MRPP 功能而添加或修改的代码段
- **Import_Path**：JavaScript ES Module 中 `import` 语句的模块路径
- **Static_Server**：项目使用的 `server.js` 静态文件服务器，通过 `node server.js` 启动
- **Inline_Logic**：HTML 入口文件中 `<script type="module">` 标签内的内联 JavaScript 业务逻辑

## 需求

### 需求 1：创建 Plugin 目录结构

**用户故事：** 作为开发者，我希望所有 MRPP 自定义代码集中在一个独立的 `plugin/` 目录中，以便清晰区分自定义代码与 three.js 原版代码。

#### 验收标准

1. THE Plugin_Directory SHALL 在项目根目录下创建 `plugin/` 目录，包含以下子目录：`mrpp/`、`utils/`、`ui/sidebar/`、`ui/menubar/`、`commands/`、`access/`、`i18n/`
2. THE Plugin_Directory SHALL 保留与源目录相同的内部子目录结构（例如 `mrpp/components/`、`mrpp/commands/`）

### 需求 2：迁移核心业务逻辑模块

**用户故事：** 作为开发者，我希望 MRPP 核心业务逻辑从 `three.js/editor/js/mrpp/` 迁移到 `plugin/mrpp/`，以便 Editor 原版目录不包含业务代码。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/mrpp/` 中包含以下文件：Builder.js、CommandContainer.js、ComponentContainer.js、EditorLoader.js、EventContainer.js、Factory.js、MetaFactory.js、MetaLoader.js、VerseFactory.js、VerseLoader.js
2. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/mrpp/components/` 中包含以下文件：ActionComponent.js、MovedComponent.js、RotateComponent.js、TooltipComponent.js、TriggerComponent.js
3. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/mrpp/commands/` 中包含以下文件：GestureCommand.js、VoiceCommand.js
4. WHEN 重构完成时，THE Editor SHALL 不再在 `three.js/editor/js/mrpp/` 目录中包含任何文件（该目录应被删除）

### 需求 3：迁移工具函数模块

**用户故事：** 作为开发者，我希望自定义工具函数从 `three.js/editor/js/utils/` 迁移到 `plugin/utils/`，以便 Editor 原版目录不包含自定义工具代码。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/utils/` 中包含以下文件：DialogUtils.js、ScreenshotUtils.js、TextUtils.js、WebpUtils.js、GlobalShortcuts.js、UnsavedEntityGuard.js、screenshot.mp3
2. WHEN 重构完成时，THE Editor SHALL 不再在 `three.js/editor/js/utils/` 目录中包含任何文件（该目录应被删除）

### 需求 4：迁移自定义 Sidebar 面板

**用户故事：** 作为开发者，我希望 MRPP 自定义的 Sidebar 面板文件迁移到 `plugin/ui/sidebar/`，以便与 Editor 原版 Sidebar 文件区分开。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/ui/sidebar/` 中包含以下文件：Sidebar.Component.js、Sidebar.Command.js、Sidebar.Meta.js、Sidebar.Media.js、Sidebar.Screenshot.js、Sidebar.Text.js、Sidebar.MultipleObjects.js、Sidebar.Events.js、Sidebar.Animation.js、Sidebar.Blockly.js
2. WHEN 重构完成时，THE Editor SHALL 不再在 `three.js/editor/js/` 目录中包含上述自定义 Sidebar 文件

### 需求 5：迁移自定义 Menubar 文件

**用户故事：** 作为开发者，我希望 MRPP 自定义的 Menubar 文件迁移到 `plugin/ui/menubar/`，以便与 Editor 原版 Menubar 文件区分开。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/ui/menubar/` 中包含以下文件：Menubar.Component.js、Menubar.Command.js、Menubar.Replace.js、Menubar.Goto.js、Menubar.Screenshot.js、Menubar.Scene.js
2. WHEN 重构完成时，THE Editor SHALL 不再在 `three.js/editor/js/` 目录中包含上述自定义 Menubar 文件

### 需求 6：迁移自定义 Commands 文件

**用户故事：** 作为开发者，我希望 MRPP 自定义的 undo/redo 命令文件迁移到 `plugin/commands/`，以便与 Editor 原版命令文件区分开。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/commands/` 中包含以下文件：AddComponentCommand.js、RemoveComponentCommand.js、SetComponentValueCommand.js、AddCommandCommand.js、RemoveCommandCommand.js、SetCommandValueCommand.js、AddEventCommand.js、RemoveEventCommand.js、SetEventValueCommand.js、MoveMultipleObjectsCommand.js、MultiTransformCommand.js
2. WHEN 重构完成时，THE Editor SHALL 不再在 `three.js/editor/js/commands/` 目录中包含上述自定义命令文件
3. WHEN 重构完成时，THE Editor 中的 `Commands.js` 注册表文件 SHALL 更新 import 路径，指向 `plugin/commands/` 中的新位置

### 需求 7：迁移权限模块

**用户故事：** 作为开发者，我希望权限管理模块 Access.js 迁移到 `plugin/access/`，以便与 Editor 原版代码区分开。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/access/` 中包含 Access.js 文件
2. WHEN 重构完成时，THE Editor SHALL 不再在 `three.js/editor/js/` 目录中包含 Access.js 文件

### 需求 8：提取 MRPP 国际化字符串

**用户故事：** 作为开发者，我希望 MRPP 特有的 i18n 字符串从 Strings.js 中提取到独立文件，以便 Strings.js 尽量保持原版内容。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 在 `plugin/i18n/` 中包含一个独立的 JavaScript 文件，导出所有 MRPP 特有的国际化字符串（包括组件、指令、事件、截图、媒体、实体、替换菜单、文本面板等相关字符串）
2. WHEN 重构完成时，THE Editor 中的 Strings.js SHALL 通过 import 引入 `plugin/i18n/` 中的 MRPP 字符串，并将其合并到各语言的字符串表中
3. THE Editor 中的 Strings.js SHALL 保留 three.js Editor 原版字符串不变
4. WHEN 调用 `strings.getKey()` 查询任意 MRPP 字符串键时，THE Strings 模块 SHALL 返回与重构前完全相同的值


### 需求 9：更新所有 Import 路径

**用户故事：** 作为开发者，我希望所有受文件迁移影响的 import 路径都被正确更新，以便模块引用在运行时不会出错。

#### 验收标准

1. WHEN 文件从 `three.js/editor/js/` 迁移到 `plugin/` 后，THE Editor 中所有引用被迁移文件的 import 语句 SHALL 更新为指向 `plugin/` 中的新路径
2. WHEN 被迁移文件内部互相引用时，THE Plugin_Directory 中的文件 SHALL 更新 import 路径以反映新的相对位置
3. WHEN 被迁移文件引用 three.js Editor 原版模块时（如 `libs/ui.js`、`Command.js`），THE Plugin_Directory 中的文件 SHALL 使用正确的相对路径指向 `three.js/editor/js/` 中的原版文件
4. WHEN 被迁移文件引用 three.js 核心库时，THE Plugin_Directory 中的文件 SHALL 继续通过 import map 中定义的 `'three'` 标识符引用 three.js

### 需求 10：更新 HTML 入口文件

**用户故事：** 作为开发者，我希望 HTML 入口文件中的 import 路径更新为指向 `plugin/` 中的新位置，以便编辑器能正确加载所有模块。

#### 验收标准

1. WHEN 重构完成时，THE Editor 中的 `meta-editor.html` SHALL 将 MetaLoader 的 import 路径从 `'./js/mrpp/MetaLoader.js'` 更新为指向 `plugin/mrpp/MetaLoader.js` 的正确相对路径
2. WHEN 重构完成时，THE Editor 中的 `verse-editor.html` SHALL 将 VerseLoader 的 import 路径从 `'./js/mrpp/VerseLoader.js'` 更新为指向 `plugin/mrpp/VerseLoader.js` 的正确相对路径
3. WHEN 重构完成时，THE Editor 中的 `meta-editor.html` 和 `verse-editor.html` SHALL 将 GlobalShortcuts 的 import 路径从 `'./js/utils/GlobalShortcuts.js'` 更新为指向 `plugin/utils/GlobalShortcuts.js` 的正确相对路径

### 需求 11：提取 HTML 内联业务逻辑

**用户故事：** 作为开发者，我希望 HTML 入口文件中的内联业务逻辑提取到 `plugin/` 中的独立 JS 模块，以便 HTML 文件更简洁且业务逻辑可复用。

#### 验收标准

1. WHEN 重构完成时，THE Plugin_Directory SHALL 包含一个独立的 JavaScript 模块（如 `plugin/bootstrap/meta-bootstrap.js`），封装 `meta-editor.html` 中的 Meta 编辑器初始化逻辑（包括 editor.type 设置、messageSend 信号处理、MetaLoader 实例化、postMessage 监听、messageReceive 处理）
2. WHEN 重构完成时，THE Plugin_Directory SHALL 包含一个独立的 JavaScript 模块（如 `plugin/bootstrap/verse-bootstrap.js`），封装 `verse-editor.html` 中的 Verse 编辑器初始化逻辑（包括 editor.type 设置、messageSend 信号处理、VerseLoader 实例化、postMessage 监听、messageReceive 处理）
3. WHEN 重构完成时，THE Editor 中的 `meta-editor.html` SHALL 通过 import 引入 `meta-bootstrap.js` 模块来完成业务初始化，而非使用内联脚本
4. WHEN 重构完成时，THE Editor 中的 `verse-editor.html` SHALL 通过 import 引入 `verse-bootstrap.js` 模块来完成业务初始化，而非使用内联脚本
5. THE Editor 中 HTML 入口文件的 `<script type="module">` 标签内 SHALL 仅保留 Editor 通用初始化代码（如 Viewport、Toolbar、Sidebar、Menubar 的创建和挂载），MRPP 特有逻辑 SHALL 全部移至 bootstrap 模块

### 需求 12：标记原版文件中的侵入式修改

**用户故事：** 作为开发者，我希望 Editor 原版文件中的 MRPP 侵入式修改用注释清晰标记，以便未来升级时快速定位需要合并的代码段。

#### 验收标准

1. WHEN 重构完成时，THE Editor 中的 Editor.js SHALL 在每处 MRPP 侵入式修改的起始位置添加 `// --- MRPP MODIFICATION START ---` 注释，在结束位置添加 `// --- MRPP MODIFICATION END ---` 注释
2. WHEN 重构完成时，THE Editor 中的 Sidebar.js SHALL 在每处 MRPP 侵入式修改的起始位置和结束位置添加相同格式的标记注释
3. WHEN 重构完成时，THE Editor 中的 Menubar.js SHALL 在每处 MRPP 侵入式修改的起始位置和结束位置添加相同格式的标记注释
4. WHEN 重构完成时，THE Editor 中的 Menubar.Add.js SHALL 在每处 MRPP 侵入式修改的起始位置和结束位置添加相同格式的标记注释
5. WHEN 重构完成时，THE Editor 中的 Sidebar.Object.js SHALL 在每处 MRPP 侵入式修改的起始位置和结束位置添加相同格式的标记注释
6. WHEN 重构完成时，THE Editor 中的 Loader.js SHALL 在每处 MRPP 侵入式修改的起始位置和结束位置添加相同格式的标记注释
7. WHEN 重构完成时，THE Editor 中的 Commands.js SHALL 在每处 MRPP 自定义命令的 export 语句处添加相同格式的标记注释

### 需求 13：功能完整性保证

**用户故事：** 作为开发者，我希望重构后编辑器的所有功能表现与重构前完全一致，以便用户无感知地使用重构后的版本。

#### 验收标准

1. WHEN 通过 `node server.js` 启动服务后访问 `meta-editor.html` 时，THE Editor SHALL 正常加载 Meta 编辑模式，所有 Sidebar 面板、Menubar 菜单、组件系统、指令系统均正常工作
2. WHEN 通过 `node server.js` 启动服务后访问 `verse-editor.html` 时，THE Editor SHALL 正常加载 Verse 编辑模式，所有 Sidebar 面板、Menubar 菜单均正常工作
3. WHEN 编辑器加载场景数据时，THE Editor SHALL 正确调用 MetaLoader 或 VerseLoader 加载并渲染场景，与重构前行为一致
4. WHEN 用户执行组件添加、删除、修改操作时，THE Editor SHALL 正确执行对应的 Command 并支持 undo/redo，与重构前行为一致
5. WHEN 用户使用截图功能时，THE Editor SHALL 正确调用 ScreenshotUtils 完成截图，与重构前行为一致
6. WHEN 编辑器显示 UI 文本时，THE Editor SHALL 根据当前语言设置显示正确的国际化字符串，包括所有 MRPP 自定义字符串，与重构前行为一致
7. THE Editor SHALL 保持 three.js r140 版本不变，不引入任何新的外部依赖或构建工具

### 需求 14：技术约束

**用户故事：** 作为开发者，我希望重构严格遵守技术约束，以便不引入额外的复杂性。

#### 验收标准

1. THE Editor SHALL 保持所有 JavaScript 文件使用 JavaScript 语言，不转换为 TypeScript
2. THE Editor SHALL 保持 three.js r140 版本不变，不升级 three.js
3. THE Editor SHALL 不引入 Vite、Webpack 或其他构建工具
4. THE Editor SHALL 不引入 npm、yarn 或其他包管理器（保持现有的 ES Module 直接引用方式）
5. THE Editor SHALL 继续使用 `<script type="importmap">` 进行模块映射，不改变现有的模块加载机制
6. THE Static_Server SHALL 无需任何修改即可正确服务 `plugin/` 目录下的文件
