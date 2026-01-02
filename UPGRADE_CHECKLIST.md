# Three.js Editor 升级检查清单

> 用于升级到新版本 three.js 时的快速参考

## 升级步骤

### Step 1: 备份当前项目

```bash
cp -r three.js three.js.backup
```

### Step 2: 下载新版本 three.js

```bash
git clone --branch r1XX https://github.com/mrdoob/three.js.git three.js.new
```

### Step 3: 复制自定义文件

```bash
# 复制完全自定义的目录
cp -r three.js/editor/js/mrpp three.js.new/editor/js/
cp -r three.js/editor/js/utils three.js.new/editor/js/

# 复制新增的入口文件
cp three.js/editor/verse-editor.html three.js.new/editor/
cp three.js/editor/meta-editor.html three.js.new/editor/

# 复制新增的命令文件
cp three.js/editor/js/commands/Add*Command.js three.js.new/editor/js/commands/
cp three.js/editor/js/commands/Remove*Command.js three.js.new/editor/js/commands/
cp three.js/editor/js/commands/Set*ValueCommand.js three.js.new/editor/js/commands/
cp three.js/editor/js/commands/Move*Command.js three.js.new/editor/js/commands/
cp three.js/editor/js/commands/Multi*Command.js three.js.new/editor/js/commands/

# 复制新增的侧边栏文件
cp three.js/editor/js/Sidebar.Component.js three.js.new/editor/js/
cp three.js/editor/js/Sidebar.Command.js three.js.new/editor/js/
cp three.js/editor/js/Sidebar.Meta.js three.js.new/editor/js/
cp three.js/editor/js/Sidebar.Media.js three.js.new/editor/js/
cp three.js/editor/js/Sidebar.Screenshot.js three.js.new/editor/js/
cp three.js/editor/js/Sidebar.Text.js three.js.new/editor/js/
cp three.js/editor/js/Sidebar.MultipleObjects.js three.js.new/editor/js/

# 复制新增的菜单文件
cp three.js/editor/js/Menubar.Component.js three.js.new/editor/js/
cp three.js/editor/js/Menubar.Command.js three.js.new/editor/js/
cp three.js/editor/js/Menubar.Replace.js three.js.new/editor/js/
cp three.js/editor/js/Menubar.Goto.js three.js.new/editor/js/
cp three.js/editor/js/Menubar.Screenshot.js three.js.new/editor/js/

# 复制权限文件
cp three.js/editor/js/Access.js three.js.new/editor/js/
```

### Step 4: 合并修改的文件

需要手动合并以下文件：

- [ ] `Editor.js` - 添加自定义信号和 type 属性
- [ ] `Sidebar.js` - 添加条件面板加载逻辑
- [ ] `Menubar.Add.js` - 添加自定义资源类型菜单
- [ ] `Sidebar.Object.js` - 添加媒体控制和自定义属性
- [ ] `Strings.js` - 合并所有自定义字符串
- [ ] `Loader.js` - 检查自定义加载逻辑
- [ ] `Menubar.File.js` - 检查文件操作修改

### Step 5: 检查 API 变更

查看 three.js 更新日志，确认以下 API 是否有变化：

- [ ] `THREE.WebGLRenderer`
- [ ] `GLTFLoader` / `DRACOLoader` / `VOXLoader` / `KTX2Loader`
- [ ] `THREE.Mesh` / `THREE.Object3D`
- [ ] `THREE.CanvasTexture`

### Step 6: 测试功能

- [ ] Meta Editor 能否正常打开
- [ ] Verse Editor 能否正常打开
- [ ] 添加各类资源（模型、图片、音频等）
- [ ] 组件功能（旋转、移动、触发等）
- [ ] 指令功能（语音、手势）
- [ ] 截图功能
- [ ] 保存/加载功能
- [ ] 与父窗口的消息通信

---

## 修改清单速查

### Editor.js 需要添加的信号

```javascript
componentAdded: new Signal(),
componentChanged: new Signal(),
componentRemoved: new Signal(),

eventAdded: new Signal(),
eventChanged: new Signal(),
eventRemoved: new Signal(),

commandAdded: new Signal(),
commandChanged: new Signal(),
commandRemoved: new Signal(),

messageSend: new Signal(),
messageReceive: new Signal(),

doneLoadObject: new Signal(),
objectsChanged: new Signal(),

multiSelectGroup: null,
multipleObjectsTransformChanged: new Signal()
```

### Editor.js 需要添加的导入

```javascript
import { DialogUtils } from './utils/DialogUtils.js';
import { Access } from './Access.js';
```

### Sidebar.js 需要添加的导入

```javascript
import { SidebarMeta } from './Sidebar.Meta.js'
import { SidebarEvents } from './Sidebar.Events.js'
import { SidebarComponent } from './Sidebar.Component.js'
import { SidebarCommand } from './Sidebar.Command.js'
import { SidebarAnimation } from './Sidebar.Animation.js'
import { SidebarMedia } from './Sidebar.Media.js'
import { SidebarScreenshot } from './Sidebar.Screenshot.js'
import { SidebarText } from './Sidebar.Text.js'
```

### Menubar.Add.js 需要添加的导入

```javascript
import { MetaFactory } from './mrpp/MetaFactory.js';
import { VerseFactory } from './mrpp/VerseFactory.js';
import { Builder } from './mrpp/Builder.js';
```

---

## 常见问题

### Q: 新版本的 import 路径变了怎么办？

检查 three.js 的 `examples/jsm/` 目录结构，更新 `mrpp/` 目录下文件的 import 路径。

### Q: 新版本的 Loader API 变了怎么办？

查看 GLTFLoader 等加载器的更新日志，更新 MetaFactory.js 中的加载代码。

### Q: Strings.js 格式变了怎么办？

保持原有的字符串结构，将自定义字符串添加到相应的语言对象中。
