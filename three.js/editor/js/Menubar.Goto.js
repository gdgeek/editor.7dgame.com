import * as THREE from 'three';

import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';

import { AddObjectCommand } from './commands/AddObjectCommand.js';
import { MetaFactory } from './mrpp/MetaFactory.js'
import { Builder } from './mrpp/Builder.js'

function MenubarGoto(editor) {


	const factory = new MetaFactory();
	const builder = new Builder();
	const strings = editor.strings;

	const resources = new Map()
	const container = new UIPanel();
	editor.signals.messageReceive.add(async function (params) {
		if (params.action === 'resource') {

			resources.set(params.data.id.toString(), params.data)

			const data = builder.resource(params.data)
			if (data != null) {
				const node = await factory.building(data, resources);
				if (node != null) {
					editor.execute(new AddObjectCommand(editor, node));
				}
			}

		}
	});
	container.setClass('menu');

	const title = new UIPanel();
	title.setClass('title');
	title.setTextContent('Code');
	container.add(title);

	const options = new UIPanel();
	options.setClass('options');
	container.add(options);

	// Blockly

	let option = new UIRow();
	option.setClass('option');
	option.setTextContent('Script Edit');
	option.onClick(function () {
		const data = {
			action: 'goto',
			data: { 'target': 'blockly.js' }
		};
		editor.signals.messageSend.dispatch(data);
	});
	options.add(option);
	return container;

}

export { MenubarGoto };
