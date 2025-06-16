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

	// 定义互斥组件类型
	const mutuallyExclusiveTypes = ['Action', 'Moved', 'Trigger'];

	// 添加组件选择容器
	const addComponentContainer = new UIRow();
	container.add( addComponentContainer );

	// 组件实例容器
	const componentsContainer = new UIRow();
	container.add( componentsContainer );

	function update() {

		topContainer.clear();
		topContainer.setDisplay( 'none' );
		componentsContainer.clear();
		componentsContainer.setDisplay( 'none' );
		addComponentContainer.clear();
		addComponentContainer.setDisplay( 'none' );

		const object = editor.selected;

		if ( object === null ) {
			return;
		}

		// 确保对象有components属性
		if ( object.components === undefined ) {
			object.components = [];
		}

		topContainer.setDisplay( 'block' );
		componentsContainer.setDisplay( 'block' );
		addComponentContainer.setDisplay( 'block' );
		container.setDisplay( 'block' );

		// 显示组件标题
		topContainer.add( new UIText( strings.getKey( 'sidebar/components' ).toUpperCase() ) );

		// 添加新组件的界面
		addComponentContainer.add( new UIBreak() );

		const label = new UIText( strings.getKey( 'sidebar/components/select' ) ).setWidth( '90px' );
		addComponentContainer.add( label );

		// 创建下拉框
		const select = new UISelect().setWidth( '100px' );
		select.setOptions( {
			'Rotate': strings.getKey( 'sidebar/components/select/rotate' ),
			'Action': strings.getKey( 'sidebar/components/select/action' ),
			'Moved': strings.getKey( 'sidebar/components/select/moved' ),
			'Trigger': strings.getKey('sidebar/components/select/trigger'),
			'Tooltip': strings.getKey('sidebar/components/select/tooltip')
		} );
		select.setValue( 'Rotate' );
		addComponentContainer.add( select );

		const newComponent = new UIButton( strings.getKey( 'sidebar/components/select/button' ) );
		newComponent.onClick( function () {
			const selectedType = select.getValue();

			// 检查互斥组件
			if (mutuallyExclusiveTypes.includes(selectedType)) {
				// 检查是否已经存在互斥组件
				let hasExclusiveComponent = false;
				let existingType = null;

				for (let i = 0; i < object.components.length; i++) {
					const compType = object.components[i].type;
					if (mutuallyExclusiveTypes.includes(compType) && compType !== selectedType) {
						hasExclusiveComponent = true;
						existingType = compType;
						break;
					}
				}

				if (hasExclusiveComponent) {
					// 已存在互斥组件，显示提示信息
					editor.showNotification(
						strings.getKey('menubar/component/mutually_exclusive') ||
						'只能选择一个互斥组件：点击触发、可移动或碰撞触发',
						true
					);
					return;
				}
			}

			const component = ComponentContainer.Create( selectedType, editor );

			if ( component !== undefined ) {
				const command = new AddComponentCommand( editor, editor.selected, component );
				editor.execute( command );

				const successMessage = strings.getKey('menubar/component/success').replace('{0}', select.getSelectedHtml());
				editor.showNotification(successMessage, false);
			}
		} );
		addComponentContainer.add( newComponent );

		// 更新下拉框中互斥组件的可用性
		updateMutuallyExclusiveOptions(select, object.components);

		if ( object.components.length > 0 ) {
			// 显示已有组件列表
			componentsContainer.setDisplay( 'block' );

			for ( let i = 0; i < object.components.length; i ++ ) {
				( function ( object, component ) {
					componentsContainer.add( new UIHorizontalRule() );
					const cc = new ComponentContainer( editor, object, component );
					cc.renderer( componentsContainer );
					componentsContainer.add( new UIBreak() );
				} )( object, object.components[ i ] );
			}
		}
	}

	// 更新互斥组件选项的可用状态
	function updateMutuallyExclusiveOptions(select, components) {
		if (!components) return;

		// 检查是否已存在互斥组件
		let existingExclusiveType = null;

		for (let i = 0; i < components.length; i++) {
			const compType = components[i].type;
			if (mutuallyExclusiveTypes.includes(compType)) {
				existingExclusiveType = compType;
				break;
			}
		}

		// 获取下拉选项的DOM元素
		const options = select.dom.options;

		// 更新互斥组件的可用状态
		if (existingExclusiveType) {
			for (let i = 0; i < options.length; i++) {
				const optionValue = options[i].value;
				if (mutuallyExclusiveTypes.includes(optionValue) && optionValue !== existingExclusiveType) {
					// 禁用其他互斥组件选项
					options[i].disabled = true;
					options[i].style.color = '#888';
				} else {
					// 启用非互斥组件选项
					options[i].disabled = false;
					options[i].style.color = '';
				}
			}
		} else {
			// 启用所有选项
			for (let i = 0; i < options.length; i++) {
				options[i].disabled = false;
				options[i].style.color = '';
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
