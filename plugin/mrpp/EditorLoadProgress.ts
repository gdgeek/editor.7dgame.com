/** Per-load task counts, not a byte/download estimate. Never shared across editor sessions. */
export class EditorLoadProgress {
	phase: 'assets' | 'finishing' | 'ready' | 'error' = 'assets';
	completed = 0;
	failed = 0;
	private sequence = 0;
	private pending = new Map<number, { kind: string; name: string }>();

	constructor(readonly total: number) {}

	start(kind: string, name?: unknown) {
		const id = ++this.sequence;
		this.pending.set(id, {
			kind,
			name: typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) : ''
		});
		let settled = false;
		return (success = true) => {
			if (settled) return;
			settled = true;
			this.pending.delete(id);
			if (success) {
				this.completed++;
			} else {
				this.failed++;
				this.phase = 'error';
			}
		};
	}

	async track<T>(kind: string, name: unknown, work: () => Promise<T>): Promise<T> {
		const finish = this.start(kind, name);
		try {
			const result = await work();
			finish();
			return result;
		} catch (error) {
			finish(false);
			throw error;
		}
	}

	finish() { if (this.phase !== 'error') this.phase = 'finishing'; }
	ready() { if (this.phase !== 'error') this.phase = 'ready'; }
	fail() { this.phase = 'error'; }

	snapshot() {
		const current = this.pending.values().next().value;
		return {
			phase: this.phase,
			completed: this.completed,
			total: this.total,
			failed: this.failed,
			currentKind: current?.kind ?? null,
			currentItem: current?.name ?? null
		};
	}
}
