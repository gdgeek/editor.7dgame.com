import type { Object3D } from 'three';
import type { MrppEditor } from '../types/mrpp.js';

type PreviewTransform = { position: any; quaternion: any; rotation: any; scale: any; visible: boolean };
const authored = new WeakMap<Object3D, PreviewTransform>();
const roots = new WeakMap<Object3D, Object3D[]>();
const previews = new WeakMap<MrppEditor, { stops: Map<Object3D, () => void>; removeInputListeners: () => void }>();

export function hasActiveEditorAnimationPreview( editor: MrppEditor ): boolean {
	return Boolean( previews.get( editor )?.stops.size );
}

export function stopEditorAnimationPreviews( editor: MrppEditor ): void {
	for ( const stop of [ ...( previews.get( editor )?.stops.values() || [] ) ] ) stop();
}

/** Stop before user input reaches normal UI handlers, so their real edits are retained. */
export function registerEditorAnimationPreview( editor: MrppEditor, root: Object3D, stop: () => void ): void {
	let state = previews.get( editor );
	if ( ! state ) {
		const onInput = () => stopEditorAnimationPreviews( editor );
		const target = typeof document !== 'undefined' ? document : null;
		const events = [ 'pointerdown', 'keydown', 'beforeinput', 'input', 'change', 'wheel' ];
		for ( const event of events ) target?.addEventListener( event, onInput, true );
		state = { stops: new Map(), removeInputListeners: () => {
			for ( const event of events ) target?.removeEventListener( event, onInput, true );
		} };
		previews.set( editor, state );
	}
	state.stops.set( root, stop );
}

export function unregisterEditorAnimationPreview( editor: MrppEditor, root: Object3D ): void {
	const state = previews.get( editor );
	state?.stops.delete( root );
	if ( state && state.stops.size === 0 ) { state.removeInputListeners(); previews.delete( editor ); }
}

/** Animation previews must never become authored transforms during serialization. */
export function beginEditorAnimationPreview( root: Object3D ): void {
	if ( roots.has( root ) ) return;
	const objects: Object3D[] = [];
	root.traverse( ( object: Object3D ) => {
		objects.push( object );
		authored.set( object, {
			position: object.position.clone(), quaternion: object.quaternion.clone(), rotation: object.rotation.clone(),
			scale: object.scale.clone(), visible: object.visible
		} );
	} );
	roots.set( root, objects );
}

export function endEditorAnimationPreview( root: Object3D ): void {
	for ( const object of roots.get( root ) || [] ) {
		const value = authored.get( object );
		if ( value ) {
			object.position.copy( value.position ); object.quaternion.copy( value.quaternion );
			object.scale.copy( value.scale ); object.visible = value.visible;
		}
		authored.delete( object );
	}
	roots.delete( root );
}

export function getEditorAnimationAuthoringTransform( object: Object3D ): PreviewTransform | undefined {
	return authored.get( object );
}
