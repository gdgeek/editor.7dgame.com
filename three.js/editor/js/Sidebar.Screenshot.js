import * as THREE from 'three';
import { UIPanel, UIRow, UIButton, UIInput, UISelect, UIText } from './libs/ui.js';
import { UIBoolean } from './libs/ui.three.js';
import { ScreenshotUtils } from './utils/ScreenshotUtils.js';

function SidebarScreenshot(editor) {
    const strings = editor.strings;
    const signals = editor.signals;
    const config = editor.config;

    // 页面刷新时重置背景色配置为original
    editor.config.setKey('screenshot/background', 'original');

    const container = new UIPanel();
    container.setBorderTop('0');
    container.setPaddingTop('20px');

    // 标题
    const title = new UIPanel();
    title.setClass('title');
    title.setTextContent(strings.getKey('sidebar/screenshot'));
    container.add(title);

    // 截图设置面板
    const settingsPanel = new UIPanel();
    container.add(settingsPanel);

    // 分辨率设置
    const resolutionRow = new UIRow();
    resolutionRow.setClass('row');
    resolutionRow.setMarginBottom('10px');

    const resolutionLabel = new UIText(strings.getKey('sidebar/screenshot/resolution')).setWidth('90px');
    resolutionRow.add(resolutionLabel);

    const resolutionSelect = new UISelect().setWidth('150px');
    resolutionSelect.setOptions({
        'current': strings.getKey('sidebar/screenshot/resolution/current'),
        '1920x1080': '1920 × 1080 (FHD)',
        '1280x720': '1280 × 720 (HD)',
        '3840x2160': '3840 × 2160 (4K)'
    });
    resolutionSelect.setValue('current');
    resolutionRow.add(resolutionSelect);

    settingsPanel.add(resolutionRow);

    // 背景色设置
    const backgroundRow = new UIRow();
    backgroundRow.setClass('row');
    backgroundRow.setMarginBottom('10px');

    const backgroundLabel = new UIText(strings.getKey('sidebar/screenshot/background')).setWidth('90px');
    backgroundRow.add(backgroundLabel);

    const backgroundSelect = new UISelect().setWidth('150px');
    backgroundSelect.setOptions({
        'original': strings.getKey('sidebar/screenshot/background/original'),
        'white': strings.getKey('sidebar/screenshot/background/white'),
        'light': strings.getKey('sidebar/screenshot/background/light'),
        'dark': strings.getKey('sidebar/screenshot/background/dark'),
    });

    // 从配置中读取背景色设置，如果没有则默认为original
    const savedBackground = editor.config.getKey('screenshot/background') || 'original';
    backgroundSelect.setValue(savedBackground);

    backgroundRow.add(backgroundSelect);

    settingsPanel.add(backgroundRow);

    // 文件名设置
    const filenameRow = new UIRow();
    filenameRow.setClass('row');
    filenameRow.setMarginBottom('10px');

    const filenameLabel = new UIText(strings.getKey('sidebar/screenshot/filename')).setWidth('90px');
    filenameRow.add(filenameLabel);

    const filenameInput = new UIInput().setWidth('150px').setValue('screenshot');
    filenameRow.add(filenameInput);

    settingsPanel.add(filenameRow);

    // 文件格式设置
    const formatRow = new UIRow();
    formatRow.setClass('row');
    formatRow.setMarginBottom('10px');

    const formatLabel = new UIText(strings.getKey('sidebar/screenshot/format')).setWidth('90px');
    formatRow.add(formatLabel);

    const formatSelect = new UISelect().setWidth('150px');
    formatSelect.setOptions({
        'png': 'PNG',
        'jpg': 'JPG'
    });
    formatSelect.setValue('png');
    formatRow.add(formatSelect);

    settingsPanel.add(formatRow);

    // 显示网格线设置
    const showGridRow = new UIRow();
    showGridRow.setClass('row');
    showGridRow.setMarginBottom('10px');

    const showGridLabel = new UIText(strings.getKey('sidebar/settings/viewport/grid')).setWidth('90px');
    showGridRow.add(showGridLabel);

    const showGrid = new UIBoolean(false);
    showGridRow.add(showGrid);
    settingsPanel.add(showGridRow);

    // 截图按钮
    const buttonRow = new UIRow();
    buttonRow.setClass('row');
    buttonRow.setMarginTop('20px');
    buttonRow.setMarginBottom('20px');

    const captureButton = new UIButton(strings.getKey('sidebar/screenshot/capture'));
    captureButton.setWidth('100%');
    captureButton.dom.style.backgroundColor = '#4CAF50';
    captureButton.dom.style.color = '#fff';
    captureButton.dom.style.padding = '8px';
    buttonRow.add(captureButton);

    settingsPanel.add(buttonRow);

    // 图片预览区域
    const previewPanel = new UIPanel();
    previewPanel.setClass('preview');
    previewPanel.setMarginTop('10px');
    previewPanel.setDisplay('none'); // 初始隐藏
    settingsPanel.add(previewPanel);

    // 预览
    const previewTitle = new UIText(strings.getKey('sidebar/screenshot/preview'));
    previewTitle.setMarginBottom('10px');
    previewPanel.add(previewTitle);

    // 预览图片容器
    const previewImageContainer = new UIPanel();
    previewImageContainer.setWidth('100%');
    previewImageContainer.setHeight('auto');
    previewImageContainer.setBorder('1px solid #ccc');
    previewImageContainer.setMarginBottom('10px');
    previewImageContainer.setPadding('5px');
    previewPanel.add(previewImageContainer);

    // 预览图片
    const previewImage = document.createElement('img');
    previewImage.style.width = '100%';
    previewImage.style.height = 'auto';
    previewImage.style.display = 'block';
    previewImageContainer.dom.appendChild(previewImage)

    // 下载按钮
    const downloadButton = new UIButton(strings.getKey('sidebar/screenshot/download'));
    downloadButton.setWidth('48%');
    downloadButton.dom.style.backgroundColor = '#2196F3';
    downloadButton.dom.style.color = '#fff';
    downloadButton.dom.style.padding = '8px';
    downloadButton.dom.style.marginRight = '4%';
    downloadButton.setMarginBottom('10px');
    downloadButton.setDisplay('none'); // 初始隐藏
    previewPanel.add(downloadButton);

    // 上传作为封面按钮
    const uploadAsCoverButton = new UIButton(strings.getKey('sidebar/screenshot/uploadAsCover'));
    uploadAsCoverButton.setWidth('48%');
    uploadAsCoverButton.dom.style.backgroundColor = '#FF9800';
    uploadAsCoverButton.dom.style.color = '#fff';
    uploadAsCoverButton.dom.style.padding = '8px';
    uploadAsCoverButton.setMarginBottom('10px');
    uploadAsCoverButton.setDisplay('none'); // 初始隐藏
    previewPanel.add(uploadAsCoverButton);

    // 事件处理
    resolutionSelect.onChange(function() {
        // 更新配置
        editor.config.setKey('screenshot/resolution', resolutionSelect.getValue());
    });

    // 背景色设置事件
    backgroundSelect.onChange(function() {
        const newBackground = backgroundSelect.getValue();
        editor.config.setKey('screenshot/background', newBackground);

        // 发送背景色变更信号
        editor.signals.screenshotBackgroundChanged.dispatch(newBackground);
    });

    // 文件名设置事件
    filenameInput.onChange(function() {
        editor.config.setKey('screenshot/filename', filenameInput.getValue());
    });

    // 文件格式设置事件
    formatSelect.onChange(function() {
        editor.config.setKey('screenshot/format', formatSelect.getValue());
    });

    // 显示网格线设置事件
    showGrid.onChange(function() {
        editor.config.setKey('screenshot/showGrid', showGrid.getValue());
    });

    captureButton.onClick(function() {
        captureScreenshot();
    });

    // 下载按钮点击事件
    let currentImageDataURL = '';
    let currentFilename = '';

    downloadButton.onClick(function() {
        if (currentImageDataURL) {
            const link = document.createElement('a');
            link.href = currentImageDataURL;
            link.download = currentFilename;
            link.click();

            // 显示下载通知
            editor.showNotification(strings.getKey('menubar/screenshot/downloaded') + currentFilename, false);
        }
    });

    // 上传作为封面按钮点击事件
    uploadAsCoverButton.onClick(function() {
        if (currentImageDataURL) {
            // 发送消息到父窗口，将截图数据作为封面上传
            editor.signals.messageSend.dispatch({
                action: 'upload-cover',
                data: {
                    imageData: currentImageDataURL,
                    filename: currentFilename
                }
            });

            editor.showNotification(strings.getKey('menubar/screenshot/uploading'), false);
        }
    });

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

        // 设置新的渲染尺寸
        let width, height;
        const resolution = resolutionSelect.getValue();

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
            tempRenderer.outputEncoding = THREE.sRGBEncoding; // 默认使用sRGB编码

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
            // 检查是否有媒体查询以确定背景色
            let bgColor = 0xaaaaaa; // 默认背景色
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                bgColor = mediaQuery.matches ? 0x333333 : 0xaaaaaa;
            }

            // 获取用户设置的背景色选项
            const backgroundOption = backgroundSelect.getValue();

            // 设置背景色
            if (backgroundOption === 'white') {
                // 设置为白色背景
                tempRenderer.setClearColor(0xffffff, 1);
            } else if (backgroundOption === 'light') {
                // 设置为浅色背景
                tempRenderer.setClearColor(0xeeffff, 1);
            } else if (backgroundOption === 'dark') {
                // 设置为深色背景
                tempRenderer.setClearColor(0x333333, 1);
            } else {
                // 使用默认背景色
                tempRenderer.setClearColor(bgColor, 1);

                // 如果场景有背景色或背景纹理，应用它
                if (scene.background) {
                    // 如果场景已经设置了背景，临时渲染器会自动使用它
                    tempRenderer.setClearColor(scene.background, 1);
                }
            }

            // 更新相机宽高比
            const originalAspect = camera.aspect;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            // 获取用户设置的网格线显示状态
            const shouldShowGrid = showGrid.getValue();

            // 渲染主场景
            tempRenderer.render(scene, camera);

            // 如果需要渲染网格线，创建并添加到场景中
            if (shouldShowGrid) {
                // 创建一个与编辑器中相同的网格线
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

                // 添加网格线到场景并渲染
                scene.add(grid);
                tempRenderer.autoClear = false;
                tempRenderer.render(scene, camera);
                scene.remove(grid);
            }

            tempRenderer.autoClear = true;

            // 获取图像数据
            const format = formatSelect.getValue();
            const quality = format === 'jpg' ? 0.9 : undefined;
            const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';

            // 创建下载链接
            const dataURL = tempRenderer.domElement.toDataURL(mimeType, quality);
            const filename = filenameInput.getValue() + '.' + format;

            // 保存当前图片数据和文件名
            currentImageDataURL = dataURL;
            currentFilename = filename;

            // 播放截图动画
            ScreenshotUtils.playAnimation(dataURL, previewImageContainer.dom);

            // 更新预览图片
            previewImage.src = dataURL;
            previewPanel.setDisplay(''); // 显示预览面板
            downloadButton.setDisplay(''); // 显示下载按钮
            uploadAsCoverButton.setDisplay(''); // 显示上传作为封面按钮

            // 自动下载
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = filename;
            link.click();

            // 显示成功消息
            console.log('正在显示通知: 截图已保存为 ' + filename);
            editor.showNotification(strings.getKey('menubar/screenshot/downloaded') + filename, false);

            // 恢复相机宽高比
            camera.aspect = originalAspect;
            camera.updateProjectionMatrix();

            // 释放临时渲染器
            tempRenderer.dispose();
        } catch (error) {
            console.error('截图保存失败:', error);

            console.log('正在显示错误通知: ' + error.message);
            editor.showNotification(strings.getKey('menubar/screenshot/error/capture_failed') + ': ' + error.message, true);
        }
    }

    return container;
}

export { SidebarScreenshot };
