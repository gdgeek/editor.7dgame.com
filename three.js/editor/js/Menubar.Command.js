import * as THREE from 'three';
import { UIPanel, UIRow, UIHorizontalRule, UIButton, UISelect, UIText } from './libs/ui.js';
import { CommandContainer } from './mrpp/CommandContainer.js';
import { AddCommandCommand } from './commands/AddCommandCommand.js';

function MenubarCommand(editor) {
    const strings = editor.strings;
    const signals = editor.signals;

    const container = new UIPanel();
    container.setClass('menu');

    // 创建菜单标题
    const title = new UIPanel();
    title.setClass('title');
    title.setTextContent(strings.getKey('menubar/command'));
    container.add(title);

    // 创建选项容器
    const options = new UIPanel();
    options.setClass('options');
    container.add(options);

    const commandTypes = {
        'Voice': strings.getKey('sidebar/command/select/voice')
    };

    // 存储指令菜单项的引用
    const typeRows = {};

    // 为每种指令类型创建菜单选项
    Object.keys(commandTypes).forEach(function(type) {
        const typeRow = new UIRow();
        typeRow.setClass('option');
        typeRow.setTextContent(commandTypes[type]);

        typeRow.onClick(function(event) {
            if (editor.selected !== null) {
                // 获取当前选中的对象
                const selectedObjects = editor.getSelectedObjects();

                // 多选对象处理
                if (selectedObjects.length > 1) {
                    // 检查哪些对象已经有语音指令
                    const objectsWithVoiceCommand = [];
                    const objectsToAddCommand = [];

                    for (let i = 0; i < selectedObjects.length; i++) {
                        const object = selectedObjects[i];

                        // 确保对象有commands属性
                        if (object.commands === undefined) {
                            object.commands = [];
                        }

                        // 检查是否已经有语音指令
                        let hasVoiceCommand = false;
                        for (let j = 0; j < object.commands.length; j++) {
                            if (object.commands[j].type === 'Voice') {
                                hasVoiceCommand = true;
                                break;
                            }
                        }

                        if (hasVoiceCommand) {
                            objectsWithVoiceCommand.push(object.name || `对象 ${i+1}`);
                        } else {
                            objectsToAddCommand.push(object);
                        }
                    }

                    // 如果有对象已经有语音指令，显示提示
                    if (objectsWithVoiceCommand.length > 0) {
                        const conflictNames = objectsWithVoiceCommand.length > 3
                            ? objectsWithVoiceCommand.slice(0, 3).join(', ') + `...等${objectsWithVoiceCommand.length}个对象`
                            : objectsWithVoiceCommand.join(', ');

                        editor.showNotification(
                            `以下对象已存在语音指令: ${conflictNames}，将跳过这些对象`,
                            true
                        );
                    }

                    // 为没有语音指令的对象添加
                    if (objectsToAddCommand.length > 0) {
                        for (let i = 0; i < objectsToAddCommand.length; i++) {
                            const object = objectsToAddCommand[i];
                            const command = CommandContainer.Create(type);

                            if (command !== undefined) {
                                const cmd = new AddCommandCommand(editor, object, command);
                                editor.execute(cmd);
                            }
                        }

                        editor.showNotification(
                            `已为${objectsToAddCommand.length}个对象添加${commandTypes[type]}指令`,
                            false
                        );
                    }

                } else {
                    // 单选对象处理（原有逻辑）
                // 检查是否已经有语音指令
                let hasVoiceCommand = false;
                if (editor.selected.commands) {
                    for (let i = 0; i < editor.selected.commands.length; i++) {
                        if (editor.selected.commands[i].type === 'Voice') {
                            hasVoiceCommand = true;
                            break;
                        }
                    }
                }

                // 如果已有语音指令，显示提示并不创建新的指令
                if (hasVoiceCommand) {
                    const message = strings.getKey('menubar/command/already_exists') ||
                                   '此对象已添加语音指令，不能重复添加';
                    editor.showNotification(message, true);
                    return;
                }

                // 如果没有语音指令，则创建新的指令
                const command = CommandContainer.Create(type);

                if (command !== undefined) {
                    const cmd = new AddCommandCommand(editor, editor.selected, command);
                    editor.execute(cmd);

                    const successMessage = strings.getKey('menubar/command/success').replace('{0}', commandTypes[type]);
                    editor.showNotification(successMessage, false);
                    }
                }
            } else {
                editor.showNotification(strings.getKey('menubar/command/select_object_first'), true);
            }
        });

        options.add(typeRow);

        // 存储引用以便后续更新状态
        typeRows[type] = typeRow;
    });

    // 初始时检查并设置菜单可见性
    updateVisibility();
    updateCommandOptions();

    // 监听对象选择变化，更新菜单可见性和指令选项
    signals.objectSelected.add(function() {
        updateVisibility();
        updateCommandOptions();
    });

    // 监听指令添加和移除事件，更新指令选项状态
    signals.commandAdded.add(updateCommandOptions);
    signals.commandRemoved.add(updateCommandOptions);

    // 更新菜单可见性
    function updateVisibility() {
        if (editor.type && editor.type.toLowerCase() === 'meta' && editor.selected !== null) {
            // 只有当选中对象类型为polygen或voxel时才显示
            const objectType = editor.selected.type ? editor.selected.type.toLowerCase() : '';
            if (objectType === 'mesh' || objectType === 'polygen' || objectType === 'voxel' || objectType === 'entity') {
                container.setDisplay('');
            } else {
                container.setDisplay('none');
            }
        } else {
            container.setDisplay('none');
        }
    }

    // 更新指令选项的可用状态
    function updateCommandOptions() {
        // 获取当前选中的对象
        const selectedObjects = editor.getSelectedObjects();

        // 多选对象处理
        if (selectedObjects.length > 1) {
            // 检查是否所有对象都已经有语音指令
            let allHaveVoiceCommand = true;

            for (let i = 0; i < selectedObjects.length; i++) {
                const object = selectedObjects[i];

                // 确保对象有commands属性
                if (object.commands === undefined) {
                    object.commands = [];
                }

                // 检查是否已经有语音指令
                let hasVoiceCommand = false;
                if (object.commands) {
                    for (let j = 0; j < object.commands.length; j++) {
                        if (object.commands[j].type === 'Voice') {
                            hasVoiceCommand = true;
                            break;
                        }
                    }
                }

                if (!hasVoiceCommand) {
                    allHaveVoiceCommand = false;
                    break;
                }
            }

            // 如果所有对象都已经有语音指令，则禁用菜单项
            if (allHaveVoiceCommand) {
                typeRows['Voice'].setClass('option disabled');
                typeRows['Voice'].dom.style.opacity = '0.5';
                typeRows['Voice'].dom.style.cursor = 'not-allowed';
            } else {
                // 启用指令
                typeRows['Voice'].setClass('option');
                typeRows['Voice'].dom.style.opacity = '';
                typeRows['Voice'].dom.style.cursor = '';
            }
        } else if (editor.selected !== null) {
            // 单选模式，使用原有逻辑
            // 确保对象有commands属性
            if (editor.selected.commands === undefined) {
                editor.selected.commands = [];
            }

            // 检查是否已经有语音指令
            let hasVoiceCommand = false;
            for (let i = 0; i < editor.selected.commands.length; i++) {
                if (editor.selected.commands[i].type === 'Voice') {
                    hasVoiceCommand = true;
                    break;
                }
            }

            // 更新语音指令的可用状态
            if (hasVoiceCommand) {
                // 如果已存在语音指令，则禁用
                typeRows['Voice'].setClass('option disabled');
                typeRows['Voice'].dom.style.opacity = '0.5';
                typeRows['Voice'].dom.style.cursor = 'not-allowed';
            } else {
                // 启用指令
                typeRows['Voice'].setClass('option');
                typeRows['Voice'].dom.style.opacity = '';
                typeRows['Voice'].dom.style.cursor = '';
            }
        }
    }

    return container;
}

export { MenubarCommand };
