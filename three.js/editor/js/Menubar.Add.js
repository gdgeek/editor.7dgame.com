import * as THREE from 'three';

import { UIPanel, UIRow, UIHorizontalRule } from './libs/ui.js';

import { AddObjectCommand } from './commands/AddObjectCommand.js';
import { MetaFactory } from './mrpp/MetaFactory.js';
import { VerseFactory } from './mrpp/VerseFactory.js';
import { Builder } from './mrpp/Builder.js';


function MenubarAdd( editor ) {

	const factory = new MetaFactory();

	const builder = new Builder();
	const strings = editor.strings;

	// 将resources暴露到window全局对象，以便其他模块能够访问
	const resources = new Map();
	window.resources = resources;

	const container = new UIPanel();

	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/add' ) );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );

	// 存储所有创建的资源菜单项的映射
	const resourceMenuItems = new Map();

	let option = null;

	if ( editor.type.toLowerCase() == 'meta' ) {

		// 更新资源菜单项的可见性
		const updateResourceMenuItems = function(availableTypes) {
			if (!availableTypes || !Array.isArray(availableTypes)) return;

			// 先隐藏所有资源菜单项
			resourceMenuItems.forEach((menuItem) => {
				menuItem.dom.style.display = 'none';
			});

			// 显示可用的资源菜单项
			availableTypes.forEach(type => {
				const menuItem = resourceMenuItems.get(type);
				if (menuItem) {
					menuItem.dom.style.display = 'block';
				}
			});
		};
		const loadResource = async function (data) {
			// 将资源同时保存到本地和全局资源集合
			resources.set( data.id.toString(), data );

			// 添加到editor.resources
			if (!editor.resources) editor.resources = [];

			// 更新或添加资源
			const existingIndex = editor.resources.findIndex(resource =>
				resource && resource.id == data.id
			);

			if (existingIndex >= 0) {
				editor.resources[existingIndex] = data;
			} else {
				editor.resources.push(data);
			}

			// 创建对象
			const raw = builder.resource( data );
			if ( raw ) {
				const node = await factory.building( raw, resources );
				if ( node ) {
					editor.execute( new AddObjectCommand( editor, node ) );
				}
			}
		}
		const loadPhototype = async function (data) {


			const node = await factory.building( builder.phototype(data), resources );
			editor.execute( new AddObjectCommand( editor, node ) );
			console.error('加载phototype:', data);
		}

		editor.signals.messageReceive.add( async function ( params ) {
			switch (params.action) {
				case 'load-resource':
					loadResource( params.data );
					break;
				case 'available-resource-types':
					updateResourceMenuItems( params.data );
					break;
				case 'load-phototype':
					loadPhototype( params.data );
					break;
			}
			/*
			if ( params.action === 'load-resource' ) {
				console.error(params);
				const data = params.data;

				// 将资源同时保存到本地和全局资源集合
				resources.set( data.id.toString(), data );

				// 添加到editor.resources
				if (!editor.resources) editor.resources = [];

				// 更新或添加资源
				const existingIndex = editor.resources.findIndex(resource =>
					resource && resource.id == data.id
				);

				if (existingIndex >= 0) {
					editor.resources[existingIndex] = data;
				} else {
					editor.resources.push(data);
				}

				// 创建对象
				const raw = builder.resource( data );
				if ( raw ) {
					const node = await factory.building( raw, resources );
					if ( node ) {
						editor.execute( new AddObjectCommand( editor, node ) );
					}
				}

			} else if ( params.action === 'available-resource-types' ) {
				updateResourceMenuItems( params.data );
			}
*/
		} );

		// Node
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/node' ) );
		option.onClick( async function () {

			const node = await factory.building( builder.entity(), resources );
			editor.execute( new AddObjectCommand( editor, node ) );

		} );
		options.add( option );

		// Text
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/text' ) );
		option.onClick( async function () {

			const node = await factory.building( builder.text(), resources );
			editor.execute( new AddObjectCommand( editor, node ) );

		} );
		options.add( option );

		// 创建资源类型菜单项的函数
		const createResourceMenuItem = function(resourceType) {
			const menuItem = new UIRow();
			menuItem.setClass( 'option' );
			menuItem.setTextContent( strings.getKey( 'menubar/add/' + resourceType ) );
			menuItem.onClick( async function () {
				editor.signals.messageSend.dispatch(
					{
						action: 'load-resource',
						data: { type: resourceType }
					} );
			} );
			// 存储创建的菜单项
			resourceMenuItems.set(resourceType, menuItem);
			return menuItem;
		};

		// 初始创建所有可能的资源类型菜单项，默认先隐藏
		const allPossibleResourceTypes = ['-', 'voxel', 'polygen', 'audio', 'picture', 'video', 'particle','-','phototype'];
		allPossibleResourceTypes.forEach(type => {
			if (type === '-') {
				options.add(new UIHorizontalRule());
				return;
			}
			const menuItem = createResourceMenuItem(type);
			menuItem.dom.style.display = 'none'; // 默认隐藏
			options.add(menuItem);
		});

		// 请求获取可用的资源类型
		editor.signals.messageSend.dispatch({
			action: 'get-available-resource-types'
		});

		// 如果编辑器已经加载了可用资源类型，立即更新菜单
		if (editor.availableResourceTypes) {
			updateResourceMenuItems(editor.availableResourceTypes);
		}

	} else if ( editor.type.toLowerCase() == 'verse' ) {

		// const factory = new VerseFactory();
		editor.signals.messageReceive.add( async function ( params ) {


			if ( params.action === 'add-module' ) {

				const data = params.data.data;
				const setup = params.data.setup;
				const title = params.data.title;

				console.error( data );

				if ( data.resources ) {

					data.resources.forEach( resource => {

						resources.set( resource.id.toString(), resource );

					} );

				}


				const node = factory.addModule( builder.module( data.id, title ) );

				node.userData.data = JSON.stringify( setup );
				node.userData.custom = data.custom;
				if ( data && data.data ) {
					await factory.readMeta( node, data.data, resources, editor );
				}

				await factory.addGizmo( node );
				editor.execute( new AddObjectCommand( editor, node ) );

			}

		} );


		// Meta
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/meta' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch( {
				action: 'add-meta'
			} );

		} );
		options.add( option );


		// Prefabs
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/prefab' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch(
				{
					action: 'add-prefab'
				} );

		} );
		options.add( option );

	}

	//

	//options.add(new UIHorizontalRule());

	// AmbientLight

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/ambientlight' ) );
	option.onClick( function () {

		const color = 0x222222;

		const light = new THREE.AmbientLight( color );
		light.name = 'AmbientLight';

		editor.execute( new AddObjectCommand( editor, light ) );

	} );
	//options.add(option);

	// DirectionalLight

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/directionallight' ) );
	option.onClick( function () {

		const color = 0xffffff;
		const intensity = 1;

		const light = new THREE.DirectionalLight( color, intensity );
		light.name = 'DirectionalLight';
		light.target.name = 'DirectionalLight Target';

		light.position.set( 5, 10, 7.5 );

		editor.execute( new AddObjectCommand( editor, light ) );

	} );
	//options.add(option);

	// HemisphereLight

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/hemispherelight' ) );
	option.onClick( function () {

		const skyColor = 0x00aaff;
		const groundColor = 0xffaa00;
		const intensity = 1;

		const light = new THREE.HemisphereLight( skyColor, groundColor, intensity );
		light.name = 'HemisphereLight';

		light.position.set( 0, 10, 0 );

		editor.execute( new AddObjectCommand( editor, light ) );

	} );
	//options.add(option);

	// PointLight

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/pointlight' ) );
	option.onClick( function () {

		const color = 0xffffff;
		const intensity = 1;
		const distance = 0;

		const light = new THREE.PointLight( color, intensity, distance );
		light.name = 'PointLight';

		editor.execute( new AddObjectCommand( editor, light ) );

	} );
	//options.add(option);

	// SpotLight

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/spotlight' ) );
	option.onClick( function () {

		const color = 0xffffff;
		const intensity = 1;
		const distance = 0;
		const angle = Math.PI * 0.1;
		const penumbra = 0;

		const light = new THREE.SpotLight( color, intensity, distance, angle, penumbra );
		light.name = 'SpotLight';
		light.target.name = 'SpotLight Target';

		light.position.set( 5, 10, 7.5 );

		editor.execute( new AddObjectCommand( editor, light ) );

	} );
	//options.add(option);

	//

	//options.add(new UIHorizontalRule());

	// OrthographicCamera

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/orthographiccamera' ) );
	option.onClick( function () {

		const aspect = editor.camera.aspect;
		const camera = new THREE.OrthographicCamera( - aspect, aspect );
		camera.name = 'OrthographicCamera';

		editor.execute( new AddObjectCommand( editor, camera ) );

	} );
	//options.add(option);

	// PerspectiveCamera

	option = new UIRow();
	option.setClass( 'option' );
	option.setTextContent( strings.getKey( 'menubar/add/perspectivecamera' ) );
	option.onClick( function () {

		const camera = new THREE.PerspectiveCamera();
		camera.name = 'PerspectiveCamera';

		editor.execute( new AddObjectCommand( editor, camera ) );

	} );
	//options.add(option);

	return container;

}

export { MenubarAdd };
