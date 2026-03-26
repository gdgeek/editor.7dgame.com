# Bugfix Requirements Document

## Introduction

three.js 从 r140 升级到 r183 后，MRPP 模式下的 UI 层出现了 8 处回归问题。3D 视口渲染本身正常，但 Sidebar（层级树、属性面板）、Menubar（菜单栏）、Viewport Controls（视口控件）和 Animation（动画时间轴）等 UI 组件在 MRPP 模式下未正确隐藏或适配 r183 的新增/变更内容。

根本原因是 r183 对 Editor UI 组件进行了结构性变更（新增面板、新增菜单、新增控件、改变 tab ID 和过滤逻辑），而 `plugin/patches/` 中的 MRPP patch 函数未完全适配这些变更。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 在 MRPP 模式下打开层级 tab 时 THEN 层级 tab 顶部缺少搜索输入框和过滤下拉框（r140 中有"搜索"输入框和"全部"过滤下拉框）

1.2 WHEN 在 MRPP 模式下查看层级树时 THEN 层级树显示了 Camera、Scene、$lights 等内部对象（r140 中这些内部对象被过滤隐藏，只显示用户场景对象）

1.3 WHEN 在 MRPP 模式下选中对象后查看属性面板 tab 时 THEN 属性面板显示 r183 原版的"属性"+"脚本" tab，而非 MRPP 的"属性"+"组件" tab（`applySidebarPropertiesPatches` 的动态 tab 管理未正确工作）

1.4 WHEN 在 MRPP 模式下选中 polygen 类型对象后查看类型字段时 THEN 类型显示为 "Object3D" 而非 MRPP 自定义类型 "Polygen"（MRPP 自定义类型未正确设置到 object.type）

1.5 WHEN 在 MRPP 模式下选中对象后查看属性面板时 THEN 属性面板显示了 r183 新增的"识别码"(UUID) 行和"阴影"(Shadow) 相关行，这些字段在 MRPP 模式下应该隐藏

1.6 WHEN 在 MRPP 模式下查看菜单栏时 THEN 菜单栏显示了 r183 新增的"视图"(View) 和"渲染"(Render) 菜单，这些菜单在 MRPP 模式下应该隐藏或移除

1.7 WHEN 在 MRPP 模式下查看编辑器底部时 THEN 底部显示了 r183 新增的动画时间轴面板（含播放/暂停/停止按钮和时间轴），MRPP 模式下应该隐藏

1.8 WHEN 在 MRPP 模式下查看视口顶部控件时 THEN 视口顶部显示了 r183 新增的 SOLID 渲染模式下拉框（shadingSelect），MRPP 模式下应该隐藏，只保留 CAMERA 下拉框

### Expected Behavior (Correct)

2.1 WHEN 在 MRPP 模式下打开层级 tab 时 THEN 系统 SHALL 在层级树顶部显示搜索输入框和过滤下拉框（与 r140 行为一致）

2.2 WHEN 在 MRPP 模式下查看层级树时 THEN 系统 SHALL 过滤隐藏 Camera、Scene、$lights 等内部对象，只显示用户添加的场景对象（与 r140 行为一致）

2.3 WHEN 在 MRPP 模式下选中对象后查看属性面板 tab 时 THEN 系统 SHALL 动态管理 tab，对 polygen/voxel/picture/entity 类型显示"属性"+"组件" tab，对 entity/point 类型显示"属性"+"命令" tab（`applySidebarPropertiesPatches` 正确接管 r183 的 tab 管理）

2.4 WHEN 在 MRPP 模式下选中 polygen 类型对象后查看类型字段时 THEN 系统 SHALL 显示 MRPP 自定义类型名称 "Polygen"（而非底层的 "Object3D"）

2.5 WHEN 在 MRPP 模式下选中对象后查看属性面板时 THEN 系统 SHALL 隐藏 r183 新增的"识别码"(UUID) 行和"阴影"(Shadow) 相关行，只显示类型/名称/位置/旋转/缩放/可见性/自定义数据等 MRPP 需要的字段

2.6 WHEN 在 MRPP 模式下查看菜单栏时 THEN 系统 SHALL 隐藏或移除 r183 新增的"视图"(View) 和"渲染"(Render) 菜单，菜单栏只显示 文件/编辑/添加/场景(或截图)/跳转

2.7 WHEN 在 MRPP 模式下查看编辑器底部时 THEN 系统 SHALL 隐藏 r183 新增的动画时间轴面板（Animation）和动画 Resizer，底部不显示任何动画控件

2.8 WHEN 在 MRPP 模式下查看视口顶部控件时 THEN 系统 SHALL 隐藏 r183 新增的 SOLID 渲染模式下拉框（shadingSelect），只保留 CAMERA 下拉框

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 在 MRPP 模式下使用层级树选中用户对象时 THEN 系统 SHALL CONTINUE TO 正确触发 objectSelected 信号并在属性面板中显示该对象的属性

3.2 WHEN 在 MRPP 模式下使用属性面板修改对象的位置/旋转/缩放时 THEN 系统 SHALL CONTINUE TO 正确执行变换命令并支持 undo/redo

3.3 WHEN 在 MRPP 模式下使用菜单栏的文件/编辑/添加菜单时 THEN 系统 SHALL CONTINUE TO 正确执行对应的菜单操作（保存、撤销、添加对象等）

3.4 WHEN 在 MRPP 模式下使用视口顶部的 CAMERA 下拉框切换相机时 THEN 系统 SHALL CONTINUE TO 正确切换视口相机

3.5 WHEN 在 MRPP 模式下切换 sidebar tab（层级/事件/截图）时 THEN 系统 SHALL CONTINUE TO 正确切换 tab 内容显示

3.6 WHEN 在非 MRPP 模式（原版 three.js editor）下使用编辑器时 THEN 系统 SHALL CONTINUE TO 显示所有原版 UI 元素（包括 View/Render 菜单、Animation 面板、SOLID 下拉框等）
