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

			// 只有当有组件实例时才显示组件标题和内容
			if (components.length > 0) {
				topContainer.setDisplay( 'block' );
				topContainer.add( new UIText( strings.getKey( 'sidebar/components' ).toUpperCase() ) );
			} else {
				// 没有组件时整个容器不显示
				container.setDisplay( 'none' );
				return;
			}

			// 注释掉选择项内容（下拉框和新建按钮）
			/*
			topContainer.add( new UIBreak() );
			topContainer.add( new UIBreak() );

			const label = new UIText( strings.getKey( 'sidebar/components/select' ) ).setWidth( '90px' );
			topContainer.add( label );

			// 创建下拉框
			const select = new UISelect().setWidth( '100px' );
			select.setOptions( {
				'Rotate': strings.getKey( 'sidebar/components/select/rotate' ),
				'Action': strings.getKey( 'sidebar/components/select/action' ),
				'Moved': strings.getKey( 'sidebar/components/select/moved' ),
				'Trigger': strings.getKey('sidebar/components/select/trigger'),
				'Tooltip':strings.getKey('sidebar/components/select/tooltip')
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
			*/
		} else {
			// 没有组件属性时整个容器不显示
			container.setDisplay( 'none' );
			return;
		}

		if ( components !== undefined && components.length > 0 ) {
			container.setDisplay( 'block' );
			componentsContainer.setDisplay( 'block' );
			for ( let i = 0; i < components.length; i ++ ) {

				( function ( object, component ) {

					componentsContainer.add( new UIHorizontalRule() );

					const cc = new ComponentContainer( editor, object, component );
					cc.renderer( componentsContainer );

					componentsContainer.add( new UIBreak() );
				} )( object, components[ i ] );

			}

		} else {
			// 没有组件时整个容器不显示
			container.setDisplay( 'none' );
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
