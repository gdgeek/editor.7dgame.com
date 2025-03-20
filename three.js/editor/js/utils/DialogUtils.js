/**
 * 对话框工具类
 * 提供自定义提示框和确认框功能，替代浏览器原生的alert和confirm
 */
class DialogUtils {
    /**
     * 显示提示框
     * @param {string} message - 提示信息
     * @param {boolean} isError - 是否为错误提示，默认为false
     * @param {number} duration - 显示时长(毫秒)，默认为3000
     * @returns {HTMLElement} - 返回创建的提示框元素
     */
    static showMessage(message, isError = false, duration = 3000) {
        // 创建临时通知元素
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = isError ? 'rgba(231, 76, 60, 0.8)' : 'rgba(67, 166, 70, 0.8)';
        notification.style.color = '#fff';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '10000';
        notification.style.fontFamily = 'Arial, sans-serif';
        notification.style.fontSize = '14px';
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        notification.style.cursor = 'pointer';
        notification.textContent = message;
        document.body.appendChild(notification);

        // 添加点击事件，点击通知可以关闭它
        notification.addEventListener('click', function() {
            DialogUtils.closeNotification(notification);
        });

        // 淡入效果
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // 指定时间后自动淡出并移除临时通知
        if (duration > 0) {
            setTimeout(function() {
                DialogUtils.closeNotification(notification);
            }, duration);
        }

        return notification;
    }

    /**
     * 关闭提示框
     * @param {HTMLElement} notification - 提示框元素
     */
    static closeNotification(notification) {
        notification.style.opacity = '0';
        setTimeout(function() {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }

    /**
     * 显示确认框
     * @param {string} message - 确认信息
     * @param {Function} onConfirm - 确认回调函数
     * @param {Function} onCancel - 取消回调函数
     * @param {Event} event - 触发事件，用于定位确认框位置
     * @param {boolean} isError - 是否为错误提示，默认为false
     * @returns {HTMLElement} - 返回创建的确认框元素
     */
    static showConfirm(message, onConfirm, onCancel, event, isError = false) {
        // 创建确认通知元素
        const confirmNotification = document.createElement('div');
        confirmNotification.style.position = 'fixed';
        confirmNotification.style.backgroundColor = 'var(--popconfirm-bg, rgba(50, 50, 50, 0.95))';
        confirmNotification.style.color = 'var(--popconfirm-text, #fff)';
        confirmNotification.style.padding = '12px';
        confirmNotification.style.borderRadius = '6px';
        confirmNotification.style.zIndex = '10000';
        confirmNotification.style.fontFamily = 'Arial, sans-serif';
        confirmNotification.style.fontSize = '14px';
        confirmNotification.style.boxShadow = '0 3px 6px -4px rgba(0,0,0,0.12), 0 6px 16px 0 rgba(0,0,0,0.08)';
        confirmNotification.style.minWidth = '200px';
        confirmNotification.style.maxWidth = '250px';
        confirmNotification.style.opacity = '0';
        confirmNotification.style.transform = 'translateY(4px)';
        confirmNotification.style.transition = 'all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)';

        // 创建箭头元素
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.width = '8px';
        arrow.style.height = '8px';
        arrow.style.backgroundColor = 'var(--popconfirm-bg, rgba(50, 50, 50, 0.95))';
        arrow.style.transform = 'rotate(45deg)';
        arrow.style.zIndex = '9999';
        confirmNotification.appendChild(arrow);

        // 根据点击事件计算位置
        if (event) {
            // 获取点击位置
            const rect = event.target.getBoundingClientRect();
            const arrowGap = 13; // 箭头到按钮的距离

            // 默认显示在按钮下方
            const buttonCenterX = rect.left + (rect.width / 2);
            confirmNotification.style.left = (buttonCenterX - 28) + 'px';
            confirmNotification.style.top = (rect.bottom + arrowGap) + 'px';

            // 设置箭头位置为弹出框中间，指向上
            arrow.style.left = '28px';
            arrow.style.top = '-4px';
            arrow.style.bottom = 'auto';

            // 检查是否会超出视窗边界并调整位置
            setTimeout(() => {
                const notificationRect = confirmNotification.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // 如果会超出右边界，向左偏移
                if (notificationRect.right > viewportWidth) {
                    const leftOffset = viewportWidth - notificationRect.width - 10;
                    confirmNotification.style.left = leftOffset + 'px';
                    // 调整箭头位置
                    const arrowLeft = buttonCenterX - leftOffset - 4;
                    arrow.style.left = Math.max(8, Math.min(notificationRect.width - 8, arrowLeft)) + 'px';
                }

                // 如果会超出左边界，向右偏移
                if (notificationRect.left < 10) {
                    confirmNotification.style.left = '10px';
                    // 调整箭头位置
                    const arrowLeft = buttonCenterX - 10 - 4;
                    arrow.style.left = Math.max(8, Math.min(notificationRect.width - 8, arrowLeft)) + 'px';
                }

                // 如果会超出下边界，显示在按钮上方
                if (notificationRect.bottom > viewportHeight - 10) {
                    confirmNotification.style.top = (rect.top - arrowGap - notificationRect.height) + 'px';
                    arrow.style.top = 'auto';
                    arrow.style.bottom = '-4px';
                }
            }, 0);
        } else {
            // 默认显示在中央
            confirmNotification.style.top = '50%';
            confirmNotification.style.left = '50%';
            confirmNotification.style.transform = 'translate(-50%, -50%)';
            arrow.style.display = 'none';
        }

        // 创建消息文本
        const messageText = document.createElement('div');
        messageText.textContent = message;
        messageText.style.marginBottom = '12px';
        messageText.style.color = 'var(--popconfirm-text, #fff)';
        confirmNotification.appendChild(messageText);

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '8px';
        confirmNotification.appendChild(buttonContainer);

        // 创建取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.style.padding = '4px 12px';
        cancelButton.style.border = '1px solid var(--popconfirm-btn-border, rgba(255,255,255,0.2))';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.backgroundColor = 'transparent';
        cancelButton.style.color = 'var(--popconfirm-text, #fff)';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontSize = '12px';
        cancelButton.style.transition = 'all 0.2s';

        // 添加悬停效果
        cancelButton.addEventListener('mouseover', function() {
            cancelButton.style.backgroundColor = 'var(--popconfirm-btn-hover-bg, rgba(255,255,255,0.1))';
        });
        cancelButton.addEventListener('mouseout', function() {
            cancelButton.style.backgroundColor = 'transparent';
        });

        cancelButton.addEventListener('click', function() {
            DialogUtils.closeConfirm(confirmNotification);
            if (onCancel) onCancel();
        });
        buttonContainer.appendChild(cancelButton);

        // 确认按钮
        const confirmButton = document.createElement('button');
        confirmButton.textContent = '确认';
        confirmButton.style.padding = '4px 12px';
        confirmButton.style.border = 'none';
        confirmButton.style.borderRadius = '4px';
        confirmButton.style.backgroundColor = isError ? 'var(--popconfirm-primary-btn-bg, #e74c3c)' : 'var(--popconfirm-primary-btn-bg, rgb(67, 166, 70))';
        confirmButton.style.color = '#fff';
        confirmButton.style.cursor = 'pointer';
        confirmButton.style.fontSize = '12px';
        confirmButton.style.transition = 'all 0.2s';

        // 添加悬停效果
        confirmButton.addEventListener('mouseover', function() {
            confirmButton.style.backgroundColor = isError ? 'var(--popconfirm-primary-btn-hover-bg, #d44637)' : 'var(--popconfirm-primary-btn-hover-bg, rgb(57, 149, 63))';
        });
        confirmButton.addEventListener('mouseout', function() {
            confirmButton.style.backgroundColor = isError ? 'var(--popconfirm-primary-btn-bg, #e74c3c)' : 'var(--popconfirm-primary-btn-bg, rgb(67, 166, 70))';
        });

        confirmButton.addEventListener('click', function() {
            DialogUtils.closeConfirm(confirmNotification);
            if (onConfirm) onConfirm();
        });
        buttonContainer.appendChild(confirmButton);

        document.body.appendChild(confirmNotification);

        // 触发重排后显示元素
        setTimeout(function() {
            confirmNotification.style.opacity = '1';
            confirmNotification.style.transform = event ? 'translateY(0)' : 'translate(-50%, -50%)';
        }, 10);

        // 10秒后自动淡出并移除确认框（如果用户没有操作）
        const autoCloseTimeout = setTimeout(function() {
            DialogUtils.closeConfirm(confirmNotification);
            if (onCancel) onCancel();
        }, 10000);

        // 如果用户点击了按钮，清除自动关闭的定时器
        confirmButton.addEventListener('click', function() {
            clearTimeout(autoCloseTimeout);
        });
        cancelButton.addEventListener('click', function() {
            clearTimeout(autoCloseTimeout);
        });

        // 点击其他区域关闭确认框
        const clickOutsideHandler = function(e) {
            if (!confirmNotification.contains(e.target) && e.target !== event?.target) {
                document.removeEventListener('click', clickOutsideHandler);
                DialogUtils.closeConfirm(confirmNotification);
                if (onCancel) onCancel();
            }
        };

        // 延迟添加点击事件，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', clickOutsideHandler);
        }, 100);

        return confirmNotification;
    }

    /**
     * 关闭确认框
     * @param {HTMLElement} confirmNotification - 确认框元素
     */
    static closeConfirm(confirmNotification) {
        confirmNotification.style.opacity = '0';
        confirmNotification.style.transform = 'translateY(4px)';
        setTimeout(function() {
            if (document.body.contains(confirmNotification)) {
                document.body.removeChild(confirmNotification);
            }
        }, 300);
    }
}

export { DialogUtils };
