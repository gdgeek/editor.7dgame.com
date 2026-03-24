import { MetaLoader } from '../mrpp/MetaLoader.js';
import { initializeGlobalShortcuts } from '../utils/GlobalShortcuts.js';

function initMetaEditor( editor ) {

	editor.type = 'meta';

	editor.signals.messageSend.add( function ( e ) {

		const data = {
			...e,
			from: 'scene.meta.editor',
			verify: 'mrpp.com'
		};
		window.parent.postMessage( data, '*' );

	} );

	initializeGlobalShortcuts( editor );

	const loader = new MetaLoader( editor );
	editor.metaLoader = loader;

	window.addEventListener( 'message', e => {

		const data = e.data;

		if ( data.action && data.from && data.from === 'scene.meta.web' ) {

			if ( data.action === 'check-unsaved-changes' ) {

				( async () => {

					const requestId = ( data.data && data.data.requestId ) || '';
					let changed = false;
					try {

						if ( editor.metaLoader && typeof editor.metaLoader.changed === 'function' ) {

							changed = await editor.metaLoader.changed();

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

						const changed = editor.metaLoader && typeof editor.metaLoader.changed === 'function'
							? await editor.metaLoader.changed()
							: false;

						if ( ! changed ) {

							editor.signals.messageSend.dispatch( {
								action: 'save-meta-before-leave-none'
							} );
							return;

						}

						const meta = await editor.metaLoader.getMeta();
						const payload = { meta, events: editor.scene.events };
						editor.signals.messageSend.dispatch( {
							action: 'save-meta-before-leave',
							data: payload
						} );
						editor.metaLoader.json = JSON.stringify( payload );

					} catch ( error ) {

						console.error( 'Failed to save before leave:', error );
						editor.signals.messageSend.dispatch( {
							action: 'save-meta-before-leave-none'
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

		if ( params.action === 'load' ) {

			const data = params.data;
			loader.load( data.data );

			// 如果消息中包含可用资源类型，在编辑器上存储它们
			console.log( "Received load message with data:", data );
			if ( data.availableResourceTypes ) {

				editor.availableResourceTypes = data.availableResourceTypes;

				// 直接触发一个自定义事件，通知菜单更新资源类型，避免递归
				editor.signals.messageReceive.dispatch( {
					action: 'available-resource-types',
					data: data.availableResourceTypes
				} );

			}

			// 保存resources信息到编辑器对象中
			if ( data.data && data.data.resources ) {

				editor.data.resources = data.data.resources;

			}

			// 保存用户信息
			if ( data.user ) {

				editor.data.user = data.user;
				console.log( "Set user role:", editor.data.user.role );

			}

		} else if ( params.action === 'user-info' ) {

			// 保存用户信息
			editor.data.user = params.data;
			console.log( "Updated user role:", editor.data.user.role );

		}

	} );

	editor.signals.messageSend.dispatch( {
		action: 'ready'
	} );

}

export { initMetaEditor };
