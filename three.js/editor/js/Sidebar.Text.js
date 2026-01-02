import { UIPanel, UIRow, UITextArea, UIText, UIInput, UINumber, UIColor, UIButton } from './libs/ui.js';
import { SetValueCommand } from './commands/SetValueCommand.js';
import { createTextMesh } from './utils/TextUtils.js';

function SidebarText(editor) {
	const strings = editor.strings;
	const signals = editor.signals;

	const container = new UIPanel();
	container.setDisplay('none');

	container.add(new UIText(strings.getKey('sidebar/text')).setTextTransform('uppercase'));
	container.add(new UIRow());

	// --- 常量定义 ---
	const PIXEL_SCALE_M = 0.005; 
	const M_TO_PX = 1 / PIXEL_SCALE_M; 

	// --- 状态变量 ---
	let currentAlign = { horizontal: 'center', vertical: 'middle' };

	// --- 核心逻辑 ---

	function getUiData() {
		return {
			text: contentValue.getValue(),
			rect: {
				x: Number(boxWidth.getValue()),
				y: Number(boxHeight.getValue())
			},
			size: Number(fontSizeNumber.getValue()), 
			color: color.getValue(),
			align: { ...currentAlign },
			follow: followCheckbox.checked,
			background: {
				enable: backgroundEnableCheckbox.checked,
				color: backgroundColor.getValue(),
				opacity: Number(backgroundOpacitySlider.value)
			}
		};
	}

	// 预览（不保存）
	function updateVisuals() {
		if (!editor.selected || editor.selected.type !== 'Text') return;
		container.updateTextObject(editor.selected, getUiData());
	}

	// 提交（保存 + 产生历史记录）
	function commitChange(key, value) {
		if (!editor.selected || editor.selected.type !== 'Text') return;

		const object = editor.selected;
		const newUserData = JSON.parse(JSON.stringify(object.userData || {})); 

		if (key === 'rect') {
			newUserData.rect = { x: Number(value.x), y: Number(value.y) };
		} else if (key === 'color') {
			const colorVal = String(value);
			newUserData.color =  colorVal.startsWith('#') ? colorVal : '#' + colorVal;
		} else if (key === 'align') {
			newUserData.align = value; 
		} else if (key === 'background') {
			const bgColorVal = String(value.color);
			newUserData.background = {
				...value,
				color: bgColorVal.startsWith('#') ? bgColorVal : '#' + bgColorVal
			};
		} else {
			newUserData[key] = value;
		}

		// 执行命令会触发 objectChanged 信号，从而自动触发下方的监听器进行 UI 和 3D 更新
		editor.execute(new SetValueCommand(editor, object, 'userData', newUserData));
	}

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
	const fontSizeNumber = new UINumber(24).setWidth('40px').setRange(8, 200).setPrecision(0);
	
	const fontSizeSlider = document.createElement('input');
	Object.assign(fontSizeSlider, { type: 'range', min: '8', max: '200', step: '1', value: '24' });
	fontSizeSlider.style.width = '120px';
	fontSizeSlider.style.verticalAlign = 'middle';

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
		const val = clampInput(fontSizeNumber, 8, 200);
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
	
	color.dom.addEventListener('input', updateVisuals); 
	color.onChange(() => commitChange('color', color.getValue()));

	colorRow.add(new UIText(strings.getKey('sidebar/text/color')).setWidth('90px'));
	colorRow.add(color);
	container.add(colorRow);

	// --- 对齐设置 (Alignment) ---
	const alignRow = new UIRow();
	const verticalRow = new UIRow();

	const icons = {
		left: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21h18v-2H3v2zm0-4h12v-2H3v2zm0-4h18v-2H3v2zm0-4h12V7H3v2zm0-6v2h18V3H3z"/></svg>',
		center: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21h18v-2H3v2zm4-4h10v-2H7v2zm-4-4h18v-2H3v2zm4-4h10V7H7v2zm-4-6v2h18V3H3z"/></svg>',
		right: '<svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zm-6-6v2h18V3H3z"/></svg>',
		top: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="1" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="5" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="9" width="20" height="2" fill="currentColor" rx="1"/></svg>',
		middle: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="11" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="15" width="20" height="2" fill="currentColor" rx="1"/></svg>',
		bottom: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="13" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="17" width="20" height="2" fill="currentColor" rx="1"/><rect x="2" y="21" width="20" height="2" fill="currentColor" rx="1"/></svg>'
	};

	function createAlignGroup(options, axis) {
		const buttons = {};
		options.forEach(opt => {
			const btn = new UIButton();
			btn.dom.innerHTML = icons[opt];
			btn.setWidth('45px');
			btn.onClick(() => {
				currentAlign[axis] = opt;
				updateAlignVisuals(buttons, opt);
				updateVisuals(); 
				commitChange('align', { ...currentAlign }); 
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
	
	verticalRow.add(new UIText('').setWidth('90px')); 
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

	// --- 背景设置 (Background) ---
	const backgroundEnableRow = new UIRow();
	const backgroundEnableCheckbox = document.createElement('input');
	backgroundEnableCheckbox.type = 'checkbox';
	backgroundEnableCheckbox.style.verticalAlign = 'middle';
	backgroundEnableCheckbox.checked = true; 
	
	backgroundEnableCheckbox.addEventListener('change', () => {
		const isEnabled = backgroundEnableCheckbox.checked;
		backgroundColorRow.setDisplay(isEnabled ? '' : 'none');
		backgroundOpacityRow.setDisplay(isEnabled ? '' : 'none');
		
		const bgColor = backgroundColor.getValue();
		commitChange('background', {
			enable: isEnabled,
			color: bgColor, 
			opacity: Number(backgroundOpacitySlider.value)
		});
		updateVisuals();
	});
	
	backgroundEnableRow.add(new UIText(strings.getKey('sidebar/text/background') || 'Background').setWidth('90px'));
	backgroundEnableRow.dom.appendChild(backgroundEnableCheckbox);
	container.add(backgroundEnableRow);
	
	const backgroundColorRow = new UIRow();
	const backgroundColor = new UIColor().setValue('#808080ff').setWidth('90px').setHeight('25px');
	backgroundColor.dom.addEventListener('input', updateVisuals);
	backgroundColor.onChange(() => {
		const bgColor = backgroundColor.getValue();
		commitChange('background', {
			enable: backgroundEnableCheckbox.checked,
			color: bgColor, 
			opacity: Number(backgroundOpacitySlider.value)
		});
	});
	
	backgroundColorRow.add(new UIText(strings.getKey('sidebar/text/background/color')).setWidth('90px'));
	backgroundColorRow.add(backgroundColor);
	backgroundColorRow.setDisplay('');
	container.add(backgroundColorRow);
	
	const backgroundOpacityRow = new UIRow();
	const backgroundOpacitySlider = document.createElement('input');
	Object.assign(backgroundOpacitySlider, {
		type: 'range',
		min: '0',
		max: '1',
		step: '0.01',
		value: '0.5'
	});
	backgroundOpacitySlider.style.width = '120px';
	backgroundOpacitySlider.style.verticalAlign = 'middle';
	
	const backgroundOpacityNumber = new UINumber(0.3).setWidth('50px').setRange(0, 1).setPrecision(2);
	
	backgroundOpacitySlider.addEventListener('input', () => {
		const val = clampInput(backgroundOpacityNumber, 0, 1);
		const sliderVal = parseFloat(backgroundOpacitySlider.value);
		backgroundOpacityNumber.setValue(sliderVal);
		updateVisuals();
	});
	backgroundOpacitySlider.addEventListener('change', () => {
		const bgColor = backgroundColor.getValue();
		const opacityVal = clampInput(backgroundOpacityNumber, 0, 1);
		commitChange('background', {
			enable: backgroundEnableCheckbox.checked,
			color: bgColor,
			opacity: opacityVal
		});
	});
	
	backgroundOpacityNumber.onInput(() => {
		const val = parseFloat(backgroundOpacityNumber.getValue());
		if (!isNaN(val)) {
			backgroundOpacitySlider.value = val;
			updateVisuals();
		}
	});
	backgroundOpacityNumber.onChange(() => {
		const val = clampInput(backgroundOpacityNumber, 0, 1);
		backgroundOpacitySlider.value = val;
		const bgColor = backgroundColor.getValue();
		commitChange('background', {
			enable: backgroundEnableCheckbox.checked,
			color: bgColor,
			opacity: val
		});
	});
	
	backgroundOpacityRow.add(new UIText(strings.getKey('sidebar/text/background/opacity')).setWidth('90px'));
	backgroundOpacityRow.dom.appendChild(backgroundOpacitySlider);
	backgroundOpacityRow.add(new UIText('').setWidth('5px'));
	backgroundOpacityRow.add(backgroundOpacityNumber);
	backgroundOpacityRow.setDisplay(''); 
	container.add(backgroundOpacityRow);


	// ================= 3D 对象更新逻辑 =================
	
	container.updateTextObject = function (textObject, dataOverride) {
		if (!textObject) return;
		try {
			
			const userData = textObject.userData || {};

			const finalData = {
				text: dataOverride?.text ?? userData.text ?? '',
				rect: dataOverride?.rect ?? userData.rect ?? { x: 1.28, y: 0.32 }, 
				size: Number(dataOverride?.size ?? userData.size ?? 24),
				color: dataOverride?.color ?? userData.color ?? '#ffffff', 
				align: dataOverride?.align ?? userData.align ?? { horizontal: 'center', vertical: 'middle' },
				background: dataOverride?.background ?? userData.background ?? { enable: true, color: '#808080', opacity: 0.3 }
			};

			if (!finalData.color.startsWith('#')) finalData.color = '#' + finalData.color;
			if (!finalData.background.color.startsWith('#')) finalData.background.color = '#' + finalData.background.color;

			const paramsForFactory = {
				...finalData,
				rect: {
					x: finalData.rect.x * M_TO_PX,
					y: finalData.rect.y * M_TO_PX
				},
				hAlign: finalData.align.horizontal,
				vAlign: finalData.align.vertical,
				backgroundEnable: finalData.background.enable,
				backgroundColor: finalData.background.color,
				backgroundOpacity: finalData.background.opacity
			};

			const newMesh = createTextMesh(finalData.text, paramsForFactory);
			
			if (!newMesh) return;
			
			if (textObject.geometry) textObject.geometry.dispose();
			textObject.geometry = newMesh.geometry;

			if (textObject.material) {
				if (textObject.material.map) textObject.material.map.dispose();
				textObject.material.dispose();
			}
			textObject.material = newMesh.material;
			
			editor.signals.sceneGraphChanged.dispatch(); 

		} catch (e) {
			console.error('SidebarText.updateTextObject error:', e);
		}
	};
	// ================= 状态同步逻辑 =================
	function updateUIState(object) {
		const data = object.userData || {};

		contentValue.setValue(data.text || '');

		const w = (data.rect && data.rect.x !== undefined) ? data.rect.x : 1.28;
		const h = (data.rect && data.rect.y !== undefined) ? data.rect.y : 0.32;
		boxWidth.setValue(w);
		boxHeight.setValue(h);

		const size = data.size || 24;
		fontSizeNumber.setValue(size);
		fontSizeSlider.value = size;

		let hex = data.color || '#ffffff';
		if (!hex.startsWith('#')) hex = '#' + hex;
		color.setValue(hex);

		currentAlign = data.align || { horizontal: 'center', vertical: 'middle' };
		updateAlignVisuals(hButtons, currentAlign.horizontal);
		updateAlignVisuals(vButtons, currentAlign.vertical);

		followCheckbox.checked = !!data.follow;

		const bg = data.background || { enable: true, color: '#808080', opacity: 0.3 };
		backgroundEnableCheckbox.checked = !!bg.enable;
		let bgColor = bg.color || '#808080';
		if (!bgColor.startsWith('#')) bgColor = '#' + bgColor;
		backgroundColor.setValue(bgColor);
		const bgOpacity = bg.opacity !== undefined ? bg.opacity : 0.3;
		backgroundOpacitySlider.value = bgOpacity;
		backgroundOpacityNumber.setValue(bgOpacity);
		
		const isBgEnabled = !!bg.enable;
		backgroundColorRow.setDisplay(isBgEnabled ? '' : 'none');
		backgroundOpacityRow.setDisplay(isBgEnabled ? '' : 'none');
	}

	// ================= 事件监听 =================

	signals.objectSelected.add(function (object) {
		if (object !== null && object.type === 'Text') {
			container.setDisplay('');
			updateUIState(object);
		} else {
			container.setDisplay('none');
		}
	});

	// 监听 objectChanged，处理撤销/重做或外部命令
	signals.objectChanged.add(function (object) {
		if (object !== editor.selected) return;
		if (object.type === 'Text') {
			// 1. 同步 UI（解决撤销 UI 不变）
			updateUIState(object);
			// 2. 强制重建 3D 网格（解决撤销 3D 视图不变）
			// 此时不传参数，让其使用 userData 中的旧数据重建
			container.updateTextObject(object);
		}
	});

	return container;
}

export { SidebarText };