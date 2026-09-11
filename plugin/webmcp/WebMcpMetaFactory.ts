import { MetaFactory } from '../mrpp/MetaFactory.js';

/** Interactive loading can show placeholders; automation must report missing assets. */
export class WebMcpMetaFactory extends MetaFactory {
	async getEmpty( data: any, _resources: Map<string, any> ): Promise<never> {
		throw new Error( `节点 ${ data?.parameters?.name ?? '' } (${ data?.type ?? '' }) 未能加载，未放入占位节点` );
	}
}
