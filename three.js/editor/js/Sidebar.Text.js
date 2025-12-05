import { UIPanel, UIRow, UITextArea, UIText, UIInput, UINumber, UIColor, UIButton } from './libs/ui.js';
import { SetValueCommand } from './commands/SetValueCommand.js';
import { MetaFactory } from './mrpp/MetaFactory.js';

function SidebarText(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setDisplay('none');

	container.add(new UIText(strings.getKey('sidebar/text')).setTextTransform('uppercase'));
	container.add(new UIRow());

	// --- 常量定义 ---
	// 核心约定：UI 和 userData 存储米(m)，生成 Canvas 贴图时转为像素(px)
	// 比例：1px = 5mm (0.005m) => 200px = 1m
	const PIXEL_SCALE_M = 0.005; 
	const M_TO_PX = 1 / PIXEL_SCALE_M; 

	// --- 状态变量 ---
	let currentAlign = { horizontal: 'center', vertical: 'middle' };

	// --- 核心逻辑：数据更新与提交 ---

	// 1. 获取当前 UI 的完整数据对象 (单位: 米)
	function getUiData() {
		return {
			text: contentValue.getValue(),
			rect: {
				x: Number(boxWidth.getValue()),
				y: Number(boxHeight.getValue())
			},
			size: Number(fontSizeNumber.getValue()), // 字号通常不随单位缩放，直接用数值
			color: color.getValue(),
			align: { ...currentAlign },
			follow: followCheckbox.checked
		};
	}

	// 2. 实时预览 (视觉更新，不产生 Undo 记录)
	function updateVisuals() {
		if (!editor.selected || editor.selected.type !== 'Text') return;
		// 传递给 Factory 进行 3D 对象更新
		container.updateTextObject(editor.selected, getUiData());
	}

	// 3. 提交修改 (产生 Command，用于 Undo/Redo)
	function commitChange(key, value) {
		if (!editor.selected || editor.selected.type !== 'Text') return;

		const object = editor.selected;
		const newUserData = JSON.parse(JSON.stringify(object.userData || {})); // 深拷贝防止引用问题

		// 特殊字段处理
		if (key === 'rect') {
			// value 格式期望为 {x, y} (米)
			newUserData.rect = { x: Number(value.x), y: Number(value.y) };
		} else if (key === 'color') {
			newUserData.color = typeof value === 'string' && value.startsWith('#') ? value.substring(1) : value;
		} else if (key === 'align') {
			newUserData.align = value; // value 期望为 { horizontal, vertical }
		} else {
			newUserData[key] = value;
		}

		// 执行命令
		editor.execute(new SetValueCommand(editor, object, 'userData', newUserData));
		
		// 同时也需要刷新视图（确保 Command 执行后的状态正确渲染）
		// 注意：Command 执行后，object.userData 已经更新，updateTextObject 会合并 userData 和传入的 override
		// 这里我们传入处理过的 displayData 确保颜色带 # 号
		const displayData = { ...newUserData };
		if (displayData.color && !displayData.color.startsWith('#')) {
			displayData.color = '#' + displayData.color;
		}
		container.updateTextObject(object, displayData);
	}

	// 4. 输入越限检查辅助函数
	function clampInput(inputUI, min, max) {
		let val = parseFloat(inputUI.getValue());
		if (isNaN(val)) val = min;
		val = Math.max(min, Math.min(max, val));
		inputUI.setValue(val);
		return val;
	}

	// ================= UI 构建 =================

	// --- 尺寸设置 (Rect) ---
	const boxRow = new UIRow();
	const boxWidth = new UINumber(1.28).setWidth('40px').setRange(0.05, 40.96).setPrecision(3);
	const boxHeight = new UINumber(0.32).setWidth('40px').setRange(0.05, 40.96).setPrecision(3);

	// 绑定尺寸事件
	[boxWidth, boxHeight].forEach(input => {
		input.onInput(updateVisuals);
		input.onChange(() => {
			const w = clampInput(boxWidth, 0.05, 40.96);
			const h = clampInput(boxHeight, 0.05, 40.96);
			commitChange('rect', { x: w, y: h });
		});
	});

	boxRow.add(new UIText(strings.getKey('sidebar/text/rect')).setWidth('90px'));
	boxRow.add(new UIText('X').setWidth('15px'));
	boxRow.add(boxWidth);
	boxRow.add(new UIText('m').setWidth('25px'));
	boxRow.add(new UIText('Y').setWidth('15px'));
	boxRow.add(boxHeight);
	boxRow.add(new UIText('m').setWidth('25px'));
	container.add(boxRow);

	// --- 字号设置 (Font Size) ---
	const fontSizeRow = new UIRow();
	const fontSizeNumber = new UINumber(24).setWidth('40px').setRange(5, 40).setPrecision(0);
	
	// 原生 Range Input
	const fontSizeSlider = document.createElement('input');
	Object.assign(fontSizeSlider, { type: 'range', min: '5', max: '40', step: '1', value: '24' });
	fontSizeSlider.style.width = '120px';
	fontSizeSlider.style.verticalAlign = 'middle';

	// 联动逻辑
	fontSizeSlider.addEventListener('input', () => {
		fontSizeNumber.setValue(fontSizeSlider.value);
		updateVisuals();
	});
	fontSizeSlider.addEventListener('change', () => {
		commitChange('size', parseInt(fontSizeSlider.value));
	});
	fontSizeNumber.onInput(() => {
		fontSizeSlider.value = fontSizeNumber.getValue();
		updateVisuals();
	});
	fontSizeNumber.onChange(() => {
		const val = clampInput(fontSizeNumber, 5, 40);
		fontSizeSlider.value = val;
		commitChange('size', val);
	});

	fontSizeRow.add(new UIText(strings.getKey('sidebar/text/fontSize')).setWidth('90px'));
	fontSizeRow.dom.appendChild(fontSizeSlider);
	fontSizeRow.add(new UIText('').setWidth('5px'));
	fontSizeRow.add(fontSizeNumber);
	container.add(fontSizeRow);

	// --- 颜色设置 (Color) ---
	const colorRow = new UIRow();
	const color = new UIColor().setValue('#ffffff').setWidth('90px').setHeight('25px');
	
	color.dom.addEventListener('input', updateVisuals); // 颜色选择器拖动时实时预览
	color.onChange(() => commitChange('color', color.getValue()));

	colorRow.add(new UIText(strings.getKey('sidebar/text/color')).setWidth('90px'));
	colorRow.add(color);
	container.add(colorRow);

	// --- 对齐设置 (Alignment) - 封装逻辑 ---
	const alignRow = new UIRow();
	const verticalRow = new UIRow();

	// SVG 图标
	const icons = {
		left: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21h18v-2H3v2zm0-4h12v-2H3v2zm0-4h18v-2H3v2zm0-4h12V7H3v2zm0-6v2h18V3H3z"/></svg>',
		center: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21h18v-2H3v2zm4-4h10v-2H7v2zm-4-4h18v-2H3v2zm4-4h10V7H7v2zm-4-6v2h18V3H3z"/></svg>',
		right: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zm-6-6v2h18V3H3z"/></svg>',
		top: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="1" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="5" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="9" width="20" height="2" fill="currentColor" rx="1"/></svg>',
		middle: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="11" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="15" width="20" height="2" fill="currentColor" rx="1"/></svg>',
		bottom: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="13" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="17" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="21" width="20" height="2" fill="currentColor" rx="1"/></svg>'
	};

	// 创建对齐按钮组辅助函数
	function createAlignGroup(options, axis) {
		const buttons = {};
		options.forEach(opt => {
			const btn = new UIButton();
			btn.dom.innerHTML = icons[opt];
			btn.setWidth('45px');
			btn.onClick(() => {
				currentAlign[axis] = opt;
				updateAlignVisuals(buttons, opt);
				updateVisuals(); // 预览
				commitChange('align', { ...currentAlign }); // 提交
			});
			buttons[opt] = btn;
		});
		return buttons;
	}

	function updateAlignVisuals(btnMap, activeKey) {
		Object.keys(btnMap).forEach(key => {
			const style = btnMap[key].dom.style;
			if (key === activeKey) {
				style.backgroundColor = '#0075ff';
				style.color = '#ffffff';
				style.border = '1px solid #0075ff';
			} else {
				style.backgroundColor = '';
				style.color = '#888';
				style.border = '1px solid transparent';
			}
		});
	}

	const hButtons = createAlignGroup(['left', 'center', 'right'], 'horizontal');
	const vButtons = createAlignGroup(['top', 'middle', 'bottom'], 'vertical');

	alignRow.add(new UIText(strings.getKey('sidebar/text/alignment')).setWidth('90px'));
	alignRow.add(hButtons.left, hButtons.center, hButtons.right);
	
	verticalRow.add(new UIText('').setWidth('90px')); // 占位，对齐上一行
	verticalRow.add(vButtons.top, vButtons.middle, vButtons.bottom);

	container.add(alignRow);
	container.add(verticalRow);

	// --- 文本内容 (Content) ---
	const contentRow = new UIRow();
	const contentValue = new UITextArea().setWidth('150px').setHeight('60px').setFontSize('12px');
	
	contentValue.dom.addEventListener('input', updateVisuals);
	contentValue.onChange(() => commitChange('text', contentValue.getValue()));

	contentRow.add(new UIText(strings.getKey('sidebar/text/content')).setWidth('90px'));
	contentRow.add(contentValue);
	container.add(contentRow);

	// --- 朝向用户 (Follow) ---
	const followRow = new UIRow();
	const followCheckbox = document.createElement('input');
	followCheckbox.type = 'checkbox';
	followCheckbox.style.verticalAlign = 'middle';
	
	followCheckbox.addEventListener('change', () => {
		commitChange('follow', !!followCheckbox.checked);
		updateVisuals();
	});

	followRow.add(new UIText(strings.getKey('sidebar/text/follow')).setWidth('90px'));
	followRow.dom.appendChild(followCheckbox);
	container.add(followRow);


	// ================= 3D 对象更新逻辑 =================
	
	container.updateTextObject = function (textObject, dataOverride) {
		if (!textObject) return;
		try {
			const factory = new MetaFactory(editor);
			const userData = textObject.userData || {};

			// 数据合并优先级：Override (预览数据) > UserData (存储数据) > 默认值
			const finalData = {
				text: dataOverride?.text ?? userData.text ?? '',
				rect: dataOverride?.rect ?? userData.rect ?? { x: 1.28, y: 0.32 }, // 这里是米(m)
				size: Number(dataOverride?.size ?? userData.size ?? 24),
				color: dataOverride?.color ?? userData.color ?? 'ffffff',
				align: dataOverride?.align ?? userData.align ?? { horizontal: 'center', vertical: 'middle' }
			};

			// 处理颜色格式
			if (!finalData.color.startsWith('#')) finalData.color = '#' + finalData.color;

			// *** 关键转换 ***：Factory 需要像素单位的 rect 来绘制 Canvas
			// 1.28m * (1/0.005) = 256px
			const paramsForFactory = {
				...finalData,
				rect: {
					x: finalData.rect.x * M_TO_PX,
					y: finalData.rect.y * M_TO_PX
				},
				// 将对齐平铺开，因为 createTextMesh 内部使用 hAlign/vAlign
				hAlign: finalData.align.horizontal,
				vAlign: finalData.align.vertical
			};

			// 调用 Factory 生成新 Mesh
			Promise.resolve(factory.createTextMesh(finalData.text, paramsForFactory)).then((newMesh) => {
				if (!newMesh) return;
				
				// 替换 Geometry 和 Material
				if (textObject.geometry) textObject.geometry.dispose();
				textObject.geometry = newMesh.geometry;

				if (textObject.material) {
					if (textObject.material.map) textObject.material.map.dispose();
					textObject.material.dispose();
				}
				textObject.material = newMesh.material;
				
				// 触发渲染更新
				editor.signals.objectChanged.dispatch(textObject);
				editor.signals.sceneGraphChanged.dispatch(); 
			});

		} catch (e) {
			console.error('SidebarText.updateTextObject error:', e);
		}
	};

	// ================= 选中对象事件监听 =================

	signals.objectSelected.add(function (object) {
		if (object !== null && object.type === 'Text') {
			container.setDisplay('');
			const data = object.userData || {};

			// 1. 恢复文本
			contentValue.setValue(data.text || '');

			// 2. 恢复尺寸 (存储的是米，直接显示)
			const w = (data.rect && data.rect.x !== undefined) ? data.rect.x : 1.28;
			const h = (data.rect && data.rect.y !== undefined) ? data.rect.y : 0.32;
			boxWidth.setValue(w);
			boxHeight.setValue(h);

			// 3. 恢复字号
			const size = data.size || 24;
			fontSizeNumber.setValue(size);
			fontSizeSlider.value = size;

			// 4. 恢复颜色
			let hex = data.color || 'ffffff';
			if (!hex.startsWith('#')) hex = '#' + hex;
			color.setValue(hex);

			// 5. 恢复对齐
			currentAlign = data.align || { horizontal: 'center', vertical: 'middle' };
			updateAlignVisuals(hButtons, currentAlign.horizontal);
			updateAlignVisuals(vButtons, currentAlign.vertical);

			// 6. 恢复 Follow
			followCheckbox.checked = !!data.follow;

		} else {
			container.setDisplay('none');
		}
	});

	return container;
}

export { SidebarText };