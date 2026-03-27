import { SceneCreater } from './SceneCreater.js';

class EditorLoader {

	/**
	 * @param {object} editor - Editor 实例
	 */
	constructor( editor ) {

		this.editor = editor;
		this.creater = new SceneCreater( editor );

	}

	/**
	 * 加载场景数据并绘制到编辑器中。
	 * @param {{ data: string, resources: Array<object> }} input - 包含 JSON 数据和资源列表的输入对象
	 */
	load( input ) {

		const data = JSON.parse( input.data );

		this.editor.clear();
		this.creater
			.loadResources( input.resources )
			.then( resources => {

				this.creater.draw( data, resources );

			} )
			.catch( error => {

				console.error( 'EditorLoader error:', error );

			} );

	}

}

export { EditorLoader };
