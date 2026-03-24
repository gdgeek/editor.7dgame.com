import { VerseLoader } from '../mrpp/VerseLoader.js';
import { initializeGlobalShortcuts } from '../utils/GlobalShortcuts.js';

function initVerseEditor( editor ) {

	editor.type = 'verse';

	editor.signals.messageSend.add( function ( e ) {

		window.parent.postMessage( {
			...e,
			from: 'scene.verse.editor',
			verify: 'mrpp.com'
		}, '*' );

	} );

	initializeGlobalShortcuts( editor );

	const loader = new VerseLoader( editor );
	editor.verseLoader = loader;

	window.addEventListener( 'message', e => {

		const data = e.data;

		if ( data.action && data.from && data.from === 'scene.verse.web' ) {

			if ( data.action === 'check-unsaved-changes' ) {

				( async () => {

					const requestId = ( data.data && data.data.requestId ) || '';
					let changed = false;
					try {

						if ( editor.verseLoader && typeof editor.verseLoader.changed === 'function' ) {

							changed = await editor.verseLoader.changed();

						}

					} catch ( error ) {

						console.error( 'Failed to check unsaved changes:', error );

					}

					editor.signals.messageSend.dispatch( {
						action: 'unsaved-changes-result',
						data: { requestId, changed: Boolean( changed ) }
					} );

				} )();
				return;

			}

			if ( data.action === 'save-before-leave' ) {

				( async () => {

					try {

						const changed = editor.verseLoader && typeof editor.verseLoader.changed === 'function'
							? await editor.verseLoader.changed()
							: false;

						if ( ! changed ) {

							editor.signals.messageSend.dispatch( {
								action: 'save-verse-before-leave-none'
							} );
							return;

						}

						const verse = await editor.verseLoader.getVerse();
						const payload = { verse };
						editor.signals.messageSend.dispatch( {
							action: 'save-verse-before-leave',
							data: payload
						} );
						editor.verseLoader.json = JSON.stringify( payload );

					} catch ( error ) {

						console.error( 'Failed to save before leave:', error );
						editor.signals.messageSend.dispatch( {
							action: 'save-verse-before-leave-none'
						} );

					}

				} )();
				return;

			}

			editor.signals.messageReceive.dispatch( {
				action: data.action,
				data: data.data
			} );

		}

	} );

	editor.signals.messageReceive.add( async function ( params ) {

		if ( ! editor.data ) {

			editor.data = {};

		}

		if ( params.action == 'load' ) {

			const data = params.data;
			loader.load( data.data );
			//console.log("Loaded verse data:", data);
			// 保存用户信息
			if ( data.user ) {

				editor.data.user = data.user;
				console.error( "Set user role:", editor.data.user.role );

			}

		} else if ( params.action === 'user-info' ) {

			// 保存用户信息
			editor.data.user = params.data;
			console.error( "Updated user role:", editor.data.user.role );

		}

	} );

	editor.signals.messageSend.dispatch( {
		action: 'ready'
	} );

}

export { initVerseEditor };
