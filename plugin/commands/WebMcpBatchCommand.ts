import { MultiCmdsCommand } from '../../three.js/editor/js/commands/MultiCmdsCommand.js';
import type { MrppEditor } from '../types/mrpp.js';

/** Project-owned execution policy; retains the editor's compound-command serialization. */
export class WebMcpBatchCommand extends MultiCmdsCommand {
	constructor( editor: MrppEditor, commands: any[] ) { super( editor, commands ); }

	private run( commands: any[], method: 'execute' | 'undo', rollback: 'execute' | 'undo' ): void {
		const signal = this.editor.signals.sceneGraphChanged;
		const active = signal.active;
		const attempted: any[] = [];
		signal.active = false;
		try {
			for ( const child of commands ) { attempted.push( child ); child[ method ](); }
		} catch ( error ) {
			const failures: unknown[] = [];
			for ( const child of attempted.reverse() ) {
				try { child[ rollback ](); } catch ( failure ) { failures.push( failure ); }
			}
			if ( failures.length ) throw new AggregateError( [ error, ...failures ], '操作失败，部分更改未能回滚；请检查当前编辑内容后再操作' );
			throw error;
		} finally { signal.active = active; signal.dispatch(); }
	}

	execute(): void { this.run( this.cmdArray, 'execute', 'undo' ); }
	undo(): void { this.run( [ ...this.cmdArray ].reverse(), 'undo', 'execute' ); }
}
