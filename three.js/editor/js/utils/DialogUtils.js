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
         // 获取多语言字符串
        const editor = window.editor;
        const strings = editor ? editor.strings : null;

        // 使用多语言配置，如果没有则使用默认值
        const confirmText = strings ? strings.getKey('dialog/confirm/confirm') : '确认';
        const cancelText = strings ? strings.getKey('dialog/confirm/cancel') : '取消';
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
        cancelButton.textContent = cancelText;//'取消';
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
        confirmButton.textContent = confirmText;//'确认';
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
     * 实体未保存时的统一确认弹窗
     * - 点击「是」: 保存并继续
     * - 点击「否」: 不保存直接继续
     * - 点击右上角关闭: 关闭弹窗，不进行任何操作
     */
    static showSceneSaveDialog(message, onYes, onNo, onClose) {
        const existing = document.querySelector('.scene-save-dialog-overlay');
        if (existing) {
            existing.remove();
        }

        const setImportantStyle = function (element, property, value) {
            element.style.setProperty(property, value, 'important');
        };

        const bindHoverStyles = function (element, normalStyles, hoverStyles) {
            if (!element) return;

            const applyStyles = function (styles) {
                Object.entries(styles).forEach(function ([property, value]) {
                    setImportantStyle(element, property, value);
                });
            };

            applyStyles(normalStyles);

            element.addEventListener('mouseenter', function () {
                applyStyles(hoverStyles);
            });

            element.addEventListener('mouseleave', function () {
                applyStyles(normalStyles);
            });
        };

        const overlay = document.createElement('div');
        overlay.className = 'scene-save-dialog-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'var(--scene-save-overlay-bg, rgba(15, 23, 42, 0.22))';
        overlay.style.backdropFilter = 'blur(var(--scene-save-overlay-blur, 2px))';
        overlay.style.zIndex = 'var(--scene-save-z-index, 12000)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'var(--scene-save-overlay-transition, opacity 180ms ease)';

        const dialog = document.createElement('div');
        dialog.style.position = 'relative';
        dialog.style.width = 'var(--scene-save-dialog-width, 280px)';
        dialog.style.maxWidth = 'var(--scene-save-dialog-max-width, 90vw)';
        dialog.style.minHeight = 'var(--scene-save-dialog-min-height, 106px)';
        dialog.style.padding = 'var(--scene-save-dialog-padding, 14px 14px 12px)';
        dialog.style.borderRadius = 'var(--scene-save-dialog-radius, 10px)';
        dialog.style.border = 'var(--scene-save-dialog-border, 1px solid var(--ar-border, #e2e8f0))';
        dialog.style.background = 'var(--scene-save-dialog-bg, var(--ar-bg-card, #ffffff))';
        dialog.style.color = 'var(--scene-save-dialog-text, var(--ar-text-primary, #1e293b))';
        dialog.style.boxShadow = 'var(--scene-save-dialog-shadow, 0 8px 24px rgba(15, 23, 42, 0.18))';
        dialog.style.transform = 'translateY(var(--scene-save-dialog-offset-y, 6px)) scale(var(--scene-save-dialog-scale-out, 0.98))';
        dialog.style.transition = 'var(--scene-save-dialog-transition, transform 180ms ease)';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.style.position = 'absolute';
        closeButton.style.top = 'var(--scene-save-close-top, 5px)';
        closeButton.style.right = 'var(--scene-save-close-right, 5px)';
        closeButton.style.width = 'var(--scene-save-close-size, 28px)';
        closeButton.style.height = 'var(--scene-save-close-size, 28px)';
        closeButton.style.borderRadius = 'var(--scene-save-close-radius, 50%)';
        closeButton.style.border = 'var(--scene-save-close-border, 1px solid var(--ar-border, #e2e8f0))';
        closeButton.style.background = 'var(--scene-save-close-bg, var(--ar-bg-card, #ffffff))';
        closeButton.style.color = 'var(--scene-save-close-color, var(--ar-text-secondary, #64748b))';
        closeButton.style.fontSize = 'var(--scene-save-close-font-size, 17px)';
        closeButton.style.lineHeight = 'var(--scene-save-close-line-height, 1)';
        closeButton.style.padding = '0';
        closeButton.style.display = 'flex';
        closeButton.style.alignItems = 'center';
        closeButton.style.justifyContent = 'center';
        closeButton.style.cursor = 'pointer';
        setImportantStyle(closeButton, 'border', 'var(--scene-save-close-border, none)');
        setImportantStyle(closeButton, 'background', 'var(--scene-save-close-bg, transparent)');
        setImportantStyle(closeButton, 'color', 'var(--scene-save-close-color, #94a3b8)');
        setImportantStyle(closeButton, 'padding', '0');
        setImportantStyle(closeButton, 'border-radius', 'var(--scene-save-close-radius, 0)');
        setImportantStyle(closeButton, 'transition', 'all 0.15s ease');
        bindHoverStyles(
            closeButton,
            {
                background: 'var(--scene-save-close-bg, transparent)',
                color: 'var(--scene-save-close-color, #94a3b8)'
            },
            {
                background: 'var(--scene-save-close-hover-bg, rgba(148, 163, 184, 0.12))',
                color: 'var(--scene-save-close-hover-color, #64748b)'
            }
        );
        dialog.appendChild(closeButton);

        const messageText = document.createElement('div');
        messageText.textContent = message;
        messageText.style.textAlign = 'center';
        messageText.style.fontSize = 'var(--scene-save-title-size, 18px)';
        messageText.style.fontWeight = 'var(--scene-save-title-weight, 600)';
        messageText.style.margin = 'var(--scene-save-title-margin, 12px 10px 22px)';
        messageText.style.lineHeight = 'var(--scene-save-title-line-height, 1.4)';
        dialog.appendChild(messageText);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.gap = 'var(--scene-save-actions-gap, 18px)';
        buttonContainer.style.marginTop = 'var(--scene-save-actions-margin-top, 10px)';

        const noButton = document.createElement('button');
        noButton.type = 'button';
        noButton.textContent = '否';
        noButton.style.minWidth = 'var(--scene-save-action-min-width, 90px)';
        noButton.style.height = 'var(--scene-save-action-height, 40px)';
        noButton.style.padding = 'var(--scene-save-action-padding, 0 20px)';
        noButton.style.borderRadius = 'var(--scene-save-action-radius, 7px)';
        noButton.style.border = 'var(--scene-save-no-border, 1px solid var(--ar-border-strong, #cbd5e1))';
        noButton.style.background = 'var(--scene-save-no-bg, var(--ar-bg-card, #ffffff))';
        noButton.style.color = 'var(--scene-save-no-color, #475569)';
        noButton.style.fontSize = 'var(--scene-save-action-font-size, 15px)';
        noButton.style.fontWeight = 'var(--scene-save-action-font-weight, 600)';
        noButton.style.cursor = 'pointer';
        setImportantStyle(noButton, 'border', 'var(--scene-save-no-border, 1px solid #dbe4ef)');
        setImportantStyle(noButton, 'background', 'var(--scene-save-no-bg, #ffffff)');
        setImportantStyle(noButton, 'color', 'var(--scene-save-no-color, #606266)');
        setImportantStyle(noButton, 'border-radius', 'var(--scene-save-action-radius, 12px)');
        setImportantStyle(noButton, 'transition', 'all 0.15s ease');
        bindHoverStyles(
            noButton,
            {
                border: 'var(--scene-save-no-border, 1px solid #dbe4ef)',
                background: 'var(--scene-save-no-bg, #ffffff)',
                color: 'var(--scene-save-no-color, #606266)'
            },
            {
                border: '1px solid var(--scene-save-no-hover-border, #cfd8e3)',
                background: 'var(--scene-save-no-hover-bg, #f8fafc)',
                color: 'var(--scene-save-no-hover-color, #475569)'
            }
        );

        const yesButton = document.createElement('button');
        yesButton.type = 'button';
        yesButton.textContent = '是';
        yesButton.style.minWidth = 'var(--scene-save-action-min-width, 90px)';
        yesButton.style.height = 'var(--scene-save-action-height, 40px)';
        yesButton.style.padding = 'var(--scene-save-action-padding, 0 20px)';
        yesButton.style.borderRadius = 'var(--scene-save-action-radius, 7px)';
        yesButton.style.border = 'var(--scene-save-yes-border, none)';
        yesButton.style.background = 'var(--scene-save-yes-bg, var(--ar-primary, #00baff))';
        yesButton.style.color = 'var(--scene-save-yes-color, #ffffff)';
        yesButton.style.fontSize = 'var(--scene-save-action-font-size, 15px)';
        yesButton.style.fontWeight = 'var(--scene-save-action-font-weight, 600)';
        yesButton.style.cursor = 'pointer';
        setImportantStyle(yesButton, 'border', 'var(--scene-save-yes-border, none)');
        setImportantStyle(yesButton, 'background', 'var(--scene-save-yes-bg, #00baff)');
        setImportantStyle(yesButton, 'color', 'var(--scene-save-yes-color, #ffffff)');
        setImportantStyle(yesButton, 'border-radius', 'var(--scene-save-action-radius, 12px)');
        setImportantStyle(yesButton, 'transition', 'all 0.15s ease');
        bindHoverStyles(
            yesButton,
            {
                border: 'var(--scene-save-yes-border, none)',
                background: 'var(--scene-save-yes-bg, #00baff)',
                color: 'var(--scene-save-yes-color, #ffffff)'
            },
            {
                border: 'var(--scene-save-yes-border, none)',
                background: 'var(--scene-save-yes-hover-bg, var(--ar-primary-hover, #0099dd))',
                color: 'var(--scene-save-yes-color, #ffffff)'
            }
        );

        buttonContainer.appendChild(noButton);
        buttonContainer.appendChild(yesButton);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const closeDialog = () => {
            overlay.style.opacity = '0';
            dialog.style.transform = 'translateY(var(--scene-save-dialog-offset-y, 6px)) scale(var(--scene-save-dialog-scale-out, 0.98))';
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 180);
        };

        const runAndClose = async (cb) => {
            try {
                if (cb) await cb();
            } finally {
                closeDialog();
            }
        };

        yesButton.addEventListener('click', () => runAndClose(onYes));
        noButton.addEventListener('click', () => runAndClose(onNo));
        closeButton.addEventListener('click', () => runAndClose(onClose));

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            dialog.style.transform = 'translateY(0) scale(1)';
        });

        return overlay;
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
