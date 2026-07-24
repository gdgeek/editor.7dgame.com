function isInternalOutlinerObject( object, editor ) {

	return (
		object === editor.camera ||
		object === editor.scene ||
		( object.userData && object.userData.hidden === true ) ||
		( object.name && object.name.charAt( 0 ) === '$' )
	);

}

function getFilterObjectType( object ) {

	const rawType = ( object.userData && object.userData.type ) || object.type || '';
	const normalizedType = String( rawType ).toLowerCase();
	const objectName = String( object.name || '' ).trim().toLowerCase();

	if ( normalizedType === 'sound' ) return 'audio';
	if ( normalizedType === 'entity' && /^point(?:\s*\(\d+\))?$/.test( objectName ) ) return 'point';

	return normalizedType;

}

function hasFilterComponent( object, componentType ) {

	const components = Array.isArray( object.components )
		? object.components
		: Array.isArray( object.userData && object.userData.components )
			? object.userData.components
			: [];

	return components.some( function ( component ) {

		return String( component && component.type || '' ).toLowerCase() === componentType;

	} );

}

function objectMatchesFilter( object, searchText, selectedType ) {

	if ( searchText.length > 0 ) {

		const objectName = String( object.name || '' ).toLowerCase();

		if ( objectName.indexOf( searchText ) === - 1 ) return false;

	}

	if ( selectedType !== '' ) {

		const [ filterKind, filterValue ] = String( selectedType ).split( ':' );

		if ( filterKind === 'type' ) return getFilterObjectType( object ) === filterValue;
		if ( filterKind === 'component' ) return hasFilterComponent( object, filterValue );

	}

	return true;

}

function createOutlinerFilter( editor, searchText = '', selectedType = '' ) {

	const normalizedSearchText = String( searchText ).toLowerCase();
	const normalizedSelectedType = String( selectedType );
	const active = normalizedSearchText.length > 0 || normalizedSelectedType !== '';
	const matchCache = new Map();

	function matchesSubtree( object ) {

		if ( ! active ) return true;
		if ( ! object || isInternalOutlinerObject( object, editor ) ) return false;
		if ( matchCache.has( object.id ) ) return matchCache.get( object.id );

		let matched = objectMatchesFilter( object, normalizedSearchText, normalizedSelectedType );

		if ( ! matched ) {

			const children = Array.isArray( object.children ) ? object.children : [];

			for ( let i = 0; i < children.length; i ++ ) {

				if ( matchesSubtree( children[ i ] ) ) {

					matched = true;
					break;

				}

			}

		}

		matchCache.set( object.id, matched );
		return matched;

	}

	return { active, matchesSubtree };

}

function hasDisplayableDescendant( object, nativeTypes ) {

	if ( ! object ) return false;
	if ( object.userData && object.userData.hidden === true ) return false;
	if ( object.name && object.name.charAt( 0 ) === '$' ) return false;

	const objectType = object.type || '';

	if ( objectType && ! nativeTypes.has( objectType ) ) return true;

	const children = Array.isArray( object.children ) ? object.children : [];

	return children.some( function ( child ) {

		return hasDisplayableDescendant( child, nativeTypes );

	} );

}

export { createOutlinerFilter, hasDisplayableDescendant, isInternalOutlinerObject };
