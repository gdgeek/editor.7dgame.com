# 实施计划：MRPP 业务代码与 Three.js Editor 结构分离

## 概述

本计划将 GDGeek Editor 中所有 MRPP 自定义业务代码从 `three.js/editor/js/` 目录迁移到独立的 `plugin/` 目录。采用增量迁移策略，每一步完成后都可验证，确保功能不中断。所有文件保持 JavaScript，不引入新构建工具，保持 three.js r140 不变。

## 任务

- [x] 1. 创建 plugin 目录结构并迁移核心业务逻辑
  - [x] 1.1 创建 plugin/ 目录及所有子目录结构
    - 在项目根目录创建 `plugin/` 目录
    - 创建子目录：`mrpp/`、`mrpp/components/`、`mrpp/commands/`、`utils/`、`access/`、`ui/sidebar/`、`ui/menubar/`、`commands/`、`i18n/`、`bootstrap/`
    - _需求: 1.1, 1.2_

  - [x] 1.2 迁移 mrpp/ 核心业务逻辑文件到 plugin/mrpp/
    - 将以下文件从 `three.js/editor/js/mrpp/` 复制到 `plugin/mrpp/`：Builder.js、CommandContainer.js、ComponentContainer.js、EditorLoader.js、EventContainer.js、Factory.js、MetaFactory.js、MetaLoader.js、VerseFactory.js、VerseLoader.js
    - 将 `three.js/editor/js/mrpp/components/` 下所有文件复制到 `plugin/mrpp/components/`：ActionComponent.js、MovedComponent.js、RotateComponent.js、TooltipComponent.js、TriggerComponent.js
    - 将 `three.js/editor/js/mrpp/commands/` 下所有文件复制到 `plugin/mrpp/commands/`：GestureCommand.js、VoiceCommand.js
    - 更新 `plugin/mrpp/` 中所有文件的 import 路径：
      - `import * as THREE from 'three'` 保持不变（通过 import map）
      - three.js 库引用如 `'../../../examples/jsm/loaders/GLTFLoader.js'` 改为 `'../../three.js/examples/jsm/loaders/GLTFLoader.js'`
      - 内部互引保持相对路径（如 `'./Factory.js'`）
      - 引用 plugin/utils/ 使用 `'../utils/TextUtils.js'` 等
    - _需求: 2.1, 2.2, 2.3, 9.2, 9.3, 9.4_

  - [x] 1.3 迁移 utils/ 工具函数到 plugin/utils/
    - 将以下文件从 `three.js/editor/js/utils/` 复制到 `plugin/utils/`：DialogUtils.js、ScreenshotUtils.js、TextUtils.js、WebpUtils.js、GlobalShortcuts.js、UnsavedEntityGuard.js、screenshot.mp3
    - 更新 `plugin/utils/` 中文件的 import 路径（如 three.js 库引用）
    - _需求: 3.1, 9.2, 9.3_

  - [x] 1.4 迁移 Access.js 到 plugin/access/
    - 将 `three.js/editor/js/Access.js` 复制到 `plugin/access/Access.js`
    - Access.js 无外部依赖，无需更新 import 路径
    - _需求: 7.1_

- [x] 2. 检查点 - 确认 plugin 目录文件完整
  - 确认 plugin/ 目录下所有文件已正确创建，内容完整，import 路径已更新。如有问题请向用户确认。

- [x] 3. 迁移自定义 UI 组件和命令文件
  - [x] 3.1 迁移自定义 Sidebar 面板到 plugin/ui/sidebar/
    - 将以下文件从 `three.js/editor/js/` 复制到 `plugin/ui/sidebar/`：Sidebar.Component.js、Sidebar.Command.js、Sidebar.Meta.js、Sidebar.Media.js、Sidebar.Screenshot.js、Sidebar.Text.js、Sidebar.MultipleObjects.js、Sidebar.Events.js、Sidebar.Animation.js、Sidebar.Blockly.js
    - 更新所有 import 路径：
      - `import { UIPanel, ... } from './libs/ui.js'` → `import { UIPanel, ... } from '../../three.js/editor/js/libs/ui.js'`
      - `import { SetValueCommand } from './commands/SetValueCommand.js'` → `import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js'`
      - 引用 plugin 内部模块使用相对路径（如 `'../utils/ScreenshotUtils.js'`、`'../../plugin/mrpp/...'` 等）
    - _需求: 4.1, 9.2, 9.3_

  - [x] 3.2 迁移自定义 Menubar 文件到 plugin/ui/menubar/
    - 将以下文件从 `three.js/editor/js/` 复制到 `plugin/ui/menubar/`：Menubar.Component.js、Menubar.Command.js、Menubar.Replace.js、Menubar.Goto.js、Menubar.Screenshot.js、Menubar.Scene.js
    - 更新所有 import 路径（同 Sidebar 策略）
    - _需求: 5.1, 9.2, 9.3_

  - [x] 3.3 迁移自定义 undo/redo 命令到 plugin/commands/
    - 将以下文件从 `three.js/editor/js/commands/` 复制到 `plugin/commands/`：AddComponentCommand.js、RemoveComponentCommand.js、SetComponentValueCommand.js、AddCommandCommand.js、RemoveCommandCommand.js、SetCommandValueCommand.js、AddEventCommand.js、RemoveEventCommand.js、SetEventValueCommand.js、MoveMultipleObjectsCommand.js、MultiTransformCommand.js
    - 更新 import 路径：`import { Command } from '../Command.js'` → `import { Command } from '../three.js/editor/js/Command.js'`
    - _需求: 6.1, 6.2, 9.2, 9.3_

- [x] 4. 检查点 - 确认所有 UI 和命令文件迁移完成
  - 确认 plugin/ui/sidebar/、plugin/ui/menubar/、plugin/commands/ 下所有文件已正确创建，import 路径已更新。如有问题请向用户确认。

- [x] 5. 提取 i18n 字符串并创建 bootstrap 模块
  - [x] 5.1 提取 MRPP 国际化字符串到 plugin/i18n/MrppStrings.js
    - 从 `three.js/editor/js/Strings.js` 中识别所有 MRPP 特有字符串键（参见设计文档中的完整键前缀列表）
    - 创建 `plugin/i18n/MrppStrings.js`，导出包含所有 5 种语言（en-us, zh-cn, ja-jp, zh-tw, th-th）的 MRPP 字符串对象
    - 确保所有字符串值与原始 Strings.js 中完全一致
    - _需求: 8.1, 8.3, 8.4_

  - [x] 5.2 创建 plugin/bootstrap/meta-bootstrap.js
    - 从 `meta-editor.html` 的 `<script type="module">` 中提取 MRPP 特有初始化逻辑
    - 封装为 `initMetaEditor(editor)` 函数，包含：
      - `editor.type = 'meta'` 设置
      - `messageSend` 信号处理（postMessage 到父窗口，`from: 'scene.meta.editor'`）
      - `initializeGlobalShortcuts(editor)` 调用
      - `MetaLoader` 实例化与 `editor.metaLoader` 赋值
      - `window.addEventListener('message', ...)` 监听（check-unsaved-changes、save-before-leave、消息转发）
      - `messageReceive` 信号处理（load、user-info、available-resource-types）
      - `messageSend.dispatch({ action: 'ready' })` 就绪通知
    - _需求: 11.1, 11.3, 11.5_

  - [x] 5.3 创建 plugin/bootstrap/verse-bootstrap.js
    - 从 `verse-editor.html` 的 `<script type="module">` 中提取 MRPP 特有初始化逻辑
    - 封装为 `initVerseEditor(editor)` 函数，包含：
      - `editor.type = 'verse'` 设置
      - `messageSend` 信号处理（postMessage 到父窗口，`from: 'scene.verse.editor'`）
      - `initializeGlobalShortcuts(editor)` 调用
      - `VerseLoader` 实例化与 `editor.verseLoader` 赋值
      - `window.addEventListener('message', ...)` 监听（check-unsaved-changes、save-before-leave、消息转发）
      - `messageReceive` 信号处理（load、user-info）
      - `messageSend.dispatch({ action: 'ready' })` 就绪通知
    - _需求: 11.2, 11.4, 11.5_

- [x] 6. 检查点 - 确认 i18n 和 bootstrap 模块创建完成
  - 确认 plugin/i18n/MrppStrings.js 包含所有 MRPP 字符串，plugin/bootstrap/ 下两个文件逻辑完整。如有问题请向用户确认。

- [x] 7. 更新原版文件的 import 路径和侵入式修改标记
  - [x] 7.1 更新 Editor.js 的 import 路径并添加 MRPP 标记注释
    - 将 `import { DialogUtils } from './utils/DialogUtils.js'` 改为 `import { DialogUtils } from '../../../plugin/utils/DialogUtils.js'`
    - 将 `import { Access } from './Access.js'` 改为 `import { Access } from '../../../plugin/access/Access.js'`
    - 在所有 MRPP 侵入式修改处添加 `// --- MRPP MODIFICATION START ---` 和 `// --- MRPP MODIFICATION END ---` 注释（包括：自定义信号定义、语言映射、Access 实例化、多选逻辑、commands 初始化、DialogUtils 调用等）
    - _需求: 9.1, 12.1_

  - [x] 7.2 更新 Sidebar.js 的 import 路径并添加 MRPP 标记注释
    - 将所有 MRPP 自定义 Sidebar 的 import 路径从 `'./Sidebar.*.js'` 改为 `'../../../plugin/ui/sidebar/Sidebar.*.js'`
    - 在 MRPP 侵入式修改处添加标记注释（包括：自定义面板 import、editor.type 条件分支、getHierarchyLabel 函数等）
    - _需求: 9.1, 12.2_

  - [x] 7.3 更新 Menubar.js 的 import 路径并添加 MRPP 标记注释
    - 将所有 MRPP 自定义 Menubar 的 import 路径从 `'./Menubar.*.js'` 改为 `'../../../plugin/ui/menubar/Menubar.*.js'`
    - 在 MRPP 侵入式修改处添加标记注释（包括：自定义菜单 import、editor.type 条件分支等）
    - _需求: 9.1, 12.3_

  - [x] 7.4 更新 Menubar.Add.js 并添加 MRPP 标记注释
    - 更新文件中引用 MRPP 模块的 import 路径（如 MetaFactory、Builder 等），指向 `plugin/` 中的新位置
    - 在所有 MRPP 侵入式修改处添加标记注释（包括：自定义资源类型菜单项、loadResource 函数、editor.type 条件分支等）
    - _需求: 9.1, 12.4_

  - [x] 7.5 更新 Sidebar.Object.js 并添加 MRPP 标记注释
    - 更新文件中引用 MRPP 模块的 import 路径，指向 `plugin/` 中的新位置
    - 在所有 MRPP 侵入式修改处添加标记注释（包括：媒体控制、sortingOrder、文本组件显示、Access 权限检查等）
    - _需求: 9.1, 12.5_

  - [x] 7.6 更新 Loader.js 并添加 MRPP 标记注释
    - 更新文件中引用 MRPP 模块的 import 路径（如有），指向 `plugin/` 中的新位置
    - 在 MRPP 侵入式修改处添加标记注释
    - _需求: 9.1, 12.6_

  - [x] 7.7 更新 Strings.js 合并 MRPP 字符串
    - 在 Strings.js 顶部添加 `import { mrppStrings } from '../../../plugin/i18n/MrppStrings.js'`
    - 在每种语言的字符串对象中，使用展开运算符 `...mrppStrings["en-us"]` 合并 MRPP 字符串
    - 从 Strings.js 中移除已提取到 MrppStrings.js 的 MRPP 字符串键值对
    - 在修改处添加 `// --- MRPP MODIFICATION START ---` 和 `// --- MRPP MODIFICATION END ---` 标记注释
    - _需求: 8.2, 8.3, 8.4_

  - [x] 7.8 更新 Commands.js 注册表
    - 在 `three.js/editor/js/commands/Commands.js` 中，将 MRPP 自定义命令的 export 路径从本地路径改为指向 `plugin/commands/` 的路径
    - 添加 `// --- MRPP MODIFICATION START ---` 和 `// --- MRPP MODIFICATION END ---` 标记注释
    - 确保所有 11 个自定义命令的 export 路径正确
    - _需求: 6.3, 12.7_

- [x] 8. 检查点 - 确认所有原版文件更新完成
  - 确认 Editor.js、Sidebar.js、Menubar.js、Menubar.Add.js、Sidebar.Object.js、Loader.js、Strings.js、Commands.js 中的 import 路径和标记注释都已正确更新。如有问题请向用户确认。

- [x] 9. 更新 HTML 入口文件并清理旧文件
  - [x] 9.1 更新 meta-editor.html
    - 将 `import { MetaLoader } from './js/mrpp/MetaLoader.js'` 改为 `import { initMetaEditor } from '../../plugin/bootstrap/meta-bootstrap.js'`
    - 将 `import { initializeGlobalShortcuts } from './js/utils/GlobalShortcuts.js'` 移除（已在 bootstrap 中处理）
    - 将 `<script type="module">` 中的 MRPP 业务初始化逻辑替换为 `initMetaEditor(editor)` 调用
    - 保留 Editor 通用初始化代码（Viewport、Toolbar、Sidebar、Menubar 创建和挂载、storage 初始化、drag/drop、resize 等）
    - _需求: 10.1, 10.3, 11.3, 11.5_

  - [x] 9.2 更新 verse-editor.html
    - 将 `import { VerseLoader } from './js/mrpp/VerseLoader.js'` 改为 `import { initVerseEditor } from '../../plugin/bootstrap/verse-bootstrap.js'`
    - 将 `import { initializeGlobalShortcuts } from './js/utils/GlobalShortcuts.js'` 移除（已在 bootstrap 中处理）
    - 将 `<script type="module">` 中的 MRPP 业务初始化逻辑替换为 `initVerseEditor(editor)` 调用
    - 保留 Editor 通用初始化代码
    - _需求: 10.2, 10.3, 11.4, 11.5_

  - [x] 9.3 删除旧的 MRPP 文件
    - 删除 `three.js/editor/js/mrpp/` 整个目录
    - 删除 `three.js/editor/js/utils/` 整个目录
    - 删除 `three.js/editor/js/Access.js`
    - 删除 `three.js/editor/js/` 中已迁移的自定义 Sidebar 文件：Sidebar.Component.js、Sidebar.Command.js、Sidebar.Meta.js、Sidebar.Media.js、Sidebar.Screenshot.js、Sidebar.Text.js、Sidebar.MultipleObjects.js、Sidebar.Events.js、Sidebar.Animation.js、Sidebar.Blockly.js
    - 删除 `three.js/editor/js/` 中已迁移的自定义 Menubar 文件：Menubar.Component.js、Menubar.Command.js、Menubar.Replace.js、Menubar.Goto.js、Menubar.Screenshot.js、Menubar.Scene.js
    - 删除 `three.js/editor/js/commands/` 中已迁移的自定义命令文件：AddComponentCommand.js、RemoveComponentCommand.js、SetComponentValueCommand.js、AddCommandCommand.js、RemoveCommandCommand.js、SetCommandValueCommand.js、AddEventCommand.js、RemoveEventCommand.js、SetEventValueCommand.js、MoveMultipleObjectsCommand.js、MultiTransformCommand.js
    - _需求: 2.4, 3.2, 4.2, 5.2, 6.2, 7.2_

- [x] 10. 最终检查点 - 全面验证
  - 确认所有文件迁移完成，旧文件已删除
  - 确认所有 import 路径正确（无断裂引用）
  - 确认 MRPP 标记注释格式统一
  - 确认 `server.js` 无需修改即可服务 `plugin/` 目录
  - 如有问题请向用户确认
  - _需求: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 11. 编写属性测试验证重构正确性
  - [x] 11.1 编写属性测试：Import 路径有效性
    - **Property 1: Import 路径有效性**
    - 扫描 `plugin/` 和 `three.js/editor/js/` 中所有 JS 文件，提取 import 语句中的相对路径，解析为绝对路径后检查文件是否存在
    - 使用 fast-check 生成随机文件索引来选择要验证的文件
    - **验证: 需求 6.3, 9.1, 9.2, 9.3**

  - [x] 11.2 编写属性测试：i18n 字符串完整性
    - **Property 2: i18n 字符串完整性**
    - 维护重构前的 MRPP 字符串键值快照，使用 fast-check 从所有键×语言组合中随机抽取，验证重构后返回值与快照一致
    - **验证: 需求 8.3, 8.4, 13.6**

  - [x] 11.3 编写属性测试：three.js 引用方式不变
    - **Property 3: three.js 引用方式不变**
    - 扫描 `plugin/` 目录下所有 JS 文件，提取包含 three 的 import 语句，验证模块标识符为 `'three'` 而非相对路径
    - **验证: 需求 9.4**

  - [x] 11.4 编写属性测试：无 TypeScript 文件
    - **Property 4: 无 TypeScript 文件**
    - 递归扫描 `plugin/` 目录，验证所有文件扩展名不为 `.ts` 或 `.tsx`
    - **验证: 需求 14.1**

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务确保增量验证，及时发现问题
- 属性测试验证重构的核心正确性属性
- 手动验收测试（启动 `node server.js` 后访问 meta-editor.html 和 verse-editor.html）需在所有任务完成后由用户执行
