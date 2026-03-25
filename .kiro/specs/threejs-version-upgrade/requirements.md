# 需求文档：Three.js 版本升级（r140 → r183）

## 简介

MRPP Editor 基于 three.js r140 Editor 构建，包含两层架构：
1. `three.js/` — 完整的 three.js r140 仓库（含 editor 源码）
2. `plugin/` — 所有 MRPP 自定义功能（patch 模块、UI 扩展、业务逻辑）

前期重构（threejs-upgrade-prep-refactor spec）已将 77 处侵入式修改外部化到 `plugin/` 层，仅 `Strings.js`（6 处 MRPP 标记）和 `Commands.js`（1 处 MRPP 标记）仍有最小修改。

本次升级目标：将 `three.js/` 目录从 r140 替换为 r183（跨越 43 个版本），同时保持 `plugin/` 层的所有 MRPP 功能正常运行。

## 术语表

- **Editor**：three.js 自带的 3D 编辑器应用，位于 `three.js/editor/` 目录
- **MRPP**：Meta Reality Presentation Platform，本项目的自定义业务逻辑总称
- **Plugin_Layer**：`plugin/` 目录中的所有 MRPP 自定义代码（patches、UI 扩展、命令、工具等）
- **Bootstrap_Module**：`plugin/bootstrap/` 中的初始化模块（meta-bootstrap.js、verse-bootstrap.js），负责在运行时通过 monkey-patch 和 DOM 注入将 MRPP 功能接入 Editor
- **Import_Map**：HTML 入口文件中的 `<script type="importmap">` 配置，将 bare specifier `"three"` 映射到 three.js 构建产物
- **Breaking_Change**：three.js 版本间不向后兼容的 API 变更（重命名、移除、行为改变）
- **Editor_API**：Editor 对象暴露的公共接口（signals、方法、属性），Plugin_Layer 通过 monkey-patch 依赖这些接口
- **Examples_JSM**：`three.js/examples/jsm/` 目录下的示例模块（GLTFLoader、DRACOLoader、VOXLoader、KTX2Loader、SkeletonUtils 等）
- **Signals_System**：Editor 使用的 js-signals 事件系统，Plugin_Layer 通过 `editor.signals.*` 进行通信

## 需求

### 需求 1：three.js 仓库整体替换

**用户故事：** 作为开发者，我希望将 `three.js/` 目录替换为 r183 版本，以便获得最新的渲染能力、性能优化和 bug 修复。

#### 验收标准

1. WHEN 升级完成时，THE `three.js/` 目录 SHALL 包含 three.js r183 的完整仓库内容（build、examples、editor、docs 等）
2. WHEN 升级完成时，THE `three.js/build/three.module.js` SHALL 为 r183 版本的构建产物
3. THE 升级过程 SHALL 保留 `three.js/editor/meta-editor.html` 和 `three.js/editor/verse-editor.html` 两个自定义入口文件
4. THE 升级过程 SHALL 保留 `three.js/editor/basis/` 目录中的 basis transcoder 文件（或更新为 r183 兼容版本）

### 需求 2：Import Map 与模块解析更新

**用户故事：** 作为开发者，我希望 HTML 入口文件中的 import map 和模块引用路径与 r183 的目录结构匹配，以便所有 ES module 正确加载。

#### 验收标准

1. WHEN 升级完成时，THE `meta-editor.html` 和 `verse-editor.html` 中的 import map SHALL 将 `"three"` 映射到 r183 的正确构建产物路径
2. WHEN r183 的 editor 入口结构发生变化时，THE 自定义入口文件 SHALL 适配新的模块导入方式（如 addons 路径变更）
3. WHEN 升级完成时，THE Plugin_Layer 中使用 bare specifier `'three'` 的 import 语句 SHALL 通过 import map 正确解析到 r183 模块
4. IF r183 引入了新的 import map 条目（如 `"three/addons/"`），THEN THE 自定义入口文件 SHALL 包含这些条目

### 需求 3：Editor 核心 API 兼容性适配

**用户故事：** 作为开发者，我希望 Plugin_Layer 的 monkey-patch 逻辑与 r183 Editor 的 API 兼容，以便所有运行时注入正常工作。

#### 验收标准

1. WHEN 升级完成时，THE `applyEditorPatches` 函数 SHALL 成功向 r183 Editor 实例注册所有 20 个自定义信号，且信号类型与 Signals_System 兼容
2. WHEN 升级完成时，THE `applyEditorPatches` 函数 SHALL 成功 monkey-patch r183 Editor 的 addObject、removeObject、select、clear、setScene、fromJSON、toJSON 方法
3. IF r183 Editor 的方法签名发生变化（参数增减、返回值类型改变），THEN THE 对应的 monkey-patch 函数 SHALL 适配新签名，同时保持 MRPP 扩展行为不变
4. IF r183 Editor 移除了 Plugin_Layer 依赖的某个方法或属性，THEN THE Plugin_Layer SHALL 提供等效的替代实现
5. WHEN 升级完成时，THE Editor 的 Signals_System（js-signals 库）SHALL 继续正常工作，或适配 r183 采用的新事件系统

### 需求 4：Examples JSM 加载器 API 适配

**用户故事：** 作为开发者，我希望 Plugin_Layer 中使用的 three.js 示例加载器（GLTFLoader、DRACOLoader、VOXLoader、KTX2Loader）与 r183 版本兼容，以便模型和纹理加载正常工作。

#### 验收标准

1. WHEN 升级完成时，THE Plugin_Layer 中的 GLTFLoader import 路径 SHALL 指向 r183 中 GLTFLoader 的实际位置
2. WHEN 升级完成时，THE Plugin_Layer 中的 DRACOLoader import 路径和 API 调用 SHALL 与 r183 版本兼容
3. WHEN 升级完成时，THE Plugin_Layer 中的 VOXLoader import 路径和 API 调用 SHALL 与 r183 版本兼容
4. WHEN 升级完成时，THE Plugin_Layer 中的 KTX2Loader import 路径和 API 调用（setTranscoderPath、detectSupport）SHALL 与 r183 版本兼容
5. IF r183 将 Examples_JSM 加载器的路径从 `examples/jsm/loaders/` 移动到其他位置，THEN THE Plugin_Layer 的所有 import 路径 SHALL 更新为新路径
6. WHEN 升级完成时，THE `LoaderPatches.js` 中的 KTX2Loader 懒初始化逻辑 SHALL 与 r183 的 LoadingManager API 兼容

### 需求 5：Editor UI 组件 API 适配

**用户故事：** 作为开发者，我希望 Plugin_Layer 的 UI 注入逻辑（Sidebar、Menubar、Properties 面板）与 r183 Editor 的 UI 组件结构兼容，以便所有自定义面板和菜单正常显示。

#### 验收标准

1. WHEN 升级完成时，THE `applySidebarPatches` 函数 SHALL 成功在 r183 Sidebar 中注入自定义面板（Events、Screenshot），且 tab 切换正常工作
2. WHEN 升级完成时，THE `applyMenubarPatches` 函数 SHALL 成功在 r183 Menubar 中注入自定义菜单（Screenshot/Scene、Goto），且菜单项点击正常工作
3. WHEN 升级完成时，THE `applySidebarPropertiesPatches` 函数 SHALL 成功在 r183 Properties 面板中动态管理 MRPP 属性标签页（MultipleObjects、Component、Command、Text、Animation）
4. IF r183 Editor 的 UI 组件库（ui.js、ui.three.js）API 发生变化，THEN THE Plugin_Layer 中依赖这些 API 的代码 SHALL 适配新接口
5. IF r183 Editor 的 DOM 结构发生变化（CSS class 名、元素层级），THEN THE Plugin_Layer 的 DOM 查询和操作逻辑 SHALL 适配新结构

### 需求 6：Strings.js 和 Commands.js MRPP 标记重新应用

**用户故事：** 作为开发者，我希望在替换 `three.js/` 目录后，将 MRPP 的最小修改重新应用到 Strings.js 和 Commands.js，以便 i18n 字符串合并和自定义命令注册正常工作。

#### 验收标准

1. WHEN 升级完成时，THE `Strings.js` SHALL 包含 `import { mrppStrings }` 语句和各语言对象中的 `...mrppStrings["xx-xx"]` spread 运算符
2. WHEN 升级完成时，THE `Commands.js` SHALL 包含 11 个 MRPP 命令的 re-export 语句（AddComponentCommand、RemoveComponentCommand、SetComponentValueCommand、AddCommandCommand、RemoveCommandCommand、SetCommandValueCommand、AddEventCommand、RemoveEventCommand、SetEventValueCommand、MoveMultipleObjectsCommand、MultiTransformCommand）
3. IF r183 的 Strings.js 格式发生变化（如语言代码命名、对象结构），THEN THE MRPP 字符串合并方式 SHALL 适配新格式
4. IF r183 的 Commands.js 导出方式发生变化，THEN THE MRPP 命令 re-export 方式 SHALL 适配新导出模式
5. WHEN 升级完成时，THE `Commands.js` 中 MRPP 命令的 import 路径 SHALL 正确指向 `plugin/commands/` 目录（使用正确的相对路径层级）

### 需求 7：Three.js 核心 API Breaking Changes 适配

**用户故事：** 作为开发者，我希望 Plugin_Layer 中直接使用的 three.js 核心 API（THREE.Group、THREE.Vector3、THREE.Box3、THREE.Mesh 等）与 r183 兼容，以便 3D 场景操作正常工作。

#### 验收标准

1. WHEN 升级完成时，THE Plugin_Layer 中使用的 `THREE.DefaultLoadingManager` SHALL 与 r183 的 API 兼容（或适配为新的等效 API）
2. WHEN 升级完成时，THE Plugin_Layer 中使用的 `THREE.Object3D` 方法（traverse、add、remove、updateWorldMatrix）SHALL 与 r183 兼容
3. WHEN 升级完成时，THE Plugin_Layer 中使用的 `THREE.BufferGeometry` 属性访问（attributes.position、computeBoundingBox）SHALL 与 r183 兼容
4. IF r183 移除了 `THREE.Geometry`（已在 r125 移除）或其他已废弃 API，THEN THE Plugin_Layer SHALL 确认不依赖这些已移除的 API
5. WHEN 升级完成时，THE Plugin_Layer 中使用的材质属性（transparent、opacity、side、depthWrite）SHALL 与 r183 的材质系统兼容
6. IF r183 将 `renderer.physicallyCorrectLights` 重命名为 `renderer.useLegacyLights` 或其他名称，THEN THE Plugin_Layer 中的相关引用 SHALL 更新


### 需求 8：Viewport 与 TransformControls 适配

**用户故事：** 作为开发者，我希望 ViewportPatches 中的多选变换逻辑与 r183 的 TransformControls 和 Viewport 实现兼容，以便多选拖拽、旋转、缩放正常工作。

#### 验收标准

1. WHEN 升级完成时，THE `applyViewportPatches` 函数 SHALL 成功将多选变换逻辑注入 r183 Viewport，包括 multiSelectGroup 管理和包围盒计算
2. IF r183 的 TransformControls API 发生变化（事件名、getMode 方法、object 属性），THEN THE `_viewportPatch` 中的 handleMultiSelectChange、handleMultiSelectMouseDown、handleMultiSelectMouseUp 函数 SHALL 适配新 API
3. WHEN 升级完成时，THE `editor.sceneHelpers` SHALL 继续可用于添加 multiSelectGroup，或适配 r183 的等效机制

### 需求 9：UIOutliner 拖拽逻辑适配

**用户故事：** 作为开发者，我希望 UIThreePatches 中的 MoveMultipleObjectsCommand 注入逻辑与 r183 的 UIOutliner 实现兼容，以便 Outliner 中的多对象拖拽正常工作。

#### 验收标准

1. WHEN 升级完成时，THE `applyUIThreePatches` 函数 SHALL 成功将 MoveMultipleObjectsCommand 注入 r183 UIOutliner 的拖拽处理逻辑
2. IF r183 的 UIOutliner 实现发生变化（DOM 结构、事件处理方式），THEN THE monkey-patch 逻辑 SHALL 适配新实现

### 需求 10：自定义入口文件适配

**用户故事：** 作为开发者，我希望 `meta-editor.html` 和 `verse-editor.html` 与 r183 Editor 的入口结构兼容，以便编辑器正常启动。

#### 验收标准

1. WHEN 升级完成时，THE `meta-editor.html` SHALL 正确导入 r183 Editor 的所有核心模块（Editor、Viewport、Toolbar、Script、Player、Sidebar、Menubar、Resizer）
2. WHEN 升级完成时，THE `verse-editor.html` SHALL 正确导入 r183 Editor 的所有核心模块
3. IF r183 Editor 的入口文件结构发生变化（新增模块、移除模块、初始化顺序改变），THEN THE 自定义入口文件 SHALL 适配新结构
4. WHEN 升级完成时，THE 自定义入口文件中的 `<script>` 标签引用（codemirror、acorn、tern、signals.min.js 等）SHALL 指向 r183 中的正确路径
5. IF r183 移除了 js-signals 依赖改用其他事件系统，THEN THE 自定义入口文件和 Plugin_Layer SHALL 适配新事件系统或自行引入 js-signals

### 需求 11：Draco 和 Basis Transcoder 文件更新

**用户故事：** 作为开发者，我希望 Draco 解码器和 Basis transcoder 文件与 r183 的加载器版本匹配，以便压缩模型和 KTX2 纹理正确解码。

#### 验收标准

1. WHEN 升级完成时，THE Draco 解码器文件路径 SHALL 与 r183 DRACOLoader 的 `setDecoderPath` 配置匹配
2. WHEN 升级完成时，THE Basis transcoder 文件 SHALL 与 r183 KTX2Loader 的 `setTranscoderPath` 配置匹配
3. IF r183 更改了 Draco/Basis 文件的默认路径或版本，THEN THE 对应文件 SHALL 更新为 r183 兼容版本

### 需求 12：Plugin_Layer Import 路径批量更新

**用户故事：** 作为开发者，我希望 Plugin_Layer 中所有指向 `three.js/examples/jsm/` 和 `three.js/editor/js/` 的 import 路径在升级后仍然有效，以便所有模块正确加载。

#### 验收标准

1. WHEN 升级完成时，THE Plugin_Layer 中所有 import 语句指向 `three.js/examples/jsm/` 的路径 SHALL 解析到 r183 中存在的文件
2. WHEN 升级完成时，THE Plugin_Layer 中所有 import 语句指向 `three.js/editor/js/` 的路径 SHALL 解析到 r183 中存在的文件
3. IF r183 重命名或移动了 Plugin_Layer 依赖的模块文件，THEN THE 对应的 import 路径 SHALL 更新为新路径
4. WHEN 升级完成时，THE 现有 import-paths 属性测试 SHALL 通过（所有相对 import 路径解析到存在的文件）

### 需求 13：现有属性测试保持通过

**用户故事：** 作为开发者，我希望升级后现有的 4 个属性测试继续通过，以便验证升级没有破坏基本正确性。

#### 验收标准

1. WHEN 升级完成时，THE import-paths 属性测试 SHALL 通过（所有 import 路径指向存在的文件）
2. WHEN 升级完成时，THE i18n-completeness 属性测试 SHALL 通过（所有 MRPP 字符串在所有语言中存在且值正确）
3. WHEN 升级完成时，THE three-reference 属性测试 SHALL 通过（plugin/ 中的 three.js 引用使用 bare specifier）
4. WHEN 升级完成时，THE no-typescript 属性测试 SHALL 通过（plugin/ 中无 TypeScript 文件）

### 需求 14：功能完整性保证

**用户故事：** 作为开发者，我希望升级后编辑器的所有 MRPP 功能表现与升级前一致。

#### 验收标准

1. WHEN 通过 `node server.js` 启动服务后访问 `meta-editor.html` 时，THE Editor SHALL 正常加载 Meta 编辑模式，所有 MRPP 功能正常工作（场景加载、对象添加/删除/选择、组件/命令/事件管理、截图、保存）
2. WHEN 通过 `node server.js` 启动服务后访问 `verse-editor.html` 时，THE Editor SHALL 正常加载 Verse 编辑模式，所有 MRPP 功能正常工作
3. WHEN 加载包含 GLTF/GLB 模型的场景时，THE Editor SHALL 正确渲染模型（含 Draco 压缩和 KTX2 纹理）
4. WHEN 执行多选操作时，THE Editor SHALL 正确处理多对象变换（位置、旋转、缩放）并支持 undo/redo
5. WHEN 使用 Outliner 拖拽对象时，THE Editor SHALL 正确执行单对象和多对象移动

### 需求 15：渐进式升级策略

**用户故事：** 作为开发者，我希望升级过程有明确的阶段划分和回滚方案，以便在遇到问题时能快速定位和恢复。

#### 验收标准

1. THE 升级过程 SHALL 在替换 `three.js/` 目录前创建当前版本的备份
2. THE 升级过程 SHALL 按阶段执行：先替换仓库、再更新入口文件、再适配 Plugin_Layer、再重新应用 MRPP 标记、最后运行测试
3. WHEN 某个阶段出现无法解决的兼容性问题时，THE 升级过程 SHALL 支持回滚到上一个可工作状态
4. THE 升级过程 SHALL 记录所有 Breaking_Change 适配点，作为后续升级的参考文档

### 需求 16：构建工具与运行环境约束

**用户故事：** 作为开发者，我希望升级后项目继续保持纯 JavaScript、无构建工具、浏览器原生 ES modules 的技术栈。

#### 验收标准

1. WHEN 升级完成时，THE 项目 SHALL 不引入新的构建工具（webpack、vite、rollup 等）
2. WHEN 升级完成时，THE 所有 JavaScript 文件 SHALL 继续使用 `.js` 扩展名（不引入 TypeScript）
3. WHEN 升级完成时，THE 项目 SHALL 继续通过 `node server.js` 启动静态文件服务器运行
4. IF r183 的 editor 依赖构建步骤才能运行，THEN THE 升级方案 SHALL 使用 r183 的预构建产物或找到无构建运行方式
