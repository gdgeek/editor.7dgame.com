import * as THREE from 'three';

import { Config } from './Config.js';
import { Loader } from './Loader.js';
import { History as _History } from './History.js';
import { Strings } from './Strings.js';
import { Storage as _Storage } from './Storage.js';

const mapping = {
	'zh-cn': 'zh',
	'en': 'en',
	'ja': 'ja'
};
const urlParams = new URLSearchParams( window.location.search );
const lg = urlParams.get( 'language' );


var _DEFAULT_CAMERA = new THREE.PerspectiveCamera( 50, 1, 0.01, 1000 );
_DEFAULT_CAMERA.name = 'Camera';
_DEFAULT_CAMERA.position.set( 0, 5, 10 );
_DEFAULT_CAMERA.lookAt( new THREE.Vector3() );

function Editor() {

	var Signal = signals.Signal;

	this.selector = null;
	this.signals = {
		upload: new Signal(),
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

		notificationAdded: new Signal()
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
	this.helpers = {};

	this.cameras = {};
	this.viewportCamera = this.camera;

	this.addCamera( this.camera );

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

	addObject: function ( object ) {
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

		this.scene.add(object);
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

	select: function ( object ) {

		if ( this.selector != null ) {

			while ( object != null && ! this.selector( object ) ) {

				object = object.parent;

			}

		}

		if ( this.selected === object ) {

			return;

		}

		var uuid = null;

		if ( object !== null ) {
			// 确保选中的对象有 commands 数组
			if (object.commands === undefined) {
				object.commands = [];
			}

			uuid = object.uuid;

		}

		this.selected = object;

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
			history: this.history.toJSON()
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

		// 创建临时通知元素
		const tempNotification = document.createElement('div');
		tempNotification.style.position = 'fixed';
		tempNotification.style.bottom = '20px';
		tempNotification.style.right = '20px';
		tempNotification.style.backgroundColor = isError ? 'rgba(255, 0, 0, 0.8)' : 'rgb(67, 166, 70, 0.8)';
		tempNotification.style.color = '#fff';
		tempNotification.style.padding = '10px 15px';
		tempNotification.style.borderRadius = '4px';
		tempNotification.style.zIndex = '10000';
		tempNotification.style.fontFamily = 'Arial, sans-serif';
		tempNotification.style.fontSize = '14px';
		tempNotification.style.transition = 'opacity 0.3s';
		tempNotification.style.opacity = '1';
		tempNotification.style.cursor = 'pointer';
		tempNotification.textContent = message;
		document.body.appendChild(tempNotification);

		// 添加点击事件，点击通知可以关闭它
		tempNotification.addEventListener('click', function() {
			tempNotification.style.opacity = '0';
			setTimeout(function() {
				if (document.body.contains(tempNotification)) {
					document.body.removeChild(tempNotification);
				}
			}, 300);
		});

		// 3秒后自动淡出并移除临时通知
		setTimeout(function() {
			tempNotification.style.opacity = '0';
			setTimeout(function() {
				if (document.body.contains(tempNotification)) {
					document.body.removeChild(tempNotification);
				}
			}, 300);
		}, 3000);

		// 同时触发通知信号，保持兼容性
		this.signals.notificationAdded.dispatch(message);
	},

	showConfirmation: function (message, onConfirm, onCancel, event) {
		console.log('显示确认框:', message);

		// 创建确认通知元素
		const confirmNotification = document.createElement('div');
		confirmNotification.style.position = 'fixed';
		confirmNotification.style.backgroundColor = 'var(--popconfirm-bg, rgba(50, 50, 50, 0.95))';
		confirmNotification.style.color = 'var(--popconfirm-text, #fff)';
		confirmNotification.style.padding = '12px';
		confirmNotification.style.borderRadius = '6px';
		confirmNotification.style.zIndex = '10000';
		confirmNotification.style.fontFamily = 'Arial, sans-serif';
		confirmNotification.style.fontSize = '14px';
		confirmNotification.style.boxShadow = '0 3px 6px -4px rgba(0,0,0,0.12), 0 6px 16px 0 rgba(0,0,0,0.08)';
		confirmNotification.style.minWidth = '200px';
		confirmNotification.style.maxWidth = '250px';

		// 创建箭头元素
		const arrow = document.createElement('div');
		arrow.style.position = 'absolute';
		arrow.style.width = '8px';
		arrow.style.height = '8px';
		arrow.style.backgroundColor = 'var(--popconfirm-bg, rgba(50, 50, 50, 0.95))';
		arrow.style.transform = 'rotate(45deg)';
		arrow.style.zIndex = '9999';
		confirmNotification.appendChild(arrow);

		// 根据点击事件计算位置
		if (event) {
			// 获取点击位置
			const rect = event.target.getBoundingClientRect();
			const arrowGap = 13; // 箭头到按钮的距离

			// 默认显示在按钮下方
			const buttonCenterX = rect.left + (rect.width / 2);
			confirmNotification.style.left = (buttonCenterX - 28) + 'px';
			confirmNotification.style.top = (rect.bottom + arrowGap) + 'px';

			// 设置箭头位置为弹出框中间，指向上
			arrow.style.left = '28px';
			arrow.style.top = '-4px';
			arrow.style.bottom = 'auto';

			// 检查是否会超出视窗边界并调整位置
			setTimeout(() => {
				const notificationRect = confirmNotification.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// 如果会超出右边界，向左偏移
				if (notificationRect.right > viewportWidth) {
					const leftOffset = viewportWidth - notificationRect.width - 10;
					confirmNotification.style.left = leftOffset + 'px';
					// 调整箭头位置
					const arrowLeft = buttonCenterX - leftOffset - 4;
					arrow.style.left = Math.max(8, Math.min(notificationRect.width - 8, arrowLeft)) + 'px';
				}

				// 如果会超出左边界，向右偏移
				if (notificationRect.left < 10) {
					confirmNotification.style.left = '10px';
					// 调整箭头位置
					const arrowLeft = buttonCenterX - 10 - 4;
					arrow.style.left = Math.max(8, Math.min(notificationRect.width - 8, arrowLeft)) + 'px';
				}

				// 如果会超出下边界，显示在按钮上方
				if (notificationRect.bottom > viewportHeight - 10) {
					confirmNotification.style.top = (rect.top - arrowGap - notificationRect.height) + 'px';
					arrow.style.top = 'auto';
					arrow.style.bottom = '-4px';
				}
			}, 0);
		} else {
			// 默认显示在右下角
			confirmNotification.style.bottom = '20px';
			confirmNotification.style.right = '20px';
			arrow.style.display = 'none';
		}

		// 创建消息文本
		const messageText = document.createElement('div');
		messageText.textContent = message;
		messageText.style.marginBottom = '12px';
		messageText.style.color = 'var(--popconfirm-text, #fff)';
		confirmNotification.appendChild(messageText);

		// 创建按钮容器
		const buttonContainer = document.createElement('div');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';
		confirmNotification.appendChild(buttonContainer);

		// 创建取消按钮
		const cancelButton = document.createElement('button');
		cancelButton.textContent = '取消';
		cancelButton.style.padding = '4px 12px';
		cancelButton.style.border = '1px solid var(--popconfirm-btn-border, rgba(255,255,255,0.2))';
		cancelButton.style.borderRadius = '4px';
		cancelButton.style.backgroundColor = 'transparent';
		cancelButton.style.color = 'var(--popconfirm-text, #fff)';
		cancelButton.style.cursor = 'pointer';
		cancelButton.style.fontSize = '12px';
		cancelButton.style.transition = 'all 0.2s';

		// 添加悬停效果
		cancelButton.addEventListener('mouseover', function() {
			cancelButton.style.backgroundColor = 'var(--popconfirm-btn-hover-bg, rgba(255,255,255,0.1))';
		});
		cancelButton.addEventListener('mouseout', function() {
			cancelButton.style.backgroundColor = 'transparent';
		});

		cancelButton.addEventListener('click', function() {
			confirmNotification.style.opacity = '0';
			setTimeout(function() {
				if (document.body.contains(confirmNotification)) {
					document.body.removeChild(confirmNotification);
				}
				if (onCancel) onCancel();
			}, 300);
		});
		buttonContainer.appendChild(cancelButton);

		// 确认按钮
		const confirmButton = document.createElement('button');
		confirmButton.textContent = '确认';
		confirmButton.style.padding = '4px 12px';
		confirmButton.style.border = 'none';
		confirmButton.style.borderRadius = '4px';
		confirmButton.style.backgroundColor = 'var(--popconfirm-primary-btn-bg, #e74c3c)';
		confirmButton.style.color = '#fff';
		confirmButton.style.cursor = 'pointer';
		confirmButton.style.fontSize = '12px';
		confirmButton.style.transition = 'all 0.2s';

		// 添加悬停效果
		confirmButton.addEventListener('mouseover', function() {
			confirmButton.style.backgroundColor = 'var(--popconfirm-primary-btn-hover-bg, #d44637)';
		});
		confirmButton.addEventListener('mouseout', function() {
			confirmButton.style.backgroundColor = 'var(--popconfirm-primary-btn-bg, #e74c3c)';
		});

		confirmButton.addEventListener('click', function() {
			confirmNotification.style.opacity = '0';
			setTimeout(function() {
				if (document.body.contains(confirmNotification)) {
					document.body.removeChild(confirmNotification);
				}
				if (onConfirm) onConfirm();
			}, 300);
		});
		buttonContainer.appendChild(confirmButton);

		// 设置过渡效果
		confirmNotification.style.transition = 'all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)';
		confirmNotification.style.opacity = '0';
		confirmNotification.style.transform = 'translateY(4px)';
		document.body.appendChild(confirmNotification);

		// 触发重排后显示元素
		setTimeout(function() {
			confirmNotification.style.opacity = '1';
			confirmNotification.style.transform = 'translateY(0)';
		}, 10);

		// 10秒后自动淡出并移除确认框（如果用户没有操作）
		const autoCloseTimeout = setTimeout(function() {
			if (document.body.contains(confirmNotification)) {
				confirmNotification.style.opacity = '0';
				confirmNotification.style.transform = 'translateY(4px)';
				setTimeout(function() {
					if (document.body.contains(confirmNotification)) {
						document.body.removeChild(confirmNotification);
					}
					if (onCancel) onCancel();
				}, 300);
			}
		}, 10000);

		// 如果用户点击了按钮，清除自动关闭的定时器
		confirmButton.addEventListener('click', function() {
			clearTimeout(autoCloseTimeout);
		});
		cancelButton.addEventListener('click', function() {
			clearTimeout(autoCloseTimeout);
		});

		// 点击其他区域关闭确认框
		const clickOutsideHandler = function(e) {
			if (!confirmNotification.contains(e.target) && e.target !== event?.target) {
				document.removeEventListener('click', clickOutsideHandler);
				confirmNotification.style.opacity = '0';
				confirmNotification.style.transform = 'translateY(4px)';
				setTimeout(function() {
					if (document.body.contains(confirmNotification)) {
						document.body.removeChild(confirmNotification);
					}
					if (onCancel) onCancel();
				}, 300);
			}
		};

		// 延迟添加点击事件，避免立即触发
		setTimeout(() => {
			document.addEventListener('click', clickOutsideHandler);
		}, 100);
	}
};

export { Editor };
