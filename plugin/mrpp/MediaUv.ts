import * as THREE from 'three';
import {
	UIPanel,
	UIRow,
	UIText,
	UINumber,
	UIButton,
} from '../../three.js/editor/js/libs/ui.js';
import { SetValueCommand } from '../../three.js/editor/js/commands/SetValueCommand.js';
import { ROLES } from '../access/Access.js';

const originals = new WeakMap<THREE.Object3D, any>();

export function applyMediaUv(object: THREE.Object3D, value: unknown): void {
	const mesh = object as THREE.Mesh;
	if (!mesh.geometry?.getAttribute('uv')) return;
	const crop = value as {
		x?: number;
		y?: number;
		width?: number;
		height?: number;
	} | null;
	const values = [
		crop?.x ?? 0,
		crop?.y ?? 0,
		crop?.width ?? 1,
		crop?.height ?? 1,
	];
	if (
		values.some((item) => !Number.isFinite(item)) ||
		values[2] <= 0 ||
		values[3] <= 0
	)
		return;
	if (!originals.has(object)) {
		mesh.geometry = mesh.geometry.clone();
		originals.set(object, mesh.geometry.getAttribute('uv').clone());
	}
	const source = originals.get(object);
	const uv = source.clone();
	for (let index = 0; index < uv.count; index++) {
		uv.setXY(
			index,
			values[0] + source.getX(index) * values[2],
			values[1] + source.getY(index) * values[3],
		);
	}
	mesh.geometry.setAttribute('uv', uv);
}

export function buildMediaUvPanel(
	editor: any,
	container: HTMLElement,
): { update: (object: any) => void } {
	const panel = new UIPanel(),
		inputs: Record<string, any> = {};
	panel.add(new UIText('图片裁剪（归一化坐标）'));
	container.appendChild(panel.dom);
	const update = (object: any) => {
		const picture = String(object?.userData?.type).toLowerCase() === 'picture';
		const canEdit = picture && editor.access.atLeast(ROLES.ADMIN);
		panel.setDisplay(canEdit ? '' : 'none');
		if (!canEdit) return;
		const crop = object.userData?.uvRect ?? { x: 0, y: 0, width: 1, height: 1 };
		for (const [key, input] of Object.entries(inputs))
			input.setValue(crop[key] ?? (key === 'x' || key === 'y' ? 0 : 1));
		applyMediaUv(object, crop);
	};
	for (const [key, label] of Object.entries({
		x: '左边距',
		y: '下边距',
		width: '宽度',
		height: '高度',
	})) {
		const input = new UINumber()
			.setRange(0, 1)
			.setPrecision(5)
			.setWidth('90px');
		inputs[key] = input;
		const row = new UIRow();
		row.add(new UIText(label).setWidth('90px'), input);
		panel.add(row);
		input.onChange(() => {
			const object = editor.selected;
			if (!object || !editor.access.atLeast(ROLES.ADMIN)) return;
			const crop = Object.fromEntries(
				Object.entries(inputs).map(([k, v]) => [k, v.getValue()]),
			);
			if (
				crop.width <= 0 ||
				crop.height <= 0 ||
				crop.x + crop.width > 1.000001 ||
				crop.y + crop.height > 1.000001
			) {
				editor.showNotification('裁剪范围必须位于图片内', true);
				update(object);
				return;
			}
			editor.execute(
				new SetValueCommand(editor, object, 'userData', {
					...object.userData,
					uvRect: crop,
				}),
			);
		});
	}
	panel.add(
		new UIButton('恢复完整图片').onClick(() => {
			const object = editor.selected;
			if (!object || !editor.access.atLeast(ROLES.ADMIN)) return;
			editor.execute(
				new SetValueCommand(editor, object, 'userData', {
					...object.userData,
					uvRect: { x: 0, y: 0, width: 1, height: 1 },
				}),
			);
		}),
	);
	return { update };
}
