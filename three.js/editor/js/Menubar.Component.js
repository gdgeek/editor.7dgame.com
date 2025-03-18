import * as THREE from 'three';
import { UIPanel, UIRow, UIHorizontalRule, UIButton, UISelect, UIText } from './libs/ui.js';
import { ComponentContainer } from './mrpp/ComponentContainer.js';
import { AddComponentCommand } from './commands/AddComponentCommand.js';

function MenubarComponent(editor) {
    const strings = editor.strings;
    const signals = editor.signals;

    const container = new UIPanel();
    container.setClass('menu');

    if (editor.type && editor.type.toLowerCase() === 'meta') {
        const title = new UIPanel();
        title.setClass('title');
        title.setTextContent(strings.getKey('menubar/component'));
        container.add(title);

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
                    const message = strings.getKey('menubar/component/confirm').replace('{0}', componentTypes[type]);

                    editor.showConfirmation(
                        message,
                        function() {
                            const component = ComponentContainer.Create(type);

                            if (component !== undefined) {
                                const command = new AddComponentCommand(editor, editor.selected, component);
                                editor.execute(command);

                                const successMessage = strings.getKey('menubar/component/success').replace('{0}', componentTypes[type]);
                                editor.showNotification(successMessage, false);
                            }
                        },
                        null,
                        event
                    );
                } else {
                    editor.showNotification(strings.getKey('menubar/component/select_object_first'), true);
                }
            });
            options.add(typeRow);
        });
    } else {
        container.setDisplay('none');
    }

    return container;
}

export { MenubarComponent };
