import * as THREE from 'three';

import { TransformControls } from '../../examples/jsm/controls/TransformControls.js';

import { UIPanel } from './libs/ui.js';

import { EditorControls } from './EditorControls.js';

import { ViewportCamera } from './Viewport.Camera.js';
import { ViewportInfo } from './Viewport.Info.js';
import { ViewHelper } from './Viewport.ViewHelper.js';
import { VR } from './Viewport.VR.js';

import { SetPositionCommand } from './commands/SetPositionCommand.js';
import { SetRotationCommand } from './commands/SetRotationCommand.js';
import { SetScaleCommand } from './commands/SetScaleCommand.js';
import { MultiTransformCommand } from './commands/MultiTransformCommand.js';

import { RoomEnvironment } from '../../examples/jsm/environments/RoomEnvironment.js';

function Viewport( editor ) {

	const signals = editor.signals;

	const container = new UIPanel();
	container.setId( 'viewport' );
	container.setPosition( 'absolute' );

	//container.add( new ViewportCamera( editor ) );
	container.add( new ViewportInfo( editor ) );


	let renderer = null;
	let pmremGenerator = null;

	const camera = editor.camera;
	const scene = editor.scene;
	const sceneHelpers = editor.sceneHelpers;
	let showSceneHelpers = true;

	// helpers

	const grid = new THREE.Group();

	const grid1 = new THREE.GridHelper( 30, 30, 0x888888 );
	grid1.material.color.setHex( 0x888888 );
	grid1.material.vertexColors = false;
	grid.add( grid1 );

	const grid2 = new THREE.GridHelper( 30, 6, 0x222222 );
	grid2.material.color.setHex( 0x222222 );
	grid2.material.depthFunc = THREE.AlwaysDepth;
	grid2.material.vertexColors = false;
	grid.add( grid2 );

	const viewHelper = new ViewHelper( camera, container );
	const vr = new VR( editor );

	//

	const box = new THREE.Box3();

	const selectionBox = new THREE.Box3Helper( box );
	selectionBox.material.depthTest = false;
	selectionBox.material.transparent = true;
	selectionBox.visible = false;
	sceneHelpers.add( selectionBox );

	// 增强的计算包围盒函数
	function computeEnhancedBoundingBox(object) {
		// 创建一个新的Box3
		const boundingBox = new THREE.Box3();

		// 确保更新世界矩阵
		object.updateWorldMatrix(true, true);

		// 递归函数，处理对象及其子对象
		function processObject(obj) {
			// 跳过隐藏的对象
			if (obj.visible === false) return;

			const geometry = obj.geometry;

			if (geometry !== undefined) {
				// 如果有几何体
				if (geometry.boundingBox === null) {
					geometry.computeBoundingBox();
				}

				// 几何体的顶点
				if (geometry.attributes && geometry.attributes.position) {
					const position = geometry.attributes.position;
					const vector = new THREE.Vector3();

					// 处理每个顶点，考虑到世界变换
					for (let i = 0; i < position.count; i++) {
						vector.fromBufferAttribute(position, i);
						vector.applyMatrix4(obj.matrixWorld);
						boundingBox.expandByPoint(vector);
					}
				}

				// 如果是骨骼或蒙皮模型
				if (obj.isSkinnedMesh) {
					// 处理骨骼
					const skeleton = obj.skeleton;
					if (skeleton) {
						for (let i = 0; i < skeleton.bones.length; i++) {
							const bone = skeleton.bones[i];
							const bonePoint = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
							boundingBox.expandByPoint(bonePoint);
						}
					}
				}
			}

			// 处理子对象
			if (obj.children && obj.children.length > 0) {
				for (let i = 0; i < obj.children.length; i++) {
					processObject(obj.children[i]);
				}
			}
		}

		// 开始处理
		processObject(object);

		// 如果包围盒为空，增加一个小的默认尺寸
		if (boundingBox.isEmpty()) {
			boundingBox.set(
				// new THREE.Vector3(-0.5, -0.5, -0.5),
				// new THREE.Vector3(0.5, 0.5, 0.5)
				new THREE.Vector3(-0.05, -0.05, -0.05),
				new THREE.Vector3(0.05, 0.05, 0.05)
			);
			boundingBox.applyMatrix4(object.matrixWorld);
		}

		// 扩展一点点，确保完全包围
		const size = new THREE.Vector3();
		boundingBox.getSize(size);

		// 增加缓冲量
		// if (Math.max(size.x, size.y, size.z) < 1.0) {
		// 	boundingBox.expandByScalar(size.length() * 0.001);
		// } else {
		// 	boundingBox.expandByScalar(size.length() * 0.01);
		// }

		return boundingBox;
	}

	let objectPositionOnDown = null;
	let objectRotationOnDown = null;
	let objectScaleOnDown = null;
	// 存储多选对象的原始变换
	let multipleObjectsTransformOnDown = [];

	// 创建一个空的组作为多选对象的临时父级
	const multiSelectGroup = new THREE.Group();
	multiSelectGroup.name = "多选临时组";
	multiSelectGroup.visible = false;
	sceneHelpers.add(multiSelectGroup);

	// 将multiSelectGroup暴露给editor以便其他组件可以访问
	editor.multiSelectGroup = multiSelectGroup;

	// 防止自动移位的标记
	let preventAutoMove = false;

	// 存储多选对象中心点
	const multiSelectionCenter = new THREE.Vector3();

	// 计算多个对象的共同包围盒
	function computeMultiSelectionBoundingBox(objects) {
		const boundingBox = new THREE.Box3();

		for (let i = 0; i < objects.length; i++) {
			if (objects[i]) {
				const objectBox = computeEnhancedBoundingBox(objects[i]);
				boundingBox.union(objectBox);
			}
		}

		return boundingBox;
	}

	// 更新所有选中对象的变换
	function updateMultiSelectionTransforms(forceUpdateCenter = false) {
		const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
		if (selectedObjects.length === 0) return;

		// 只有当强制更新中心点或中心点未定义时才计算中心点
		if (forceUpdateCenter || multiSelectionCenter.lengthSq() === 0) {
			const bbox = computeMultiSelectionBoundingBox(selectedObjects);
			bbox.getCenter(multiSelectionCenter);

			// 设置临时组的初始位置为所有对象的中心
			multiSelectGroup.position.copy(multiSelectionCenter);
		}

		// 计算每个对象相对于中心的偏移
		for (let i = 0; i < selectedObjects.length; i++) {
			const obj = selectedObjects[i];
			if (obj) {
				obj.userData.offsetFromCenter = obj.position.clone().sub(multiSelectionCenter);
			}
		}
	}

	const transformControls = new TransformControls( camera, container.dom );
	transformControls.addEventListener( 'change', function () {

		const object = transformControls.object;

		if ( object !== undefined ) {

			if (object === multiSelectGroup) {
				// 多选模式：根据临时组的变换更新所有子对象
				const selectedObjects = editor.getSelectedObjects();

				// 获取变换模式
				const mode = transformControls.getMode();

				// 根据模式调用相应的回调函数
				if (mode === 'translate' && object.userData.onPositionChange) {
					object.userData.onPositionChange();
				} else if (mode === 'rotate' && object.userData.onRotationChange) {
					object.userData.onRotationChange();
				} else if (mode === 'scale' && object.userData.onScaleChange) {
					object.userData.onScaleChange();
				}

				// 计算所有选中对象的共同包围盒
				box.copy(computeMultiSelectionBoundingBox(selectedObjects));

				// 刷新侧边栏
				signals.refreshSidebarObject3D.dispatch(object);

				// 触发编辑器信号，通知侧边栏多选面板更新
				signals.multipleObjectsTransformChanged.dispatch(object);
			} else {
				// 单选模式：正常更新
				box.copy(computeEnhancedBoundingBox(object));

				const helper = editor.helpers[ object.id ];

				if ( helper !== undefined && helper.isSkeletonHelper !== true ) {
					helper.update();
				}

				signals.refreshSidebarObject3D.dispatch( object );
			}
		}

		render();

	} );
	transformControls.addEventListener( 'mouseDown', function () {

		const object = transformControls.object;

		if (object === multiSelectGroup) {
			// 多选模式：保存每个选中对象的原始变换
			multipleObjectsTransformOnDown = [];
			const selectedObjects = multiSelectGroup.userData.selectedObjects || [];

			// 设置防止自动移位标记
			preventAutoMove = true;

			// 保存多选组本身的初始变换
			multiSelectGroup.userData.originalTransform = {
				position: multiSelectGroup.position.clone(),
				rotation: multiSelectGroup.rotation.clone(),
				scale: multiSelectGroup.scale.clone()
			};

			for (let i = 0; i < selectedObjects.length; i++) {
				const obj = selectedObjects[i];
				if (obj) { // 确保对象存在
					multipleObjectsTransformOnDown.push({
						object: obj,
						position: obj.position.clone(),
						rotation: obj.rotation.clone(),
						scale: obj.scale.clone()
					});
				}
			}
		} else {
			// 单选模式
			objectPositionOnDown = object.position.clone();
			objectRotationOnDown = object.rotation.clone();
			objectScaleOnDown = object.scale.clone();
		}

		controls.enabled = false;

	} );
	transformControls.addEventListener( 'mouseUp', function () {

		const object = transformControls.object;

		if ( object !== undefined ) {

			if (object === multiSelectGroup) {
				// 多选模式：使用单一命令来处理所有对象的变换
				const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
				if (selectedObjects.length === 0 || multipleObjectsTransformOnDown.length === 0) {
					return;
				}

				// MultiTransformCommand已在文件顶部导入
				if (typeof MultiTransformCommand === 'undefined') {
					console.warn('MultiTransformCommand not available, falling back to individual commands');

					// 根据变换模式决定要应用的命令
					switch (transformControls.getMode()) {
						case 'translate':
							for (let i = 0; i < multipleObjectsTransformOnDown.length; i++) {
								const data = multipleObjectsTransformOnDown[i];
								const obj = data.object;
								// 确保对象存在且位置已更改
								if (obj && !data.position.equals(obj.position)) {
									editor.execute(new SetPositionCommand(editor, obj, obj.position, data.position));
								}
							}
							break;

						case 'rotate':
							for (let i = 0; i < multipleObjectsTransformOnDown.length; i++) {
								const data = multipleObjectsTransformOnDown[i];
								const obj = data.object;
								// 确保对象存在且旋转已更改
								if (obj && !data.rotation.equals(obj.rotation)) {
									editor.execute(new SetRotationCommand(editor, obj, obj.rotation, data.rotation));
								}
							}
							break;

						case 'scale':
							for (let i = 0; i < multipleObjectsTransformOnDown.length; i++) {
								const data = multipleObjectsTransformOnDown[i];
								const obj = data.object;
								// 确保对象存在且缩放已更改
								if (obj && !data.scale.equals(obj.scale)) {
									editor.execute(new SetScaleCommand(editor, obj, obj.scale, data.scale));
								}
							}
							break;
					}
				} else {
					// 创建一个多变换命令
					const multiCommand = new MultiTransformCommand(editor, selectedObjects);

					// 设置命令的模式和名称
					const mode = transformControls.getMode();
					switch (mode) {
						case 'translate':
							multiCommand.type = 'MultiPositionCommand';
							multiCommand.name = '多对象位置变换';
							break;
						case 'rotate':
							multiCommand.type = 'MultiRotationCommand';
							multiCommand.name = '多对象旋转变换';
							break;
						case 'scale':
							multiCommand.type = 'MultiScaleCommand';
							multiCommand.name = '多对象缩放变换';
							break;
					}

					// 手动设置命令的初始和最终状态
					for (let i = 0; i < multipleObjectsTransformOnDown.length; i++) {
						const data = multipleObjectsTransformOnDown[i];
						const obj = data.object;
						if (obj) {
							// 设置初始状态
							multiCommand.oldPositions[obj.id] = data.position;
							multiCommand.oldRotations[obj.id] = data.rotation;
							multiCommand.oldScales[obj.id] = data.scale;

							// 设置当前状态
							multiCommand.newPositions[obj.id] = obj.position.clone();
							multiCommand.newRotations[obj.id] = obj.rotation.clone();
							multiCommand.newScales[obj.id] = obj.scale.clone();
						}
					}

					// 存储多选组的状态
					// 获取multiSelectGroup在变换前的值，理论上应该是在mouseDown时保存的
					// 如果没有原始值，先尝试获取在mouseDown时保存的临时组位置
					const tmpGroup = multiSelectGroup.userData.originalTransform || {};
					multiCommand.oldGroupPosition = tmpGroup.position || multiSelectGroup.position.clone();
					multiCommand.oldGroupRotation = tmpGroup.rotation || multiSelectGroup.rotation.clone();
					multiCommand.oldGroupScale = tmpGroup.scale || multiSelectGroup.scale.clone();

					multiCommand.newGroupPosition = multiSelectGroup.position.clone();
					multiCommand.newGroupRotation = multiSelectGroup.rotation.clone();
					multiCommand.newGroupScale = multiSelectGroup.scale.clone();

					// 执行命令
					editor.execute(multiCommand);
				}

				// 清除临时存储的对象变换数据
				multipleObjectsTransformOnDown = [];

				// 更新选中对象的中心点和偏移量，但不强制重新计算中心点
				if (preventAutoMove) {
					// 当preventAutoMove为true时，不更新中心点，只更新对象的偏移量
					const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
					for (let i = 0; i < selectedObjects.length; i++) {
						const obj = selectedObjects[i];
						if (obj) {
							// 更新偏移量，保持原中心点不变
							obj.userData.offsetFromCenter = obj.position.clone().sub(multiSelectGroup.position);
						}
					}
				}

                // 确保变换后刷新多选状态
                editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
			} else {
				// 单选模式
				switch (transformControls.getMode()) {
					case 'translate':
						if (!objectPositionOnDown.equals(object.position)) {
							editor.execute(new SetPositionCommand(editor, object, object.position, objectPositionOnDown));
						}
						break;

					case 'rotate':
						if (!objectRotationOnDown.equals(object.rotation)) {
							editor.execute(new SetRotationCommand(editor, object, object.rotation, objectRotationOnDown));
						}
						break;

					case 'scale':
						if (!objectScaleOnDown.equals(object.scale)) {
							editor.execute(new SetScaleCommand(editor, object, object.scale, objectScaleOnDown));
						}
						break;
				}
			}
		}

		controls.enabled = true;

	} );

	sceneHelpers.add( transformControls );

	// object picking

	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();

	// events

	function updateAspectRatio() {

		camera.aspect = container.dom.offsetWidth / container.dom.offsetHeight;
		camera.updateProjectionMatrix();

	}

	function getIntersects( point ) {

		mouse.set( ( point.x * 2 ) - 1, - ( point.y * 2 ) + 1 );

		raycaster.setFromCamera( mouse, camera );

		const objects = [];

		scene.traverseVisible( function ( child ) {

			objects.push( child );

		} );

		sceneHelpers.traverseVisible( function ( child ) {

			if ( child.name === 'picker' ) objects.push( child );

		} );

		return raycaster.intersectObjects( objects, false );

	}

	const onDownPosition = new THREE.Vector2();
	const onUpPosition = new THREE.Vector2();
	const onDoubleClickPosition = new THREE.Vector2();

	function getMousePosition( dom, x, y ) {

		const rect = dom.getBoundingClientRect();
		return [ ( x - rect.left ) / rect.width, ( y - rect.top ) / rect.height ];

	}

	function handleClick() {

		if ( onDownPosition.distanceTo( onUpPosition ) === 0 ) {

			const intersects = getIntersects( onUpPosition );

			if ( intersects.length > 0 ) {

				const object = intersects[ 0 ].object;

				if ( object.userData.object !== undefined ) {

					// helper

					editor.select( object.userData.object );

				} else {

					editor.select( object );

				}

			} else {

				editor.select( null );

			}

			render();

		}

	}

	function onMouseDown( event ) {

		// event.preventDefault();

		const array = getMousePosition( container.dom, event.clientX, event.clientY );
		onDownPosition.fromArray( array );

		document.addEventListener( 'mouseup', onMouseUp );

	}

	// 添加objectChanged事件监听器用于处理sidebar中多选对象变换命令
	editor.signals.objectChanged.add(function(object) {
		if (object === multiSelectGroup) {
			// 当多选组发生变化时，应用变换到所有选中对象
			const selectedObjects = multiSelectGroup.userData.selectedObjects || [];

			if (selectedObjects.length > 0 && multiSelectGroup.userData) {
				// 如果有onPositionChange等回调，调用它们
				if (multiSelectGroup.userData.onPositionChange) {
					multiSelectGroup.userData.onPositionChange();
				}
				if (multiSelectGroup.userData.onRotationChange) {
					multiSelectGroup.userData.onRotationChange();
				}
				if (multiSelectGroup.userData.onScaleChange) {
					multiSelectGroup.userData.onScaleChange();
				}

				// 触发多选对象变换变化信号
				editor.signals.multipleObjectsTransformChanged.dispatch(multiSelectGroup);
			}
		}
	});

	function onMouseUp( event ) {

		const array = getMousePosition( container.dom, event.clientX, event.clientY );
		onUpPosition.fromArray( array );

		handleClick();

		document.removeEventListener( 'mouseup', onMouseUp );

	}

	function onTouchStart( event ) {

		const touch = event.changedTouches[ 0 ];

		const array = getMousePosition( container.dom, touch.clientX, touch.clientY );
		onDownPosition.fromArray( array );

		document.addEventListener( 'touchend', onTouchEnd );

	}

	function onTouchEnd( event ) {

		const touch = event.changedTouches[ 0 ];

		const array = getMousePosition( container.dom, touch.clientX, touch.clientY );
		onUpPosition.fromArray( array );

		handleClick();

		document.removeEventListener( 'touchend', onTouchEnd );

	}

	function onDoubleClick( event ) {

		const array = getMousePosition( container.dom, event.clientX, event.clientY );
		onDoubleClickPosition.fromArray( array );

		const intersects = getIntersects( onDoubleClickPosition );

		if ( intersects.length > 0 ) {

			const intersect = intersects[ 0 ];

			signals.objectFocused.dispatch( intersect.object );

		}

	}

	container.dom.addEventListener( 'mousedown', onMouseDown );
	container.dom.addEventListener( 'touchstart', onTouchStart );
	container.dom.addEventListener( 'dblclick', onDoubleClick );

	// controls need to be added *after* main logic,
	// otherwise controls.enabled doesn't work.

	const controls = new EditorControls( camera, container.dom );
	controls.addEventListener( 'change', function () {

		signals.cameraChanged.dispatch( camera );
		signals.refreshSidebarObject3D.dispatch( camera );

	} );
	viewHelper.controls = controls;

	// signals

	signals.editorCleared.add( function () {

		controls.center.set( 0, 0, 0 );
		render();

	} );

	signals.transformModeChanged.add( function ( mode ) {

		transformControls.setMode( mode );

	} );

	signals.snapChanged.add( function ( dist ) {

		transformControls.setTranslationSnap( dist );

	} );

	signals.spaceChanged.add( function ( space ) {

		transformControls.setSpace( space );

	} );

	// 添加多选对象变换更新信号处理
	signals.multipleObjectsTransformChanged.add( function ( object ) {
		if (object === multiSelectGroup) {
			// 更新选中对象的包围盒
			const selectedObjects = multiSelectGroup.userData.selectedObjects || [];
			if (selectedObjects.length > 0) {
				// 计算所有选中对象的共同包围盒
				box.copy(computeMultiSelectionBoundingBox(selectedObjects));
				// 确保包围盒可见
				if (box.isEmpty() === false) {
					selectionBox.visible = true;
				}
				render();
			}
		}
	} );

	signals.rendererUpdated.add( function () {

		scene.traverse( function ( child ) {

			if ( child.material !== undefined ) {

				child.material.needsUpdate = true;

			}

		} );

		render();

	} );

	signals.rendererCreated.add( function ( newRenderer ) {

		if ( renderer !== null ) {

			renderer.setAnimationLoop( null );
			renderer.dispose();
			pmremGenerator.dispose();

			container.dom.removeChild( renderer.domElement );

		}

		renderer = newRenderer;

		renderer.setAnimationLoop( animate );
		renderer.setClearColor( 0xaaaaaa );

		if ( window.matchMedia ) {

			const mediaQuery = window.matchMedia( '(prefers-color-scheme: dark)' );
			mediaQuery.addEventListener( 'change', function ( event ) {

				renderer.setClearColor( event.matches ? 0x333333 : 0xaaaaaa );
				updateGridColors( grid1, grid2, event.matches ? [ 0x222222, 0x888888 ] : [ 0x888888, 0x282828 ] );

				render();

			} );

			renderer.setClearColor( mediaQuery.matches ? 0x333333 : 0xaaaaaa );
			updateGridColors( grid1, grid2, mediaQuery.matches ? [ 0x222222, 0x888888 ] : [ 0x888888, 0x282828 ] );

		}

		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( container.dom.offsetWidth, container.dom.offsetHeight );

		pmremGenerator = new THREE.PMREMGenerator( renderer );
		pmremGenerator.compileEquirectangularShader();

		container.dom.appendChild( renderer.domElement );

		render();

	} );

	signals.sceneGraphChanged.add( function () {

		render();

	} );

	signals.cameraChanged.add( function () {

		render();

	} );

	signals.objectSelected.add( function ( object ) {

		selectionBox.visible = false;
		transformControls.detach();

		if ( object !== null && object !== scene && object !== camera ) {

			// 检查是否存在多选
			const selectedObjects = editor.getSelectedObjects();

			if (selectedObjects.length > 1) {
				// 多选模式
				// 记录当前所有被选择的对象，确保所有对象都被处理
				multiSelectGroup.userData.selectedObjects = [...selectedObjects];

				// 计算所有选中对象的共同包围盒
				box.copy(computeMultiSelectionBoundingBox(selectedObjects));

				if (box.isEmpty() === false) {
					selectionBox.visible = true;
				}

				// 清空临时组并设置为可见
				while (multiSelectGroup.children.length > 0) {
					multiSelectGroup.remove(multiSelectGroup.children[0]);
				}
				multiSelectGroup.visible = true;

				// 重置中心点和防止自动移位标记
				multiSelectionCenter.set(0, 0, 0);
				preventAutoMove = false;

				// 更新选中对象的变换，强制重新计算中心点
				updateMultiSelectionTransforms(true);

				// 重置临时组的旋转和缩放
				multiSelectGroup.rotation.set(0, 0, 0);
				multiSelectGroup.scale.set(1, 1, 1);

				// 附加变换控制器到临时组
				transformControls.attach(multiSelectGroup);

				// 添加更新函数
				multiSelectGroup.userData.onPositionChange = function() {
					const objects = multiSelectGroup.userData.selectedObjects || [];
					if (objects.length === 0) return;

					// 使用存储的中心点和偏移量
					for (let i = 0; i < objects.length; i++) {
						const obj = objects[i];
						if (obj && obj.userData.offsetFromCenter) {
							// 根据临时组的新位置和原始偏移计算新位置
							const newPos = multiSelectGroup.position.clone().add(obj.userData.offsetFromCenter);
							obj.position.copy(newPos);
						}
					}
				};

				multiSelectGroup.userData.onRotationChange = function() {
					const objects = multiSelectGroup.userData.selectedObjects || [];
					if (objects.length === 0) return;

					const groupWorldMatrix = new THREE.Matrix4();
					groupWorldMatrix.makeRotationFromEuler(multiSelectGroup.rotation);

					for (let i = 0; i < objects.length; i++) {
						const obj = objects[i];
						if (obj && obj.userData.offsetFromCenter) {
							// 创建向量来表示偏移
							const offset = obj.userData.offsetFromCenter.clone();

							// 应用组的旋转到偏移向量
							offset.applyMatrix4(groupWorldMatrix);

							// 计算新位置
							const newPos = multiSelectGroup.position.clone().add(offset);
							obj.position.copy(newPos);

							// 应用相同的旋转
							obj.rotation.copy(multiSelectGroup.rotation);
						}
					}
				};

				multiSelectGroup.userData.onScaleChange = function() {
					const objects = multiSelectGroup.userData.selectedObjects || [];
					if (objects.length === 0) return;

					for (let i = 0; i < objects.length; i++) {
						const obj = objects[i];
						if (obj && obj.userData.offsetFromCenter) {
							// 根据临时组的缩放调整偏移
							const scaledOffset = obj.userData.offsetFromCenter.clone()
								.multiply(multiSelectGroup.scale);

							// 计算新位置
							const newPos = multiSelectGroup.position.clone().add(scaledOffset);
							obj.position.copy(newPos);

							// 应用相同的缩放
							obj.scale.copy(multiSelectGroup.scale);
						}
					}
				};

			} else {
				// 单选模式
				multiSelectGroup.visible = false;
				multiSelectionCenter.set(0, 0, 0); // 清除中心点
				box.copy(computeEnhancedBoundingBox(object));

				if (box.isEmpty() === false) {
					selectionBox.visible = true;
				}

				transformControls.attach(object);
			}
		} else {
			// 无选择
			multiSelectGroup.visible = false;
			multiSelectionCenter.set(0, 0, 0); // 清除中心点
		}

		render();

	} );

	signals.objectFocused.add( function ( object ) {

		controls.focus( object );

	} );

	signals.geometryChanged.add( function ( object ) {

		if ( object !== undefined ) {

			// box.setFromObject( object, true );
			box.copy(computeEnhancedBoundingBox(object));

		}

		render();

	} );

	signals.objectChanged.add( function ( object ) {

		if ( editor.selected === object ) {

			// box.setFromObject( object, true );
			box.copy(computeEnhancedBoundingBox(object));

		}

		if ( object.isPerspectiveCamera ) {

			object.updateProjectionMatrix();

		}

		if ( editor.helpers[ object.id ] !== undefined ) {

			editor.helpers[ object.id ].update();

		}

		render();

	} );

	signals.objectRemoved.add( function ( object ) {

		controls.enabled = true; // see #14180
		if ( object === transformControls.object ) {

			transformControls.detach();

		}

	} );

	signals.materialChanged.add( function () {

		render();

	} );

	// background

	signals.sceneBackgroundChanged.add( function ( backgroundType, backgroundColor, backgroundTexture, backgroundEquirectangularTexture ) {

		switch ( backgroundType ) {

			case 'None':

				scene.background = null;

				break;

			case 'Color':

				scene.background = new THREE.Color( backgroundColor );

				break;

			case 'Texture':

				if ( backgroundTexture ) {

					scene.background = backgroundTexture;

				}

				break;

			case 'Equirectangular':

				if ( backgroundEquirectangularTexture ) {

					backgroundEquirectangularTexture.mapping = THREE.EquirectangularReflectionMapping;
					scene.background = backgroundEquirectangularTexture;

				}

				break;

		}

		render();

	} );

	// environment

	signals.sceneEnvironmentChanged.add( function ( environmentType, environmentEquirectangularTexture ) {

		switch ( environmentType ) {

			case 'None':

				scene.environment = null;

				break;

			case 'Equirectangular':

				scene.environment = null;

				if ( environmentEquirectangularTexture ) {

					environmentEquirectangularTexture.mapping = THREE.EquirectangularReflectionMapping;
					scene.environment = environmentEquirectangularTexture;

				}

				break;

			case 'ModelViewer':

				scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;

				break;

		}

		render();

	} );

	// fog

	signals.sceneFogChanged.add( function ( fogType, fogColor, fogNear, fogFar, fogDensity ) {

		switch ( fogType ) {

			case 'None':
				scene.fog = null;
				break;
			case 'Fog':
				scene.fog = new THREE.Fog( fogColor, fogNear, fogFar );
				break;
			case 'FogExp2':
				scene.fog = new THREE.FogExp2( fogColor, fogDensity );
				break;

		}

		render();

	} );

	signals.sceneFogSettingsChanged.add( function ( fogType, fogColor, fogNear, fogFar, fogDensity ) {

		switch ( fogType ) {

			case 'Fog':
				scene.fog.color.setHex( fogColor );
				scene.fog.near = fogNear;
				scene.fog.far = fogFar;
				break;
			case 'FogExp2':
				scene.fog.color.setHex( fogColor );
				scene.fog.density = fogDensity;
				break;

		}

		render();

	} );

	signals.viewportCameraChanged.add( function () {

		const viewportCamera = editor.viewportCamera;

		if ( viewportCamera.isPerspectiveCamera ) {

			viewportCamera.aspect = editor.camera.aspect;
			viewportCamera.projectionMatrix.copy( editor.camera.projectionMatrix );

		} else if ( viewportCamera.isOrthographicCamera ) {

			// TODO

		}

		// disable EditorControls when setting a user camera

		controls.enabled = ( viewportCamera === editor.camera );

		render();

	} );

	signals.exitedVR.add( render );

	//

	signals.windowResize.add( function () {

		updateAspectRatio();

		renderer.setSize( container.dom.offsetWidth, container.dom.offsetHeight );

		render();

	} );

	signals.showGridChanged.add( function ( showGrid ) {

		grid.visible = showGrid;
		render();

	} );

	signals.showHelpersChanged.add( function ( showHelpers ) {

		showSceneHelpers = showHelpers;
		transformControls.enabled = showHelpers;

		render();

	} );

	signals.cameraResetted.add( updateAspectRatio );

	// animations

	let prevActionsInUse = 0;

	const clock = new THREE.Clock(); // only used for animations

	function animate() {

		const mixer = editor.mixer;
		const delta = clock.getDelta();

		let needsUpdate = false;

		// Animations

		const actions = mixer.stats.actions;

		if ( actions.inUse > 0 || prevActionsInUse > 0 ) {

			prevActionsInUse = actions.inUse;

			mixer.update( delta );
			needsUpdate = true;

		}

		// View Helper

		if ( viewHelper.animating === true ) {

			viewHelper.update( delta );
			needsUpdate = true;

		}

		if ( vr.currentSession !== null ) {

			needsUpdate = true;

		}

		if ( needsUpdate === true ) render();

	}

	//

	let startTime = 0;
	let endTime = 0;

	function render() {

		startTime = performance.now();

		// Adding/removing grid to scene so materials with depthWrite false
		// don't render under the grid.

		scene.add( grid );
		renderer.setViewport( 0, 0, container.dom.offsetWidth, container.dom.offsetHeight );
		renderer.render( scene, editor.viewportCamera );
		scene.remove( grid );

		if ( camera === editor.viewportCamera ) {

			renderer.autoClear = false;
			if ( showSceneHelpers === true ) renderer.render( sceneHelpers, camera );
			if ( vr.currentSession === null ) viewHelper.render( renderer );
			renderer.autoClear = true;

		}

		endTime = performance.now();
		editor.signals.sceneRendered.dispatch( endTime - startTime );

	}

	return container;

}

function updateGridColors( grid1, grid2, colors ) {

	grid1.material.color.setHex( colors[ 0 ] );
	grid2.material.color.setHex( colors[ 1 ] );

}

export { Viewport };
