import * as THREE from 'three';

import { UIPanel, UIRow, UIColor, UISelect, UIText } from './libs/ui.js';
import { UITexture } from './libs/ui.three.js';

function SidebarBackground(editor) {

	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UIPanel();
	container.setBorderTop('0');
	container.setPaddingTop('20px');

	const backgroundRow = new UIRow();

	const backgroundType = new UISelect()
		.setOptions({
			None: '',
			Color: 'Color',
			Texture: 'Texture',
			Equirectangular: 'Equirect'
		})
		.setWidth('150px');
	backgroundType.onChange(function () {

		onBackgroundChanged();
		refreshBackgroundUI();

	});

	backgroundRow.add(
		new UIText(strings.getKey('sidebar/scene/background')).setWidth('90px')
	);
	backgroundRow.add(backgroundType);

	const backgroundColor = new UIColor()
		.setValue('#000000')
		.setMarginLeft('8px')
		.onInput(onBackgroundChanged);
	backgroundRow.add(backgroundColor);

	const backgroundTexture = new UITexture()
		.setMarginLeft('8px')
		.onChange(onBackgroundChanged);
	backgroundTexture.setDisplay('none');
	backgroundRow.add(backgroundTexture);

	const backgroundEquirectangularTexture = new UITexture()
		.setMarginLeft('8px')
		.onChange(onBackgroundChanged);
	backgroundEquirectangularTexture.setDisplay('none');
	backgroundRow.add(backgroundEquirectangularTexture);

	container.add(backgroundRow);

	function onBackgroundChanged() {

		signals.sceneBackgroundChanged.dispatch(
			backgroundType.getValue(),
			backgroundColor.getHexValue(),
			backgroundTexture.getValue(),
			backgroundEquirectangularTexture.getValue()
		);

	}

	function refreshBackgroundUI() {

		const type = backgroundType.getValue();

		backgroundType.setWidth(type === 'None' ? '150px' : '110px');
		backgroundColor.setDisplay(type === 'Color' ? '' : 'none');
		backgroundTexture.setDisplay(type === 'Texture' ? '' : 'none');
		backgroundEquirectangularTexture.setDisplay(
			type === 'Equirectangular' ? '' : 'none'
		);

	}

	function refreshUI() {

		const scene = editor.scene;

		if (scene.background) {

			if (scene.background.isColor) {

				backgroundType.setValue('Color');
				backgroundColor.setHexValue(scene.background.getHex());

			} else if (scene.background.isTexture) {

				if (scene.background.mapping === THREE.EquirectangularReflectionMapping) {

					backgroundType.setValue('Equirectangular');
					backgroundEquirectangularTexture.setValue(scene.background);

				} else {

					backgroundType.setValue('Texture');
					backgroundTexture.setValue(scene.background);

				}

			}

		} else {

			backgroundType.setValue('None');

		}

		refreshBackgroundUI();

	}

	refreshUI();

	signals.editorCleared.add(refreshUI);
	signals.sceneBackgroundChanged.add(refreshUI);
	signals.sceneGraphChanged.add(refreshUI);

	return container;

}

export { SidebarBackground };
