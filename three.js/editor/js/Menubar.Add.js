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

	const resources = new Map();
	const container = new UIPanel();

	container.setClass( 'menu' );

	const title = new UIPanel();
	title.setClass( 'title' );
	title.setTextContent( strings.getKey( 'menubar/add' ) );
	container.add( title );

	const options = new UIPanel();
	options.setClass( 'options' );
	container.add( options );


	let option = null;

	if ( editor.type.toLowerCase() == 'meta' ) {

		editor.signals.messageReceive.add( async function ( params ) {

			if ( params.action === 'load-resource' ) {


				const data = params.data;
				//data.src = convertToHttps(data.src)
				console.error( data.src );
				resources.set( data.id.toString(), data );

				const raw = builder.resource( data );

				if ( raw ) {

					const node = await factory.building( raw, resources );
					if ( node ) {

						editor.execute( new AddObjectCommand( editor, node ) );

					}

				}

			}

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


		// Voxel
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/voxel' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch(
				{
					action: 'load-resource',
					data: { type: 'voxel' }
				} );

		} );
		options.add( option );



		// Polygen
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/polygen' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch( {
				action: 'load-resource',
				data: { type: 'polygen' }
			} );

		} );
		options.add( option );


		// Audio
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/audio' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch(
				{
					action: 'load-resource',
					data: { type: 'audio' }
				} );

		} );
		options.add( option );


		// Picture
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/picture' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch(
				{
					action: 'load-resource',
					data: { type: 'picture' }
				} );

		} );
		options.add( option );


		// Video
		option = new UIRow();
		option.setClass( 'option' );
		option.setTextContent( strings.getKey( 'menubar/add/video' ) );
		option.onClick( async function () {

			editor.signals.messageSend.dispatch(
				{
					action: 'load-resource',
					data: { type: 'video' }
				} );

		} );
		options.add( option );

	} else if ( editor.type.toLowerCase() == 'verse' ) {

		//const factory = new VerseFactory();
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

					await factory.readMeta( node, JSON.parse( data.data ), resources, editor );

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
