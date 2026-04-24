type EditorLike = {
	clearSelection?: () => void;
	clear?: () => void;
};

export function prepareMetaLoadState(editor: EditorLike): void {
	if (typeof editor.clearSelection === 'function') {
		editor.clearSelection();
	}

	if (typeof editor.clear === 'function') {
		editor.clear();
	}
}
