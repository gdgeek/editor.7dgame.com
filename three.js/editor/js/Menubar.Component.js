import * as THREE from 'three';
import { UIPanel, UIRow, UIHorizontalRule, UIButton, UISelect, UIText } from './libs/ui.js';
import { ComponentContainer } from './mrpp/ComponentContainer.js';
import { AddComponentCommand } from './commands/AddComponentCommand.js';

function MenubarComponent(editor) {
    const strings = editor.strings;
    const signals = editor.signals;

    const container = new UIPanel();
    container.setClass('menu');

    // 创建菜单标题
    const title = new UIPanel();
    title.setClass('title');
    title.setTextContent(strings.getKey('menubar/component'));
    container.add(title);

    // 创建选项容器
    const options = new UIPanel();
    options.setClass('options');
    container.add(options);

    const componentTypes = {
        'Rotate': strings.getKey('sidebar/components/select/rotate'),
        'Action': strings.getKey('sidebar/components/select/action'),
        'Moved': strings.getKey('sidebar/components/select/moved'),
        'Trigger': strings.getKey('sidebar/components/select/trigger'),
        'Tooltip': strings.getKey('sidebar/components/select/tooltip')
    };

    // 互斥组件类型
    const mutuallyExclusiveTypes = ['Action', 'Moved', 'Trigger'];

    // 存储组件菜单项的引用
    const typeRows = {};

    // 为每种组件类型创建菜单选项
    Object.keys(componentTypes).forEach(function(type) {
        const typeRow = new UIRow();
        typeRow.setClass('option');
        typeRow.setTextContent(componentTypes[type]);
        typeRow.onClick(function(event) {
            if (editor.selected !== null) {
                // 获取当前选中的对象
                const selectedObjects = editor.getSelectedObjects();

                // 多选对象处理
                if (selectedObjects.length > 1) {
                    // 检查互斥组件
                    if (mutuallyExclusiveTypes.includes(type)) {
                        // 检查是否有对象已经存在互斥组件
                        let objectsWithExclusiveComponents = [];

                        for (let i = 0; i < selectedObjects.length; i++) {
                            const object = selectedObjects[i];

                            // 确保对象有components属性
                            if (object.components === undefined) {
                                object.components = [];
                            }

                            for (let j = 0; j < object.components.length; j++) {
                                const compType = object.components[j].type;
                                if (mutuallyExclusiveTypes.includes(compType) && compType !== type) {
                                    objectsWithExclusiveComponents.push(object.name || `对象 ${i+1}`);
                                    break;
                                }
                            }
                        }

                        if (objectsWithExclusiveComponents.length > 0) {
                            // 已存在互斥组件，显示提示信息
                            const conflictNames = objectsWithExclusiveComponents.length > 3
                                ? objectsWithExclusiveComponents.slice(0, 3).join(', ') + `...等${objectsWithExclusiveComponents.length}个对象`
                                : objectsWithExclusiveComponents.join(', ');

                            editor.showNotification(
                                (strings.getKey('menubar/component/mutually_exclusive') || '只能选择一个互斥组件') +
                                `\n以下对象已存在互斥组件: ${conflictNames}`,
                                true
                            );
                            return;
                        }

                        // 为所有选中对象添加组件
                        for (let i = 0; i < selectedObjects.length; i++) {
                            const object = selectedObjects[i];

                            // 确保对象有components属性
                            if (object.components === undefined) {
                                object.components = [];
                            }

                            const component = ComponentContainer.Create(type, editor);
                            if (component !== undefined) {
                                const command = new AddComponentCommand(editor, object, component);
                                editor.execute(command);
                            }
                        }

                        editor.showNotification(`已为${selectedObjects.length}个选中对象添加${componentTypes[type]}组件`, false);

                    } else {
                        // 非互斥组件，直接为所有选中对象添加
                        for (let i = 0; i < selectedObjects.length; i++) {
                            const object = selectedObjects[i];

                            // 确保对象有components属性
                            if (object.components === undefined) {
                                object.components = [];
                            }

                            const component = ComponentContainer.Create(type, editor);
                            if (component !== undefined) {
                                const command = new AddComponentCommand(editor, object, component);
                                editor.execute(command);
                            }
                        }

                        editor.showNotification(`已为${selectedObjects.length}个选中对象添加${componentTypes[type]}组件`, false);
                    }

                } else {
                    // 单选对象处理（原有逻辑）
                // 确保对象有components属性
                if (editor.selected.components === undefined) {
                    editor.selected.components = [];
                }

                // 检查互斥组件
                if (mutuallyExclusiveTypes.includes(type)) {
                    // 检查是否已经存在互斥组件
                    let hasExclusiveComponent = false;
                    let existingType = null;

                    for (let i = 0; i < editor.selected.components.length; i++) {
                        const compType = editor.selected.components[i].type;
                        if (mutuallyExclusiveTypes.includes(compType) && compType !== type) {
                            hasExclusiveComponent = true;
                            existingType = compType;
                            break;
                        }
                    }

                    if (hasExclusiveComponent) {
                        // 已存在互斥组件，显示提示信息
                        editor.showNotification(
                            strings.getKey('menubar/component/mutually_exclusive') ||
                            '只能选择一个互斥组件：点击触发、可移动或碰撞触发',
                            true
                        );
                        return;
                    }
                }

                const component = ComponentContainer.Create(type, editor);

                if (component !== undefined) {
                    const command = new AddComponentCommand(editor, editor.selected, component);
                    editor.execute(command);

                    const successMessage = strings.getKey('menubar/component/success').replace('{0}', componentTypes[type]);
                    editor.showNotification(successMessage, false);
                    }
                }
            } else {
                editor.showNotification(strings.getKey('menubar/component/select_object_first'), true);
            }
        });
        options.add(typeRow);

        // 存储引用以便后续更新状态
        typeRows[type] = typeRow;
    });

    // 初始时检查并设置菜单可见性
    updateVisibility();
    updateMutuallyExclusiveOptions();

    // 监听对象选择变化，更新菜单可见性和互斥选项
    signals.objectSelected.add(function() {
        updateVisibility();
        updateMutuallyExclusiveOptions();
    });

    // 监听组件添加和移除事件，更新互斥选项状态
    signals.componentAdded.add(updateMutuallyExclusiveOptions);
    signals.componentRemoved.add(updateMutuallyExclusiveOptions);

    // 更新菜单可见性的函数
    function updateVisibility() {
        if (editor.type && editor.type.toLowerCase() === 'meta' && editor.selected !== null) {
            // 只有当选中对象类型为polygen或voxel时才显示
            const objectType = editor.selected.type ? editor.selected.type.toLowerCase() : '';
            if (objectType === 'mesh' || objectType === 'polygen' || objectType === 'voxel' || objectType === 'picture') {
                container.setDisplay('');
            } else {
                container.setDisplay('none');
            }
        } else {
            container.setDisplay('none');
        }
    }

    // 更新互斥组件选项的可用状态
    function updateMutuallyExclusiveOptions() {
        if (editor.selected !== null) {
            // 确保对象有components属性
            if (editor.selected.components === undefined) {
                editor.selected.components = [];
            }

            // 检查当前选中对象已有的组件
            const existingComponents = editor.selected.components;

            // 检查是否已存在互斥组件中的一个
            let existingExclusiveType = null;

            for (let i = 0; i < existingComponents.length; i++) {
                const compType = existingComponents[i].type;
                if (mutuallyExclusiveTypes.includes(compType)) {
                    existingExclusiveType = compType;
                    break;
                }
            }

            // 更新互斥组件的可用状态
            mutuallyExclusiveTypes.forEach(function(type) {
                if (existingExclusiveType && type !== existingExclusiveType) {
                    // 如果已存在互斥组件且当前组件不是已存在的组件，则禁用
                    typeRows[type].setClass('option disabled');
                    typeRows[type].dom.style.opacity = '0.5';
                    typeRows[type].dom.style.cursor = 'not-allowed';

                    // 保存原始的onClick处理函数
                    if (!typeRows[type].originalOnClick) {
                        typeRows[type].originalOnClick = typeRows[type].onClick;
                    }

                    // 设置为显示提示信息的onClick处理函数
                    typeRows[type].onClick(function(event) {
                        const message = strings.getKey('menubar/component/mutually_exclusive') ||
                                       '只能选择一个互斥组件：点击触发、可移动或碰撞触发';
                        editor.showNotification(message, true);
                        event.stopPropagation();
                    });
                } else {
                    // 启用组件
                    typeRows[type].setClass('option');
                    typeRows[type].dom.style.opacity = '';
                    typeRows[type].dom.style.cursor = '';

                    // 恢复原始的onClick处理函数
                    if (typeRows[type].originalOnClick) {
                        typeRows[type].onClick(typeRows[type].originalOnClick);
                    }
                }
            });
        }
    }

    return container;
}

export { MenubarComponent };
