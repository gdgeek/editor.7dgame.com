import { UIPanel } from './libs/ui.js';

import { MenubarAdd } from './Menubar.Add.js';
import { MenubarReplace } from './Menubar.Replace.js';
import { MenubarGoto } from './Menubar.Goto.js';
import { MenubarEdit } from './Menubar.Edit.js';
import { MenubarFile } from './Menubar.File.js';
// import { MenubarExamples } from './Menubar.Examples.js'
import { MenubarView } from './Menubar.View.js';
import { MenubarHelp } from './Menubar.Help.js';
// import { MenubarPlay } from './Menubar.Play.js'
import { MenubarStatus } from './Menubar.Status.js';
import { MenubarComponent } from './Menubar.Component.js';
import { MenubarCommand } from './Menubar.Command.js';
import { MenubarScreenshot } from './Menubar.Screenshot.js';

function Menubar( editor ) {

	const container = new UIPanel();
	container.setId( 'menubar' );

	container.add( new MenubarFile( editor ) );
	container.add( new MenubarEdit( editor ) );
	container.add( new MenubarAdd( editor ) );
	container.add( new MenubarReplace( editor ) );
	container.add( new MenubarComponent( editor ) );
	container.add( new MenubarCommand( editor ) );
	container.add( new MenubarScreenshot( editor ) );
	container.add( new MenubarGoto( editor ) );
	// container.add(new MenubarPlay(editor))
	// container.add(new MenubarExamples(editor))
	//container.add(new MenubarView(editor))
	//container.add(new MenubarHelp(editor))

	container.add( new MenubarStatus( editor ) );

	return container;

}

export { Menubar };
