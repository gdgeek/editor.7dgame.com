---
inclusion: auto
---

# Patch 注入模式与原版恢复注意事项

## 注入模式分类

在将侵入式修改外部化为 patch 注入时，需区分三种模式：

| 模式 | 处理方式 | 示例 |
|---|---|---|
| 完全替换型 | 注入前清空容器所有子元素 | Add 菜单：MRPP 完全替换原版几何体菜单 |
| 部分替换型 | 注入前按标签/ID 移除特定项 | Edit 菜单：移除原版 Clone/Delete，保留 Undo/Redo |
| 追加型 | 直接 append，无需清空 | Sidebar tab、ObjectExt 按钮、新增顶级菜单 |

判断依据：对比 MRPP 修改前后，原版内容是否还需要保留。

## 原版恢复注意事项

恢复 three.js editor 原版文件时，最大风险是**误删原版代码**：

- 当 MRPP 修改和原版代码在同一函数/区块内交织时，容易把原版逻辑误判为 MRPP 修改
- 典型案例：`Sidebar.js` 中 `scene.add(propertiesPanel)` 是原版就有的代码，但因为紧邻 MRPP 的 flex 样式设置而被误删
- 恢复前应确认每一行的来源：是 r140 原版还是 MRPP 新增

## 修改 patch 文件时的注意事项

- 在已有函数中插入新代码块时，注意变量作用域冲突。例如在同一函数中新增步骤时，如果新步骤和已有步骤都声明了 `const editorType`，会导致重复声明报错。应复用已有变量或提升到函数顶部。

## DOM Wrapper 接管已有组件的注意事项

当用 wrapper 对象包装已有的 UI 组件实例（如 `wrapAsTabbedPanel` 包装 `UITabbedPanel`）时：

- 原版实例的事件处理器（如 tab 点击）仍然绑定到原版实例的方法
- Wrapper 添加的新元素的事件绑定到 wrapper 的方法
- 两套独立的状态管理会导致 UI 卡死（如 tab 切换失效）
- 解决方案：初始化 wrapper 时，用 capture-phase 事件 + `stopImmediatePropagation` 拦截原版事件，统一由 wrapper 管理

## DOM 引用在 clear/addTab 循环中的生存问题

当 wrapper 的 `clear()` + `addTab()` 循环重建 tab 时：

- `addTab` 中 `panelDom.appendChild(items.dom)` 会把 DOM 节点从原位置移走
- `clear()` 移除 panelDom 后，通过 `firstChild` 等间接引用获取的节点会变成 `null`
- 解决方案：初始化时直接保存对目标 DOM 元素的引用，不要每次通过 `parentNode.firstChild` 间接获取

## 验证清单

恢复原版文件后，除了检查 MRPP 标记数量为 0，还应验证：
1. 原版功能是否正常（菜单项、面板显示、信号处理）
2. Patch 注入后的功能是否正常（MRPP 菜单项、扩展面板、自定义信号）
3. 不存在重复项（同一菜单出现两个 Clone/Delete 等）
4. patch 文件无语法错误（特别是变量重复声明）
