import * as THREE from 'three';
import { UIPanel, UIRow } from './libs/ui.js';
import { ScreenshotUtils } from './utils/ScreenshotUtils.js';

function MenubarScreenshot(editor) {
    const strings = editor.strings;
    const signals = editor.signals;
    const config = editor.config;

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

        // 保存原始渲染器尺寸
        const originalSize = {
            width: rendererDomElement.width,
            height: rendererDomElement.height
        };

        // 从配置中获取截图设置
        const resolution = config.getKey('screenshot/resolution') || 'current';
        const background = config.getKey('screenshot/background') || 'original';
        const format = config.getKey('screenshot/format') || 'png';
        const filename = config.getKey('screenshot/filename') || 'screenshot';
        const showGrid = config.getKey('screenshot/showGrid') || false;

        // 设置新的渲染尺寸
        let width, height;
        if (resolution === 'current') {
            width = originalSize.width;
            height = originalSize.height;
        } else {
            const dims = resolution.split('x');
            width = parseInt(dims[0]);
            height = parseInt(dims[1]);
        }

        try {
            // 创建一个临时的渲染器来截图
            const tempRenderer = new THREE.WebGLRenderer({
                preserveDrawingBuffer: true,
                antialias: true,
                alpha: true
            });

            // 设置渲染器尺寸
            tempRenderer.setSize(width, height);

            // 设置渲染器属性以匹配编辑器的渲染器
            tempRenderer.outputEncoding = THREE.sRGBEncoding;

            // 物理正确光照
            const physicallyCorrectLights = editor.config.getKey('project/renderer/physicallyCorrectLights');
            if (physicallyCorrectLights !== undefined) {
                tempRenderer.physicallyCorrectLights = physicallyCorrectLights;
            }

            // 阴影
            const shadows = editor.config.getKey('project/renderer/shadows');
            if (shadows !== undefined) {
                tempRenderer.shadowMap.enabled = shadows;
            }

            // 阴影类型
            const shadowType = editor.config.getKey('project/renderer/shadowType');
            if (shadowType !== undefined) {
                tempRenderer.shadowMap.type = shadowType;
            }

            // 色调映射
            const toneMapping = editor.config.getKey('project/renderer/toneMapping');
            if (toneMapping !== undefined) {
                tempRenderer.toneMapping = toneMapping;
            }

            // 色调映射曝光
            const toneMappingExposure = editor.config.getKey('project/renderer/toneMappingExposure');
            if (toneMappingExposure !== undefined) {
                tempRenderer.toneMappingExposure = toneMappingExposure;
            }

            // 获取当前背景色
            let bgColor = 0xaaaaaa; // 默认背景色
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                bgColor = mediaQuery.matches ? 0x333333 : 0xaaaaaa;
            }

            // 设置背景色
            if (background === 'white') {
                tempRenderer.setClearColor(0xffffff, 1);
            } else {
                tempRenderer.setClearColor(bgColor, 1);
                if (scene.background) {
                    tempRenderer.setClearColor(scene.background, 1);
                }
            }

            // 更新相机宽高比
            const originalAspect = camera.aspect;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            // 渲染主场景
            tempRenderer.render(scene, camera);

            // 如果需要渲染网格线
            if (showGrid) {
                const grid = new THREE.Group();
                const grid1 = new THREE.GridHelper(30, 30, 0x888888);
                grid1.material.color.setHex(0x888888);
                grid1.material.vertexColors = false;
                grid.add(grid1);

                const grid2 = new THREE.GridHelper(30, 6, 0x222222);
                grid2.material.color.setHex(0x222222);
                grid2.material.depthFunc = THREE.AlwaysDepth;
                grid2.material.vertexColors = false;
                grid.add(grid2);

                scene.add(grid);
                tempRenderer.autoClear = false;
                tempRenderer.render(scene, camera);
                scene.remove(grid);
            }

            tempRenderer.autoClear = true;

            // 获取图像数据
            const quality = format === 'jpg' ? 0.9 : undefined;
            const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
            const dataURL = tempRenderer.domElement.toDataURL(mimeType, quality);
            const finalFilename = filename + '.' + format;

            // 播放截图动画效果
            ScreenshotUtils.playAnimation(dataURL, null, function() {
                // 动画完成后显示确认对话框
                editor.showConfirmation(
                    strings.getKey('menubar/screenshot/confirm_upload'),
                    function() {
                        editor.signals.messageSend.dispatch({
                            action: 'upload-cover',
                            data: {
                                imageData: dataURL,
                                filename: finalFilename
                            }
                        });

                        editor.showNotification(strings.getKey('menubar/screenshot/uploading'), false);
                    },
                    function() {
                        editor.showNotification(strings.getKey('menubar/screenshot/upload_canceled'), false);
                    }
                );
            });

            // 恢复相机宽高比
            camera.aspect = originalAspect;
            camera.updateProjectionMatrix();

            // 释放临时渲染器
            tempRenderer.dispose();
        } catch (error) {
            console.error('截图过程中出现错误:', error);
            editor.showNotification(strings.getKey('menubar/screenshot/error/capture_failed') + ': ' + error.message, true);
        }
    }

    return container;
}

export { MenubarScreenshot };
