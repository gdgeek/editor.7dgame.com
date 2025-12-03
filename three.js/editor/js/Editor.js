import * as THREE from 'three';

import { Config } from './Config.js';
import { Loader } from './Loader.js';
import { History as _History } from './History.js';
import { Strings } from './Strings.js';
import { Storage as _Storage } from './Storage.js';
import { DialogUtils } from './utils/DialogUtils.js';

const mapping = {
	'zh-cn': 'zh-cn',
	'en': 'en',
	'ja': 'ja',
	'zh-tw': 'zh-tw',
	'th': 'th'
};
const urlParams = new URLSearchParams( window.location.search );
const lg = urlParams.get( 'language' );

var _DEFAULT_CAMERA = new THREE.PerspectiveCamera( 50, 1, 0.01, 1000 );
_DEFAULT_CAMERA.name = 'Camera';
_DEFAULT_CAMERA.position.set( 0, 5, 10 );
_DEFAULT_CAMERA.lookAt( new THREE.Vector3() );

function Editor() {

	const Signal = signals.Signal;

	this.selector = null;
	this.signals = {
		upload: new Signal(),
		release: new Signal(),
		// script

		editScript: new Signal(),

		// player

		startPlayer: new Signal(),
		stopPlayer: new Signal(),

		// vr

		toggleVR: new Signal(),
		exitedVR: new Signal(),

		// notifications

		editorCleared: new Signal(),

		savingStarted: new Signal(),
		savingFinished: new Signal(),

		transformModeChanged: new Signal(),
		snapChanged: new Signal(),
		spaceChanged: new Signal(),
		rendererCreated: new Signal(),
		rendererUpdated: new Signal(),

		sceneBackgroundChanged: new Signal(),
		sceneEnvironmentChanged: new Signal(),
		sceneFogChanged: new Signal(),
		sceneFogSettingsChanged: new Signal(),
		sceneGraphChanged: new Signal(),
		sceneRendered: new Signal(),

		cameraChanged: new Signal(),
		cameraResetted: new Signal(),

		geometryChanged: new Signal(),

		objectSelected: new Signal(),
		objectFocused: new Signal(),

		objectAdded: new Signal(),
		objectChanged: new Signal(),
		objectRemoved: new Signal(),
		objectsChanged: new Signal(), // 多个对象同时变化的信号

		cameraAdded: new Signal(),
		cameraRemoved: new Signal(),

		helperAdded: new Signal(),
		helperRemoved: new Signal(),

		materialAdded: new Signal(),
		materialChanged: new Signal(),
		materialRemoved: new Signal(),

		scriptAdded: new Signal(),
		scriptChanged: new Signal(),
		scriptRemoved: new Signal(),

		componentAdded: new Signal(),
		componentChanged: new Signal(),
		componentRemoved: new Signal(),

		eventAdded: new Signal(),
		eventChanged: new Signal(),
		eventRemoved: new Signal(),

		commandAdded: new Signal(),
		commandChanged: new Signal(),
		commandRemoved: new Signal(),

		windowResize: new Signal(),

		showGridChanged: new Signal(),
		showHelpersChanged: new Signal(),
		refreshSidebarObject3D: new Signal(),
		historyChanged: new Signal(),

		viewportCameraChanged: new Signal(),

		messageSend: new Signal(),
		messageReceive: new Signal(),

		notificationAdded: new Signal(),

		doneLoadObject: new Signal(),

		// 场景树多选相关
		multiSelectGroup: null,
		multipleObjectsTransformChanged: new Signal() // 多选对象变换变化信号
	};

	this.config = new Config();
	this.history = new _History( this );
	this.storage = new _Storage();

	if ( lg && mapping[ lg ] ) {

		this.config.setKey( 'language', mapping[ lg ] );

	}

	this.strings = new Strings( this.config );

	this.loader = new Loader( this );

	this.camera = _DEFAULT_CAMERA.clone();

	this.scene = new THREE.Scene();
	this.scene.name = 'Scene';

	this.sceneHelpers = new THREE.Scene();

	this.object = {};
	this.geometries = {};
	this.materials = {};
	this.textures = {};
	this.scripts = {};

	this.materialsRefCounter = new Map(); // tracks how often is a material used by a 3D object

	this.mixer = new THREE.AnimationMixer( this.scene );

	this.selected = null;
	this.selectedObjects = []; // 存储多选对象
	this.helpers = {};

	this.cameras = {};
	this.viewportCamera = this.camera;

	this.addCamera( this.camera );

	this.type = '';
	this.resources = []; // 保存场景中的资源信息

}

Editor.prototype = {
	setScene: function ( scene ) {

		this.scene.uuid = scene.uuid;
		this.scene.name = scene.name;

		this.scene.background = scene.background;
		this.scene.environment = scene.environment;
		this.scene.fog = scene.fog;

		this.scene.userData = JSON.parse( JSON.stringify( scene.userData ) );

		// 初始化场景中所有对象的 commands 数组
		scene.traverse(function(object) {
			if (object.commands === undefined) {
				object.commands = [];
			}
		});

		// avoid render per object

		this.signals.sceneGraphChanged.active = false;

		while ( scene.children.length > 0 ) {

			this.addObject( scene.children[ 0 ] );

		}

		this.signals.sceneGraphChanged.active = true;
		this.signals.sceneGraphChanged.dispatch();

	},

	//

	addObject: function ( object, parent, index ) {
		// 保存原始type
		const originalType = object.type;

		// 初始化 commands 数组
		if (object.commands === undefined) {
			object.commands = [];
		}

		// 现有的addObject逻辑
		var scope = this;
		object.traverse(function (child) {
			if (child.geometry !== undefined) scope.addGeometry(child.geometry);
			if (child.material !== undefined) scope.addMaterial(child.material);
			scope.addCamera(child);
			scope.addHelper(child);
		});

		// 恢复type
		object.type = originalType;

		// 添加到指定的父级，如果没有父级则添加到场景中
		if (parent !== undefined) {
			// 如果指定了索引，则在父级的特定位置插入
			if (index !== undefined) {
				parent.children.splice(index, 0, object);
				object.parent = parent;
			} else {
				parent.add(object);
			}
		} else {
			this.scene.add(object);
		}

		// 如果是新加入的对象，检查它是否有资源信息并添加到全局resources
		if (object.userData && object.userData.resource && window.resources) {
			const resourceId = object.userData.resource;

			// 确保资源数据在editor.resources和window.resources之间同步
			const resourceData = window.resources.get(resourceId.toString());
			if (resourceData) {
				// 查找并更新或添加到editor.resources
				const existingIndex = this.resources.findIndex(res =>
					res && res.id === parseInt(resourceId)
				);

				if (existingIndex >= 0) {
					this.resources[existingIndex] = resourceData;
				} else {
					this.resources.push(resourceData);
				}
			}
		}

		this.signals.objectAdded.dispatch(object);
		this.signals.sceneGraphChanged.dispatch();
	},

	moveObject: function ( object, parent, before ) {

		if ( parent === undefined ) {

			parent = this.scene;

		}

		parent.add( object );

		// sort children array

		if ( before !== undefined ) {

			var index = parent.children.indexOf( before );
			parent.children.splice( index, 0, object );
			parent.children.pop();

		}

		this.signals.sceneGraphChanged.dispatch();

	},

	nameObject: function ( object, name ) {

		object.name = name;
		this.signals.sceneGraphChanged.dispatch();

	},

	removeObject: function ( object ) {

		if ( object.parent === null ) return; // avoid deleting the camera or scene

		var scope = this;

		object.traverse( function ( child ) {

			scope.removeCamera( child );
			scope.removeHelper( child );

			if ( child.material !== undefined ) scope.removeMaterial( child.material );

		} );

		object.parent.remove( object );

		// 从selectedObjects数组中移除
		const index = this.selectedObjects.indexOf(object);
		if (index !== -1) {
			this.selectedObjects.splice(index, 1);

			// 如果当前主选中对象被移除，更新主选中对象
			if (this.selected === object) {
				this.selected = this.selectedObjects.length > 0 ?
					this.selectedObjects[this.selectedObjects.length - 1] : null;
				this.signals.objectSelected.dispatch(this.selected);
			}
		}

		this.signals.objectRemoved.dispatch( object );
		this.signals.sceneGraphChanged.dispatch();

	},

	addGeometry: function ( geometry ) {

		this.geometries[ geometry.uuid ] = geometry;

	},

	setGeometryName: function ( geometry, name ) {

		geometry.name = name;
		this.signals.sceneGraphChanged.dispatch();

	},

	addMaterial: function ( material ) {

		if ( Array.isArray( material ) ) {

			for ( var i = 0, l = material.length; i < l; i ++ ) {

				this.addMaterialToRefCounter( material[ i ] );

			}

		} else {

			this.addMaterialToRefCounter( material );

		}

		this.signals.materialAdded.dispatch();

	},

	addMaterialToRefCounter: function ( material ) {

		var materialsRefCounter = this.materialsRefCounter;

		var count = materialsRefCounter.get( material );

		if ( count === undefined ) {

			materialsRefCounter.set( material, 1 );
			this.materials[ material.uuid ] = material;

		} else {

			count ++;
			materialsRefCounter.set( material, count );

		}

	},

	removeMaterial: function ( material ) {

		if ( Array.isArray( material ) ) {

			for ( var i = 0, l = material.length; i < l; i ++ ) {

				this.removeMaterialFromRefCounter( material[ i ] );

			}

		} else {

			this.removeMaterialFromRefCounter( material );

		}

		this.signals.materialRemoved.dispatch();

	},

	removeMaterialFromRefCounter: function ( material ) {

		var materialsRefCounter = this.materialsRefCounter;

		var count = materialsRefCounter.get( material );
		count --;

		if ( count === 0 ) {

			materialsRefCounter.delete( material );
			delete this.materials[ material.uuid ];

		} else {

			materialsRefCounter.set( material, count );

		}

	},

	getMaterialById: function ( id ) {

		var material;
		var materials = Object.values( this.materials );

		for ( var i = 0; i < materials.length; i ++ ) {

			if ( materials[ i ].id === id ) {

				material = materials[ i ];
				break;

			}

		}

		return material;

	},

	setMaterialName: function ( material, name ) {

		material.name = name;
		this.signals.sceneGraphChanged.dispatch();

	},

	addTexture: function ( texture ) {

		this.textures[ texture.uuid ] = texture;

	},

	//

	addCamera: function ( camera ) {

		if ( camera.isCamera ) {

			this.cameras[ camera.uuid ] = camera;

			this.signals.cameraAdded.dispatch( camera );

		}

	},

	removeCamera: function ( camera ) {

		if ( this.cameras[ camera.uuid ] !== undefined ) {

			delete this.cameras[ camera.uuid ];

			this.signals.cameraRemoved.dispatch( camera );

		}

	},

	//

	addHelper: ( function () {

		var geometry = new THREE.SphereGeometry( 2, 4, 2 );
		var material = new THREE.MeshBasicMaterial( {
			color: 0xff0000,
			visible: false
		} );

		return function ( object, helper ) {

			if ( helper === undefined ) {

				if ( object.isCamera ) {

					helper = new THREE.CameraHelper( object );

				} else if ( object.isPointLight ) {

					helper = new THREE.PointLightHelper( object, 1 );

				} else if ( object.isDirectionalLight ) {

					helper = new THREE.DirectionalLightHelper( object, 1 );

				} else if ( object.isSpotLight ) {

					helper = new THREE.SpotLightHelper( object );

				} else if ( object.isHemisphereLight ) {

					helper = new THREE.HemisphereLightHelper( object, 1 );

				} else if ( object.isSkinnedMesh ) {

					helper = new THREE.SkeletonHelper( object.skeleton.bones[ 0 ] );

				} else if ( object.isBone === true && object.parent?.isBone !== true ) {

					helper = new THREE.SkeletonHelper( object );

				} else {

					// no helper for this object type
					return;

				}

				const picker = new THREE.Mesh( geometry, material );
				picker.name = 'picker';
				picker.userData.object = object;
				helper.add( picker );

			}

			this.sceneHelpers.add( helper );
			this.helpers[ object.id ] = helper;

			this.signals.helperAdded.dispatch( helper );

		};

	} )(),

	removeHelper: function ( object ) {

		if ( this.helpers[ object.id ] !== undefined ) {

			var helper = this.helpers[ object.id ];
			helper.parent.remove( helper );

			delete this.helpers[ object.id ];

			this.signals.helperRemoved.dispatch( helper );

		}

	},

	//

	addScript: function ( object, script ) {

		if ( this.scripts[ object.uuid ] === undefined ) {

			this.scripts[ object.uuid ] = [];

		}

		this.scripts[ object.uuid ].push( script );

		this.signals.scriptAdded.dispatch( script );

	},

	removeScript: function ( object, script ) {

		if ( this.scripts[ object.uuid ] === undefined ) return;

		var index = this.scripts[ object.uuid ].indexOf( script );

		if ( index !== - 1 ) {

			this.scripts[ object.uuid ].splice( index, 1 );

		}

		this.signals.scriptRemoved.dispatch( script );

	},

	getObjectMaterial: function ( object, slot ) {

		var material = object.material;

		if ( Array.isArray( material ) && slot !== undefined ) {

			material = material[ slot ];

		}

		return material;

	},

	setObjectMaterial: function ( object, slot, newMaterial ) {

		if ( Array.isArray( object.material ) && slot !== undefined ) {

			object.material[ slot ] = newMaterial;

		} else {

			object.material = newMaterial;

		}

	},

	setViewportCamera: function ( uuid ) {

		this.viewportCamera = this.cameras[ uuid ];
		this.signals.viewportCameraChanged.dispatch();

	},

	//

	select: function ( object, multiSelect ) {

		if ( this.selector != null ) {

			while ( object != null && ! this.selector( object ) ) {

				object = object.parent;

			}

		}

		if (multiSelect) {
			// 多选模式
			if (object === null) {
				// 如果传入null且是多选模式，保持当前选择不变
				return;
			}

			const index = this.selectedObjects.indexOf(object);

			if (index === -1) {
				// 添加到选中对象数组，即使是缺失资源的对象
				this.selectedObjects.push(object);

				// 更新主选中对象
				this.selected = object;
			} else {
				// 如果已选中，则从数组中移除（切换选择状态）
				this.selectedObjects.splice(index, 1);

				// 更新主选中对象为最后一个选中的对象，如果没有则为null
				this.selected = this.selectedObjects.length > 0 ?
					this.selectedObjects[this.selectedObjects.length - 1] : null;
			}
		} else {
			// 单选模式 - 清空多选数组
			this.selectedObjects.length = 0;

			if (object !== null) {
				this.selectedObjects.push(object);
			}

			if ( this.selected === object ) {
				return;
		}

		this.selected = object;
		}

		let uuid = null;

		if ( object !== null ) {
			uuid = object.uuid;
		}

		this.config.setKey( 'selected', uuid );
		this.signals.objectSelected.dispatch( object );
	},

	selectById: function ( id ) {

		if ( id === this.camera.id ) {

			this.select( this.camera );
			return;

		}

		this.select( this.scene.getObjectById( id ) );

	},

	selectByUuid: function ( uuid ) {

		var scope = this;

		this.scene.traverse( function ( child ) {

			if ( child.uuid === uuid ) {

				scope.select( child );

			}

		} );

	},

	deselect: function () {

		this.select( null );

	},

	focus: function ( object ) {

		if ( object !== undefined ) {

			this.signals.objectFocused.dispatch( object );

		}

	},

	focusById: function ( id ) {

		this.focus( this.scene.getObjectById( id ) );

	},

	clear: function () {

		this.history.clear();
		this.storage.clear();

		this.camera.copy( _DEFAULT_CAMERA );
		this.signals.cameraResetted.dispatch();

		this.scene.name = 'Scene';
		this.scene.userData = {};
		this.scene.background = null;
		this.scene.environment = null;
		this.scene.fog = null;

		var objects = this.scene.children;

		while ( objects.length > 0 ) {

			this.removeObject( objects[ 0 ] );

		}

		this.geometries = {};
		this.materials = {};
		this.textures = {};
		this.scripts = {};

		this.materialsRefCounter.clear();

		this.animations = {};
		this.mixer.stopAllAction();

		this.deselect();
		this.selectedObjects.length = 0; // 清空多选数组

		this.signals.editorCleared.dispatch();

	},

	//

	fromJSON: async function ( json ) {

		var loader = new THREE.ObjectLoader();
		var camera = await loader.parseAsync( json.camera );

		this.camera.copy( camera );
		this.signals.cameraResetted.dispatch();

		this.history.fromJSON( json.history );
		this.scripts = json.scripts;

		this.setScene( await loader.parseAsync( json.scene ) );

		// 保存资源信息
		if (json.resources !== undefined) {
			this.resources = json.resources;
		}

	},

	toJSON: function () {

		// scripts clean up

		var scene = this.scene;
		var scripts = this.scripts;

		for ( var key in scripts ) {

			var script = scripts[ key ];

			if (
				script.length === 0 ||
				scene.getObjectByProperty( 'uuid', key ) === undefined
			) {

				delete scripts[ key ];

			}

		}

		//

		return {
			metadata: {},
			project: {
				shadows: this.config.getKey( 'project/renderer/shadows' ),
				shadowType: this.config.getKey( 'project/renderer/shadowType' ),
				vr: this.config.getKey( 'project/vr' ),
				physicallyCorrectLights: this.config.getKey(
					'project/renderer/physicallyCorrectLights'
				),
				toneMapping: this.config.getKey( 'project/renderer/toneMapping' ),
				toneMappingExposure: this.config.getKey(
					'project/renderer/toneMappingExposure'
				)
			},
			camera: this.camera.toJSON(),
			scene: this.scene.toJSON(),
			scripts: this.scripts,
			history: this.history.toJSON(),
			resources: this.resources // 保存资源信息
		};

	},

	objectByUuid: function ( uuid ) {

		return this.scene.getObjectByProperty( 'uuid', uuid, true );

	},

	execute: function ( cmd, optionalName ) {

		this.history.execute( cmd, optionalName );

	},

	undo: function () {

		this.history.undo();

	},

	redo: function () {

		this.history.redo();

	},

	showNotification: function (message, isError) {
		console.log('显示通知:', message);

		// 使用 DialogUtils 显示提示框
		DialogUtils.showMessage(message, isError);

		// 同时触发通知信号，保持兼容性
		this.signals.notificationAdded.dispatch(message);
	},

	showConfirmation: function (message, onConfirm, onCancel, event, isError = false) {
		console.log('显示确认框:', message);

		// 使用 DialogUtils 显示确认框
		DialogUtils.showConfirm(message, onConfirm, onCancel, event, isError);
	},

	// 获取所有当前选中的对象
	getSelectedObjects: function () {
		// 确保返回所有选中对象，包括通过Shift+范围选择的对象

		// 如果使用DOM直接检查UI中选中的元素，获取更准确的多选结果
		const outlinerElement = document.getElementById('outliner');
		if (outlinerElement) {
			const activeElements = outlinerElement.querySelectorAll('.option.active');

			if (activeElements.length > 0) {
				const selectedObjects = [];

				for (let i = 0; i < activeElements.length; i++) {
					const objectId = parseInt(activeElements[i].value);
					if (!isNaN(objectId)) {
						const object = this.scene.getObjectById(objectId) ||
									  (this.camera.id === objectId ? this.camera : null);

						if (object) {
							selectedObjects.push(object);
						}
					}
				}

				// 只有在UI中找到选中对象时才返回，否则回退到内部数组
				if (selectedObjects.length > 0) {
					return selectedObjects;
				}
			}
		}

		// 回退到内部数组
		return this.selectedObjects.slice();
	},

	// 清空所有选中的对象
	clearSelection: function () {
		this.selectedObjects.length = 0;
		this.selected = null;
		this.signals.objectSelected.dispatch(null);
	},

};

export { Editor };
