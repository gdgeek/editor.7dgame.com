# develop 分支待合并修改

> 对比基准：`feature/editor-plugin-separation` 分支
> 检查时间：2026-03-25

## 概述

develop 分支相对于本分支（feature/editor-plugin-separation）有 1 个新提交需要合并。

## 修改详情

### 提交：`f307127` — 场景编辑菜单替换为实体导航功能

- 作者：MervinTT02
- 日期：2026-03-25

#### 目的

在 verse 编辑器中新增"实体"菜单，替代原来的"场景"菜单。用户可以通过该菜单快速导航到已加载的实体（module），点击后发送 `edit-meta` 消息跳转到对应实体的编辑页面。

#### 修改的文件

| 文件 | 变更 | 说明 |
|---|---|---|
| `three.js/editor/js/Menubar.Entity.js` | 新增 | 实体导航菜单组件，214 行 |
| `three.js/editor/js/Menubar.js` | 修改 | verse 模式下添加 MenubarEntity 菜单 |
| `three.js/editor/js/Strings.js` | 修改 | 5 种语言新增 `menubar/entity` 和 `menubar/entity/empty` 翻译 |

#### 功能细节

- `MenubarEntity` 组件从多个数据源提取实体列表（`messageReceive` 的 load/entity-list/loaded-entities/meta-list 消息，以及场景中的 module 类型对象）
- 支持去重（按 id）和多种数据格式兼容（id/meta_id/metaId/entityId 等字段名）
- 点击实体菜单项发送 `edit-meta` 消息，携带 `meta_id` 和 `meta_name`
- 场景图变化时自动刷新实体列表
- 空状态显示"暂无已加载实体"

#### 合并注意事项

此提交直接修改了 `three.js/editor/js/Menubar.js` 和 `three.js/editor/js/Strings.js`，与本分支的重构有冲突：

1. `Menubar.js` — 本分支已恢复为 r140 原版（移除了所有 MRPP import 和条件分支），develop 的修改在 MRPP 版本的 Menubar.js 上添加了 `MenubarEntity` import 和 verse 条件分支。合并时需要将 `MenubarEntity` 的注入逻辑移到 `plugin/patches/MenubarPatches.js` 中。
2. `Strings.js` — 本分支未修改 Strings.js（保持现状），develop 添加了新的翻译 key。这部分可以直接合并。
3. `Menubar.Entity.js` — 新文件，无冲突。但按照本分支的架构，它应该放在 `plugin/ui/menubar/` 目录下，而不是 `three.js/editor/js/` 下。
