# 实施计划：Three.js 版本升级（r140 → r183）

## 概述

按照设计文档的 11 阶段流程，将 `three.js/` 目录从 r140 整体替换为 r183，逐步适配 `plugin/` 层的 import 路径和 API 调用，最后通过属性测试和手动验证确保所有 MRPP 功能正常。每个阶段完成后运行已有属性测试进行渐进式验证。

## 任务

- [x] 1. Phase 1: 备份与替换
  - [x] 1.1 备份当前 `three.js/` 目录，克隆 r183 仓库替换
    - 执行 `mv three.js three.js.backup`
    - 执行 `git clone --branch r183 --depth 1 https://github.com/mrdoob/three.js.git`
    - 恢复自定义入口文件：`cp three.js.backup/editor/meta-editor.html three.js/editor/` 和 `verse-editor.html`
    - 验证关键文件存在：`build/three.module.js`、`editor/js/Editor.js`、`examples/jsm/loaders/GLTFLoader.js`
    - _需求: 1.1, 1.2, 1.3, 1.4, 15.1_

- [x] 2. Phase 2: 入口文件适配
  - [x] 2.1 对比 r183 原版 `editor/index.html` 与当前 `meta-editor.html`，适配入口结构
    - 对比 r183 `index.html` 的 `<script>` 标签列表（codemirror、acorn、tern、signals 等），更新 `meta-editor.html` 中的引用路径
    - 对比 r183 `index.html` 的 ES module 导入列表（Editor、Viewport、Toolbar 等），确认是否有新增/移除模块
    - 保留 MRPP 特有内容：ffmpeg script 标签、`initMetaEditor(editor)` 调用、bootstrap import
    - 以 r183 `index.html` 为基准重建 `meta-editor.html`，在其上添加 MRPP 扩展
    - _需求: 10.1, 10.3, 10.4_
  - [x] 2.2 同样适配 `verse-editor.html`
    - 以 r183 `index.html` 为基准重建，添加 `initVerseEditor(editor)` 调用和 verse-bootstrap import
    - _需求: 10.2, 10.3, 10.4_

- [x] 3. Phase 3: Import Map 更新
  - [x] 3.1 更新 `meta-editor.html` 和 `verse-editor.html` 中的 import map
    - 确认 r183 `build/three.module.js` 路径是否变化，更新 `"three"` 映射
    - 添加 `"three/addons/"` → `"../examples/jsm/"` 映射条目（如 r183 index.html 包含）
    - 验证 import map JSON 格式正确
    - _需求: 2.1, 2.2, 2.3, 2.4_

- [x] 4. Checkpoint — 验证入口文件基础结构
  - 确保 `meta-editor.html` 和 `verse-editor.html` 的 import map 和 script 标签引用路径均指向 r183 中存在的文件，如有问题请询问用户。

- [x] 5. Phase 4: Strings.js / Commands.js 重新应用 MRPP 修改
  - [x] 5.1 在 r183 `Strings.js` 中重新应用 MRPP i18n 修改
    - 在文件顶部添加 `import { mrppStrings } from '../../../plugin/i18n/MrppStrings.js';`
    - 确认 r183 Strings.js 支持的语言列表，在每个语言对象末尾添加 `...mrppStrings["xx-xx"]` spread
    - 确认 r183 语言代码格式是否变化（如 `en` vs `en-us`），如有变化需同步更新 `MrppStrings.js` 键名
    - 所有修改使用 `// --- MRPP MODIFICATION START/END ---` 标记包裹
    - _需求: 6.1, 6.3_
  - [x] 5.2 在 r183 `Commands.js` 中重新应用 MRPP 命令 re-export
    - 在文件末尾添加 11 个 MRPP 命令的 export 语句
    - 验证 `../../../../plugin/commands/` 相对路径层级是否正确（取决于 r183 Commands.js 的目录位置）
    - 确认 r183 Commands.js 的导出方式是否变化，适配新格式
    - _需求: 6.2, 6.4, 6.5_

- [x] 6. Phase 5: Plugin Import 路径更新
  - [x] 6.1 更新 `plugin/patches/LoaderPatches.js` 中的 KTX2Loader import 路径
    - 检查 r183 中 `KTX2Loader.js` 的实际位置，更新 import 路径
    - 验证 `setTranscoderPath` 路径是否需要更新
    - _需求: 4.4, 4.5, 4.6, 12.1_
  - [x] 6.2 更新 `plugin/patches/UIThreePatches.js` 中的 import 路径
    - 更新 `MoveObjectCommand.js` import 路径（`../../three.js/editor/js/commands/MoveObjectCommand.js`）
    - 更新 `UIOutliner` import 路径（`../../three.js/editor/js/libs/ui.three.js`）
    - _需求: 12.2, 9.1_
  - [x] 6.3 更新 `plugin/mrpp/MetaFactory.js` 中的加载器 import 路径
    - 更新 GLTFLoader、DRACOLoader、VOXLoader、KTX2Loader 的 import 路径
    - 检查 r183 中 VOXLoader 是否仍存在，如已移除需找替代方案
    - _需求: 4.1, 4.2, 4.3, 4.5, 12.1_
  - [x] 6.4 更新 `plugin/mrpp/VerseFactory.js` 中的加载器 import 路径
    - 更新 GLTFLoader、DRACOLoader 的 import 路径
    - _需求: 4.1, 4.2, 12.1_
  - [x] 6.5 更新其他 plugin 文件中指向 `three.js/editor/js/` 的 import 路径
    - 扫描 `plugin/ui/sidebar/`、`plugin/ui/menubar/` 下所有文件的 editor 模块引用
    - 更新 `Sidebar.ObjectExt.js`、`Menubar.MrppEdit.js` 等文件中的 import 路径
    - _需求: 12.2, 12.3_

- [x] 7. Checkpoint — 运行现有属性测试验证 import 路径
  - 在 `three.js/editor/test/` 目录下运行 `npm test`，确保 import-paths、three-reference、no-typescript、i18n-completeness 4 个属性测试通过。如有失败请询问用户。

- [x] 8. Phase 6: Editor 核心 API 适配
  - [x] 8.1 适配 `plugin/patches/EditorPatches.js` 中的 monkey-patch 逻辑
    - 检查 r183 Editor 是否仍使用 `signals.Signal`（js-signals），如改用 EventDispatcher 需适配 `registerCustomSignals`
    - 检查 r183 Editor 的 `addObject`、`removeObject`、`select`、`clear`、`setScene`、`fromJSON`、`toJSON` 方法签名是否变化
    - 如 r183 Editor 从函数构造器改为 class，验证 monkey-patch 仍然有效
    - 适配所有签名变化，保持 MRPP 扩展行为不变
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 8.2 适配 `plugin/bootstrap/meta-bootstrap.js` 和 `verse-bootstrap.js`
    - 检查 bootstrap 中引用的 editor 模块路径是否需要更新
    - 确认初始化顺序与 r183 Editor 兼容
    - _需求: 10.1, 10.2_

- [x] 9. Phase 7: Examples JSM 加载器 API 适配
  - [x] 9.1 适配 `plugin/mrpp/MetaFactory.js` 中的加载器 API 调用
    - 检查 r183 GLTFLoader API（构造函数、parse、load 方法签名）
    - 检查 r183 DRACOLoader API（setDecoderPath 路径、setDecoderConfig）
    - 检查 r183 KTX2Loader API（setTranscoderPath、detectSupport）
    - 检查 r183      API 是否变化或被移除
    - 更新所有不兼容的 API 调用
    - _需求: 4.1, 4.2, 4.3, 4.4, 11.1, 11.2_
  - [x] 9.2 适配 `plugin/patches/LoaderPatches.js` 中的 KTX2Loader API
    - 检查 `new KTX2Loader(manager)` 构造函数是否变化
    - 检查 `setTranscoderPath`、`detectSupport` 方法是否变化
    - 检查 `manager.addHandler` API 是否变化
    - _需求: 4.4, 4.6, 11.2, 11.3_

- [x] 10. Phase 8: UI 组件 API 适配
  - [x] 10.1 适配 `plugin/patches/SidebarPatches.js`
    - 检查 r183 Sidebar 的 UITabbedPanel API（addTab、tabs、panels 数组结构）
    - 检查 r183 Sidebar 的 DOM 结构（tab id、panel id）
    - 适配 tab 重命名、面板注入、tab 移除逻辑
    - _需求: 5.1, 5.3, 5.4, 5.5_
  - [x] 10.2 适配 `plugin/patches/MenubarPatches.js`
    - 检查 r183 Menubar 的 DOM 结构（.menu、.title、.options class 名）
    - 检查 r183 Menubar 的菜单项结构是否变化
    - 适配 `findMenuOptions` 和菜单注入逻辑
    - _需求: 5.2, 5.4, 5.5_
  - [x] 10.3 适配 `plugin/patches/UIThreePatches.js` 中的 UIOutliner monkey-patch
    - 检查 r183 UIOutliner 是否仍为 prototype-based
    - 检查 r183 UIOutliner 的 `options` 数组结构、`selectIndex` 方法、`setOptions` 方法
    - 适配所有 prototype 扩展和方法覆盖
    - _需求: 9.1, 9.2, 5.4_

- [x] 11. Phase 9: Viewport / TransformControls 适配
  - [x] 11.1 适配 `plugin/patches/ViewportPatches.js`
    - 检查 r183 `editor.sceneHelpers` 是否仍存在
    - 检查 r183 TransformControls API（getMode、object 属性、事件名）
    - 检查 r183 `signals.refreshSidebarObject3D` 是否仍存在
    - 适配 multiSelectGroup 管理和变换回调逻辑
    - _需求: 8.1, 8.2, 8.3_

- [x] 12. Checkpoint — 运行全部现有属性测试
  - 运行 `npm test`，确保 4 个现有属性测试全部通过。如有失败请询问用户。
  - _需求: 13.1, 13.2, 13.3, 13.4_

- [x] 13. Phase 10: 新增属性测试
  - [x] 13.1 更新现有 `import-paths.test.js`（Property 1）
    - 检查 `KNOWN_BROKEN_IMPORTS` 集合是否需要更新
    - 确保测试覆盖 r183 新增的 import 路径模式
    - _需求: 13.1, 12.4_

  - [ ]* 13.2 编写 Property 5 属性测试：Commands.js MRPP 命令 re-export 完整性
    - **Property 5: Commands.js MRPP 命令 re-export 完整性**
    - **验证: 需求 6.2, 6.5**
    - 创建 `three.js/editor/test/properties/commands-reexport.test.js`
    - 读取 `three.js/editor/js/commands/Commands.js` 文件内容
    - 对 11 个 MRPP 命令名称，检查文件中包含对应的 `export { XxxCommand }` 语句
    - 检查每个 export 的 import 路径指向存在的文件

  - [ ]* 13.3 编写 Property 6 属性测试：Plugin 层无已废弃 three.js API 使用
    - **Property 6: Plugin 层无已废弃 three.js API 使用**
    - **验证: 需求 7.4, 7.6**
    - 创建 `three.js/editor/test/properties/deprecated-api.test.js`
    - 扫描 `plugin/` 下所有 JS 文件
    - 检查不包含已知废弃 API 模式：`\.gammaOutput`、`\.gammaFactor`、`\.outputEncoding`、`new Geometry\(`、`\.encoding\s*=` 等

  - [ ]* 13.4 编写 Property 7 属性测试：入口文件 Import Map 正确性
    - **Property 7: 入口文件 Import Map 正确性**
    - **验证: 需求 2.1, 2.4**
    - 创建 `three.js/editor/test/properties/import-map.test.js`
    - 解析 `meta-editor.html` 和 `verse-editor.html` 中的 `<script type="importmap">` 内容
    - 验证 JSON 包含 `"three"` 键且映射目标文件存在

  - [ ]* 13.5 编写 Property 8 属性测试：入口文件资源引用有效性
    - **Property 8: 入口文件资源引用有效性**
    - **验证: 需求 10.1, 10.2, 10.4**
    - 创建 `three.js/editor/test/properties/entry-file-references.test.js`
    - 解析入口文件中的 `<script src="...">` 和 `import ... from '...'`
    - 过滤外部 URL（http/https），验证本地路径解析到存在的文件

  - [ ]* 13.6 编写 Property 9 属性测试：无构建工具配置文件
    - **Property 9: 无构建工具配置文件**
    - **验证: 需求 16.1**
    - 创建 `three.js/editor/test/properties/no-build-tools.test.js`
    - 扫描项目根目录，验证不存在 webpack.config.js、vite.config.js、vite.config.ts、rollup.config.js、rollup.config.mjs、tsconfig.json

- [x] 14. Checkpoint — 运行全部属性测试（含新增）
  - 运行 `npm test`，确保 4 个现有 + 5 个新增属性测试全部通过。如有问题请询问用户。

- [x] 15. Phase 11: 检查废弃 API 并清理
  - [x] 15.1 检查并替换 Plugin 层中的废弃 three.js API
    - 搜索 `plugin/` 中的 `renderer.outputEncoding`，替换为 `renderer.outputColorSpace`
    - 搜索 `material.encoding`，替换为 `material.colorSpace`
    - 搜索 `renderer.physicallyCorrectLights` / `renderer.useLegacyLights`，按 r183 方式处理
    - 搜索其他已知废弃 API 并更新
    - _需求: 7.4, 7.6_
  - [x] 15.2 验证 Draco / Basis transcoder 文件路径
    - 确认 r183 中 Draco 解码器文件路径（`examples/js/libs/draco/` 或新路径）
    - 确认 r183 中 Basis transcoder 文件路径
    - 更新 `DRACOLoader.setDecoderPath` 和 `KTX2Loader.setTranscoderPath` 配置
    - _需求: 11.1, 11.2, 11.3_

- [x] 16. 最终 Checkpoint — 全部测试通过
  - 运行 `npm test`，确保所有属性测试通过，如有问题请询问用户。
  - _需求: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2_

## 备注

- 标记 `*` 的任务为可选，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以便追溯
- Checkpoint 任务确保渐进式验证，避免问题累积
- 属性测试验证设计文档中定义的 9 个正确性属性
- 单元测试验证特定示例和边界情况
- Phase 11 的手动功能验证（浏览器中测试）不包含在此任务列表中，需开发者自行执行
