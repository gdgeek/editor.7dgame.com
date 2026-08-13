import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('scene entity signal insertion contract', () => {
	it('registers signals before the command selects the new object', () => {
		const source = readFileSync(
			resolve(process.cwd(), '../../../plugin/ui/menubar/Menubar.MrppAdd.ts'),
			'utf8'
		);
		const verseModeIndex = source.indexOf('function _injectVerseMode');
		const verseModeSource = source.slice(verseModeIndex);
		const registerIndex = verseModeSource.indexOf(
			'signalRegistry.upsert( data.id, signalDefinition.value, false )'
		);
		const executeIndex = verseModeSource.indexOf(
			'editor.execute( new AddObjectCommand( editor, node ) )'
		);

		expect(registerIndex).toBeGreaterThan(-1);
		expect(executeIndex).toBeGreaterThan(registerIndex);
	});

	it('reads the registry before compatibility snapshots', () => {
		const source = readFileSync(
			resolve(process.cwd(), '../js/Sidebar.Object.js'),
			'utf8'
		);
		expect(source.indexOf('metaSignalRegistry.get')).toBeLessThan(
			source.indexOf('object.metaEvents')
		);
	});
});
