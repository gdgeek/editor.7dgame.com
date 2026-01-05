import { UIPanel, UIBreak, UIButton, UIDiv, UIText, UIRow, UISelect, UIInput } from './libs/ui.js';

function SidebarAnimation(editor) {
	const strings = editor.strings;
	const signals = editor.signals;
	const mixer = editor.mixer;

	// SVG 图标
	const ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5.14v14l11-7-11-7z"/></svg>';
	const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
	const ICON_STOP = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>';

	const animationStates = new Map();

	function getAnimationState(object) {
		if (!animationStates.has(object.uuid)) {
			animationStates.set(object.uuid, { currentAction: null, isPlaying: false });
		}
		return animationStates.get(object.uuid);
	}

	const container = new UIPanel();
	container.setDisplay('none');

	container.add(new UIText(strings.getKey('sidebar/animations/preview')).setTextTransform('uppercase'));
	container.add(new UIBreak(), new UIBreak());

	const animationsList = new UIDiv();
	container.add(animationsList);

	let updateRequestId = null;

	function createAnimationControls(object, animations) {
		animationsList.clear();
		const state = getAnimationState(object);

		// --- 1. 动画选择 ---
		const animSelectRow = new UIRow();
		animSelectRow.add(new UIText(strings.getKey('sidebar/animations/select')).setWidth('90px'));
		const animSelect = new UISelect().setWidth('160px');
		const options = {};
		animations.forEach(anim => options[anim.name] = anim.name);
		animSelect.setOptions(options);
		if (animations.length > 0) animSelect.setValue(animations[0].name);
		animSelectRow.add(animSelect);
		animationsList.add(animSelectRow);

		// --- 2. 播放控制 ---
		const controlsRow = new UIRow();
		controlsRow.add(new UIText('').setWidth('90px'));

		const createIconButton = (html) => {
			const btn = new UIButton();
			btn.dom.innerHTML = html;
			btn.dom.style.display = 'inline-flex';
			btn.dom.style.alignItems = 'center';
			btn.dom.style.justifyContent = 'center';
			btn.setWidth('36px').setHeight('24px').setMarginRight('4px');
			return btn;
		};

		const playBtn = createIconButton(ICON_PLAY);
		const pauseBtn = createIconButton(ICON_PAUSE);
		const stopBtn = createIconButton(ICON_STOP);

		controlsRow.add(playBtn, pauseBtn, stopBtn);
		animationsList.add(controlsRow);

		// --- 3. 进度条 ---
		const progressRow = new UIRow();
		progressRow.add(new UIText(strings.getKey('sidebar/animations/progress')).setWidth('90px'));
		
		const progressBar = new UIInput().setWidth('160px');
		progressBar.dom.type = 'range';
		progressBar.dom.min = 0;
		progressBar.dom.max = 1;
		progressBar.dom.step = 0.001;
		progressBar.dom.style.marginTop = '8px';
		progressRow.add(progressBar);
		animationsList.add(progressRow);

		// --- 4. 时间显示 ---
		const timeInfoRow = new UIDiv();
		timeInfoRow.dom.style.paddingLeft = '90px';
		timeInfoRow.dom.style.marginTop = '-4px';
		
		const timeDisplay = new UIText('0.00s / 0.00s').setFontSize('10px').setOpacity(0.5);
		timeDisplay.dom.style.width = '160px';
		timeDisplay.dom.style.textAlign = 'right';
		
		timeInfoRow.add(timeDisplay);
		animationsList.add(timeInfoRow);

		// --- 逻辑处理 ---

		function getAction() {
			const name = animSelect.getValue();
			if (state.currentAction && state.currentAction.getClip().name === name) {
				return state.currentAction;
			}
			if (state.currentAction) state.currentAction.stop();
			const clip = animations.find(a => a.name === name);
			if (!clip) return null;

			const animationClip = (clip instanceof THREE.AnimationClip) ? clip : THREE.AnimationClip.parse(clip);
			state.currentAction = mixer.clipAction(animationClip, object);
			return state.currentAction;
		}

		// 判定阈值设为 0.03s
		const EPSILON = 0.03;

		function refreshUIStatus() {
			const action = getAction();
			if (!action) return;

			const duration = action.getClip().duration;
			
			if (duration < EPSILON) {
				// 判定为静态，但显示真实时长
				playBtn.setDisabled(true);
				pauseBtn.setDisabled(true);
				progressBar.dom.disabled = true;
				progressBar.dom.value = 1;
				timeDisplay.setValue(`${duration.toFixed(2)}s / ${duration.toFixed(2)}s`);
				state.isPlaying = false;
				if (updateRequestId) cancelAnimationFrame(updateRequestId);
			} else {
				// 正常可播放状态
				playBtn.setDisabled(false);
				pauseBtn.setDisabled(false);
				progressBar.dom.disabled = false;
				const progress = action.time / duration;
				progressBar.dom.value = isNaN(progress) ? 0 : progress;
				timeDisplay.setValue(`${action.time.toFixed(2)}s / ${duration.toFixed(2)}s`);
			}
		}

		function updateUI() {
			const action = getAction();
			if (action && action.getClip().duration >= EPSILON && state.isPlaying) {
				const duration = action.getClip().duration;
				progressBar.dom.value = action.time / duration;
				timeDisplay.setValue(`${action.time.toFixed(2)}s / ${duration.toFixed(2)}s`);
				updateRequestId = requestAnimationFrame(updateUI);
			} else {
				state.isPlaying = false;
				cancelAnimationFrame(updateRequestId);
			}
		}

		playBtn.onClick(() => {
			const action = getAction();
			if (action && action.getClip().duration >= EPSILON) {
				action.paused = false;
				action.play();
				state.isPlaying = true;
				if (updateRequestId) cancelAnimationFrame(updateRequestId);
				updateUI();
			}
		});

		pauseBtn.onClick(() => {
			const action = getAction();
			if (action) {
				action.paused = true;
				state.isPlaying = false;
				cancelAnimationFrame(updateRequestId);
			}
		});

		stopBtn.onClick(() => {
			const action = getAction();
			if (action) {
				action.stop();
				state.isPlaying = false;
				cancelAnimationFrame(updateRequestId);
				refreshUIStatus();
			}
		});

		progressBar.dom.addEventListener('input', () => {
			const action = getAction();
			if (action && action.getClip().duration >= EPSILON) {
				const duration = action.getClip().duration;
				if (!state.isPlaying) {
					action.play();
					action.paused = true;
				}
				action.time = progressBar.dom.value * duration;
				mixer.update(0);
				timeDisplay.setValue(`${action.time.toFixed(2)}s / ${duration.toFixed(2)}s`);
			}
		});

		animSelect.onChange(() => {
			state.isPlaying = false;
			cancelAnimationFrame(updateRequestId);
			refreshUIStatus();
		});

		refreshUIStatus();
		container.setDisplay('');
	}

	signals.objectSelected.add(function (object) {
		if (updateRequestId) cancelAnimationFrame(updateRequestId);
		if (object && ((object.animations && object.animations.length > 0) || 
			(object.userData && object.userData.animations && object.userData.animations.length > 0))) {
			createAnimationControls(object, object.animations || object.userData.animations);
		} else {
			container.setDisplay('none');
		}
	});

	return {
		container,
		update: function (object) {
			if (object) {
				const anims = object.animations || (object.userData ? object.userData.animations : null);
				if (anims && anims.length > 0) {
					createAnimationControls(object, anims);
					return;
				}
			}
			container.setDisplay('none');
		}
	};
}

export { SidebarAnimation };