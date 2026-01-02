# Three.js Editor 修改文档

> 本文档记录了对原始 three.js (v0.140.0) Editor 的所有修改，用于将来升级到更高版本时参考。

## 概述

本项目基于 **three.js r140** 版本进行修改，主要目的是创建一个用于 **MRPP (Meta/Verse) 场景编辑器**的定制版本。主要修改包括：

1. 新增两个编辑器入口（Meta Editor / Verse Editor）
2. 添加自定义资源类型（体素、模型、图片、视频、音频、粒子、文本等）
3. 新增组件系统（旋转、移动、触发、动作、提示组件）
4. 新增指令系统（语音、手势指令）
5. 添加权限管理系统
6. 自定义工具函数（截图、WebP 处理、文本渲染、对话框等）
7. 国际化多语言支持扩展（新增泰语、繁体中文）

---

## 目录结构

### 新增文件夹

```
three.js/editor/
├── js/
│   ├── mrpp/                    # 核心业务逻辑（完全新增）
│   │   ├── Builder.js           # 构建器：创建各类节点的配置
│   │   ├── CommandContainer.js  # 指令容器
│   │   ├── ComponentContainer.js # 组件容器
│   │   ├── EditorLoader.js      # 编辑器加载器
│   │   ├── EventContainer.js    # 事件容器
│   │   ├── Factory.js           # 工厂基类
│   │   ├── MetaFactory.js       # Meta 编辑器工厂
│   │   ├── MetaLoader.js        # Meta 加载器
│   │   ├── VerseFactory.js      # Verse 编辑器工厂
│   │   ├── VerseLoader.js       # Verse 加载器
│   │   ├── commands/            # 指令定义
│   │   │   ├── GestureCommand.js
│   │   │   └── VoiceCommand.js
│   │   └── components/          # 组件定义
│   │       ├── ActionComponent.js
│   │       ├── MovedComponent.js
│   │       ├── RotateComponent.js
│   │       ├── TooltipComponent.js
│   │       └── TriggerComponent.js
│   │
│   └── utils/                   # 工具函数（完全新增）
│       ├── DialogUtils.js       # 对话框工具
│       ├── ScreenshotUtils.js   # 截图工具
│       ├── TextUtils.js         # 文本渲染工具
│       ├── WebpUtils.js         # WebP 图片处理工具
│       └── screenshot.mp3       # 截图音效
```

### 新增文件

#### 入口文件
| 文件 | 说明 |
|------|------|
| `verse-editor.html` | Verse（场景）编辑器入口 |
| `meta-editor.html` | Meta（实体）编辑器入口 |
| `_editor.html` | 备份的原始编辑器 |
| `_index.html` / `_index2.html` | 备份文件 |

#### 侧边栏扩展
| 文件 | 说明 |
|------|------|
| `js/Sidebar.Component.js` | 组件面板 |
| `js/Sidebar.Command.js` | 指令面板 |
| `js/Sidebar.Meta.js` | Meta 面板 |
| `js/Sidebar.Media.js` | 媒体控制面板 |
| `js/Sidebar.Screenshot.js` | 截图面板 |
| `js/Sidebar.Text.js` | 文本编辑面板 |

#### 菜单扩展
| 文件 | 说明 |
|------|------|
| `js/Menubar.Component.js` | 组件菜单 |
| `js/Menubar.Command.js` | 指令菜单 |
| `js/Menubar.Replace.js` | 替换菜单 |
| `js/Menubar.Goto.js` | 跳转菜单 |
| `js/Menubar.Screenshot.js` | 截图菜单 |

#### 命令扩展 (`js/commands/`)
| 文件 | 说明 |
|------|------|
| `AddComponentCommand.js` | 添加组件命令 |
| `RemoveComponentCommand.js` | 移除组件命令 |
| `SetComponentValueCommand.js` | 设置组件值命令 |
| `AddCommandCommand.js` | 添加指令命令 |
| `RemoveCommandCommand.js` | 移除指令命令 |
| `SetCommandValueCommand.js` | 设置指令值命令 |
| `AddEventCommand.js` | 添加事件命令 |
| `RemoveEventCommand.js` | 移除事件命令 |
| `MoveMultipleObjectsCommand.js` | 多对象移动命令 |
| `MultiTransformCommand.js` | 多对象变换命令 |

#### 其他新增文件
| 文件 | 说明 |
|------|------|
| `js/Access.js` | 权限管理系统 |

---

## 修改的核心文件

### 1. Editor.js

**修改内容：**
- 添加 `editor.type` 属性（区分 'meta' / 'verse' 编辑器类型）
- 添加新的信号（Signals）：
  - `componentAdded`, `componentChanged`, `componentRemoved`
  - `eventAdded`, `eventChanged`, `eventRemoved`
  - `commandAdded`, `commandChanged`, `commandRemoved`
  - `messageSend`, `messageReceive`（与父窗口通信）
  - `doneLoadObject`
  - `objectsChanged`（多对象同时变化）
  - `multiSelectGroup`, `multipleObjectsTransformChanged`（多选支持）
- 添加语言映射：
  ```javascript
  const mapping = {
      'zh-CN': 'zh-cn',
      'en-US': 'en-us',
      'ja-JP': 'ja-jp',
      'zh-TW': 'zh-tw',
      'th-TH': 'th-th'
  };
  ```
- 引入 `DialogUtils` 和 `Access` 模块

**关键代码位置：**
- 信号定义：约第 30-120 行
- 语言映射：约第 10-20 行

### 2. Sidebar.js

**修改内容：**
- 根据 `editor.type` 动态加载不同的侧边栏面板
- Meta 类型：显示 `SidebarComponent`, `SidebarEvents`, `SidebarCommand`
- Verse 类型：显示 `SidebarMeta`
- 添加 `SidebarText`, `SidebarAnimation`, `SidebarScreenshot`
- 移除了部分原始面板（Project, Settings）

**关键代码：**
```javascript
if (editor.type.toLowerCase() == 'meta') {
    scene.add(new SidebarComponent(editor))
    scene.add(new SidebarEvents(editor))
    scene.add(new SidebarCommand(editor))
} else if (editor.type.toLowerCase() == 'verse') {
    scene.add(new SidebarMeta(editor))
}
```

### 3. Menubar.Add.js

**修改内容：**
- 根据 `editor.type` 显示不同的添加菜单
- Meta 类型：Node, Text, Voxel, Polygen, Audio, Picture, Video, Particle, Phototype
- Verse 类型：Module（场景模块）
- 添加资源加载消息通信机制
- 添加 `resources` 全局资源管理

**关键功能：**
- `loadResource()`: 加载资源并创建对象
- `loadPhototype()`: 加载 Phototype 资源
- `updateResourceMenuItems()`: 动态更新可用资源类型

### 4. Sidebar.Object.js

**修改内容：**
- 添加媒体控制（播放/暂停/循环）
- 添加图片渲染层级（sortingOrder）属性
- 添加文本组件相关显示
- 添加可见性（visibility）属性
- 扩展 userData 显示

### 5. Strings.js

**修改内容：**
- 新增大量自定义字符串键
- 扩展语言支持：`zh-tw`（繁体中文）, `th-th`（泰语）
- 添加的字符串类别：
  - `menubar/add/*`: 添加菜单相关
  - `menubar/replace/*`: 替换菜单相关
  - `menubar/component/*`: 组件菜单相关
  - `menubar/command/*`: 指令菜单相关
  - `sidebar/components/*`: 组件面板相关
  - `sidebar/command/*`: 指令面板相关
  - `sidebar/text/*`: 文本面板相关
  - 语音指令相关字符串

### 6. Loader.js

**修改内容：**
- 可能添加了对自定义资源格式的支持

### 7. Menubar.File.js

**修改内容：**
- 调整文件操作相关功能

---

## 新增功能详解

### 组件系统 (Component System)

组件是附加到对象上的行为模块，定义在 `js/mrpp/components/` 目录：

| 组件 | 类 | 说明 |
|------|------|------|
| 旋转组件 | `RotateComponent` | 控制对象自动旋转 |
| 动作组件 | `ActionComponent` | 定义对象的动作行为 |
| 移动组件 | `MovedComponent` | 控制对象可移动，支持磁力 |
| 触发组件 | `TriggerComponent` | 交互触发（捏合/触摸） |
| 提示组件 | `TooltipComponent` | 显示提示信息 |

### 指令系统 (Command System)

指令是可以通过语音或手势触发的操作，定义在 `js/mrpp/commands/` 目录：

| 指令 | 类 | 说明 |
|------|------|------|
| 语音指令 | `VoiceCommand` | 语音触发的指令 |
| 手势指令 | `GestureCommand` | 手势触发的指令（如握拳） |

### 权限管理 (Access Control)

定义在 `js/Access.js`：

```javascript
// 角色定义
ROLES = { ROOT, ADMIN, MANAGER, USER, GUEST }

// 权限定义
ABILITIES = { 
    UI_USERDATA,      // 自定义数据面板
    UI_ADVANCED,      // 高级面板
    FEATURE_ADVANCED  // 高级功能
}
```

### 消息通信机制

编辑器通过 `postMessage` 与父窗口通信：

```javascript
// 发送消息
editor.signals.messageSend.dispatch({
    action: 'save-verse',
    data: { verse }
});

// 接收消息
editor.signals.messageReceive.add(function(params) {
    switch(params.action) {
        case 'load-resource': ...
        case 'add-module': ...
    }
});
```

---

## 升级指南

升级到新版本 three.js 时，需要注意以下步骤：

### 1. 保留的自定义目录（直接复制）

```
js/mrpp/           → 完全保留
js/utils/          → 完全保留
js/commands/       → 保留新增的命令文件
```

### 2. 需要合并修改的文件

| 文件 | 修改要点 |
|------|----------|
| `Editor.js` | 添加自定义信号、type 属性、语言映射 |
| `Sidebar.js` | 根据 type 加载不同面板 |
| `Menubar.Add.js` | 添加自定义资源类型菜单 |
| `Sidebar.Object.js` | 添加媒体控制、渲染层级等属性 |
| `Strings.js` | 合并自定义字符串 |
| `Loader.js` | 检查自定义加载逻辑 |

### 3. 需要创建的新入口文件

- `verse-editor.html` - 复制 `index.html` 并添加：
  - 引入 `VerseLoader`
  - 设置 `editor.type = 'verse'`
  - 添加 `messageSend` 信号处理

- `meta-editor.html` - 复制 `index.html` 并添加：
  - 引入 `MetaLoader`
  - 设置 `editor.type = 'meta'`
  - 添加 `messageSend` 信号处理

### 4. 检查点

- [ ] `signals` 对象是否包含所有自定义信号
- [ ] `Strings.js` 是否包含所有自定义键
- [ ] 新增的 Sidebar 面板是否正确导入
- [ ] commands 目录下的新增命令是否正确导出
- [ ] `Access.js` 权限系统是否正确集成

---

## 依赖说明

### 外部依赖

- FFmpeg: `https://unpkg.com/@ffmpeg/ffmpeg@0.9.6/dist/ffmpeg.min.js`
- ES Module Shims: `/libs/es-module-shims.js`

### 内部模块依赖

```
MetaFactory ← Factory ← THREE
           ← TextUtils, WebpUtils
           ← GLTFLoader, DRACOLoader, VOXLoader, KTX2Loader

VerseLoader ← MetaFactory
            ← VerseFactory

ComponentContainer ← *Component (各组件类)
CommandContainer ← *Command (各指令类)
```

---

## 版本历史

| 日期 | 版本 | 说明 |
|------|------|------|
| 初始 | r140 | 基于 three.js r140 创建 |
| 持续 | - | 详见 git 提交历史 |

---

## 附录：完整新增文件列表

### 完全新增的 JavaScript 文件

```
# 核心业务模块 (mrpp)
js/mrpp/Builder.js
js/mrpp/CommandContainer.js
js/mrpp/ComponentContainer.js
js/mrpp/EditorLoader.js
js/mrpp/EventContainer.js
js/mrpp/Factory.js
js/mrpp/MetaFactory.js
js/mrpp/MetaLoader.js
js/mrpp/VerseFactory.js
js/mrpp/VerseLoader.js
js/mrpp/commands/GestureCommand.js
js/mrpp/commands/VoiceCommand.js
js/mrpp/components/ActionComponent.js
js/mrpp/components/MovedComponent.js
js/mrpp/components/RotateComponent.js
js/mrpp/components/TooltipComponent.js
js/mrpp/components/TriggerComponent.js

# 工具模块 (utils)
js/utils/DialogUtils.js
js/utils/ScreenshotUtils.js
js/utils/TextUtils.js
js/utils/WebpUtils.js

# 侧边栏模块
js/Sidebar.Component.js
js/Sidebar.Command.js
js/Sidebar.Meta.js
js/Sidebar.Media.js
js/Sidebar.Screenshot.js
js/Sidebar.Text.js
js/Sidebar.MultipleObjects.js

# 菜单模块
js/Menubar.Component.js
js/Menubar.Command.js
js/Menubar.Replace.js
js/Menubar.Goto.js
js/Menubar.Screenshot.js

# 命令模块 (新增)
js/commands/AddComponentCommand.js
js/commands/RemoveComponentCommand.js
js/commands/SetComponentValueCommand.js
js/commands/AddCommandCommand.js
js/commands/RemoveCommandCommand.js
js/commands/SetCommandValueCommand.js
js/commands/AddEventCommand.js
js/commands/RemoveEventCommand.js
js/commands/MoveMultipleObjectsCommand.js
js/commands/MultiTransformCommand.js

# 权限模块
js/Access.js
```

### 新增的 HTML 入口文件

```
verse-editor.html    # Verse 编辑器入口
meta-editor.html     # Meta 编辑器入口
```

---

## 附录：Strings.js 新增字符串键

以下是添加到 `Strings.js` 的主要自定义字符串键（部分列表）：

```javascript
// 添加菜单
'menubar/add/node'
'menubar/add/text'
'menubar/add/voxel'
'menubar/add/polygen'
'menubar/add/audio'
'menubar/add/picture'
'menubar/add/video'
'menubar/add/particle'
'menubar/add/meta'
'menubar/add/prefab'
'menubar/add/phototype'

// 替换菜单
'menubar/replace'
'menubar/replace/polygen'
'menubar/replace/voxel'
'menubar/replace/picture'
'menubar/replace/noselection'
'menubar/replace/success'

// 组件菜单
'menubar/component'
'menubar/component/list'

// 指令菜单
'menubar/command'
'menubar/command/list'
'menubar/command/confirm'
'menubar/command/success'
'menubar/command/select_object_first'
'menubar/command/already_exists'

// 组件面板
'sidebar/components'
'sidebar/components/select'
'sidebar/components/select/rotate'
'sidebar/components/select/action'
'sidebar/components/select/action/mode'
'sidebar/components/select/action/mode/pinch'
'sidebar/components/select/action/mode/touch'
'sidebar/components/select/moved'
'sidebar/components/select/moved/magnetic'
'sidebar/components/select/moved/scalable'
'sidebar/components/select/trigger'
'sidebar/components/select/trigger/target'
'sidebar/components/select/tooltip'
'sidebar/components/tooltip/text'
'sidebar/components/tooltip/length'
'sidebar/components/tooltip/target'

// 指令面板
'sidebar/command'
'sidebar/command/select'
'sidebar/command/select/voice'
'sidebar/command/select/gesture'
'sidebar/command/voice/id'
'sidebar/command/voice/label'
'sidebar/command/voice/scaleUp'
'sidebar/command/voice/scaleDown'
'sidebar/command/voice/decompose'
'sidebar/command/voice/reset'
'sidebar/command/voice/goBack'
'sidebar/command/gesture/label'
'sidebar/command/gesture/ok'
'sidebar/command/gesture/fist'

// 文本面板
'sidebar/text'
'sidebar/text/content'
'sidebar/text/rect'
'sidebar/text/color'
'sidebar/text/font'
'sidebar/text/fontSize'
'sidebar/text/alignment'
'sidebar/text/follow'
'sidebar/text/background'
'sidebar/text/background/color'
'sidebar/text/background/opacity'

// 对象属性
'sidebar/object/loop'
'sidebar/object/sortingOrder'

// 动画面板
'sidebar/animations'
'sidebar/animations/play'
'sidebar/animations/stop'
'sidebar/animations/timescale'
'sidebar/animations/select'

// 实体面板
'sidebar/entity'
'sidebar/entity/button'
```

---

## 联系方式

如有问题，请查看 git 提交历史或联系项目维护者。

```bash
# 查看完整修改历史
git log --oneline --all

# 查看特定文件的修改历史
git log --follow -p -- path/to/file.js

# 对比与原始 three.js 的差异
# 1. 克隆原始 three.js r140
git clone --branch r140 --depth 1 https://github.com/mrdoob/three.js.git three-original

# 2. 对比编辑器文件
diff -r three-original/editor three.js/editor
```
