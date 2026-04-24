import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('prepareMetaLoadState', () => {
	let prepareMetaLoadState;

	beforeEach(async () => {
		vi.clearAllMocks();
		({ prepareMetaLoadState } = await import('../../../../plugin/mrpp/prepareMetaLoadState.ts'));
	});

	it('clears stale selection and scene contents before loading the next meta scene', () => {
		const clearSelection = vi.fn();
		const clear = vi.fn();

		prepareMetaLoadState({
			clearSelection,
			clear,
		});

		expect(clearSelection).toHaveBeenCalledTimes(1);
		expect(clear).toHaveBeenCalledTimes(1);
	});
});
