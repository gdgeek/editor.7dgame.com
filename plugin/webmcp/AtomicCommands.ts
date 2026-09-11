import type { MrppEditor } from '../types/mrpp.js';

/** The upstream history queues before execute; restore its bookkeeping on failure. */
export function executeAtomicCommand( editor: MrppEditor, command: any ): void {
	const history = ( editor as any ).history;
	const saved = history && {
		undos: history.undos.slice(), redos: history.redos.slice(),
		idCounter: history.idCounter, lastCmdTime: history.lastCmdTime
	};
	try { editor.execute( command ); } catch ( error ) {
		if ( saved ) Object.assign( history, saved );
		throw error;
	}
}

export function addObjectAtomically( editor: MrppEditor, command: any ): void {
	const selected = editor.selected;
	try { executeAtomicCommand( editor, command ); } catch ( error ) {
		if ( command.object.parent ) editor.removeObject( command.object );
		editor.select( selected );
		throw error;
	}
}
