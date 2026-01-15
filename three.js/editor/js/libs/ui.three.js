import * as THREE from 'three';

import { RGBELoader } from '../../../examples/jsm/loaders/RGBELoader.js';
import { TGALoader } from '../../../examples/jsm/loaders/TGALoader.js';

import { UIElement, UISpan, UIDiv, UIRow, UIButton, UICheckbox, UIText, UINumber } from './ui.js';
import { MoveObjectCommand } from '../commands/MoveObjectCommand.js';
import { MoveMultipleObjectsCommand } from '../commands/MoveMultipleObjectsCommand.js';

class UITexture extends UISpan {

	constructor( mapping ) {

		super();

		const scope = this;

		const form = document.createElement( 'form' );

		const input = document.createElement( 'input' );
		input.type = 'file';
		input.addEventListener( 'change', function ( event ) {

			loadFile( event.target.files[ 0 ] );

		} );
		form.appendChild( input );

		const canvas = document.createElement( 'canvas' );
		canvas.width = 32;
		canvas.height = 16;
		canvas.style.cursor = 'pointer';
		canvas.style.marginRight = '5px';
		canvas.style.border = '1px solid #888';
		canvas.addEventListener( 'click', function () {

			input.click();

		} );
		canvas.addEventListener( 'drop', function ( event ) {

			event.preventDefault();
			event.stopPropagation();
			loadFile( event.dataTransfer.files[ 0 ] );

		} );
		this.dom.appendChild( canvas );

		function loadFile( file ) {

			const extension = file.name.split( '.' ).pop().toLowerCase();
			const reader = new FileReader();

			if ( extension === 'hdr' || extension === 'pic' ) {

				reader.addEventListener( 'load', function ( event ) {

					// assuming RGBE/Radiance HDR iamge format

					const loader = new RGBELoader();
					loader.load( event.target.result, function ( hdrTexture ) {

						hdrTexture.sourceFile = file.name;
						hdrTexture.isHDRTexture = true;

						scope.setValue( hdrTexture );

						if ( scope.onChangeCallback ) scope.onChangeCallback( hdrTexture );

					} );

				} );

				reader.readAsDataURL( file );

			} else if ( extension === 'tga' ) {

				reader.addEventListener( 'load', function ( event ) {

					const canvas = new TGALoader().parse( event.target.result );

					const texture = new THREE.CanvasTexture( canvas, mapping );
					texture.sourceFile = file.name;

					scope.setValue( texture );

					if ( scope.onChangeCallback ) scope.onChangeCallback( texture );

				}, false );

				reader.readAsArrayBuffer( file );

			} else if ( file.type.match( 'image.*' ) ) {

				reader.addEventListener( 'load', function ( event ) {

					const image = document.createElement( 'img' );
					image.addEventListener( 'load', function () {

						const texture = new THREE.Texture( this, mapping );
						texture.sourceFile = file.name;
						texture.needsUpdate = true;

						scope.setValue( texture );

						if ( scope.onChangeCallback ) scope.onChangeCallback( texture );

					}, false );

					image.src = event.target.result;

				}, false );

				reader.readAsDataURL( file );

			}

			form.reset();

		}

		this.texture = null;
		this.onChangeCallback = null;

	}

	getValue() {

		return this.texture;

	}

	setValue( texture ) {

		const canvas = this.dom.children[ 0 ];
		const context = canvas.getContext( '2d' );

		// Seems like context can be null if the canvas is not visible
		if ( context ) {

			// Always clear the context before set new texture, because new texture may has transparency
			context.clearRect( 0, 0, canvas.width, canvas.height );

		}

		if ( texture !== null ) {

			const image = texture.image;

			if ( image !== undefined && image.width > 0 ) {

				canvas.title = texture.sourceFile;
				const scale = canvas.width / image.width;

				if ( image.data === undefined ) {

					context.drawImage( image, 0, 0, image.width * scale, image.height * scale );

				} else {

					const canvas2 = renderToCanvas( texture );
					context.drawImage( canvas2, 0, 0, image.width * scale, image.height * scale );

				}

			} else {

				canvas.title = texture.sourceFile + ' (error)';

			}

		} else {

			canvas.title = 'empty';

		}

		this.texture = texture;

	}

	setEncoding( encoding ) {

		const texture = this.getValue();

		if ( texture !== null ) {

			texture.encoding = encoding;

		}

		return this;

	}

	onChange( callback ) {

		this.onChangeCallback = callback;

		return this;

	}

}

class UICubeTexture extends UIElement {

	constructor() {

		const container = new UIDiv();

		super( container.dom );

		this.cubeTexture = null;
		this.onChangeCallback = null;

		this.textures = [];

		const scope = this;

		const pRow = new UIRow();
		const nRow = new UIRow();

		pRow.add( new UIText( 'P:' ).setWidth( '35px' ) );
		nRow.add( new UIText( 'N:' ).setWidth( '35px' ) );

		const posXTexture = new UITexture().onChange( onTextureChanged );
		const negXTexture = new UITexture().onChange( onTextureChanged );
		const posYTexture = new UITexture().onChange( onTextureChanged );
		const negYTexture = new UITexture().onChange( onTextureChanged );
		const posZTexture = new UITexture().onChange( onTextureChanged );
		const negZTexture = new UITexture().onChange( onTextureChanged );

		this.textures.push( posXTexture, negXTexture, posYTexture, negYTexture, posZTexture, negZTexture );

		pRow.add( posXTexture );
		pRow.add( posYTexture );
		pRow.add( posZTexture );

		nRow.add( negXTexture );
		nRow.add( negYTexture );
		nRow.add( negZTexture );

		container.add( pRow, nRow );

		function onTextureChanged() {

			const images = [];

			for ( let i = 0; i < scope.textures.length; i ++ ) {

				const texture = scope.textures[ i ].getValue();

				if ( texture !== null ) {

					images.push( texture.isHDRTexture ? texture : texture.image );

				}

			}

			if ( images.length === 6 ) {

				const cubeTexture = new THREE.CubeTexture( images );
				cubeTexture.needsUpdate = true;

				if ( images[ 0 ].isHDRTexture ) cubeTexture.isHDRTexture = true;

				scope.cubeTexture = cubeTexture;

				if ( scope.onChangeCallback ) scope.onChangeCallback( cubeTexture );

			}

		}

	}

	setEncoding( encoding ) {

		const cubeTexture = this.getValue();
		if ( cubeTexture !== null ) {

			cubeTexture.encoding = encoding;

		}

		return this;

	}

	getValue() {

		return this.cubeTexture;

	}

	setValue( cubeTexture ) {

		this.cubeTexture = cubeTexture;

		if ( cubeTexture !== null ) {

			const images = cubeTexture.image;

			if ( Array.isArray( images ) === true && images.length === 6 ) {

				for ( let i = 0; i < images.length; i ++ ) {

					const image = images[ i ];

					const texture = new THREE.Texture( image );
					this.textures[ i ].setValue( texture );

				}

			}

		} else {

			const textures = this.textures;

			for ( let i = 0; i < textures.length; i ++ ) {

				textures[ i ].setValue( null );

			}

		}

		return this;

	}

	onChange( callback ) {

		this.onChangeCallback = callback;

		return this;

	}

}

class UIOutliner extends UIDiv {

	constructor( editor ) {

		super();

		this.dom.className = 'Outliner';
		this.dom.tabIndex = 0;	// keyup event is ignored without setting tabIndex

		const scope = this;

		// hack
		this.scene = editor.scene;

		// Prevent native scroll behavior
		this.dom.addEventListener( 'keydown', function ( event ) {

			switch ( event.keyCode ) {

				case 38: // up
				case 40: // down
					event.preventDefault();
					event.stopPropagation();
					break;

			}

		} );

		// Keybindings to support arrow navigation
		this.dom.addEventListener( 'keyup', function ( event ) {

			switch ( event.keyCode ) {

				case 38: // up
					scope.selectIndex( scope.selectedIndex - 1 );
					break;
				case 40: // down
					scope.selectIndex( scope.selectedIndex + 1 );
					break;

			}

		} );

		this.editor = editor;

		this.options = [];
		this.selectedIndex = - 1;
		this.selectedValue = null;

		// 多选支持
		this.selectedIndices = [];
		this.selectedValues = [];

	}

	selectIndex( index ) {

		if ( index >= 0 && index < this.options.length ) {

			this.setValue( this.options[ index ].value );

			const changeEvent = new CustomEvent('change', {
				bubbles: true,
				cancelable: true
			});
			this.dom.dispatchEvent( changeEvent );

		}

	}

	setOptions( options ) {

		const scope = this;

		while ( scope.dom.children.length > 0 ) {

			scope.dom.removeChild( scope.dom.firstChild );

		}

		function onClick(event) {
			// 多选支持：检查是否按下Ctrl键(Windows)或Command键(Mac)
			const multiSelect = event.ctrlKey || event.metaKey;

			// 或者检查是否按下Shift键（范围选择）
			const rangeSelect = event.shiftKey;

			if (rangeSelect && scope.selectedIndex !== -1) {
				// 实现范围选择
				const lastIndex = scope.selectedIndex;
				const currentIndex = options.indexOf(this);

				// 清除当前选择
				scope.clearSelection();

				// 选择范围内的所有项
				const start = Math.min(lastIndex, currentIndex);
				const end = Math.max(lastIndex, currentIndex);

				// 先设置当前点击的为主选择（最后一个）
				scope.selectedIndex = currentIndex;
				scope.selectedValue = options[currentIndex].value;

				// 添加整个范围到选择中，确保正确处理selectedValues数组
				for (let i = start; i <= end; i++) {
					const element = options[i];
					element.classList.add('active');

					if (scope.selectedValues.indexOf(element.value) === -1) {
						scope.selectedIndices.push(i);
						scope.selectedValues.push(element.value);
					}
				}
			} else {
				// 单选或Ctrl/Command多选
				scope.setValue(this.value, multiSelect);
			}

			const changeEvent = new CustomEvent('change', {
				bubbles: true,
				cancelable: true
			});
			scope.dom.dispatchEvent(changeEvent);
		}

		// Drag

		let currentDrag;

		function onDrag() {

			currentDrag = this;

		}

		function onDragStart( event ) {
			event.dataTransfer.setData( 'text', 'foo' );

			// 检查当前拖动的元素是否在选中集合中
			const draggedId = parseInt(this.value);
			if (scope.selectedValues.indexOf(draggedId) === -1) {
				// 如果拖动的不是选中集合中的元素，清除当前选择并选中该元素
				scope.clearSelection();
				scope.setValue(draggedId);
			}
			// 此时currentDrag是选中集合中的一个元素
		}

		function onDragOver( event ) {

			if ( this === currentDrag ) return;

			const area = event.offsetY / this.clientHeight;

			if ( area < 0.25 ) {

				this.className = 'option dragTop';

			} else if ( area > 0.75 ) {

				this.className = 'option dragBottom';

			} else {

				this.className = 'option drag';

			}

		}

		function onDragLeave() {

			if ( this === currentDrag ) return;

			this.className = 'option';

		}

		function onDrop( event ) {

			if ( this === currentDrag || currentDrag === undefined ) return;

			this.className = 'option';

			const scene = scope.scene;

			// 获取所有选中的对象
			const selectedValues = scope.getValues();
			const selectedObjects = selectedValues.map(id => scene.getObjectById(parseInt(id))).filter(Boolean);

			// 如果没有选中对象，退出
			if (selectedObjects.length === 0) return;

			// 获取当前拖拽目标
			const area = event.offsetY / this.clientHeight;

			if ( area < 0.25 ) {
				// 在目标上方插入
				const nextObject = scene.getObjectById(parseInt(this.value));
				moveMultipleObjects(selectedObjects, nextObject.parent, nextObject);

			} else if ( area > 0.75 ) {
				// 在目标下方插入
				let nextObject, parent;

				if ( this.nextSibling !== null ) {
					nextObject = scene.getObjectById(parseInt(this.nextSibling.value));
					parent = nextObject.parent;
				} else {
					// 列表末尾（没有下一个对象）
					nextObject = null;
					parent = scene.getObjectById(parseInt(this.value)).parent;
				}

				moveMultipleObjects(selectedObjects, parent, nextObject);

			} else {
				// 作为目标的子级
				const parentObject = scene.getObjectById(parseInt(this.value));
				moveMultipleObjects(selectedObjects, parentObject);
			}
		}

		function moveMultipleObjects(objects, newParent, nextObject) {
			if (nextObject === null) nextObject = undefined;

			// 检查是否有循环引用
			for (let i = 0; i < objects.length; i++) {
				let object = objects[i];
				let newParentIsChild = false;

				object.traverse(function(child) {
					if (child === newParent) newParentIsChild = true;
				});

				if (newParentIsChild) return; // 如果存在循环引用则退出

				// 检查目标是否是被移动对象之一
				if (objects.indexOf(newParent) !== -1) return;
			}

			const editor = scope.editor;
			// 使用已经导入的MoveMultipleObjectsCommand
			const cmd = new MoveMultipleObjectsCommand(editor, objects, newParent, nextObject);
			editor.execute(cmd);

			const changeEvent = new CustomEvent('change', {
				bubbles: true,
				cancelable: true
			});
			scope.dom.dispatchEvent(changeEvent);
		}

		//

		scope.options = [];

		for ( let i = 0; i < options.length; i ++ ) {

			const div = options[ i ];
			div.className = 'option';
			scope.dom.appendChild( div );

			scope.options.push( div );

			div.addEventListener( 'click', onClick );

			if ( div.draggable === true ) {

				div.addEventListener( 'drag', onDrag );
				div.addEventListener( 'dragstart', onDragStart ); // Firefox needs this

				div.addEventListener( 'dragover', onDragOver );
				div.addEventListener( 'dragleave', onDragLeave );
				div.addEventListener( 'drop', onDrop );

			}


		}

		return scope;

	}

	getValue() {

		return this.selectedValue;

	}

	// 获取所有选中的值
	getValues() {
		return this.selectedValues.slice();
	}

	// 清除所有选择
	clearSelection() {
		for (let i = 0; i < this.options.length; i++) {
			this.options[i].classList.remove('active');
			this.options[i].classList.remove('multi-selected');
		}

		this.selectedIndices = [];
		this.selectedValues = [];
		this.selectedIndex = -1;
		this.selectedValue = null;
	}

	// 将项目添加到多选
	addToSelection(value, index) {
		if (index === undefined) {
			// 如果没有提供索引，查找它
			for (let i = 0; i < this.options.length; i++) {
				if (this.options[i].value === value) {
					index = i;
					break;
				}
			}
		}

		if (index >= 0 && index < this.options.length) {
			const element = this.options[index];

			if (this.selectedIndices.indexOf(index) === -1) {
				this.selectedIndices.push(index);
				this.selectedValues.push(value);
				element.classList.add('active');

				// 如果是多选状态，添加多选样式类
				if (this.selectedValues.length > 1) {
					// 为所有选中项添加多选样式
					for (let i = 0; i < this.selectedIndices.length; i++) {
						const selectedIndex = this.selectedIndices[i];
						this.options[selectedIndex].classList.add('multi-selected');
					}
				}
			}

			// 更新主选中索引
			this.selectedIndex = index;
			this.selectedValue = value;
		}
	}

	setValue(value, multiSelect) {
		if (!multiSelect) {
			// 单选模式 - 清除所有现有选择
			this.clearSelection();
		}

		// 查找值对应的元素
		let foundIndex = -1;

		for (let i = 0; i < this.options.length; i++) {
			const element = this.options[i];

			if (element.value === value) {
				foundIndex = i;

				// 在多选模式下，切换选择状态
				if (multiSelect) {
					const existingIndex = this.selectedValues.indexOf(value);

					if (existingIndex === -1) {
						// 添加到选择
						this.selectedIndices.push(i);
						this.selectedValues.push(value);
						element.classList.add('active');
					} else {
						// 从选择中移除
						this.selectedIndices.splice(existingIndex, 1);
						this.selectedValues.splice(existingIndex, 1);
						element.classList.remove('active');
						element.classList.remove('multi-selected');
					}
				} else {
					// 单选模式
					element.classList.add('active');
					this.selectedIndices = [i];
					this.selectedValues = [value];

					// 滚动到视图
					const y = element.offsetTop - this.dom.offsetTop;
					const bottomY = y + element.offsetHeight;
					const minScroll = bottomY - this.dom.offsetHeight;

					if (this.dom.scrollTop > y) {
						this.dom.scrollTop = y;
					} else if (this.dom.scrollTop < minScroll) {
						this.dom.scrollTop = minScroll;
					}
				}

				// 更新主选中索引和值
				this.selectedIndex = i;
				this.selectedValue = value;
			} else if (!multiSelect) {
				// 在单选模式下移除其他项的活动状态
				element.classList.remove('active');
				element.classList.remove('multi-selected');
			}
		}

		// 更新多选样式
		if (this.selectedValues.length > 1) {
			// 为所有选中项添加多选样式
			for (let i = 0; i < this.selectedIndices.length; i++) {
				const selectedIndex = this.selectedIndices[i];
				this.options[selectedIndex].classList.add('multi-selected');
			}
		} else {
			// 如果只有一个选中项，移除所有多选样式
			for (let i = 0; i < this.options.length; i++) {
				this.options[i].classList.remove('multi-selected');
			}
		}

		return this;
	}

}

class UIPoints extends UISpan {

	constructor() {

		super();

		this.dom.style.display = 'inline-block';

		this.pointsList = new UIDiv();
		this.add( this.pointsList );

		this.pointsUI = [];
		this.lastPointIdx = 0;
		this.onChangeCallback = null;

		// TODO Remove this bind() stuff

		this.update = function () {

			if ( this.onChangeCallback !== null ) {

				this.onChangeCallback();

			}

		}.bind( this );

	}

	onChange( callback ) {

		this.onChangeCallback = callback;

		return this;

	}

	clear() {

		for ( let i = 0; i < this.pointsUI.length; ++ i ) {

			if ( this.pointsUI[ i ] ) {

				this.deletePointRow( i, true );

			}

		}

		this.lastPointIdx = 0;

	}

	deletePointRow( idx, dontUpdate ) {

		if ( ! this.pointsUI[ idx ] ) return;

		this.pointsList.remove( this.pointsUI[ idx ].row );

		this.pointsUI.splice( idx, 1 );

		if ( dontUpdate !== true ) {

			this.update();

		}

		this.lastPointIdx --;

	}

}

class UIPoints2 extends UIPoints {

	constructor() {

		super();

		const row = new UIRow();
		this.add( row );

		const addPointButton = new UIButton( '+' );
		addPointButton.onClick( () => {

			if ( this.pointsUI.length === 0 ) {

				this.pointsList.add( this.createPointRow( 0, 0 ) );

			} else {

				const point = this.pointsUI[ this.pointsUI.length - 1 ];

				this.pointsList.add( this.createPointRow( point.x.getValue(), point.y.getValue() ) );

			}

			this.update();

		} );
		row.add( addPointButton );

	}

	getValue() {

		const points = [];

		let count = 0;

		for ( let i = 0; i < this.pointsUI.length; i ++ ) {

			const pointUI = this.pointsUI[ i ];

			if ( ! pointUI ) continue;

			points.push( new THREE.Vector2( pointUI.x.getValue(), pointUI.y.getValue() ) );
			++ count;
			pointUI.lbl.setValue( count );

		}

		return points;

	}

	setValue( points ) {

		this.clear();

		for ( let i = 0; i < points.length; i ++ ) {

			const point = points[ i ];
			this.pointsList.add( this.createPointRow( point.x, point.y ) );

		}

		this.update();
		return this;

	}

	createPointRow( x, y ) {

		const pointRow = new UIDiv();
		const lbl = new UIText( this.lastPointIdx + 1 ).setWidth( '20px' );
		const txtX = new UINumber( x ).setWidth( '30px' ).onChange( this.update );
		const txtY = new UINumber( y ).setWidth( '30px' ).onChange( this.update );

		const scope = this;
		const btn = new UIButton( '-' ).onClick( function () {

			if ( scope.isEditing ) return;

			const idx = scope.pointsList.getIndexOfChild( pointRow );
			scope.deletePointRow( idx );

		} );

		this.pointsUI.push( { row: pointRow, lbl: lbl, x: txtX, y: txtY } );
		++ this.lastPointIdx;
		pointRow.add( lbl, txtX, txtY, btn );

		return pointRow;

	}

}

class UIPoints3 extends UIPoints {

	constructor() {

		super();

		const row = new UIRow();
		this.add( row );

		const addPointButton = new UIButton( '+' );
		addPointButton.onClick( () => {

			if ( this.pointsUI.length === 0 ) {

				this.pointsList.add( this.createPointRow( 0, 0, 0 ) );

			} else {

				const point = this.pointsUI[ this.pointsUI.length - 1 ];

				this.pointsList.add( this.createPointRow( point.x.getValue(), point.y.getValue(), point.z.getValue() ) );

			}

			this.update();

		} );
		row.add( addPointButton );

	}

	getValue() {

		const points = [];
		let count = 0;

		for ( let i = 0; i < this.pointsUI.length; i ++ ) {

			const pointUI = this.pointsUI[ i ];

			if ( ! pointUI ) continue;

			points.push( new THREE.Vector3( pointUI.x.getValue(), pointUI.y.getValue(), pointUI.z.getValue() ) );
			++ count;
			pointUI.lbl.setValue( count );

		}

		return points;

	}

	setValue( points ) {

		this.clear();

		for ( let i = 0; i < points.length; i ++ ) {

			const point = points[ i ];
			this.pointsList.add( this.createPointRow( point.x, point.y, point.z ) );

		}

		this.update();
		return this;

	}

	createPointRow( x, y, z ) {

		const pointRow = new UIDiv();
		const lbl = new UIText( this.lastPointIdx + 1 ).setWidth( '20px' );
		const txtX = new UINumber( x ).setWidth( '30px' ).onChange( this.update );
		const txtY = new UINumber( y ).setWidth( '30px' ).onChange( this.update );
		const txtZ = new UINumber( z ).setWidth( '30px' ).onChange( this.update );

		const scope = this;
		const btn = new UIButton( '-' ).onClick( function () {

			if ( scope.isEditing ) return;

			const idx = scope.pointsList.getIndexOfChild( pointRow );
			scope.deletePointRow( idx );

		} );

		this.pointsUI.push( { row: pointRow, lbl: lbl, x: txtX, y: txtY, z: txtZ } );
		++ this.lastPointIdx;
		pointRow.add( lbl, txtX, txtY, txtZ, btn );

		return pointRow;

	}

}

class UIBoolean extends UISpan {

	constructor( boolean, text ) {

		super();

		this.setMarginRight( '4px' );

		this.checkbox = new UICheckbox( boolean );
		this.text = new UIText( text ).setMarginLeft( '3px' );

		this.add( this.checkbox );
		this.add( this.text );

	}

	getValue() {

		return this.checkbox.getValue();

	}

	setValue( value ) {

		return this.checkbox.setValue( value );

	}

}

let renderer;

function renderToCanvas( texture ) {

	if ( renderer === undefined ) {

		renderer = new THREE.WebGLRenderer();
		renderer.outputEncoding = THREE.sRGBEncoding;

	}

	const image = texture.image;

	renderer.setSize( image.width, image.height, false );

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );

	const material = new THREE.MeshBasicMaterial( { map: texture } );
	const quad = new THREE.PlaneGeometry( 2, 2 );
	const mesh = new THREE.Mesh( quad, material );
	scene.add( mesh );

	renderer.render( scene, camera );

	return renderer.domElement;

}

export { UITexture, UICubeTexture, UIOutliner, UIPoints, UIPoints2, UIPoints3, UIBoolean };
