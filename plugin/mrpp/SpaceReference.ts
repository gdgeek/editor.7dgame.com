import * as THREE from 'three';
import { GLTFLoader } from '../../three.js/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../../three.js/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from '../../three.js/examples/jsm/loaders/KTX2Loader.js';
import type { MrppEditor } from '../types/mrpp.js';

export interface SpaceReferenceFile {
	id?: number;
	url?: string | null;
	filename?: string | null;
}

export interface SpaceReferenceData {
	id?: number;
	name?: string | null;
	mesh?: SpaceReferenceFile | null;
	file?: SpaceReferenceFile | null;
}

export const SPACE_REFERENCE_VISIBILITY_ACTION = 'set-space-reference-visible';

function normalizeUrl( value: unknown ): string {

	if ( typeof value !== 'string' ) return '';
	return value.trim();

}

export function getSpaceModelUrl( space: SpaceReferenceData | null | undefined ): string {

	return normalizeUrl( space?.mesh?.url ) || normalizeUrl( space?.file?.url );

}

export function formatSpaceReferenceLabel(
	space: Pick<SpaceReferenceData, 'name'> | null | undefined,
	prefix = 'Space'
): string {

	const name = normalizeUrl( space?.name );
	return name ? `${ prefix }：${ name }` : '';

}

export function normalizeSpaceReferenceVisibility( value: unknown ): boolean {

	if ( typeof value === 'boolean' ) return value;
	if ( typeof value !== 'object' || value === null ) return true;
	const payload = value as { visible?: unknown };
	return typeof payload.visible === 'boolean' ? payload.visible : true;

}

export function buildSpaceReferenceUserData( userData: Record<string, unknown> = {} ): Record<string, unknown> {

	return {
		...userData,
		hidden: true,
		spaceReference: true,
		internalHelper: true
	};

}

function matchCurrentProtocol( url: string ): string {

	if ( typeof window === 'undefined' ) return url;
	const protocol = window.location.protocol;
	if ( protocol === 'https:' && url.startsWith( 'http://' ) ) {

		return url.replace( 'http://', 'https://' );

	}
	if ( protocol === 'http:' && url.startsWith( 'https://' ) ) {

		return url.replace( 'https://', 'http://' );

	}
	return url;

}

export class SpaceReference {

	private editor: MrppEditor;
	private ktx2Loader: any = null;
	private object: THREE.Object3D | null = null;
	private visible = true;

	constructor( editor: MrppEditor ) {

		this.editor = editor;
		this.editor.signals.objectSelected.add( ( object: THREE.Object3D | null ) => {

			if ( object?.userData?.spaceReference ) {

				this.editor.clearSelection();

			}

		} );

	}

	get hasObject(): boolean {

		return this.object !== null;

	}

	isVisible(): boolean {

		return this.object ? this.object.visible : this.visible;

	}

	clear(): void {

		if ( this.object && this.object.parent ) {

			this.object.parent.remove( this.object );
			this.editor.signals.sceneGraphChanged.dispatch();

		}
		this.object = null;

	}

	async load( space: SpaceReferenceData | null | undefined, visible = true ): Promise<void> {

		this.clear();
		this.visible = visible;
		if ( ! space ) return;

		const modelUrl = getSpaceModelUrl( space );
		if ( ! modelUrl ) {

			console.warn( 'Bound space has no mesh or file URL.', space );
			return;

		}

		try {

			const object = await this.loadModel( matchCurrentProtocol( modelUrl ) );
			object.name = `Space: ${ space.name || space.id || '' }`.trim();
			object.visible = this.visible;
			object.userData = buildSpaceReferenceUserData( object.userData );
			this.lockChildren( object );
			this.object = object;
			this.editor.scene.add( object );
			this.editor.signals.sceneGraphChanged.dispatch();

		} catch ( error ) {

			console.warn( 'Failed to load bound space model:', error );

		}

	}

	setVisible( visible: boolean ): void {

		this.visible = visible;
		if ( this.object ) {

			this.object.visible = visible;
			this.editor.signals.sceneGraphChanged.dispatch();

		}

	}

	toggleVisibility(): boolean {

		this.setVisible( ! this.isVisible() );
		return this.isVisible();

	}

	private async loadModel( url: string ): Promise<THREE.Object3D> {

		return new Promise( ( resolve, reject ) => {

			const loader = new GLTFLoader( THREE.DefaultLoadingManager );
			const dracoLoader = new DRACOLoader();
			dracoLoader.setDecoderPath( '../examples/jsm/libs/draco/gltf/' );
			loader.setDRACOLoader( dracoLoader );

			if ( this.ktx2Loader === null ) {

				this.ktx2Loader = new KTX2Loader();
				this.ktx2Loader.setTranscoderPath( '../examples/jsm/libs/basis/' );
				if ( this.editor.renderer ) {

					this.ktx2Loader.detectSupport( this.editor.renderer );

				}

			}
			loader.setKTX2Loader( this.ktx2Loader );

			loader.load(
				url,
				( gltf: any ) => resolve( gltf.scene ),
				undefined,
				( error: unknown ) => reject( error )
			);

		} );

	}

	private lockChildren( object: THREE.Object3D ): void {

		object.children.forEach( child => {

			child.userData = buildSpaceReferenceUserData( child.userData );
			this.lockChildren( child );

		} );

	}

}
