import * as THREE from 'three';
import { UIPanel, UIRow, UIHorizontalRule, UIButton, UISelect, UIText } from './libs/ui.js';
import { CommandContainer } from './mrpp/CommandContainer.js';
import { AddCommandCommand } from './commands/AddCommandCommand.js';

function MenubarCommand(editor) {
    const strings = editor.strings;
    const signals = editor.signals;

    const container = new UIPanel();
    container.setClass('menu');

    if (editor.type && editor.type.toLowerCase() === 'meta') {
        const title = new UIPanel();
        title.setClass('title');
        title.setTextContent(strings.getKey('menubar/command'));
        container.add(title);

        const options = new UIPanel();
        options.setClass('options');
        container.add(options);

        const commandTypes = {
            'Voice': strings.getKey('sidebar/command/select/voice')
        };

        // 为每种指令类型创建菜单选项
        Object.keys(commandTypes).forEach(function(type) {
            const typeRow = new UIRow();
            typeRow.setClass('option');
            typeRow.setTextContent(commandTypes[type]);
            typeRow.onClick(function(event) {
                if (editor.selected !== null) {
                    const message = strings.getKey('menubar/command/confirm').replace('{0}', commandTypes[type]);

                    editor.showConfirmation(
                        message,
                        function() {
                            const command = CommandContainer.Create(type);

                            if (command !== undefined) {
                                const cmd = new AddCommandCommand(editor, editor.selected, command);
                                editor.execute(cmd);

                                const successMessage = strings.getKey('menubar/command/success').replace('{0}', commandTypes[type]);
                                editor.showNotification(successMessage, false);
                            }
                        },
                        null,
                        event
                    );
                } else {
                    editor.showNotification(strings.getKey('menubar/command/select_object_first'), true);
                }
            });
            options.add(typeRow);
        });
    } else {
        container.setDisplay('none');
    }

    return container;
}

export { MenubarCommand };
