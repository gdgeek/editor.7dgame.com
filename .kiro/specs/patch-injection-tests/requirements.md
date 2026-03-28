# 需求文档：Patch 注入集成测试

## 简介

GDGeek Editor 通过 `plugin/patches/` 目录下的 6 个 patch 文件，将 MRPP 自定义功能以 monkey-patch 和 DOM 操作的方式注入到 three.js r183 Editor 原版代码中。Bootstrap 模块（`meta-bootstrap.ts`、`verse-bootstrap.ts`）在运行时按固定顺序调用这些 patch。

当前核心问题：**patch 注入失败是静默的**——没有编译错误，只会在运行时出现功能异常。随着 three.js 版本升级，patch 所依赖的 API（方法名、信号名、DOM 结构）最容易发生破坏性变更，而现有测试体系无法覆盖这类回归。

本 feature 为 patch 注入机制建立一套集成测试，运行于 `three.js/editor/test/` 的 vitest + fast-check 框架中，在 CI 阶段静态验证 patch 的结构性前提条件，使注入失败从"运行时静默"变为"构建时可见"。

---

## 词汇表

- **Patch 文件**：`plugin/patches/` 下的 6 个 TypeScript 文件（`EditorPatches.ts`、`SidebarPatches.ts`、`MenubarPatches.ts`、`LoaderPatches.ts`、`UIThreePatches.ts`、`ViewportPatches.ts`），每个文件导出一个主入口函数。
- **Bootstrap 模块**：`plugin/bootstrap/meta-bootstrap.ts` 和 `verse-bootstrap.ts`，负责在运行时按顺序调用 patch 入口函数。
- **Patch 入口函数**：每个 patch 文件导出的顶层函数（如 `applyEditorPatches`、`applySidebarPatches` 等），是 bootstrap 调用的直接目标。
- **Monkey-patch 目标**：patch 文件所覆写的 editor 方法（`setScene`、`addObject`、`removeObject`、`select`、`clear`、`fromJSON`、`toJSON`）。
- **自定义信号**：`EditorPatches.ts` 通过 `registerCustomSignals` 注入到 `editor.signals` 上的 MRPP 专属信号（如 `upload`、`release`、`objectsChanged` 等）。
- **延迟 UI Patch**：`DeferredUIPatches.ts` 通过 `MutationObserver` 等待 `#sidebar`、`#menubar` 出现后再调用 `SidebarPatches` 和 `MenubarPatches`。
- **UIOutliner**：`three.js/editor/js/libs/ui.three.js` 中的 outliner 组件，`UIThreePatches.ts` 对其 prototype 进行多选扩展。
- **LANGUAGE_MAPPING**：`EditorPatches.ts` 中将 URL 参数语言码映射到 r183 编辑器配置码的常量对象。
- **KTX2Loader**：`LoaderPatches.ts` 懒加载的纹理加载器，通过 monkey-patch `editor.loader.loadFiles` 和 `loadFile` 注入。
- **MrppEditor**：`plugin/types/mrpp.d.ts` 中定义的编辑器扩展接口，描述 patch 注入后 editor 实例应具备的完整类型。
- **Test_Suite**：本 feature 新增的测试文件集合，位于 `three.js/editor/test/properties/` 目录。

---

## 需求

### 需求 1：Patch 入口函数导出验证

**用户故事：** 作为开发者，我希望在 CI 中验证每个 patch 文件都正确导出了预期的入口函数，以便在函数被意外重命名或删除时立即得到反馈。

#### 验收标准

1. THE Test_Suite SHALL 验证 `EditorPatches.ts` 导出名为 `applyEditorPatches` 的函数。
2. THE Test_Suite SHALL 验证 `EditorPatches.ts` 导出名为 `LANGUAGE_MAPPING` 的对象。
3. THE Test_Suite SHALL 验证 `SidebarPatches.ts` 导出名为 `applySidebarPatches` 的函数。
4. THE Test_Suite SHALL 验证 `SidebarPatches.ts` 导出名为 `applySidebarPropertiesPatches` 的函数。
5. THE Test_Suite SHALL 验证 `MenubarPatches.ts` 导出名为 `applyMenubarPatches` 的函数。
6. THE Test_Suite SHALL 验证 `LoaderPatches.ts` 导出名为 `applyLoaderPatches` 的函数。
7. THE Test_Suite SHALL 验证 `UIThreePatches.ts` 导出名为 `applyUIThreePatches` 的函数。
8. THE Test_Suite SHALL 验证 `ViewportPatches.ts` 导出名为 `applyViewportPatches` 的函数。
9. THE Test_Suite SHALL 验证 `ViewportPatches.ts` 导出名为 `computeEnhancedBoundingBox` 的函数。
10. WHEN 任意 patch 文件的导出名称发生变更，THE Test_Suite SHALL 报告具体的文件名和缺失的导出名称。

---

### 需求 2：Bootstrap 调用顺序验证

**用户故事：** 作为开发者，我希望验证 bootstrap 模块按正确顺序调用所有必要的 patch 入口函数，以便在调用顺序被打乱或遗漏时立即发现。

#### 验收标准

1. THE Test_Suite SHALL 验证 `meta-bootstrap.ts` 的源码中包含对 `applyEditorPatches` 的调用。
2. THE Test_Suite SHALL 验证 `meta-bootstrap.ts` 的源码中包含对 `applyLoaderPatches` 的调用。
3. THE Test_Suite SHALL 验证 `meta-bootstrap.ts` 的源码中包含对 `applyViewportPatches` 的调用。
4. THE Test_Suite SHALL 验证 `meta-bootstrap.ts` 的源码中包含对 `applyUIThreePatches` 的调用。
5. THE Test_Suite SHALL 验证 `meta-bootstrap.ts` 的源码中包含对 `applyDeferredUIPatches` 的调用。
6. THE Test_Suite SHALL 验证 `verse-bootstrap.ts` 的源码中包含对 `applyEditorPatches` 的调用。
7. THE Test_Suite SHALL 验证 `verse-bootstrap.ts` 的源码中包含对 `applyLoaderPatches` 的调用。
8. THE Test_Suite SHALL 验证 `verse-bootstrap.ts` 的源码中包含对 `applyViewportPatches` 的调用。
9. THE Test_Suite SHALL 验证 `verse-bootstrap.ts` 的源码中包含对 `applyUIThreePatches` 的调用。
10. THE Test_Suite SHALL 验证 `verse-bootstrap.ts` 的源码中包含对 `applyDeferredUIPatches` 的调用。
11. THE Test_Suite SHALL 验证 `meta-bootstrap.ts` 中 `applyEditorPatches` 的调用出现在 `applyLoaderPatches` 调用之前（源码行号顺序）。
12. THE Test_Suite SHALL 验证 `verse-bootstrap.ts` 中 `applyEditorPatches` 的调用出现在 `applyLoaderPatches` 调用之前（源码行号顺序）。

---

### 需求 3：EditorPatches 依赖的 Editor API 存在性验证

**用户故事：** 作为开发者，我希望验证 `EditorPatches.ts` 所 monkey-patch 的 editor 方法在 three.js Editor.js 中确实存在，以便在 three.js 升级后方法被重命名或删除时立即发现。

#### 验收标准

1. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `setScene` 方法定义。
2. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `addObject` 方法定义。
3. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `removeObject` 方法定义。
4. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `select` 方法定义。
5. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `clear` 方法定义。
6. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `fromJSON` 方法定义。
7. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `toJSON` 方法定义。
8. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `signals` 属性初始化。
9. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `config` 属性初始化（用于 `applyLanguageMapping` 调用 `config.setKey`）。
10. WHEN 上述任意方法或属性在 `Editor.js` 中不存在，THE Test_Suite SHALL 报告具体缺失的方法名和所在文件路径。

---

### 需求 4：LANGUAGE_MAPPING 完整性验证

**用户故事：** 作为开发者，我希望验证 `LANGUAGE_MAPPING` 中的所有目标语言码在 r183 `Strings.js` 中都有对应的语言定义，以便在 three.js 升级后语言码发生变化时立即发现。

#### 验收标准

1. THE Test_Suite SHALL 读取 `three.js/editor/js/Strings.js` 的源码，提取其中定义的所有语言码。
2. THE Test_Suite SHALL 验证 `LANGUAGE_MAPPING` 中每个映射目标值（`'zh'`、`'en'`、`'ja'`、`'ko'`、`'fr'`）都出现在 `Strings.js` 的语言码列表中。
3. IF `LANGUAGE_MAPPING` 中某个目标语言码在 `Strings.js` 中不存在，THEN THE Test_Suite SHALL 报告该语言码和对应的源语言码。
4. THE Test_Suite SHALL 验证 `LANGUAGE_MAPPING` 中至少包含 `'zh-CN'`、`'en-US'`、`'ja-JP'`、`'ko-KR'`、`'fr-FR'` 这 5 个源语言码的映射。
5. FOR ALL 源语言码 `k` in `LANGUAGE_MAPPING`，`LANGUAGE_MAPPING[k]` SHALL 是一个非空字符串（属性测试：映射值完整性不变量）。

---

### 需求 5：自定义信号名称验证

**用户故事：** 作为开发者，我希望验证 `EditorPatches.ts` 注册的所有自定义信号名称在 `MrppEditor` 类型定义中都有声明，以便类型定义与实际注入保持同步。

#### 验收标准

1. THE Test_Suite SHALL 从 `EditorPatches.ts` 源码中提取 `registerCustomSignals` 函数内所有 `editor.signals.XXX = new Signal()` 形式的信号名称。
2. THE Test_Suite SHALL 验证提取到的信号名称集合不为空（至少包含 `upload`、`release`、`objectsChanged`、`componentAdded`、`componentChanged`、`componentRemoved`）。
3. THE Test_Suite SHALL 验证 `EditorPatches.ts` 中对 `savingStarted` 和 `savingFinished` 的注册使用了条件守卫（`if (!editor.signals.XXX)`），以避免覆盖 r183 内置信号。
4. FOR ALL 信号名称 `s` 提取自 `registerCustomSignals`，`s` SHALL 是一个合法的 JavaScript 标识符（属性测试：信号名称格式不变量）。

---

### 需求 6：UIThreePatches 依赖的 UIOutliner 存在性验证

**用户故事：** 作为开发者，我希望验证 `UIThreePatches.ts` 所 patch 的 `UIOutliner` 类在 `ui.three.js` 中确实存在且被导出，以便在 three.js 升级后 UIOutliner 被重命名或移除时立即发现。

#### 验收标准

1. THE Test_Suite SHALL 验证 `three.js/editor/js/libs/ui.three.js` 文件存在。
2. THE Test_Suite SHALL 验证 `three.js/editor/js/libs/ui.three.js` 的源码中存在 `UIOutliner` 的定义或导出。
3. THE Test_Suite SHALL 验证 `UIThreePatches.ts` 的导入语句中包含从 `ui.three.js` 导入 `UIOutliner` 的声明。
4. THE Test_Suite SHALL 验证 `three.js/editor/js/libs/ui.three.js` 的源码中存在 `prototype` 关键字（确认 UIOutliner 使用 prototype 模式，patch 方式仍然有效）。
5. THE Test_Suite SHALL 验证 `UIThreePatches.ts` 源码中存在 `_mrppMultiSelectPatched` 守卫检查（防止重复 patch 的幂等性保护）。

---

### 需求 7：LoaderPatches 依赖的 Loader API 存在性验证

**用户故事：** 作为开发者，我希望验证 `LoaderPatches.ts` 所 monkey-patch 的 `editor.loader` 方法在 `Loader.js` 中确实存在，以便在 three.js 升级后 Loader API 变更时立即发现。

#### 验收标准

1. THE Test_Suite SHALL 验证 `three.js/editor/js/Loader.js` 文件存在。
2. THE Test_Suite SHALL 验证 `three.js/editor/js/Loader.js` 的源码中存在 `loadFiles` 方法定义。
3. THE Test_Suite SHALL 验证 `three.js/editor/js/Loader.js` 的源码中存在 `loadFile` 方法定义。
4. THE Test_Suite SHALL 验证 `LoaderPatches.ts` 的导入语句中包含从 `KTX2Loader.js` 的导入声明。
5. IF `three.js/editor/js/Loader.js` 中不存在 `loadFiles` 或 `loadFile` 方法，THEN THE Test_Suite SHALL 报告具体缺失的方法名。

---

### 需求 8：ViewportPatches 依赖的 Editor 信号存在性验证

**用户故事：** 作为开发者，我希望验证 `ViewportPatches.ts` 所监听的 editor 信号（`objectSelected`、`objectChanged`、`transformModeChanged`、`multipleObjectsTransformChanged`）在 `Editor.js` 中确实被初始化，以便在 three.js 升级后信号被重命名时立即发现。

#### 验收标准

1. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `objectSelected` 信号的初始化。
2. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `objectChanged` 信号的初始化。
3. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `transformModeChanged` 信号的初始化。
4. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `sceneGraphChanged` 信号的初始化（ViewportPatches 通过此信号触发重渲染）。
5. THE Test_Suite SHALL 验证 `three.js/editor/js/Editor.js` 的源码中存在 `sceneHelpers` 属性初始化（ViewportPatches 调用 `editor.sceneHelpers.add`）。
6. FOR ALL 信号名称 `s` in `['objectSelected', 'objectChanged', 'transformModeChanged', 'sceneGraphChanged']`，`s` SHALL 出现在 `Editor.js` 源码中（属性测试：信号集合覆盖不变量）。

---

### 需求 9：Patch 文件导入路径合法性验证

**用户故事：** 作为开发者，我希望验证所有 patch 文件的导入路径都指向实际存在的文件，以便在文件被移动或重命名后立即发现悬空导入。

#### 验收标准

1. THE Test_Suite SHALL 从每个 patch 文件的源码中提取所有相对导入路径（`import ... from '...'` 形式）。
2. THE Test_Suite SHALL 验证每个相对导入路径解析后对应的文件在文件系统中存在（`.ts` 文件检查 `.ts` 扩展名，`.js` 导入检查对应的 `.ts` 或 `.js` 文件）。
3. IF 任意导入路径解析后文件不存在，THEN THE Test_Suite SHALL 报告源文件名、导入路径和解析后的绝对路径。
4. THE Test_Suite SHALL 验证 6 个 patch 文件中的导入路径总数大于 0（确保提取逻辑本身有效）。
5. FOR ALL patch 文件 `f` in `plugin/patches/`，`f` 中的每个相对导入路径 `p` SHALL 解析到一个存在的文件（属性测试：导入路径完整性不变量）。

---

### 需求 10：Patch 幂等性静态验证

**用户故事：** 作为开发者，我希望验证关键 patch 函数包含防止重复执行的守卫逻辑，以便在 bootstrap 被意外多次调用时不会产生副作用。

#### 验收标准

1. THE Test_Suite SHALL 验证 `UIThreePatches.ts` 源码中存在 `_mrppMultiSelectPatched` 守卫标志的读取检查。
2. THE Test_Suite SHALL 验证 `UIThreePatches.ts` 源码中存在 `_mrppMultiSelectPatched` 守卫标志的写入赋值。
3. THE Test_Suite SHALL 验证 `UIThreePatches.ts` 源码中存在 `_mrppDropPatched` 守卫标志（outliner drop handler 的幂等性保护）。
4. THE Test_Suite SHALL 验证 `EditorPatches.ts` 源码中对 `savingStarted` 和 `savingFinished` 信号的注册使用了 `if (!editor.signals.XXX)` 条件守卫。
5. THE Test_Suite SHALL 验证 `DeferredUIPatches.ts` 源码中存在 `sidebarPatched` 和 `menubarPatched` 布尔守卫变量。

---

### 需求 11：测试基础设施完整性

**用户故事：** 作为开发者，我希望 patch 注入测试能够无缝集成到现有的 vitest 测试框架中，与其他属性测试共享相同的运行方式和报告格式。

#### 验收标准

1. THE Test_Suite SHALL 以 `.test.js` 扩展名存放于 `three.js/editor/test/properties/` 目录中。
2. THE Test_Suite SHALL 使用 `vitest` 的 `describe`、`it`、`expect` API 编写测试用例。
3. WHERE fast-check 属性测试适用，THE Test_Suite SHALL 使用 `fc.assert` 和 `fc.property` 编写属性测试。
4. THE Test_Suite SHALL 使用 Node.js `fs` 和 `path` 模块进行文件系统操作，不依赖浏览器 DOM API。
5. THE Test_Suite SHALL 通过 `path.resolve(process.cwd(), '../../..')` 计算项目根目录（与现有测试保持一致）。
6. WHEN 测试失败，THE Test_Suite SHALL 在错误信息中包含足够的上下文（文件名、期望值、实际值）以便快速定位问题。
7. THE Test_Suite SHALL 在 `vitest --run` 单次执行模式下完成，不依赖 watch 模式。

