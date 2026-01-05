import { UIPanel, UIBreak, UIText, UISpan } from './libs/ui.js';

function ViewportInfo( editor ) {

	const signals = editor.signals;
	const strings = editor.strings;

	const container = new UIPanel();
	container.setId( 'info' );
	container.setPosition( 'absolute' );
	container.setLeft( '10px' );
	container.setBottom( '10px' );
	container.setFontSize( '12px' );
	container.setColor( '#fff' );
	container.dom.style.pointerEvents = 'none';
	container.dom.style.userSelect = 'none';

	// 增加一个范围标识，提示用户当前看的是“总计”还是“选中项”
	const scopeText = new UIText( '' ).setTextTransform( 'uppercase' ).setOpacity( 0.5 );
	
	const objectsText = new UIText( '0' ).setMarginLeft( '6px' );
	const verticesText = new UIText( '0' ).setMarginLeft( '6px' );
	const trianglesText = new UIText( '0' ).setMarginLeft( '6px' );
	const frametimeText = new UIText( '0' ).setMarginLeft( '6px' );

	container.add( scopeText, new UIBreak() ); // 显示 [TOTAL] 或 [SELECTED]
	container.add( new UIText( strings.getKey( 'viewport/info/objects' ) ).setTextTransform( 'lowercase' ) );
	container.add( objectsText, new UIBreak() );
	container.add( new UIText( strings.getKey( 'viewport/info/vertices' ) ).setTextTransform( 'lowercase' ) );
	container.add( verticesText, new UIBreak() );
	container.add( new UIText( strings.getKey( 'viewport/info/triangles' ) ).setTextTransform( 'lowercase' ) );
	container.add( trianglesText, new UIBreak() );
	container.add( new UIText( strings.getKey( 'viewport/info/frametime' ) ).setTextTransform( 'lowercase' ) );
	container.add( frametimeText, new UIBreak() );

	// --- 信号监听 ---

	signals.objectAdded.add( update );
	signals.objectRemoved.add( update );
	signals.geometryChanged.add( update );
	signals.sceneGraphChanged.add( update );
	
	// 核心信号：当选择发生变化时触发更新
	signals.objectSelected.add( update );

	function update() {

		const scene = editor.scene;
		const selected = editor.selected; // 获取当前选中的对象

		let objects = 0, vertices = 0, triangles = 0;

		// 核心逻辑：决定遍历的根节点
		if ( selected ) {
			
			// 情况 A：显示选中对象的信息
			scopeText.setValue( '[ Selected ]' );
			selected.traverse( function ( object ) {
				countStats( object );
			} );
			
			// 对于选中统计，objects 就是选中的树节点总数
			objectsText.setValue( objects.toLocaleString() );

		} else {
			
			// 情况 B：无选择，显示全场景总和
			scopeText.setValue( '[ Total ]' );
			scene.traverse( function ( object ) {
				countStats( object );
			} );
			
			// 排除场景根节点本身
			objectsText.setValue( Math.max( 0, objects - 1 ).toLocaleString() );
		}

		// 通用统计函数
		function countStats( object ) {
			
			objects ++;

			if ( object.isMesh ) {

				const geometry = object.geometry;

				if ( geometry && geometry.attributes.position ) {

					vertices += geometry.attributes.position.count;

					if ( geometry.index !== null ) {
						triangles += geometry.index.count / 3;
					} else {
						triangles += geometry.attributes.position.count / 3;
					}
				}

			} else if ( object.isPoints || object.isLine ) {
				const geometry = object.geometry;
				if ( geometry && geometry.attributes.position ) {
					vertices += geometry.attributes.position.count;
				}
			}
		}

		verticesText.setValue( vertices.toLocaleString() );
		trianglesText.setValue( Math.floor( triangles ).toLocaleString() );

	}

	// --- 帧率监听 ---

	signals.sceneRendered.add( updateFrametime );

	function updateFrametime( frametime ) {
		frametimeText.setValue( Number( frametime ).toFixed( 2 ) + ' ms' );
	}

	// 初始化执行
	update();

	return container;

}

export { ViewportInfo };