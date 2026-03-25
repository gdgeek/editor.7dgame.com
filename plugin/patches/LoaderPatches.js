import { KTX2Loader } from '../../three.js/examples/jsm/loaders/KTX2Loader.js';

/**
 * Lazily initialize a shared KTX2Loader instance.
 * Caches the result so subsequent calls are no-ops.
 *
 * @param {object} state   - Shared state object with `ktx2Loader` property
 * @param {object} manager - THREE.LoadingManager to register the handler on
 * @param {object} editor  - Editor instance (needs editor.renderer for detectSupport)
 * @returns {KTX2Loader|null}
 */
function ensureKTX2( state, manager, editor ) {

	if ( state.ktx2Loader ) return state.ktx2Loader;

	try {

		const k = new KTX2Loader( manager )
			.setTranscoderPath( '../examples/jsm/libs/basis/' )
			.detectSupport( editor.renderer );
		manager.addHandler( /\.ktx2$/i, k );
		state.ktx2Loader = k;
		return k;

	} catch ( e ) {

		console.warn( 'KTX2Loader 初始化失败', e );
		return null;

	}

}

/**
 * Apply all MRPP loader patches to the given editor instance.
 *
 * Extracts KTX2 loading support that was previously inlined in Loader.js
 * (10 MRPP markers) into external monkey-patches on editor.loader.
 *
 * Patches applied:
 * 1. `loadFiles` — flags when the file batch contains ktx2/glb/gltf
 * 2. `loadFile`  — initializes KTX2 on the manager for glb/gltf files
 *    and sets KTX2Loader on the GLTFLoader inside the FileReader callback
 * 3. handleZIP   — handled indirectly: `ensureKTX2` and `ktx2Loader` are
 *    exposed on the loader instance so handleZIP (or a refactored version
 *    that delegates to loadFile) can use them
 *
 * Safety pattern (same as EditorPatches.js):
 * - Save original method reference
 * - try/catch isolation for MRPP logic
 * - Full parameter passthrough to original
 *
 * @param {object} editor - The Editor instance (must have editor.loader set)
 */
function applyLoaderPatches( editor ) {

	const loader = editor.loader;

	// Shared mutable state for the lazy-initialized KTX2Loader
	const ktx2State = { ktx2Loader: null };

	// Expose ensureKTX2 and ktx2Loader on the loader instance so that
	// handleZIP (which is a private closure inside Loader.js) can call
	// them via `scope.ensureKTX2(manager)` / `scope.ktx2Loader` when
	// Loader.js is cleaned up to use minimal hooks.
	loader.ktx2Loader = null;

	loader.ensureKTX2 = function ( manager ) {

		const result = ensureKTX2( ktx2State, manager, editor );
		loader.ktx2Loader = ktx2State.ktx2Loader;
		return result;

	};


	// ─── Monkey-patch loadFiles ─────────────────────────────────────

	const originalLoadFiles = loader.loadFiles;

	loader.loadFiles = function ( files, filesMap ) {

		try {

			// Flag whether the batch contains files that need KTX2 support.
			// The actual initialization happens in the loadFile patch below,
			// because the LoadingManager is created inside the original
			// loadFiles and passed to loadFile as a parameter.
			if ( files && files.length > 0 &&
				files.some( f => /\.(ktx2|glb|gltf)$/i.test( f.name ) ) ) {

				loader._mrppBatchNeedsKTX2 = true;

			} else {

				loader._mrppBatchNeedsKTX2 = false;

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (loadFiles pre):', e );

		}

		return originalLoadFiles.call( this, files, filesMap );

	};

	// ─── Monkey-patch loadFile ──────────────────────────────────────

	const originalLoadFile = loader.loadFile;

	loader.loadFile = function ( file, manager ) {

		try {

			// Batch-level KTX2 initialization:
			// When loadFiles flagged that the batch contains ktx2/glb/gltf,
			// initialize KTX2 on the manager (once). This replicates the
			// original `if (files.some(...)) ensureKTX2(manager)` that ran
			// inside loadFiles right after manager creation.
			if ( loader._mrppBatchNeedsKTX2 && manager && ! ktx2State.ktx2Loader ) {

				ensureKTX2( ktx2State, manager, editor );
				loader.ktx2Loader = ktx2State.ktx2Loader;

			}

			// Per-file KTX2 initialization for glb/gltf:
			// Even outside a batch context (e.g. called from handleZIP),
			// ensure KTX2 is ready when loading glb/gltf files.
			const filename = ( file && file.name ) ? file.name : '';
			const extension = filename.split( '.' ).pop().toLowerCase();

			if ( ( extension === 'glb' || extension === 'gltf' ) && manager ) {

				if ( ! ktx2State.ktx2Loader ) {

					ensureKTX2( ktx2State, manager, editor );
					loader.ktx2Loader = ktx2State.ktx2Loader;

				}

			}

		} catch ( e ) {

			console.warn( 'MRPP extension error (loadFile pre):', e );

		}

		return originalLoadFile.call( this, file, manager );

	};

}

export { applyLoaderPatches };
