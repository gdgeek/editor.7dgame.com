import {
	SPACE_REFERENCE_VISIBILITY_ACTION,
	formatSpaceReferenceLabel,
	normalizeSpaceReferenceVisibility
} from '../mrpp/SpaceReference.js';
import type { MrppEditor } from '../types/mrpp.js';

const CONTROL_ID = 'mrpp-space-reference-control';
const STYLE_ID = 'mrpp-space-reference-control-style';

function getSpacePrefix( editor: MrppEditor ): string {

	const value = editor.strings?.getKey?.( 'space/reference/prefix' );
	return value && value !== 'space/reference/prefix' ? value : 'Space';

}

function injectSpaceReferenceControlStyle(): void {

	if ( document.getElementById( STYLE_ID ) ) return;

	const style = document.createElement( 'style' );
	style.id = STYLE_ID;
	style.textContent = `
		#${ CONTROL_ID } {
			position: absolute;
			left: calc(50% - 175px);
			bottom: 98px;
			z-index: 25;
			display: inline-flex;
			align-items: center;
			gap: 6px;
			max-width: min(360px, calc(100% - 420px));
			min-height: 28px;
			padding: 3px 6px 3px 10px;
			box-sizing: border-box;
			color: #334155;
			font: 13px/18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			white-space: nowrap;
			background: rgba(255, 255, 255, 0.92);
			border: 1px solid rgba(148, 163, 184, 0.45);
			border-radius: 6px;
			box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
			transform: translateX(-50%);
		}

		#${ CONTROL_ID }[hidden] {
			display: none !important;
		}

		#${ CONTROL_ID }.is-hidden {
			color: #64748b;
			background: rgba(255, 255, 255, 0.76);
		}

		#${ CONTROL_ID } .space-reference-label {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		#${ CONTROL_ID } .space-reference-toggle {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 22px;
			height: 22px;
			padding: 0;
			color: inherit;
			cursor: pointer;
			background: transparent;
			border: 0;
			border-radius: 4px;
		}

		#${ CONTROL_ID } .space-reference-toggle:hover {
			color: #2563eb;
			background: rgba(37, 99, 235, 0.08);
		}

		#${ CONTROL_ID } .space-reference-toggle svg {
			width: 15px;
			height: 15px;
			fill: none;
			stroke: currentColor;
			stroke-width: 2;
			stroke-linecap: round;
			stroke-linejoin: round;
		}

		@media (max-width: 900px) {
			#${ CONTROL_ID } {
				left: 50%;
				max-width: min(320px, calc(100% - 32px));
			}
		}
	`;
	document.head.appendChild( style );

}

function getSpace( editor: MrppEditor ): any {

	return editor.data?.space || null;

}

function getEyeIcon( visible: boolean ): string {

	const slash = visible ? '' : '<path d="M4 20L20 4" />';
	return `
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
			<circle cx="12" cy="12" r="2.5" />
			${ slash }
		</svg>
	`;

}

export function installSpaceReferenceControl( editor: MrppEditor ): void {

	if ( document.getElementById( CONTROL_ID ) ) return;

	const toolbar = document.getElementById( 'toolbar' );
	if ( ! toolbar || ! toolbar.parentElement ) return;

	injectSpaceReferenceControlStyle();

	const control = document.createElement( 'div' );
	control.id = CONTROL_ID;

	const label = document.createElement( 'span' );
	label.className = 'space-reference-label';
	control.appendChild( label );

	const toggle = document.createElement( 'button' );
	toggle.type = 'button';
	toggle.className = 'space-reference-toggle';
	control.appendChild( toggle );

	toolbar.parentElement.appendChild( control );

	function update(): void {

		const space = getSpace( editor );
		const text = formatSpaceReferenceLabel( space, getSpacePrefix( editor ) );
		const hasSpace = Boolean( text || editor.spaceReference?.hasObject );
		const isVisible = Boolean( editor.spaceReference?.isVisible?.() );

		control.hidden = ! hasSpace;
		control.classList.toggle( 'is-hidden', hasSpace && ! isVisible );
		label.textContent = text;
		label.title = text;

		const toggleTitle = editor.strings.getKey( isVisible ? 'menubar/space/hide' : 'menubar/space/show' );
		toggle.title = toggleTitle;
		toggle.setAttribute( 'aria-label', toggleTitle );
		toggle.innerHTML = getEyeIcon( isVisible );

	}

	toggle.addEventListener( 'click', function ( event ) {

		event.preventDefault();
		event.stopPropagation();

		if ( editor.spaceReference ) {

			editor.spaceReference.toggleVisibility();
			update();

		}

	} );

	editor.signals.messageReceive.add( function ( params: any ) {

		if ( params.action === 'load' ) {

			const data = params.data;
			if ( ! editor.data ) editor.data = {};
			editor.data.space = data.data?.space || null;
			update();

		}

		if ( params.action === SPACE_REFERENCE_VISIBILITY_ACTION ) {

			editor.spaceReference?.setVisible(
				normalizeSpaceReferenceVisibility( params.data )
			);
			update();

		}

	} );

	editor.signals.sceneGraphChanged.add( update );
	update();

}
