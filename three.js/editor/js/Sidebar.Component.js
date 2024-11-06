import { UIPanel, UIBreak, UIText, UIButton, UIRow, UISelect, UIInput, UIHorizontalRule } from './libs/ui.js';


import { AddComponentCommand } from './commands/AddComponentCommand.js';
import { ComponentContainer } from './mrpp/ComponentContainer.js';

function SidebarComponent( editor ) {






	const strings = editor.strings;

	const signals = editor.signals;

	const container = new UIPanel();
	container.setDisplay( 'none' );




	const topContainer = new UIRow();
	container.add( topContainer );

	const componentsContainer = new UIRow();
	container.add( componentsContainer );

	function update() {

		topContainer.clear();
		topContainer.setDisplay( 'none' );
		componentsContainer.clear();
		componentsContainer.setDisplay( 'none' );
		const object = editor.selected;

		if ( object === null ) {

			return;

		}




		const components = object.components;



		if ( components !== undefined ) {

			topContainer.setDisplay( 'block' );

			topContainer.add( new UIText( strings.getKey( 'sidebar/components' ).toUpperCase() ) );
			topContainer.add( new UIBreak() );
			topContainer.add( new UIBreak() );

			const label = new UIText( strings.getKey( 'sidebar/components/select' ) );
			topContainer.add( label );

			// 创建下拉框
			const select = new UISelect().setWidth( '100px' );
			select.setOptions( {
				'Rotate': strings.getKey( 'sidebar/components/select/rotate' ),
				'Action': strings.getKey( 'sidebar/components/select/action' ),
				'Moved': strings.getKey( 'sidebar/components/select/moved' ),
				'Trigger': strings.getKey( 'sidebar/components/select/trigger' ),
			} );
			select.setValue( 'Rotate' );
			select.onChange( function () { // 下拉框选项改变时触发的事件

				console.log( 'Selected option:', select.getValue() );

			} );
			topContainer.add( select );


			const newComponent = new UIButton( strings.getKey( 'sidebar/components/select/button' ) );
			newComponent.onClick( function () {

				const component = ComponentContainer.Create( select.getValue() );

				if ( component != undefined ) {

					const command = new AddComponentCommand( editor, editor.selected, component );
					editor.execute( command );

				}

			}.bind( this ) );
			topContainer.add( newComponent );

		}



		if ( components !== undefined && components.length > 0 ) {

			componentsContainer.setDisplay( 'block' );
			for ( let i = 0; i < components.length; i ++ ) {

				( function ( object, component ) {

					componentsContainer.add( new UIHorizontalRule() );

					const cc = new ComponentContainer( editor, object, component );
					cc.renderer( componentsContainer );



					// 将水平分隔线添加到容器中
					componentsContainer.add( new UIBreak() );

				} )( object, components[ i ] );

			}

		}

	}

	// signals

	signals.objectSelected.add( function ( object ) {

		if ( object !== null && editor.camera !== object ) {

			container.setDisplay( 'block' );

			update();

		} else {

			container.setDisplay( 'none' );

		}

	} );

	signals.componentAdded.add( update );
	signals.componentRemoved.add( update );
	signals.componentChanged.add( update );

	return container;

}

export { SidebarComponent };
