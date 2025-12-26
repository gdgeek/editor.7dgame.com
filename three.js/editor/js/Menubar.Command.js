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
        'Voice': strings.getKey('sidebar/command/select/voice'),
        'Gesture': strings.getKey('sidebar/command/select/gesture')
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
                    // NOTE: 原先会检查重复并跳过已有指令的对象；改为对所有选中对象都添加指令（允许重复）
                    for (let i = 0; i < selectedObjects.length; i++) {
                        const object = selectedObjects[i];
                        if (object.commands === undefined) object.commands = [];
                        const command = CommandContainer.Create(type);

                        if (command !== undefined) {
                            const cmd = new AddCommandCommand(editor, object, command);
                            editor.execute(cmd);
                        }
                    }

                    editor.showNotification(
                        `已为${selectedObjects.length}个对象添加${commandTypes[type]}指令`,
                        false
                    );

                } else {
                    // 单选对象处理

                    // NOTE: 注释掉单选时防止重复添加的检查，允许重复添加相同类型指令
                    /*
                    // 检查是否已经有该类型的指令
                    let hasVoiceCommand = false;
                    if (editor.selected.commands) {
                        for (let i = 0; i < editor.selected.commands.length; i++) {
                            if (editor.selected.commands[i].type === type) {
                                hasVoiceCommand = true;
                                break;
                            }
                        }
                    }

                    // 如果已有该类型指令，提示并不创建
                    if (hasVoiceCommand) {
                        const message = strings.getKey('menubar/command/already_exists') ||
                                    `此对象已添加${commandTypes[type]}，不能重复添加`;
                        editor.showNotification(message, true);
                        return;
                    }
                    */

                // 创建并添加
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
            if (objectType === 'mesh' || objectType === 'entity') {
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

        // NOTE: 注释掉基于是否已有指令而禁用菜单项的逻辑，始终允许添加指令
        Object.keys(commandTypes).forEach(function(t) {
            if (typeRows[t]) {
                typeRows[t].setClass('option');
                typeRows[t].dom.style.opacity = '';
                typeRows[t].dom.style.cursor = '';
            }
        });
    }

    return container;
}

export { MenubarCommand };
