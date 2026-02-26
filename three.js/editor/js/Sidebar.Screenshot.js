import * as THREE from 'three';
import { UIPanel, UIRow, UIButton, UIInput, UISelect, UIText, UIColor } from './libs/ui.js';
import { UIBoolean } from './libs/ui.three.js';
import { ScreenshotUtils } from './utils/ScreenshotUtils.js';

const LIGHT_CLEAR_COLOR = 0x1b1f24;
const DARK_CLEAR_COLOR = 0x1b1f24;
const LIGHT_GRID_COLORS = [0x4f535a, 0x5a5f67];
const DARK_GRID_COLORS = [0x4f535a, 0x5a5f67];
const AXIS_X_COLOR = 0xd75f66;
const AXIS_Z_COLOR = 0x5abf77;

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
    title.setTextContent(strings.getKey('sidebar/scene/background'));
    container.add(title);

    // 场景背景/网格设置（放在顶部）
    const sceneSettingsPanel = new UIPanel();
    container.add(sceneSettingsPanel);

    const sceneBackgroundRow = new UIRow();
    sceneBackgroundRow.setClass('row');
    sceneBackgroundRow.setMarginBottom('10px');

    const sceneBackgroundLabel = new UIText(strings.getKey('sidebar/scene/background')).setWidth('90px');
    sceneBackgroundRow.add(sceneBackgroundLabel);

    const sceneBackgroundColor = new UIColor().setWidth('150px');
    sceneBackgroundRow.add(sceneBackgroundColor);

    sceneSettingsPanel.add(sceneBackgroundRow);

    const sceneGridRow = new UIRow();
    sceneGridRow.setClass('row');
    sceneGridRow.setMarginBottom('8px');

    const sceneGridLabel = new UIText(strings.getKey('sidebar/settings/viewport/grid')).setWidth('90px');
    sceneGridRow.add(sceneGridLabel);

    const sceneShowGrid = new UIBoolean(true);
    sceneGridRow.add(sceneShowGrid);

    sceneSettingsPanel.add(sceneGridRow);

    const sceneGroundRow = new UIRow();
    sceneGroundRow.setClass('row');
    sceneGroundRow.setMarginBottom('12px');

    const sceneGroundLabel = new UIText(strings.getKey('sidebar/settings/viewport/ground')).setWidth('90px');
    sceneGroundRow.add(sceneGroundLabel);

    const sceneShowGround = new UIBoolean(true);
    sceneGroundRow.add(sceneShowGround);

    sceneSettingsPanel.add(sceneGroundRow);

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
    resolutionSelect.setValue(config.getKey('screenshot/resolution') || 'current');
    resolutionRow.add(resolutionSelect);

    settingsPanel.add(resolutionRow);

    // 文件名设置
    const filenameRow = new UIRow();
    filenameRow.setClass('row');
    filenameRow.setMarginBottom('10px');

    const filenameLabel = new UIText(strings.getKey('sidebar/screenshot/filename')).setWidth('90px');
    filenameRow.add(filenameLabel);

    const filenameInput = new UIInput().setWidth('150px').setValue(config.getKey('screenshot/filename') || 'screenshot');
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
    formatSelect.setValue(config.getKey('screenshot/format') || 'png');
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

    function getCurrentDefaultClearColor() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            return mediaQuery.matches ? DARK_CLEAR_COLOR : LIGHT_CLEAR_COLOR;
        }

        return LIGHT_CLEAR_COLOR;
    }

    function getCurrentGridColors() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            return mediaQuery.matches ? DARK_GRID_COLORS : LIGHT_GRID_COLORS;
        }

        return LIGHT_GRID_COLORS;
    }

    function readSceneBackgroundColor() {
        if (editor.scene.background && editor.scene.background.isColor) {
            return `#${editor.scene.background.getHexString()}`;
        }

        return `#${getCurrentDefaultClearColor().toString(16).padStart(6, '0')}`;
    }

    function applySceneBackgroundColor() {
        signals.sceneBackgroundChanged.dispatch(
            'Color',
            sceneBackgroundColor.getHexValue(),
            null,
            null
        );

        config.setKey('scene/backgroundColor', sceneBackgroundColor.getHexValue());
    }

    function applySceneGridVisible() {
        signals.showGridChanged.dispatch(sceneShowGrid.getValue());
        config.setKey('scene/showGrid', sceneShowGrid.getValue());
    }

    function applySceneGroundVisible() {
        signals.showGroundChanged.dispatch(sceneShowGround.getValue());
        config.setKey('scene/showGround', sceneShowGround.getValue());
    }

    // 初始化场景背景配置
    const savedSceneBackgroundColor = config.getKey('scene/backgroundColor');
    const migratedBackgroundColor = (savedSceneBackgroundColor === 0xf8fafc) ? LIGHT_CLEAR_COLOR : savedSceneBackgroundColor;
    if (migratedBackgroundColor !== undefined) {
        sceneBackgroundColor.setHexValue(migratedBackgroundColor);
    } else {
        sceneBackgroundColor.setValue(readSceneBackgroundColor());
    }

    // 初始化网格开关
    const savedSceneShowGrid = config.getKey('scene/showGrid');
    sceneShowGrid.setValue(savedSceneShowGrid !== undefined ? savedSceneShowGrid : true);
    const savedSceneShowGround = config.getKey('scene/showGround');
    sceneShowGround.setValue(savedSceneShowGround !== undefined ? savedSceneShowGround : true);

    // 启动时仅在无背景时套用主题色；已有纹理背景时保留原场景设置
    if (migratedBackgroundColor !== undefined || editor.scene.background === null || editor.scene.background.isColor) {
        applySceneBackgroundColor();
    }
    applySceneGridVisible();
    applySceneGroundVisible();

    // 事件处理
    resolutionSelect.onChange(function() {
        config.setKey('screenshot/resolution', resolutionSelect.getValue());
    });

    sceneBackgroundColor.onInput(function () {
        applySceneBackgroundColor();
    });

    sceneShowGrid.onChange(function() {
        applySceneGridVisible();
    });

    sceneShowGround.onChange(function() {
        applySceneGroundVisible();
    });

    filenameInput.onChange(function() {
        config.setKey('screenshot/filename', filenameInput.getValue());
    });

    formatSelect.onChange(function() {
        config.setKey('screenshot/format', formatSelect.getValue());
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
            const physicallyCorrectLights = config.getKey('project/renderer/physicallyCorrectLights');
            if (physicallyCorrectLights !== undefined) {
                tempRenderer.physicallyCorrectLights = physicallyCorrectLights;
            }

            // 阴影
            const shadows = config.getKey('project/renderer/shadows');
            if (shadows !== undefined) {
                tempRenderer.shadowMap.enabled = shadows;
            }

            // 阴影类型
            const shadowType = config.getKey('project/renderer/shadowType');
            if (shadowType !== undefined) {
                tempRenderer.shadowMap.type = shadowType;
            }

            // 色调映射
            const toneMapping = config.getKey('project/renderer/toneMapping');
            if (toneMapping !== undefined) {
                tempRenderer.toneMapping = toneMapping;
            }

            // 色调映射曝光
            const toneMappingExposure = config.getKey('project/renderer/toneMappingExposure');
            if (toneMappingExposure !== undefined) {
                tempRenderer.toneMappingExposure = toneMappingExposure;
            }

            if (scene.background === null) {
                tempRenderer.setClearColor(getCurrentDefaultClearColor(), 1);
            }

            // 更新相机宽高比
            const originalAspect = camera.aspect;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            // 渲染主场景
            tempRenderer.render(scene, camera);

            // 按当前场景网格/地面开关渲染辅助
            if (sceneShowGrid.getValue() || sceneShowGround.getValue()) {
                const grid = new THREE.Group();
                const gridColors = getCurrentGridColors();

                if (sceneShowGrid.getValue()) {
                    const grid1 = createGridWithoutCenter(30, 30, gridColors[0], 0);
                    grid.add(grid1);

                    const grid2 = createGridWithoutCenter(30, 6, gridColors[1], 0.0005);
                    grid2.material.depthFunc = THREE.AlwaysDepth;
                    grid.add(grid2);

                    const axisX = createCenterAxisLine(
                        new THREE.Vector3(-15, 0.001, 0),
                        new THREE.Vector3(15, 0.001, 0),
                        AXIS_X_COLOR
                    );
                    const axisZ = createCenterAxisLine(
                        new THREE.Vector3(0, 0.001, -15),
                        new THREE.Vector3(0, 0.001, 15),
                        AXIS_Z_COLOR
                    );
                    grid.add(axisX);
                    grid.add(axisZ);
                }

                if (sceneShowGround.getValue()) {
                    const groundTint = new THREE.Mesh(
                        new THREE.PlaneGeometry(30, 30),
                        new THREE.MeshBasicMaterial({
                            color: 0x272c34,
                            transparent: true,
                            opacity: 0.35,
                            depthWrite: false,
                            toneMapped: false
                        })
                    );
                    groundTint.rotation.x = -Math.PI / 2;
                    groundTint.position.y = -0.002;
                    groundTint.renderOrder = -2;
                    grid.add(groundTint);
                }

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
            editor.showNotification(strings.getKey('menubar/screenshot/downloaded') + filename, false);

            // 恢复相机宽高比
            camera.aspect = originalAspect;
            camera.updateProjectionMatrix();

            // 释放临时渲染器
            tempRenderer.dispose();
        } catch (error) {
            console.error('截图保存失败:', error);
            editor.showNotification(strings.getKey('menubar/screenshot/error/capture_failed') + ': ' + error.message, true);
        }
    }

    return container;
}

export { SidebarScreenshot };

function createGridWithoutCenter(size, divisions, color, y = 0) {
    const halfSize = size / 2;
    const step = size / divisions;
    const vertices = [];

    for (let i = 0; i <= divisions; i++) {
        const coord = -halfSize + i * step;
        if (Math.abs(coord) < 1e-6) continue; // 中心线单独绘制

        vertices.push(-halfSize, y, coord, halfSize, y, coord);
        vertices.push(coord, y, -halfSize, coord, y, halfSize);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.62,
        toneMapped: false
    });
    material.reflectivity = 0;
    material.envMapIntensity = 0;

    return new THREE.LineSegments(geometry, material);
}

function createCenterAxisLine(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        toneMapped: false
    });

    return new THREE.Line(geometry, material);
}
