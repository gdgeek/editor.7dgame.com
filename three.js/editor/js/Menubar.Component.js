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

    // 为每种组件类型创建菜单选项
    Object.keys(componentTypes).forEach(function(type) {
        const typeRow = new UIRow();
        typeRow.setClass('option');
        typeRow.setTextContent(componentTypes[type]);
        typeRow.onClick(function(event) {
            if (editor.selected !== null) {
                const component = ComponentContainer.Create(type, editor);

                if (component !== undefined) {
                    const command = new AddComponentCommand(editor, editor.selected, component);
                    editor.execute(command);

                    const successMessage = strings.getKey('menubar/component/success').replace('{0}', componentTypes[type]);
                    editor.showNotification(successMessage, false);
                }
            } else {
                editor.showNotification(strings.getKey('menubar/component/select_object_first'), true);
            }
        });
        options.add(typeRow);
    });

    // 初始时检查并设置菜单可见性
    updateVisibility();

    // 监听对象选择变化，更新菜单可见性
    signals.objectSelected.add(updateVisibility);

    // 更新菜单可见性的函数
    function updateVisibility() {
        if (editor.type && editor.type.toLowerCase() === 'meta' && editor.selected !== null) {
            // 只有当选中对象类型为polygen或voxel时才显示
            const objectType = editor.selected.type ? editor.selected.type.toLowerCase() : '';
            if (objectType === 'mesh' || objectType === 'polygen' || objectType === 'voxel') {
                container.setDisplay('');
            } else {
                container.setDisplay('none');
            }
        } else {
            container.setDisplay('none');
        }
    }

    return container;
}

export { MenubarComponent };
