/**
 * 截图工具类
 * 提供截图动画效果和音效功能
 */
class ScreenshotUtils {
    /**
     * 截图音效
     * @type {Audio}
     */
    static captureSound = null;

    /**
     * 初始化音效
     */
    static initSound() {
        if (ScreenshotUtils.captureSound === null) {
            ScreenshotUtils.captureSound = new Audio();
            ScreenshotUtils.captureSound.src = './js/utils/screenshot.mp3';
            ScreenshotUtils.captureSound.load();
        }
    }

    /**
     * 创建截图动画元素
     * @param {HTMLElement} previewContainer - 预览容器元素 (可选，用于移动动画)
     * @returns {HTMLElement} - 返回截图动画容器元素
     */
    static createAnimationElements(previewContainer = null) {
        // 已经存在则不重复创建
        if (document.getElementById('screenshot-animation-container')) {
            return document.getElementById('screenshot-animation-container');
        }

        // 初始化音效
        ScreenshotUtils.initSound();

        // 创建动画容器
        const animationContainer = document.createElement('div');
        animationContainer.id = 'screenshot-animation-container';
        animationContainer.style.position = 'fixed';
        animationContainer.style.top = '0';
        animationContainer.style.left = '0';
        animationContainer.style.width = '100%';
        animationContainer.style.height = '100%';
        animationContainer.style.display = 'none';
        animationContainer.style.zIndex = '9999';
        animationContainer.style.pointerEvents = 'none';

        // 创建闪光层
        const flashLayer = document.createElement('div');
        flashLayer.id = 'screenshot-flash';
        flashLayer.style.position = 'absolute';
        flashLayer.style.top = '0';
        flashLayer.style.left = '0';
        flashLayer.style.width = '100%';
        flashLayer.style.height = '100%';
        flashLayer.style.backgroundColor = '#fff';
        flashLayer.style.opacity = '0';
        flashLayer.style.transition = 'opacity 0.15s ease-out';
        animationContainer.appendChild(flashLayer);

        // 创建截图预览动画层
        const screenshotPreview = document.createElement('div');
        screenshotPreview.id = 'screenshot-preview-animation';
        screenshotPreview.style.position = 'absolute';
        screenshotPreview.style.top = '50%';
        screenshotPreview.style.left = '50%';
        screenshotPreview.style.transform = 'translate(-50%, -50%) scale(0.9)';
        screenshotPreview.style.maxWidth = '80%';
        screenshotPreview.style.maxHeight = '80%';
        screenshotPreview.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
        screenshotPreview.style.borderRadius = '4px';
        screenshotPreview.style.opacity = '0';
        screenshotPreview.style.transition = 'all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1)';
        animationContainer.appendChild(screenshotPreview);

        // 将动画容器添加到 body
        document.body.appendChild(animationContainer);

        return animationContainer;
    }

    /**
     * 播放截图动画
     * @param {string} imageDataURL - 图片的 Data URL
     * @param {HTMLElement} previewContainer - 预览容器元素 (可选，用于移动动画)
     * @param {function} callback - 动画完成后的回调函数 (可选)
     */
    static playAnimation(imageDataURL, previewContainer = null, callback = null) {
        const animationContainer = ScreenshotUtils.createAnimationElements(previewContainer);
        const flashLayer = document.getElementById('screenshot-flash');
        const screenshotPreview = document.getElementById('screenshot-preview-animation');

        // 创建预览图像
        const previewImageElement = document.createElement('img');
        previewImageElement.src = imageDataURL;
        previewImageElement.style.maxWidth = '100%';
        previewImageElement.style.maxHeight = '100%';
        previewImageElement.style.borderRadius = '4px';
        previewImageElement.style.display = 'block';

        // 清空并添加新图像
        screenshotPreview.innerHTML = '';
        screenshotPreview.appendChild(previewImageElement);

        // 初始状态设置 - 从全屏状态开始
        screenshotPreview.style.opacity = '0';
        screenshotPreview.style.transform = 'translate(-50%, -50%) scale(1.2)';
        screenshotPreview.style.maxWidth = '100%';
        screenshotPreview.style.maxHeight = '100%';
        screenshotPreview.style.borderRadius = '0';

        // 显示动画容器
        animationContainer.style.display = 'block';

        // 播放拍照音效
        ScreenshotUtils.captureSound.currentTime = 0;
        ScreenshotUtils.captureSound.play().catch(error => console.log('音效播放失败:', error));

        // 播放闪光动画
        setTimeout(() => {
            flashLayer.style.opacity = '0.8';

            // 同时将图像淡入显示并从场景向中间缩小
            setTimeout(() => {
                flashLayer.style.opacity = '0';
                screenshotPreview.style.opacity = '1';
                // 向中间缩小到合适大小
                screenshotPreview.style.transform = 'translate(-50%, -50%) scale(0.9)';
                screenshotPreview.style.maxWidth = '80%';
                screenshotPreview.style.maxHeight = '80%';
                screenshotPreview.style.borderRadius = '4px';

                // 短暂停留后继续动画
                setTimeout(() => {
                    // 放大到标准预览大小
                    screenshotPreview.style.transform = 'translate(-50%, -50%) scale(1)';

                    // 过一段时间后隐藏预览
                    setTimeout(() => {
                        if (previewContainer) {
                            // 缩小并移动到预览区域的位置
                            const previewRect = previewContainer.getBoundingClientRect();
                            const centerX = previewRect.left + previewRect.width / 2;
                            const centerY = previewRect.top + previewRect.height / 2;

                            const viewportWidth = window.innerWidth;
                            const viewportHeight = window.innerHeight;

                            // 计算从屏幕中心到预览区域的位置变换
                            const translateX = ((centerX / viewportWidth) * 200) - 100; // 转换为-100到100的范围
                            const translateY = ((centerY / viewportHeight) * 200) - 100; // 转换为-100到100的范围

                            screenshotPreview.style.transform = `translate(${translateX}%, ${translateY}%) scale(0.2)`;
                        } else {
                            // 如果没有指定预览容器，则直接缩小并淡出
                            screenshotPreview.style.transform = 'translate(-50%, -50%) scale(0.2)';
                        }

                        screenshotPreview.style.opacity = '0';

                        // 完全隐藏动画
                        setTimeout(() => {
                            animationContainer.style.display = 'none';
                            // 如果有回调函数，则调用
                            if (callback && typeof callback === 'function') {
                                callback();
                            }
                        }, 500);
                    }, 800);
                }, 300);
            }, 150);
        }, 10);
    }
}

export { ScreenshotUtils };
