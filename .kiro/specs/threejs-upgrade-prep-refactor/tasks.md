# Implementation Plan: Three.js 升级前期重构准备

## 概述

将 12 个 three.js editor 原版文件中的 77 处侵入式 MRPP 修改外部化到 `plugin/` 层。按依赖顺序执行：先创建 patch 模块（EditorPatches 为基础），再创建 UI 扩展模块，然后更新 bootstrap 调用 patches，接着恢复原版文件，最后编写属性测试验证。

## Tasks

- [x] 1. 创建 EditorPatches 核心 patch 模块
  - [x] 1.1 创建 `plugin/patches/EditorPatches.js`，实现 `applyEditorPatches(editor)` 函数
    - 向 `editor.signals` 添加 20 个自定义信号（upload, release, savingStarted, savingFinished, objectsChanged, componentAdded/Changed/Removed, eventAdded/Changed/Removed, commandAdded/Changed/Removed, showGroundChanged, messageSend, messageReceive, notificationAdded, doneLoadObject, multipleObjectsTransformChanged）
    - 向 `editor` 添加自定义属性（type, resources, selectedObjects, access, multiSelectGroup, data）
    - 向 `editor` 添加自定义方法（save, showNotification, showConfirmation, getSelectedObjects, clearSelection）
    - 实现语言映射逻辑（URL 参数 → config.setKey），从 Editor.js 顶层移入
    - 导入 DialogUtils 和 Access，在 patch 中使用而非在 Editor.js 中导入
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 1.2 在 `applyEditorPatches` 中实现 monkey-patch 方法扩展
    - Monkey-patch `editor.addObject`：添加 commands 初始化、parent/index 参数支持、资源同步
    - Monkey-patch `editor.removeObject`：添加 selectedObjects 清理
    - Monkey-patch `editor.select`：添加 multiSelect 支持
    - Monkey-patch `editor.clear`：添加 selectedObjects 清空
    - Monkey-patch `editor.setScene`：添加 commands 初始化遍历
    - Monkey-patch `editor.fromJSON`：添加 resources 保存
    - Monkey-patch `editor.toJSON`：添加 resources 字段
    - 所有 monkey-patch 遵循安全模式：保存原始方法、异常隔离、参数透传
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 1.3 编写 EditorPatches 属性测试：MRPP 扩展注册完整性
    - **Property 3: MRPP 扩展注册完整性**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - 创建 `three.js/editor/test/properties/editor-extensions.test.js`
    - 验证 applyEditorPatches 后所有信号、属性、方法存在且类型正确

  - [ ]* 1.4 编写语言映射属性测试
    - **Property 4: 语言映射正确性**
    - **Validates: Requirements 2.1**
    - 创建 `three.js/editor/test/properties/language-mapping.test.js`
    - 验证所有映射对正确转换，未知输入不修改 config

- [x] 2. 创建 LoaderPatches 和 ViewportPatches 模块
  - [x] 2.1 创建 `plugin/patches/LoaderPatches.js`，实现 `applyLoaderPatches(editor)` 函数
    - 封装 KTX2Loader 懒初始化逻辑（ensureKTX2）
    - Monkey-patch `editor.loader.loadFiles`：在含 ktx2/glb/gltf 文件时初始化 KTX2
    - Monkey-patch `editor.loader.loadFile`：在 glb/gltf case 中设置 KTX2Loader
    - Monkey-patch handleZIP 内部逻辑（通过包装 loadFile 间接处理）
    - _Requirements: 10.1, 10.2_

  - [x] 2.2 创建 `plugin/patches/ViewportPatches.js`，实现 `applyViewportPatches(editor)` 函数
    - 注入 MultiTransformCommand 使用逻辑
    - 通过信号监听方式注入多选变换逻辑
    - multiSelectGroup 管理、多选包围盒计算
    - _Requirements: 14.1_

  - [x] 2.3 创建 `plugin/patches/UIThreePatches.js`，实现 `applyUIThreePatches(editor)` 函数
    - Monkey-patch UIOutliner 的拖拽处理逻辑，注入 MoveMultipleObjectsCommand
    - _Requirements: 13.1_

- [x] 3. Checkpoint - 确保 patch 模块结构正确
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 创建 UI 扩展模块
  - [x] 4.1 创建 `plugin/ui/menubar/Menubar.MrppAdd.js`，实现 `injectMrppAddMenu(editor, addMenuOptions)` 函数
    - Meta 模式：entity/text/资源类型菜单项、loadResource/loadPhototype、messageReceive 处理
    - Verse 模式：meta 菜单项、add-module 消息处理
    - 管理 window.resources 全局资源映射
    - _Requirements: 7.1, 7.2_

  - [x] 4.2 创建 `plugin/ui/menubar/Menubar.MrppEdit.js`，实现 `injectMrppEditMenu(editor, editMenuOptions)` 函数
    - 多选克隆（含 components/commands 复制和 UUID 重生成）
    - 资源替换（replace-resource 消息处理）
    - 多选删除
    - Ctrl+C/V 复制粘贴、Del/Backspace 键盘快捷键
    - _Requirements: 8.1, 8.2_

  - [x] 4.3 创建 `plugin/ui/sidebar/Sidebar.ObjectExt.js`，实现 `injectSidebarObjectExtensions(editor, sidebarObjectContainer)` 函数
    - 变换数据复制粘贴 UI（位置/旋转/缩放 copy/paste 按钮）
    - 重置位置/旋转/缩放按钮
    - 悬停边框效果
    - 媒体 loop 控制、sortingOrder 选择器
    - 对象类型本地化（getLocalizedObjectType）
    - 编辑实体按钮、Access 权限检查
    - _Requirements: 9.1, 9.2_

- [x] 5. 创建 Sidebar 和 Menubar patch 模块
  - [x] 5.1 创建 `plugin/patches/SidebarPatches.js`，实现 `applySidebarPatches(editor, sidebarContainer)` 和 `applySidebarPropertiesPatches(editor, propertiesContainer)` 函数
    - 通过 DOM 操作添加 Events、Screenshot 等面板标签
    - 动态设置层级标签（getHierarchyLabel 逻辑）
    - 通过信号监听动态切换面板（MultipleObjects、Component、Command、Text、Animation）
    - _Requirements: 4.1, 4.2, 5.1_

  - [x] 5.2 创建 `plugin/patches/MenubarPatches.js`，实现 `applyMenubarPatches(editor, menubarContainer)` 函数
    - 通过 DOM 操作添加 Screenshot/Scene、Goto 菜单
    - 调用 Menubar.MrppAdd 和 Menubar.MrppEdit 注入逻辑
    - _Requirements: 6.1_

- [x] 6. Checkpoint - 确保所有 patch 和 UI 模块创建完成
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 更新 Bootstrap 模块调用 patches
  - [x] 7.1 更新 `plugin/bootstrap/meta-bootstrap.js`
    - 在 `initMetaEditor` 函数开头导入并调用所有 patch 函数
    - 调用顺序：applyEditorPatches → applyLoaderPatches → applyViewportPatches → applyUIThreePatches → applySidebarPatches → applyMenubarPatches → applySidebarPropertiesPatches
    - 保留现有的消息监听、MetaLoader 初始化等逻辑
    - _Requirements: 1.1, 1.2, 1.3, 3.1_

  - [x] 7.2 更新 `plugin/bootstrap/verse-bootstrap.js`
    - 在 `initVerseEditor` 函数开头导入并调用所有 patch 函数
    - 调用顺序与 meta-bootstrap 一致
    - 保留现有的消息监听、VerseLoader 初始化等逻辑
    - _Requirements: 1.1, 1.2, 1.3, 3.1_

- [x] 8. 恢复原版文件（移除 MRPP 标记）
  - [x] 8.1 恢复 `three.js/editor/js/Editor.js` 为原版
    - 移除所有 MRPP import（DialogUtils, Access）
    - 移除语言映射常量和 URL 参数解析
    - 移除 signals 中的所有 MRPP 自定义信号
    - 移除 selectedObjects、type、resources、access 属性初始化
    - 恢复 addObject、removeObject、select、clear、setScene、fromJSON、toJSON 为原版实现
    - 移除 save、showNotification、showConfirmation、getSelectedObjects、clearSelection 方法
    - 目标：0 处 MRPP 标记
    - _Requirements: 1.4, 2.2, 2.3, 3.8, 16.3_

  - [x] 8.2 恢复 `three.js/editor/js/Sidebar.js` 为原版
    - 移除所有 plugin/ import（SidebarEvents, SidebarComponent, SidebarCommand, SidebarAnimation, SidebarMedia, SidebarScreenshot, SidebarText）
    - 移除 getHierarchyLabel 函数和 editor.type 条件分支
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 4.3, 4.4, 16.2_

  - [x] 8.3 恢复 `three.js/editor/js/Menubar.js` 为原版
    - 移除所有 plugin/ import（MenubarGoto, MenubarComponent, MenubarCommand, MenubarScreenshot, MenubarScene）
    - 移除 editor.type 条件分支
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 6.2, 6.3, 16.2_

  - [x] 8.4 恢复 `three.js/editor/js/Sidebar.Properties.js` 为原版
    - 移除所有 plugin/ import（SidebarMultipleObjects, SidebarComponent, SidebarCommand, SidebarText, SidebarAnimation）
    - 移除多选面板、组件面板、指令面板、文字面板、动画面板逻辑
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 5.2, 5.3, 16.2_

  - [x] 8.5 恢复 `three.js/editor/js/Menubar.Add.js` 为原版
    - 移除所有 plugin/ import（MetaFactory, VerseFactory, Builder）
    - 移除 editor.type 条件分支、loadResource、loadPhototype 等 MRPP 逻辑
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 7.3, 7.4, 16.3_

  - [x] 8.6 恢复 `three.js/editor/js/Menubar.Edit.js` 为原版
    - 移除 plugin/ import（MetaFactory, Builder）
    - 移除多选克隆、资源替换、多选删除、Ctrl+C/V、Del/Backspace 等 MRPP 逻辑
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 8.3, 8.4, 16.2_

  - [x] 8.7 恢复 `three.js/editor/js/Loader.js` 为原版
    - 移除 KTX2Loader import 和 ensureKTX2 函数
    - 移除 loadFiles/loadFile/handleZIP 中的 KTX2 相关代码
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 10.3, 10.4, 16.3_

  - [x] 8.8 恢复 `three.js/editor/js/Viewport.js` 为原版
    - 移除 MultiTransformCommand import
    - 移除多选变换相关的 MRPP 逻辑（multiSelectGroup、computeMultiSelectionBoundingBox 等）
    - 恢复为 three.js r140 原版实现
    - 目标：0 处 MRPP 标记
    - _Requirements: 14.2, 14.3, 16.3_

  - [x] 8.9 恢复 `three.js/editor/js/libs/ui.three.js` 为原版
    - 移除 MoveMultipleObjectsCommand import
    - 恢复 UIOutliner 拖拽逻辑为原版（使用 MoveObjectCommand）
    - 目标：0 处 MRPP 标记
    - _Requirements: 13.2, 16.3_

  - [x] 8.10 恢复 `three.js/editor/js/Sidebar.Object.js` 为原版
    - 移除 plugin/ import（MetaFactory, ABILITIES）
    - 移除变换复制粘贴 UI、重置按钮、悬停边框、媒体控制、sortingOrder、类型本地化、编辑实体按钮、Access 权限检查等 MRPP 逻辑
    - 恢复为 three.js r140 原版实现
    - 目标：0-5 处 MRPP 标记
    - _Requirements: 9.3, 9.4, 16.3_

- [x] 9. Checkpoint - 确保恢复后编辑器结构完整
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. 编写新增属性测试
  - [ ]* 10.1 编写 MRPP 标记数量属性测试
    - **Property 1: MRPP 标记数量合规**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4**
    - 创建 `three.js/editor/test/properties/mrpp-marker-count.test.js`
    - 验证每个原版文件的 MRPP 标记数量不超过目标上限，总计不超过 20

  - [ ]* 10.2 编写无 plugin 导入属性测试
    - **Property 2: 目标零标记文件无 plugin 导入**
    - **Validates: Requirements 4.3, 5.2, 6.2, 7.3, 8.3, 9.3, 10.3, 13.2, 14.2**
    - 创建 `three.js/editor/test/properties/no-plugin-imports.test.js`
    - 验证目标零标记文件中无 import 语句引用 plugin/ 目录

- [x] 11. 验证现有属性测试通过
  - [x] 11.1 运行现有 4 个属性测试确认通过
    - 运行 `import-paths.test.js`：验证所有 import 路径有效（含新增 plugin/patches/ 文件）
    - 运行 `i18n-completeness.test.js`：验证 MRPP 字符串合并不受影响
    - 运行 `three-reference.test.js`：验证新增 plugin 文件使用 bare specifier
    - 运行 `no-typescript.test.js`：验证新增文件均为 .js
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 12. Final checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Strings.js（6 处标记）和 Commands.js（1 处标记）保持现状不做修改（Requirements 11, 12）
- 每个 task 引用具体的 requirements 以确保可追溯性
- Checkpoints 确保增量验证
- Property tests 使用 vitest + fast-check，与现有测试保持一致
