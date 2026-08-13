import type { MrppEditor } from '../types/mrpp.js';

export interface MetaSignalGroups {
	inputs: unknown[];
	outputs: unknown[];
}

export interface MetaSignalNormalization {
	ok: boolean;
	value?: MetaSignalGroups;
	reason?: string;
}

const EMPTY_SIGNALS: MetaSignalGroups = { inputs: [], outputs: [] };

function cloneSignals( signals: MetaSignalGroups ): MetaSignalGroups {

	return {
		inputs: signals.inputs.slice(),
		outputs: signals.outputs.slice()
	};

}

export function normalizeMetaSignals( raw: unknown ): MetaSignalNormalization {

	if ( raw === null ) {

		return { ok: true, value: cloneSignals( EMPTY_SIGNALS ) };

	}

	if ( raw === undefined ) {

		return { ok: false, reason: 'events is missing' };

	}

	let value = raw;
	if ( typeof value === 'string' ) {

		try {

			value = JSON.parse( value );

		} catch {

			return { ok: false, reason: 'events is not valid JSON' };

		}

	}

	if ( typeof value !== 'object' || value === null || Array.isArray( value ) ) {

		return { ok: false, reason: 'events must be an object or null' };

	}

	const signals = value as { inputs?: unknown; outputs?: unknown };
	if ( ! Array.isArray( signals.inputs ) || ! Array.isArray( signals.outputs ) ) {

		return { ok: false, reason: 'events.inputs and events.outputs must be arrays' };

	}

	return {
		ok: true,
		value: {
			inputs: signals.inputs.slice(),
			outputs: signals.outputs.slice()
		}
	};

}

export class MetaSignalRegistry {

	private values = new Map<string, MetaSignalGroups>();
	private editor: MrppEditor | null;
	private legacyMap: Map<string, MetaSignalGroups>;

	constructor( editor: MrppEditor | null = null ) {

		this.editor = editor;
		this.legacyMap = new Map<string, MetaSignalGroups>();
		if ( this.editor ) {

			if ( ! this.editor.data ) this.editor.data = {};
			this.editor.data.metaEventsById = this.legacyMap;

		}

	}

	reset( metas: unknown = [] ): string[] {

		this.values.clear();
		this.legacyMap.clear();
		const errors: string[] = [];
		if ( ! Array.isArray( metas ) ) return [ 'metas must be an array' ];

		metas.forEach( ( item: unknown, index: number ) => {

			if ( typeof item !== 'object' || item === null ) {

				errors.push( `metas[${ index }] must be an object` );
				return;

			}

			const meta = item as { id?: unknown; events?: unknown };
			const result = this.upsert( meta.id, meta.events, false );
			if ( ! result.ok ) errors.push( `metas[${ index }]: ${ result.reason }` );

		} );

		return errors;

	}

	validate( raw: unknown ): MetaSignalNormalization {

		return normalizeMetaSignals( raw );

	}

	upsert( metaId: unknown, raw: unknown, refresh = true ): MetaSignalNormalization {

		if ( metaId === null || metaId === undefined || String( metaId ).trim() === '' ) {

			return { ok: false, reason: 'meta id is missing' };

		}

		const normalized = normalizeMetaSignals( raw );
		if ( ! normalized.ok || ! normalized.value ) return normalized;

		const key = String( metaId );
		this.values.set( key, normalized.value );
		this.legacyMap.set( key, cloneSignals( normalized.value ) );

		if ( refresh ) {

			const selected = this.editor?.selected;
			if ( selected && String( selected.userData?.meta_id ) === key ) {

				this.editor?.signals.refreshSidebarObject3D?.dispatch( selected );

			}

		}

		return { ok: true, value: cloneSignals( normalized.value ) };

	}

	get( metaId: unknown ): MetaSignalGroups | undefined {

		if ( metaId === null || metaId === undefined ) return undefined;
		const value = this.values.get( String( metaId ) );
		return value ? cloneSignals( value ) : undefined;

	}

}

export function ensureMetaSignalRegistry( editor: MrppEditor ): MetaSignalRegistry {

	if ( ! editor.data ) editor.data = {};
	if ( !( editor.data.metaSignalRegistry instanceof MetaSignalRegistry ) ) {

		editor.data.metaSignalRegistry = new MetaSignalRegistry( editor );

	}
	return editor.data.metaSignalRegistry;

}
