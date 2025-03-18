import * as THREE from 'three';
import { UIPanel, UIRow } from './libs/ui.js';

function MenubarScreenshot(editor) {
    const strings = editor.strings;
    const signals = editor.signals;

    const container = new UIPanel();
    container.setClass('menu');

    const title = new UIPanel();
    title.setClass('title');
    title.setTextContent(strings.getKey('menubar/screenshot'));
    container.add(title);

    const options = new UIPanel();
    options.setClass('options');
    container.add(options);

    // 截图选项
    const captureRow = new UIRow();
    captureRow.setClass('option');
    captureRow.setTextContent(strings.getKey('menubar/screenshot/capture'));
    captureRow.onClick(function() {
        // 调用截图功能
        captureScreenshot();
    });
    options.add(captureRow);

    // 截图功能实现
    function captureScreenshot() {
        // 获取渲染器和相机
        const viewportElement = document.getElementById('viewport');
        if (!viewportElement) {
            editor.showNotification(strings.getKey('menubar/screenshot/error/viewport_not_found'), true);
            return;
        }

        // 获取渲染器 - 直接从DOM中获取
        const rendererDomElement = viewportElement.querySelector('canvas');
        if (!rendererDomElement) {
            editor.showNotification(strings.getKey('menubar/screenshot/error/canvas_not_found'), true);
            return;
        }

        // 获取场景和相机
        const scene = editor.scene;
        const camera = editor.camera;

        // 保存当前网格显示状态
        const showGridState = editor.config.getKey('view/grid');

        try {
            // 临时隐藏网格
            editor.config.setKey('view/grid', false);
            editor.signals.showGridChanged.dispatch(false);

            // 进行渲染并获取图像数据
            editor.signals.sceneRendered.dispatch();

            // 创建数据URL
            const dataURL = rendererDomElement.toDataURL('image/png');
            const filename = 'screenshot_' + Date.now() + '.png';

            // 恢复网格状态
            editor.config.setKey('view/grid', showGridState);
            editor.signals.showGridChanged.dispatch(showGridState);

            // 显示截图成功的提示，并询问是否上传为封面
            editor.showConfirmation(
                strings.getKey('menubar/screenshot/confirm_upload'),
                function() {
                    editor.signals.messageSend.dispatch({
                        action: 'upload-cover',
                        data: {
                            imageData: dataURL,
                            filename: filename
                        }
                    });

                    editor.showNotification(strings.getKey('menubar/screenshot/uploading'), false);
                },
                function() {
                    editor.showNotification(strings.getKey('menubar/screenshot/upload_canceled'), false);
                }
            );
        } catch (error) {
            console.error('截图过程中出现错误:', error);
            editor.showNotification(strings.getKey('menubar/screenshot/error/capture_failed') + ': ' + error.message, true);

            // 恢复网格状态
            editor.config.setKey('view/grid', showGridState);
            editor.signals.showGridChanged.dispatch(showGridState);
        }
    }

    return container;
}

export { MenubarScreenshot };
