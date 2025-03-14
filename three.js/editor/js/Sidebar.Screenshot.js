import * as THREE from 'three';
import { UIPanel, UIRow, UIButton, UIInput, UISelect, UIText } from './libs/ui.js';

function SidebarScreenshot(editor) {
    const strings = editor.strings;
    const signals = editor.signals;
    const config = editor.config;

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
        'current': '当前视口大小',
        '1920x1080': '1920 × 1080 (FHD)',
        '1280x720': '1280 × 720 (HD)',
        '3840x2160': '3840 × 2160 (4K)',
        'custom': '自定义'
    });
    resolutionSelect.setValue('current');
    resolutionRow.add(resolutionSelect);

    settingsPanel.add(resolutionRow);

    // 自定义分辨率（默认隐藏）
    const customResolutionRow = new UIRow();
    customResolutionRow.setClass('row');
    customResolutionRow.setMarginBottom('10px');
    customResolutionRow.setDisplay('none');

    const widthInput = new UIInput().setWidth('70px').setValue('1920');
    customResolutionRow.add(widthInput);

    customResolutionRow.add(new UIText(' × ').setMarginLeft('5px').setMarginRight('5px'));

    const heightInput = new UIInput().setWidth('70px').setValue('1080');
    customResolutionRow.add(heightInput);

    settingsPanel.add(customResolutionRow);

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
    previewImageContainer.dom.appendChild(previewImage);

    // 下载按钮
    const downloadButton = new UIButton(strings.getKey('sidebar/screenshot/download'));
    downloadButton.setWidth('100%');
    downloadButton.dom.style.backgroundColor = '#2196F3';
    downloadButton.dom.style.color = '#fff';
    downloadButton.dom.style.padding = '8px';
    downloadButton.setMarginBottom('10px');
    downloadButton.setDisplay('none'); // 初始隐藏
    previewPanel.add(downloadButton);

    // 事件处理
    resolutionSelect.onChange(function() {
        if (resolutionSelect.getValue() === 'custom') {
            customResolutionRow.setDisplay('');
        } else {
            customResolutionRow.setDisplay('none');
        }
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
            editor.showNotification('图片已下载: ' + currentFilename, false);
        }
    });

    // 截图功能实现
    function captureScreenshot() {
        // 获取渲染器和相机
        const viewportElement = document.getElementById('viewport');
        if (!viewportElement) {
            editor.showNotification('无法找到视口元素', true);
            return;
        }

        // 获取渲染器 - 直接从DOM中获取
        const rendererDomElement = viewportElement.querySelector('canvas');
        if (!rendererDomElement) {
            editor.showNotification('无法找到渲染器画布', true);
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
        } else if (resolution === 'custom') {
            width = parseInt(widthInput.getValue());
            height = parseInt(heightInput.getValue());
        } else {
            const dims = resolution.split('x');
            width = parseInt(dims[0]);
            height = parseInt(dims[1]);
        }

        try {
            // 创建一个临时的渲染器来截图
            const tempRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true });
            tempRenderer.setSize(width, height);
            tempRenderer.setClearColor(0xffffff, 0); // 透明背景

            // 更新相机宽高比
            const originalAspect = camera.aspect;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            // 渲染场景
            tempRenderer.render(scene, camera);

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

            // 更新预览图片
            previewImage.src = dataURL;
            previewPanel.setDisplay(''); // 显示预览面板
            downloadButton.setDisplay(''); // 显示下载按钮

            // 自动下载
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = filename;
            link.click();

            // 显示成功消息
            console.log('正在显示通知: 截图已保存为 ' + filename);
            editor.showNotification('截图已保存为 ' + filename, false);

            // 恢复相机宽高比
            camera.aspect = originalAspect;
            camera.updateProjectionMatrix();

            // 释放临时渲染器
            tempRenderer.dispose();
        } catch (error) {
            console.error('截图保存失败:', error);

            console.log('正在显示错误通知: ' + error.message);
            editor.showNotification('截图保存失败: ' + error.message, true);
        }
    }

    return container;
}

export { SidebarScreenshot };
