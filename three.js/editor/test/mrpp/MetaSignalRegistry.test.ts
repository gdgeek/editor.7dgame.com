import { describe, expect, it, vi } from 'vitest';
import {
	MetaSignalRegistry,
	normalizeMetaSignals,
} from '../../../../plugin/mrpp/MetaSignalRegistry.ts';

describe('MetaSignalRegistry', () => {
	it('normalizes null and legacy JSON signal definitions', () => {
		expect(normalizeMetaSignals(null)).toEqual({
			ok: true,
			value: { inputs: [], outputs: [] },
		});
		expect(
			normalizeMetaSignals(
				JSON.stringify({ inputs: [{ title: 'Start' }], outputs: [] })
			)
		).toEqual({
			ok: true,
			value: { inputs: [{ title: 'Start' }], outputs: [] },
		});
	});

	it('rejects missing or malformed signal definitions', () => {
		expect(normalizeMetaSignals(undefined).ok).toBe(false);
		expect(normalizeMetaSignals('{').ok).toBe(false);
		expect(normalizeMetaSignals({ inputs: [] }).ok).toBe(false);
	});

	it('resets all stale entries when another scene is loaded', () => {
		const registry = new MetaSignalRegistry();
		registry.reset([
			{ id: 1, events: { inputs: [{ title: 'Old' }], outputs: [] } },
		]);
		expect(registry.get(1)?.inputs).toHaveLength(1);

		registry.reset([]);
		expect(registry.get(1)).toBeUndefined();
	});

	it('keeps the legacy map synchronized for existing consumers', () => {
		const editor = { data: {}, signals: {} } as any;
		const registry = new MetaSignalRegistry(editor);
		registry.upsert(5, { inputs: [{ title: 'Ready' }], outputs: [] }, false);

		expect(editor.data.metaEventsById.get('5')).toEqual({
			inputs: [{ title: 'Ready' }],
			outputs: [],
		});
		registry.reset([]);
		expect(editor.data.metaEventsById.size).toBe(0);
	});

	it('keeps one authoritative definition for all instances of the same meta', () => {
		const registry = new MetaSignalRegistry();
		registry.upsert(7, { inputs: [{ title: 'Before' }], outputs: [] });
		registry.upsert('7', { inputs: [], outputs: [{ title: 'After' }] });

		expect(registry.get(7)).toEqual({
			inputs: [],
			outputs: [{ title: 'After' }],
		});
	});

	it('refreshes the selected instance when its meta definition changes', () => {
		const dispatch = vi.fn();
		const selected = { userData: { meta_id: 9 } };
		const registry = new MetaSignalRegistry({
			selected,
			signals: { refreshSidebarObject3D: { dispatch } },
		} as any);

		registry.upsert(9, { inputs: [], outputs: [] });
		expect(dispatch).toHaveBeenCalledWith(selected);
	});
});
