import { UIButton, UICheckbox, UIColor, UIDiv, UIInput, UIRow, UIText } from './libs/ui.js';
import { SetValueCommand } from './commands/SetValueCommand.js';

const DEFAULT_FONT_SIZE = 36;
const DEFAULT_COLOR = '#FFFFFF';
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 96;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function hasSubtitleBinding( editor, object ) {

	if ( editor.type !== 'meta' || ! object?.userData ) return false;
	const { type, resource: resourceId } = object.userData;
	const nodeType = String( type ).toLowerCase();
	if ( ( nodeType !== 'sound' && nodeType !== 'video' ) || resourceId == null ) return false;

	const resources = editor.data?.resources;
	if ( ! Array.isArray( resources ) ) return false;
	const resource = resources.find( item => String( item?.id ) === String( resourceId ) );
	if ( resource?.type !== ( nodeType === 'sound' ? 'audio' : 'video' ) ) return false;
	if ( typeof resource.hasSubtitle === 'boolean' ) return resource.hasSubtitle;

	// Published snapshots carry the binding in info; the live resource API uses hasSubtitle.
	try {

		const info = typeof resource.info === 'string' ? JSON.parse( resource.info ) : resource.info;
		const id = info?.subtitleResourceId;
		return Number.isSafeInteger( id ) && id > 0 && resources.some( item =>
			item?.type === 'subtitle' && String( item.id ) === String( id ) );

	} catch {

		return false;

	}

}

function isValidFontSize( value ) {

	return Number.isFinite( value ) && value >= MIN_FONT_SIZE && value <= MAX_FONT_SIZE;

}

function getStyle( object ) {

	const style = object.userData.subtitleStyle;
	return style && typeof style === 'object' && ! Array.isArray( style ) ? style : {};

}

function SidebarSubtitle( editor ) {

	const label = key => editor.strings.getKey( 'sidebar/subtitle/' + key );
	const panel = new UIDiv().setDisplay( 'none' );
	const enabled = new UICheckbox( true );
	const fontSize = new UIInput( '' ).setWidth( '64px' );
	fontSize.dom.type = 'number';
	fontSize.dom.min = String( MIN_FONT_SIZE );
	fontSize.dom.max = String( MAX_FONT_SIZE );
	fontSize.dom.step = 'any';
	const color = new UIInput( '' ).setWidth( '67px' );
	const colorPicker = new UIColor();
	const resetFontSize = new UIButton( label( 'reset' ) ).setClass( 'Button SubtitleReset' ).setMarginLeft( '4px' );
	const resetColor = new UIButton( label( 'reset' ) ).setClass( 'Button SubtitleReset' ).setMarginLeft( '4px' );
	const error = new UIRow().setDisplay( 'none' );
	error.dom.setAttribute( 'role', 'alert' );
	let selected = null;
	let invalidField = null;

	for ( const [ field, key ] of [ [ enabled, 'enabled' ], [ fontSize, 'fontSize' ], [ color, 'color' ],
		[ colorPicker, 'colorPicker' ], [ resetFontSize, 'resetFontSize' ], [ resetColor, 'resetColor' ] ] ) {

		field.dom.setAttribute( 'aria-label', label( key ) );

	}

	function addRow( key, ...fields ) {

		const row = new UIRow();
		row.add( new UIText( label( key ) ).setClass( 'Text Label' ).setWidth( '90px' ), ...fields );
		panel.add( row );

	}

	addRow( 'enabled', enabled );
	addRow( 'fontSize', fontSize, resetFontSize );
	addRow( 'color', colorPicker, color, resetColor );
	panel.add( error );

	function showError( field, key ) {

		if ( invalidField ) invalidField.dom.setAttribute( 'aria-invalid', 'false' );
		invalidField = field;
		if ( field ) field.dom.setAttribute( 'aria-invalid', 'true' );
		error.setTextContent( field ? label( key ) : '' );
		error.setDisplay( field ? '' : 'none' );

	}

	function update( object ) {

		const hasBinding = hasSubtitleBinding( editor, object );
		if ( selected !== object || ! hasBinding ) showError( null );
		selected = object;
		panel.setDisplay( hasBinding ? '' : 'none' );
		if ( ! hasBinding ) return;

		const style = getStyle( object );
		const readOnly = editor.data?.saveable === false;
		const savedColor = typeof style.color === 'string' && COLOR_PATTERN.test( style.color )
			? style.color.toUpperCase() : DEFAULT_COLOR;
		enabled.setValue( style.enabled !== false ).setDisabled( readOnly );
		if ( invalidField !== fontSize ) fontSize.setValue( String( isValidFontSize( style.fontSize ) ? style.fontSize : DEFAULT_FONT_SIZE ) );
		if ( invalidField !== color ) color.setValue( savedColor );
		colorPicker.setValue( savedColor.toLowerCase() );
		fontSize.setDisabled( readOnly );
		color.setDisabled( readOnly );
		colorPicker.setDisabled( readOnly );
		resetFontSize.setDisabled( readOnly || ( ! Object.hasOwn( style, 'fontSize' ) && invalidField !== fontSize ) );
		resetColor.setDisabled( readOnly || ( ! Object.hasOwn( style, 'color' ) && invalidField !== color ) );

	}

	function saveField( key, value ) {

		const object = editor.selected;
		if ( object !== selected || editor.data?.saveable === false || ! hasSubtitleBinding( editor, object ) ) return;

		showError( null );
		const currentStyle = getStyle( object );
		if ( currentStyle[ key ] === value ) {

			update( object );
			return;

		}

		const style = { ...currentStyle };
		if ( value === undefined ) delete style[ key ];
		else style[ key ] = value;
		const userData = { ...object.userData };
		if ( Object.keys( style ).length ) userData.subtitleStyle = style;
		else delete userData.subtitleStyle;

		const command = new SetValueCommand( editor, object, 'userData', userData );
		command.updatable = false;
		editor.execute( command );

	}

	enabled.onChange( () => saveField( 'enabled', enabled.getValue() ? undefined : false ) );
	fontSize.onChange( () => {

		const size = Number( fontSize.getValue() );
		if ( isValidFontSize( size ) ) saveField( 'fontSize', size );
		else showError( fontSize, 'invalidFontSize' );
		update( selected );

	} );
	color.onChange( () => {

		const value = color.getValue().trim();
		if ( COLOR_PATTERN.test( value ) ) saveField( 'color', value.toUpperCase() );
		else showError( color, 'invalidColor' );
		update( selected );

	} );
	colorPicker.onChange( () => saveField( 'color', colorPicker.getValue().toUpperCase() ) );
	resetFontSize.onClick( () => saveField( 'fontSize', undefined ) );
	resetColor.onClick( () => saveField( 'color', undefined ) );

	return { panel, update };

}

export { SidebarSubtitle };
