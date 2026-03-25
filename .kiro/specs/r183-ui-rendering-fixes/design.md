# r183 UI Rendering Fixes — Bugfix Design

## Overview

three.js r140→r183 升级后，MRPP 模式下的 UI 层出现 8 处回归。3D 视口渲染正常，但 Sidebar、Menubar、Viewport Controls 和 Animation 等 UI 组件未正确适配 r183 的结构性变更。修复策略：通过 `plugin/patches/` 层的 monkey-patch 和 DOM 操作实现，不修改 r183 原版文件（除非绝对必要），同时适用于 meta 和 verse 两种编辑器模式。

## Glossary

- **Bug_Condition (C)**: 在 MRPP 模式（meta 或 verse）下加载编辑器时，r183 新增/变更的 UI 元素未被正确隐藏或适配
- **Property (P)**: MRPP 模式下 UI 应与 r140 行为一致——隐藏不需要的原版元素，显示 MRPP 自定义元素
- **Preservation**: 非 MRPP 模式（原版 three.js editor）下所有 UI 应正常显示；MRPP 模式下已有功能（变换、undo/redo、tab 切换等）不受影响
- **MRPP 模式**: `editor.type` 为 `'meta'` 或 `'verse'` 时的编辑器运行模式
- **Deferred UI Patches**: 通过 MutationObserver 延迟到 DOM 元素创建后执行的 patch 函数（`applyDeferredUIPatches`）
- **wrapAsTabbedPanel**: 将原生 DOM 元素包装为 UITabbedPanel 兼容接口的辅助函数

## Bug Details

### Bug Condition

当编辑器以 MRPP 模式（meta/verse）加载时，r183 新增的 UI 元素和变更的组件结构未被 `plugin/patches/` 中的 patch 函数正确处理，导致 8 处 UI 回归。

**Formal Specification:**
```
FUNCTION isBugCondition(state)
  INPUT: state of type EditorState { editorType, uiComponent, componentState }
  OUTPUT: boolean

  RETURN state.editorType IN ['meta', 'verse']
         AND (
           (state.uiComponent == 'outliner' AND state.componentState.missingSearchFilter == true)
           OR (state.uiComponent == 'outliner' AND state.componentState.showsInternalObjects == true)
           OR (state.uiComponent == 'properties' AND state.componentState.showsOriginalTabs == true)
           OR (state.uiComponent == 'objectPanel' AND state.componentState.showsRawType == true)
           OR (state.uiComponent == 'objectPanel' AND state.componentState.showsUUIDOrShadow == true)
           OR (state.uiComponent == 'menubar' AND state.componentState.showsViewOrRender == true)
           OR (state.uiComponent == 'animation' AND state.componentState.animationVisible == true)
           OR (state.uiComponent == 'viewport' AND state.componentState.showsShadingSelect == true)
         )
END FUNCTION
```

### Examples

- Bug 1.1: MRPP 模式下层级 tab 顶部无搜索框和过滤下拉框（r140 有）
- Bug 1.2: MRPP 模式下层级树显示 Camera、Scene、$lights 等内部对象（r140 中被过滤）
- Bug 1.3: MRPP 模式下属性面板显示 r183 原版 "属性"+"几何"+"材质"+"脚本" tab，而非 MRPP 动态 tab
- Bug 1.4: MRPP 模式下 polygen 类型对象显示 "Object3D" 而非 "Polygen"
- Bug 1.5: MRPP 模式下属性面板显示 UUID 行和 Shadow 相关行（应隐藏）
- Bug 1.6: MRPP 模式下菜单栏显示 View 和 Render 菜单（应隐藏）
- Bug 1.7: MRPP 模式下底部显示 Animation 时间轴面板（应隐藏）
- Bug 1.8: MRPP 模式下视口顶部显示 SOLID 渲染模式下拉框（应隐藏）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 层级树选中用户对象后正确触发 objectSelected 信号并在属性面板显示属性
- 属性面板修改位置/旋转/缩放正确执行变换命令并支持 undo/redo
- 菜单栏的文件/编辑/添加菜单正确执行操作
- 视口 CAMERA 下拉框正确切换相机
- Sidebar tab 切换（层级/事件/截图）正确工作
- 非 MRPP 模式下所有原版 UI 元素正常显示

**Scope:**
所有不涉及 MRPP 模式 UI 隐藏/适配的功能不受影响。非 MRPP 模式（`editor.type` 未设置或不为 meta/verse）下编辑器行为完全不变。

## Hypothesized Root Cause

基于代码分析，8 个缺陷的根因如下：

1. **Bug 1.1 — 层级树缺少搜索/过滤**: r183 的 `Sidebar.Scene.js` 移除了搜索输入框和过滤下拉框（r140 有）。`SidebarPatches.js` 未补充注入这些 UI 元素。需要在 patch 层重新创建搜索和过滤 UI。

2. **Bug 1.2 — 层级树显示内部对象**: r183 的 `Sidebar.Scene.js` 的 `refreshUI()` 函数遍历 `scene.children` 时不做过滤，直接显示所有对象（包括 Camera、Scene 本身、$lights 等）。r140 中 MRPP 通过修改 `refreshUI` 过滤了这些对象。`SidebarPatches.js` 未 monkey-patch `refreshUI` 或注入过滤逻辑。

3. **Bug 1.3 — 属性面板 tab 管理失效**: `applySidebarPropertiesPatches` 通过 `clearTabbedPanel` + `addTab` 动态管理 tab。但 r183 的 `SidebarProperties` 自身也有 `objectSelected` 信号监听器（`toggleTabs` 函数），它会在 MRPP patch 之后执行，覆盖 MRPP 的 tab 管理。两个监听器竞争导致 tab 状态不一致。

4. **Bug 1.4 — 对象类型显示错误**: `Sidebar.ObjectExt.js` 的 `injectSidebarObjectExtensions` 通过 `applyMrppUIValues` 设置本地化类型名。但该函数依赖 `object.userData.type` 来获取 MRPP 自定义类型。如果 `userData.type` 未正确设置（或 r183 的 `updateUI` 在 MRPP patch 之后再次覆盖为 `object.type`），则显示底层类型 "Object3D"。

5. **Bug 1.5 — 属性面板显示多余行**: r183 的 `Sidebar.Object.js` 新增了 UUID 行（始终显示）和 Shadow 相关行（`shadowIntensity`、`shadowBias`、`shadowNormalBias`、`shadowRadius`）。`SidebarPatches.js` / `Sidebar.ObjectExt.js` 未在 MRPP 模式下隐藏这些行。

6. **Bug 1.6 — 菜单栏显示多余菜单**: r183 的 `Menubar.js` 新增了 `MenubarView` 和 `MenubarRender`。`applyMenubarPatches` 只添加了 MRPP 菜单（Screenshot/Scene/Goto）和修改了 Add/Edit 菜单，但未移除 View 和 Render 菜单。

7. **Bug 1.7 — 动画面板可见**: r183 新增了 `Animation.js` 面板（含播放控件和时间轴），在 `meta-editor.html` / `verse-editor.html` 中通过 `new Animation(editor)` 创建并 `appendChild` 到 body。bootstrap 代码未在 MRPP 模式下隐藏此面板及其 `AnimationResizer`。

8. **Bug 1.8 — 视口显示 shading 下拉框**: r183 的 `Viewport.Controls.js` 新增了 `shadingSelect` 下拉框（realistic/solid/normals/wireframe）。`applyViewportPatches` 未在 MRPP 模式下隐藏此下拉框。

## Correctness Properties

Property 1: Bug Condition — MRPP 模式下 r183 新增 UI 元素正确隐藏/适配

_For any_ editor state where MRPP mode is active (editor.type is 'meta' or 'verse'), the patched UI SHALL: (a) 在层级 tab 顶部显示搜索框和过滤下拉框, (b) 过滤隐藏内部对象, (c) 动态管理属性面板 tab, (d) 显示 MRPP 自定义类型名, (e) 隐藏 UUID/Shadow 行, (f) 隐藏 View/Render 菜单, (g) 隐藏 Animation 面板, (h) 隐藏 shading 下拉框。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 2: Preservation — 非 MRPP 模式和已有功能不受影响

_For any_ editor state where MRPP mode is NOT active (editor.type is not 'meta'/'verse'), or for any MRPP mode interaction that does not involve the 8 bug conditions (e.g., transform operations, undo/redo, tab switching, camera switching), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**


## Fix Implementation

### Changes Required

假设根因分析正确，以下是各缺陷的修复方案：

### Fix 1.1 & 1.2 — 层级树搜索/过滤 + 内部对象过滤

**File**: `plugin/patches/SidebarPatches.js`

**Strategy**: 在 `applySidebarPatches` 中，通过 deferred DOM patch 对 `#outliner` 进行增强：
1. 在 outliner 上方注入搜索输入框（UIInput）和过滤下拉框（UISelect）
2. Monkey-patch `Sidebar.Scene` 的 `refreshUI` 逻辑：通过 MutationObserver 监听 outliner 内容变化，在每次 refreshUI 后过滤掉 Camera、Scene 根节点、以 `$` 开头的对象（如 `$lights`）
3. 搜索框输入时按名称过滤 outliner 选项
4. 过滤下拉框提供"全部"/"网格"/"灯光"等分类过滤

**Specific Changes**:
- 新增 `injectOutlinerSearchFilter(editor, sidebarDom)` 函数
- 在 outliner DOM 上方插入搜索行和过滤行
- 使用 MutationObserver 监听 outliner childList 变化，在变化后执行过滤逻辑
- 过滤逻辑：遍历 outliner `.option` 子元素，根据 `editor.scene.getObjectById(option.value)` 获取对象，判断是否为内部对象（Camera、Scene、`$` 前缀），设置 `display: none`

### Fix 1.3 — 属性面板 tab 管理

**File**: `plugin/patches/SidebarPatches.js`

**Strategy**: 解决 r183 `SidebarProperties.toggleTabs` 与 MRPP `applySidebarPropertiesPatches` 的信号监听器竞争问题。

**Specific Changes**:
1. 在 `applySidebarPropertiesPatches` 中，找到 r183 原版 `SidebarProperties` 注册的 `objectSelected` 监听器（`toggleTabs`），将其从 `signals.objectSelected` 中移除
2. 方案：在 `wrapAsTabbedPanel` 包装 `#properties` 时，先移除 r183 原版的 geometry/material/script tab DOM 元素和对应的 panels，确保 MRPP 的 `clearTabbedPanel` + `addTab` 完全接管
3. 备选方案：在 deferred patch 中，通过 `signals.objectSelected._listeners` 或 `signals.objectSelected.memorize` 找到并移除 `toggleTabs` 监听器

### Fix 1.4 — 对象类型显示

**File**: `plugin/patches/SidebarPatches.js` 或 `plugin/ui/sidebar/Sidebar.ObjectExt.js`

**Strategy**: 确保 MRPP 的 `applyMrppUIValues` 在 r183 原版 `updateUI` 之后执行，覆盖类型显示。

**Specific Changes**:
1. 在 `injectSidebarObjectExtensions` 中，确保 `objectSelected` 和 `objectChanged` 信号的 MRPP 监听器在原版监听器之后注册（信号按注册顺序触发）
2. 使用 `setTimeout(0)` 延迟执行 `applyMrppUIValues`，确保在原版 `updateUI` 之后覆盖
3. 确认 `getLocalizedObjectType` 正确读取 `object.userData.type`（优先）和 `object.type`（回退）

### Fix 1.5 — 隐藏 UUID/Shadow 行

**File**: `plugin/ui/sidebar/Sidebar.ObjectExt.js`

**Strategy**: 在 `injectSidebarObjectExtensions` 中，通过 DOM 查询找到 UUID 行和 Shadow 相关行并隐藏。

**Specific Changes**:
1. 在 `applyMrppRowVisibility` 函数中新增逻辑：
   - 查找 UUID 行（label 为 `strings.getKey('sidebar/object/uuid')`）并设置 `display: none`
   - 查找 Shadow 行（label 为 `strings.getKey('sidebar/object/shadow')`）及其子行（shadowIntensity、shadowBias、shadowNormalBias、shadowRadius）并设置 `display: none`
   - 查找 frustumCulled 行和 renderOrder 行并设置 `display: none`（MRPP 不需要）
   - 查找 Export JSON 按钮并隐藏

### Fix 1.6 — 隐藏 View/Render 菜单

**File**: `plugin/patches/MenubarPatches.js`

**Strategy**: 在 `applyMenubarPatches` 中移除 View 和 Render 菜单 DOM 元素。

**Specific Changes**:
1. 在 `applyMenubarPatches` 函数开头，遍历 menubar 子元素，找到 title 为 View 和 Render 的菜单容器
2. 使用 `menubarDom.removeChild()` 移除这两个菜单
3. 同时移除 Help 菜单（MRPP 模式不需要）

### Fix 1.7 — 隐藏 Animation 面板

**File**: `plugin/bootstrap/meta-bootstrap.js` 和 `plugin/bootstrap/verse-bootstrap.js`

**Strategy**: 在 deferred UI patches 中，通过 MutationObserver 检测 `#animation` 元素出现后将其隐藏。

**Specific Changes**:
1. 在 `applyDeferredUIPatches` 中新增 `tryHideAnimation()` 函数
2. 查找 `document.getElementById('animation')` 并设置 `display: none`
3. 同时查找 AnimationResizer（紧邻 animation 面板的 resizer 元素）并隐藏
4. 取消 `animationPanelChanged` 信号的 dispatch（或在 bootstrap 中 dispatch `false` 来隐藏）

### Fix 1.8 — 隐藏 shading 下拉框

**File**: `plugin/patches/ViewportPatches.js`

**Strategy**: 在 deferred UI patches 中，通过 DOM 查询找到 viewport controls 中的 shading select 并隐藏。

**Specific Changes**:
1. 在 `applyDeferredUIPatches` 中新增 `tryPatchViewportControls()` 函数
2. 查找 `#viewport` 内的控件面板，找到第二个 `<select>` 元素（第一个是 camera select，第二个是 shading select）
3. 设置 shading select 的 `display: none`

## Testing Strategy

### Validation Approach

测试策略分两阶段：首先在未修复代码上验证缺陷存在（探索性测试），然后验证修复正确且不引入回归。

### Exploratory Bug Condition Checking

**Goal**: 在实施修复前，确认 8 个缺陷确实存在，验证根因分析。

**Test Plan**: 在浏览器中以 MRPP 模式加载编辑器，逐一检查每个 UI 组件的状态。

**Test Cases**:
1. **层级搜索/过滤测试**: 打开 meta-editor.html，检查层级 tab 顶部是否有搜索框（预期：无，确认 Bug 1.1）
2. **内部对象过滤测试**: 打开 meta-editor.html，检查层级树是否显示 Camera/Scene（预期：显示，确认 Bug 1.2）
3. **属性面板 tab 测试**: 选中一个 polygen 对象，检查属性面板 tab（预期：显示原版 tab，确认 Bug 1.3）
4. **类型显示测试**: 选中 polygen 对象，检查类型字段（预期：显示 "Object3D"，确认 Bug 1.4）
5. **UUID/Shadow 行测试**: 选中任意对象，检查属性面板（预期：显示 UUID 和 Shadow 行，确认 Bug 1.5）
6. **菜单栏测试**: 检查菜单栏（预期：显示 View/Render 菜单，确认 Bug 1.6）
7. **Animation 面板测试**: 检查编辑器底部（预期：显示 Animation 面板，确认 Bug 1.7）
8. **Shading 下拉框测试**: 检查视口右上角（预期：显示 shading 下拉框，确认 Bug 1.8）

**Expected Counterexamples**:
- 所有 8 个 UI 元素在 MRPP 模式下可见/缺失，与 bugfix.md 描述一致
- 根因：r183 新增 UI 元素未被 patch 层处理

### Fix Checking

**Goal**: 验证修复后，所有 8 个缺陷在 MRPP 模式下正确解决。

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition(state) DO
  result := loadEditor_fixed(state)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: 验证修复不影响非 MRPP 模式和已有 MRPP 功能。

**Pseudocode:**
```
FOR ALL state WHERE NOT isBugCondition(state) DO
  ASSERT loadEditor_original(state) = loadEditor_fixed(state)
END FOR
```

**Testing Approach**: 手动测试为主（UI 渲染测试难以自动化），辅以代码审查确保 patch 逻辑仅在 MRPP 模式下生效。

**Test Cases**:
1. **原版编辑器保留测试**: 打开 index.html（原版），验证 View/Render/Animation/shading 等全部正常显示
2. **变换操作保留测试**: MRPP 模式下选中对象，修改位置/旋转/缩放，验证 undo/redo 正常
3. **Tab 切换保留测试**: MRPP 模式下切换层级/事件/截图 tab，验证内容正确切换
4. **相机切换保留测试**: MRPP 模式下使用 CAMERA 下拉框切换相机，验证视口正确更新

### Unit Tests

- 测试 `getHierarchyLabel` 返回正确的层级标签
- 测试 `findMenuOptions` 正确定位菜单选项容器
- 测试 `clearTabbedPanel` 正确清理 tab 和 panel 数组
- 测试内部对象过滤逻辑（Camera/Scene/$lights 被过滤）

### Property-Based Tests

- 生成随机 editor.type 值，验证 MRPP 模式判断逻辑正确
- 生成随机对象类型，验证 `getLocalizedObjectType` 返回正确类型名
- 生成随机 UI 状态，验证 `applyMrppRowVisibility` 正确隐藏/显示行

### Integration Tests

- 完整加载 meta-editor.html，验证所有 8 个修复点
- 完整加载 verse-editor.html，验证所有 8 个修复点
- 完整加载 index.html（原版），验证无回归
