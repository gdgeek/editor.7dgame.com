import { UIPanel } from './libs/ui.js';

import { MenubarAdd } from './Menubar.Add.js';
import { MenubarEdit } from './Menubar.Edit.js';
import { MenubarFile } from './Menubar.File.js';
// import { MenubarExamples } from './Menubar.Examples.js'
import { MenubarView } from './Menubar.View.js';
import { MenubarHelp } from './Menubar.Help.js';
// import { MenubarPlay } from './Menubar.Play.js'
import { MenubarStatus } from './Menubar.Status.js';

// --- MRPP MODIFICATION START ---
// import { MenubarReplace } from '../../../plugin/ui/menubar/Menubar.Replace.js';  // 替换功能已移入编辑菜单
import { MenubarGoto } from '../../../plugin/ui/menubar/Menubar.Goto.js';
import { MenubarComponent } from '../../../plugin/ui/menubar/Menubar.Component.js';
import { MenubarCommand } from '../../../plugin/ui/menubar/Menubar.Command.js';
import { MenubarScreenshot } from '../../../plugin/ui/menubar/Menubar.Screenshot.js';
import { MenubarScene } from '../../../plugin/ui/menubar/Menubar.Scene.js';
// --- MRPP MODIFICATION END ---

function Menubar(editor) {

	const container = new UIPanel();
	container.setId('menubar');

	container.add(new MenubarFile(editor));
	container.add(new MenubarEdit(editor));
	container.add(new MenubarAdd(editor));
	// --- MRPP MODIFICATION START ---
	// container.add( new MenubarReplace( editor ) );  // 替换功能已移入编辑菜单
	//container.add( new MenubarComponent( editor ) );
	//container.add( new MenubarCommand( editor ) );
	if ( editor.type && editor.type.toLowerCase() === 'meta' ) {
		container.add( new MenubarScene( editor ) );
	} else {
		container.add( new MenubarScreenshot( editor ) );
	}
	container.add( new MenubarGoto( editor ) );
	// --- MRPP MODIFICATION END ---
	// container.add(new MenubarPlay(editor))
	// container.add(new MenubarExamples(editor))
	//container.add(new MenubarView(editor))
	//container.add(new MenubarHelp(editor))

	container.add(new MenubarStatus(editor));

	return container;

}

export { Menubar };
