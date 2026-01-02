import * as THREE from 'three';

// 辅助：绘制圆角矩形
function roundRect(ctx, x, y, width, height, radius) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

/**
 * 创建文本 Mesh
 * @param {String} text - 文本内容
 * @param {Object} params - 样式参数
 * @returns {THREE.Mesh}
 */
export function createTextMesh(text, params = {}) {
	// 1. 基础参数 (逻辑像素)
	const baseWidth = Math.max(1, params.rect?.x || 256);
	const baseHeight = Math.max(1, params.rect?.y || 64);
	const baseFontSize = params.size || 24;

	const color = params.color || '#ffffff';
	const hAlign = params.hAlign || 'center';
	const vAlign = params.vAlign || 'middle';
	const backgroundEnable = params.backgroundEnable !== undefined ? params.backgroundEnable : true;
	const backgroundColor = params.backgroundColor || '#808080';
	const backgroundOpacity = params.backgroundOpacity !== undefined ? params.backgroundOpacity : 0.3;

	const PIXEL_SCALE = 0.005; // 物理单位转换

	// 2. 高清渲染倍率
	const SCALE_FACTOR = 4;

	// 3. Canvas 尺寸
	const canvasWidth = Math.round(baseWidth * SCALE_FACTOR);
	const canvasHeight = Math.round(baseHeight * SCALE_FACTOR);
	const scaledFontSize = baseFontSize * SCALE_FACTOR;
	const padding = 4 * SCALE_FACTOR;

	const canvas = document.createElement('canvas');
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	const ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvasWidth, canvasHeight);

	// 背景绘制
	if (backgroundEnable) {
		const cornerRadius = 8 * SCALE_FACTOR;
		const bgColor = backgroundColor.startsWith('#') ? backgroundColor.substring(1) : backgroundColor;
		const r = parseInt(bgColor.substring(0, 2), 16);
		const g = parseInt(bgColor.substring(2, 4), 16);
		const b = parseInt(bgColor.substring(4, 6), 16);
		ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${backgroundOpacity})`;
		roundRect(ctx, 0, 0, canvasWidth, canvasHeight, cornerRadius);
		ctx.fill();
	}

	// 字体设置
	ctx.font = `${scaledFontSize}px 'Arial Unicode MS', Arial, sans-serif`;
	ctx.fillStyle = color;
	ctx.textBaseline = 'middle';

	// 水平对齐计算
	let x = 0;
	if (hAlign === 'left') {
		ctx.textAlign = 'left';
		x = padding;
	} else if (hAlign === 'right') {
		ctx.textAlign = 'right';
		x = canvasWidth - padding;
	} else {
		ctx.textAlign = 'center';
		// x 坐标在下方绘制时计算
	}

	// 换行逻辑
	const textStr = String(text || '');
	const paragraphs = textStr.split('\n');
	const lines = [];

	if (textStr) {
		paragraphs.forEach(paragraph => {
			if (paragraph.length === 0) {
				lines.push('');
				return;
			}
			let currentLine = '';
			for (let i = 0; i < paragraph.length; i++) {
				const char = paragraph[i];
				const testLine = currentLine + char;
				const metrics = ctx.measureText(testLine);
				const maxLineWidth = canvasWidth - (padding * 2);

				if (metrics.width > maxLineWidth && i > 0) {
					const lastSpaceIndex = currentLine.lastIndexOf(' ');
					if (lastSpaceIndex > -1 && lastSpaceIndex < currentLine.length - 1) {
						lines.push(currentLine.substring(0, lastSpaceIndex));
						currentLine = currentLine.substring(lastSpaceIndex + 1) + char;
					} else {
						lines.push(currentLine);
						currentLine = char;
					}
				} else {
					currentLine = testLine;
				}
			}
			lines.push(currentLine);
		});
	}

	// 垂直对齐与绘制
	const lineHeight = scaledFontSize * 1.2;
	const totalTextHeight = lines.length * lineHeight;
	const halfLine = lineHeight / 2;
	let startY = 0;

	if (vAlign === 'top') startY = padding + halfLine;
	else if (vAlign === 'bottom') startY = canvasHeight - totalTextHeight + halfLine - padding;
	else startY = (canvasHeight - totalTextHeight) / 2 + halfLine;

	if (totalTextHeight > canvasHeight && vAlign !== 'bottom') startY = padding + halfLine;

	const contentLeft = padding;
	const contentRight = canvasWidth - padding;
	const contentTop = padding;
	const contentBottom = canvasHeight - padding;

	lines.forEach((line, index) => {
		const y = startY + (index * lineHeight);
		const lineMetrics = ctx.measureText(line);
		const lineWidth = lineMetrics.width;

		let lineXStart;
		if (hAlign === 'left') lineXStart = contentLeft;
		else if (hAlign === 'right') lineXStart = contentRight - lineWidth;
		else lineXStart = (canvasWidth - lineWidth) / 2;

		ctx.textAlign = 'left';
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			const substr = line.substring(0, i);
			const offset = ctx.measureText(substr).width;
			const chWidth = ctx.measureText(ch).width;
			const chLeft = lineXStart + offset;
			const chRight = chLeft + chWidth;

			const chMetrics = ctx.measureText(ch);
			const ascent = chMetrics.actualBoundingBoxAscent || (scaledFontSize * 0.8);
			const descent = chMetrics.actualBoundingBoxDescent || (scaledFontSize * 0.2);
			const chTop = y - ascent;
			const chBottom = y + descent;
			const EPS = 0.5;

			if (chLeft + EPS >= contentLeft && chRight - EPS <= contentRight && chTop + EPS >= contentTop && chBottom - EPS <= contentBottom) {
				ctx.fillText(ch, chLeft, y);
			}
		}
	});

	// 生成 Mesh
	const texture = new THREE.CanvasTexture(canvas);
	texture.encoding = THREE.sRGBEncoding;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.generateMipmaps = true;
	texture.anisotropy = 4;
	texture.needsUpdate = true;

	const geometry = new THREE.PlaneGeometry(baseWidth * PIXEL_SCALE, baseHeight * PIXEL_SCALE);
	const material = new THREE.MeshBasicMaterial({
		map: texture,
		transparent: true,
		side: THREE.DoubleSide,
		alphaTest: 0.01
	});

	const mesh = new THREE.Mesh(geometry, material);
	mesh.type = 'Text';
	return mesh;
}
