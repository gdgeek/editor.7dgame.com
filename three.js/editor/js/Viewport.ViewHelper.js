import { UIPanel } from './libs/ui.js';

import { ViewHelper as ViewHelperBase } from 'three/addons/helpers/ViewHelper.js';

class ViewHelper extends ViewHelperBase {

	constructor( editorCamera, container ) {

		super( editorCamera, container.dom );
		this.setLabels( 'X', 'Y', 'Z' );
		this.setLabelStyle( '22px Arial', '#ffffff', 14 );

		this.location.top = 4;

		const panel = new UIPanel();
		panel.setId( 'viewHelper' );
		panel.setPosition( 'absolute' );
		panel.setRight( '0px' );
		panel.setTop( '4px' );
		panel.setHeight( '128px' );
		panel.setWidth( '128px' );

		panel.dom.addEventListener( 'pointerup', ( event ) => {

			event.stopPropagation();

			this.handleClick( event );

		} );

		panel.dom.addEventListener( 'pointerdown', function ( event ) {

			event.stopPropagation();

		} );

		container.add( panel );

	}

}

export { ViewHelper };
