import { UIPanel, UINumber, UIBreak, UIText, UIButton, UIRow, UIInput, UIHorizontalRule } from '../libs/ui.js';
import { RemoveComponentCommand } from '../commands/RemoveComponentCommand.js';

import { RotateComponent } from './components/RotateComponent.js';
import { ActionComponent } from './components/ActionComponent.js';
import { MovedComponent } from './components/MovedComponent.js';
import { TriggerComponent } from './components/TriggerComponent.js';
import { TooltipComponent } from './components/TooltipComponent.js';

class ComponentContainer {

	static Create( type, editor ) {

		switch ( type.toLowerCase() ) {

			case 'rotate':
				return RotateComponent.Create();
			case 'action':
				return ActionComponent.Create();
			case 'moved':
				return MovedComponent.Create();
			case 'trigger':
				return TriggerComponent.Create();
			case 'tooltip':
				return TooltipComponent.Create(editor);

		}
		// return {}

	}

	constructor( editor, object, component ) {

		this.editor = editor;
		this.object = object;
		this.component = component;
		switch ( component.type.toLowerCase() ) {

			case 'rotate':
				this.handler = new RotateComponent( editor, object, component );
				break;
			case 'action':
				this.handler = new ActionComponent( editor, object, component );
				break;
			case 'moved':
				this.handler = new MovedComponent( editor, object, component );
				break;
			case 'trigger':
				this.handler = new TriggerComponent( editor, object, component );
				break;
			case 'tooltip':
				this.handler = new TooltipComponent( editor, object, component );
				break;
			default:
				console.error( 'ComponentContainer: Unknown component type.' );

		}

	}

	renderer( container ) {

		const strings = this.editor.strings;
		if (this.component.type && this.component.type.toLowerCase() === 'tooltip') {
			container.add( new UIText('Label') );
		} else {
			container.add( new UIText( this.component.type ) );
		}

		if ( this.handler != undefined ) {

			this.handler.renderer( container );

		}

		const remove = new UIButton( strings.getKey( 'sidebar/script/remove' ) );
		remove.setMarginLeft( '4px' );
		remove.onClick( function (event) {
			this.editor.showConfirmation(strings.getKey('sidebar/components/remove/confirm'),
				function() {
					this.editor.execute(new RemoveComponentCommand(this.editor, this.object, this.component));
				}.bind(this),
				null,
				event,
				true
			);
		}.bind(this));
		container.add(remove);
		container.add(new UIBreak());

	}

}
export { ComponentContainer };
