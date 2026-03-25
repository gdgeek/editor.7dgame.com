# Tasks — r183 UI Rendering Fixes

## Priority Legend
- P0: 阻塞性问题（UI 完全不可用）
- P1: 核心功能缺失
- P2: 次要 UI 问题

---

- [x] 1. [P0] 隐藏 r183 新增菜单（View/Render/Help）— Bug 1.6
  - [x] 1.1 在 `plugin/patches/MenubarPatches.js` 的 `applyMenubarPatches` 函数中，遍历 menubar 子元素，找到 title 为 View、Render、Help 的菜单容器并 `removeChild` 移除
  - [x] 1.2 验证：MRPP 模式下菜单栏只显示 文件/编辑/添加 + MRPP 自定义菜单（场景或截图/跳转）+ Status
  - [x] 1.3 验证：原版 index.html 不受影响（applyMenubarPatches 仅在 MRPP bootstrap 中调用）

- [x] 2. [P0] 隐藏 r183 新增 Animation 面板和 AnimationResizer — Bug 1.7
  - [x] 2.1 在 `plugin/bootstrap/meta-bootstrap.js` 和 `plugin/bootstrap/verse-bootstrap.js` 的 `applyDeferredUIPatches` 中新增 `tryHideAnimation()` 函数
  - [x] 2.2 `tryHideAnimation` 通过 `document.getElementById('animation')` 找到 Animation 面板并设置 `display: none`
  - [x] 2.3 同时找到 AnimationResizer 元素（id 为 `animationResizer` 或紧邻 animation 的 resizer）并隐藏
  - [x] 2.4 dispatch `editor.signals.animationPanelChanged.dispatch(false)` 重置 viewport/toolbar 的 bottom 偏移

- [x] 3. [P0] 修复属性面板 tab 管理竞争 — Bug 1.3
  - [x] 3.1 分析 r183 `SidebarProperties.js` 的 `toggleTabs` 函数如何注册到 `signals.objectSelected`
  - [x] 3.2 在 `applySidebarPropertiesPatches` 中，移除 r183 原版的 geometry/material/script tab（从 DOM 和 wrapper 数组中移除），确保 MRPP 完全接管 tab 管理
  - [x] 3.3 禁用 r183 `SidebarProperties` 的 `toggleTabs` 监听器：通过在 propertiesWrapper 上设置标记，或在 MRPP objectSelected 监听器中重新执行 clearTabbedPanel 覆盖
  - [x] 3.4 验证：选中 polygen 对象时显示"属性"+"组件" tab；选中 entity/point 时显示"属性"+"命令" tab；选中 text 时显示"属性"+"文本" tab

- [x] 4. [P1] 隐藏属性面板多余行（UUID/Shadow 等）— Bug 1.5
  - [x] 4.1 在 `plugin/ui/sidebar/Sidebar.ObjectExt.js` 的 `applyMrppRowVisibility` 函数中新增隐藏逻辑
  - [x] 4.2 通过 `findRowByLabel` 查找并隐藏以下行：UUID 行、Shadow 行、shadowIntensity 行、shadowBias 行、shadowNormalBias 行、shadowRadius 行、frustumCulled 行、renderOrder 行
  - [x] 4.3 隐藏 Export JSON 按钮（查找 container 中最后一个 button 元素）
  - [x] 4.4 验证：MRPP 模式下属性面板只显示 类型/名称/位置/旋转/缩放/可见性/自定义数据 + MRPP 扩展行

- [x] 5. [P1] 修复对象类型显示 — Bug 1.4
  - [x] 5.1 在 `plugin/ui/sidebar/Sidebar.ObjectExt.js` 的 `applyMrppUIValues` 中，使用 `setTimeout(0)` 延迟执行类型覆盖，确保在 r183 原版 `updateUI` 之后执行
  - [x] 5.2 确认 `getLocalizedObjectType` 优先读取 `object.userData.type`，回退到 `object.type`
  - [x] 5.3 验证：选中 polygen 对象时类型字段显示 "Polygen"（或对应本地化名称）

- [x] 6. [P1] 隐藏视口 shading 下拉框 — Bug 1.8
  - [x] 6.1 在 `plugin/bootstrap/meta-bootstrap.js` 和 `plugin/bootstrap/verse-bootstrap.js` 的 `applyDeferredUIPatches` 中新增 `tryPatchViewportControls()` 函数
  - [x] 6.2 查找 `#viewport` 内的控件面板，定位第二个 `select` 元素（shading select）并设置 `display: none`
  - [x] 6.3 验证：MRPP 模式下视口右上角只显示 CAMERA 下拉框

- [x] 7. [P1] 层级树内部对象过滤 — Bug 1.2
  - [x] 7.1 在 `plugin/patches/SidebarPatches.js` 中新增 `injectOutlinerFilter(editor)` 函数
  - [x] 7.2 使用 MutationObserver 监听 `#outliner` 的 childList 变化
  - [x] 7.3 在每次变化后遍历 `.option` 子元素，通过 `editor.scene.getObjectById(option.value)` 获取对象，隐藏 Camera（`object === editor.camera`）、Scene 根节点（`object === editor.scene`）、以 `$` 开头的对象
  - [x] 7.4 在 `applySidebarPatches` 中调用 `injectOutlinerFilter`
  - [x] 7.5 验证：MRPP 模式下层级树只显示用户添加的场景对象

- [x] 8. [P2] 层级树搜索/过滤 UI — Bug 1.1
  - [x] 8.1 在 `plugin/patches/SidebarPatches.js` 中新增 `injectOutlinerSearchUI(editor, sidebarDom)` 函数
  - [x] 8.2 在 `#outliner` 上方注入搜索输入框（UIInput）和过滤下拉框（UISelect，选项：全部/网格/灯光/相机等）
  - [x] 8.3 搜索框 `onInput` 时按对象名称过滤 outliner 选项（设置不匹配项 `display: none`）
  - [x] 8.4 过滤下拉框 `onChange` 时按对象类型过滤
  - [x] 8.5 验证：搜索和过滤功能正常工作，与 r140 行为一致

- [x] 9. [P0] 回归测试
  - [x] 9.1 在原版 index.html 中验证所有 UI 元素正常显示（View/Render/Animation/shading 等）
  - [x] 9.2 在 meta-editor.html 中验证所有 8 个修复点
  - [x] 9.3 在 verse-editor.html 中验证所有 8 个修复点
  - [x] 9.4 在 MRPP 模式下验证变换操作、undo/redo、tab 切换、相机切换等已有功能正常
