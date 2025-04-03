import * as THREE from 'three';

import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';

import { AddObjectCommand } from './commands/AddObjectCommand.js';
import { RemoveObjectCommand } from './commands/RemoveObjectCommand.js';
import { MetaFactory } from './mrpp/MetaFactory.js';
import { Builder } from './mrpp/Builder.js';


function MenubarReplace( editor ) {

	const factory = new MetaFactory();
	const builder = new Builder();
	const strings = editor.strings;

	const resources = new Map();
	const container = new UIPanel();

	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/replace' ) );
	container.add( title );

	// 初始隐藏替换菜单
	container.dom.style.display = 'none';

	if ( editor.type.toLowerCase() == 'meta' ) {

		// 记录当前选中对象的类型
		let selectedObjectType = '';

		// 监听选择事件，检查当前选中的对象类型
		editor.signals.objectSelected.add( function ( object ) {
			selectedObjectType = '';

			if (!object) {
				container.dom.style.display = 'none';
				return;
			}

			// 检查是否为Polygen类型
			const isPolygen = object && (
				( object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'polygen' ) ||
				( object.name && object.name.toLowerCase().includes( '[polygen]' ) )
			);

			// 检查是否为Voxel类型
			const isVoxel = object && (
				( object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'voxel' ) ||
				( object.name && object.name.toLowerCase().includes( '[voxel]' ) )
			);

			// 检查是否为Picture类型
			const isPicture = object && (
				( object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'picture' ) ||
				( object.name && object.name.toLowerCase().includes( '[picture]' ) )
			);

			// 检查是否为Sound类型
			const isSound = object && (
				( object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'sound' ) ||
				( object.name && object.name.toLowerCase().includes( '[sound]' ) )
			);

			// 检查是否为Video类型
			const isVideo = object && (
				( object.userData && object.userData.type && object.userData.type.toLowerCase && object.userData.type.toLowerCase() === 'video' ) ||
				( object.name && object.name.toLowerCase().includes( '[video]' ) )
			);

			// 设置当前选中对象类型
			if (isPolygen) {
				selectedObjectType = 'polygen';
				container.dom.style.display = '';
			} else if (isVoxel) {
				selectedObjectType = 'voxel';
				container.dom.style.display = '';
			} else if (isPicture) {
				selectedObjectType = 'picture';
				container.dom.style.display = '';
			}  else if (isSound) {
				selectedObjectType = 'audio';
				container.dom.style.display = '';
			} else if (isVideo) {
				selectedObjectType = 'video';
				container.dom.style.display = '';
			} else {
				container.dom.style.display = 'none';
			}
		} );

		// 当取消选择时隐藏菜单
		editor.signals.objectFocused.add( function ( object ) {
			if ( !object ) {
				container.dom.style.display = 'none';
				selectedObjectType = '';
			}
		} );

		editor.signals.messageReceive.add( async function ( params ) {

			if ( params.action === 'replace-resource' ) {

				const data = params.data;
				resources.set( data.id.toString(), data );

				const raw = builder.resource( data );

				if ( raw ) {

					const node = await factory.building( raw, resources );
					if ( node ) {
						const selected = editor.selected;
						if (selected) {
							console.log('替换前的旧对象:', selected);
							console.log('替换用的新对象:', node);

							// 保存旧对象的所有属性
							const position = selected.position.clone();
							const rotation = selected.rotation.clone();
							const scale = selected.scale.clone();
							const parent = selected.parent;
							const uuid = selected.uuid;
							const name = selected.name;

							const components = selected.components ? [...selected.components] : [];
							const commands = selected.commands ? [...selected.commands] : [];

							// 需要继承的子对象
							// const childrenToInherit = [];
							// selected.children.forEach(child => {
							// 	if (child.type !== 'Object3D') {
							// 		childrenToInherit.push(child.clone());
							// 	}
							// });

							// 删除旧对象
							editor.execute( new RemoveObjectCommand( editor, selected ) );

							// 应用旧对象的基本属性到新对象
							node.position.copy( position );
							node.rotation.copy( rotation );
							node.scale.copy( scale );
							node.uuid = uuid;
							node.name = name;

							node.components = components;
							node.commands = commands;

							// 添加继承的子对象
							// childrenToInherit.forEach(child => {
							// 	node.add(child);
							// });

							const cmd = new AddObjectCommand( editor, node );

							cmd.execute = function() {
								editor.addObject(node, parent);
								editor.select(node);
							};
							// 执行修改后的命令
							editor.execute( cmd );

							editor.showNotification(strings.getKey( 'menubar/replace/success' ), false);
						}
					}
				}
			}
		} );

		// 点击替换菜单标题直接触发替换操作
		title.onClick( function () {
			const selected = editor.selected;
			if ( selected && selectedObjectType ) {
				editor.signals.messageSend.dispatch( {
					action: 'replace-resource',
					data: {
						type: selectedObjectType,
						target: selected.uuid
					}
				} );
			}
		} );
	}

	return container;
}

export { MenubarReplace };
