import { UIPanel, UIBreak, UIButton, UIDiv, UIText, UINumber, UIRow, UISelect } from './libs/ui.js';

function SidebarAnimation( editor ) {

	const strings = editor.strings;
	const signals = editor.signals;
	const mixer = editor.mixer;

	// 存储每个对象的动画状态，使用对象UUID作为键
	const animationStates = new Map();

	// 获取对象的动画状态，如果不存在则创建
	function getAnimationState(object) {
		if (!animationStates.has(object.uuid)) {
			animationStates.set(object.uuid, {
				currentAction: null,
				isPlaying: false
			});
		}
		return animationStates.get(object.uuid);
	}

	function getButtonText( action ) {
		return action.isRunning()
			? strings.getKey( 'sidebar/animations/stop' )
			: strings.getKey( 'sidebar/animations/play' );
	}

	// 播放指定动画
	function playAnimation(object, animation, playButton) {
		const state = getAnimationState(object);

		// 如果当前有动画正在播放，先停止
		if (state.currentAction) {
			state.currentAction.stop();
		}

		// 播放选中的动画
		if (animation instanceof THREE.AnimationClip) {
			// 处理标准Three.js动画
			state.currentAction = mixer.clipAction(animation, object);
		} else if (object.animations) {
			// 查找匹配的动画对象
			const clipAnimation = object.animations.find(a => a.name === animation.name);
			if (clipAnimation) {
				state.currentAction = mixer.clipAction(clipAnimation, object);
			}
		}

		if (state.currentAction) {
			state.currentAction.play();
			state.isPlaying = true;
			if(playButton) {
				playButton.setTextContent(strings.getKey('sidebar/animations/stop'));
			}
		}
	}

	// 停止当前动画
	function stopAnimation(object, playButton) {
		const state = getAnimationState(object);

		if (state.currentAction) {
			state.currentAction.stop();
			state.currentAction = null;
		}
		state.isPlaying = false;
		if(playButton) {
			playButton.setTextContent(strings.getKey('sidebar/animations/play'));
		}
	}

	// 创建动画控制面板
	function createAnimationControls(object, animations) {
		animationsList.clear();

		// 获取或创建对象的动画状态
		const state = getAnimationState(object);

		// 创建动画选择下拉框和播放按钮在同一行
		const animSelectRow = new UIRow();
		animSelectRow.add(new UIText(strings.getKey('sidebar/animations/select')).setWidth('90px'));

		const animSelect = new UISelect().setWidth('100px');
		let options = {};

		// 添加动画选项
		animations.forEach((animation) => {
			options[animation.name] = animation.name;
		});

		animSelect.setOptions(options);

		// 默认选择第一个动画但不播放
		if (animations.length > 0) {
			animSelect.setValue(animations[0].name);
		}

		// 播放/停止按钮
		const playButton = new UIButton(strings.getKey('sidebar/animations/play'));

		// 如果该对象已经有正在播放的动画，更新按钮状态
		if (state.isPlaying) {
			playButton.setTextContent(strings.getKey('sidebar/animations/stop'));
		}

		// 下拉框选择事件
		animSelect.onChange(function() {
			const selectedAnim = animSelect.getValue();

			// 查找选中的动画
			const animation = animations.find(anim => {
				if (anim instanceof THREE.AnimationClip) {
					return anim.name === selectedAnim;
				} else {
					return anim.name === selectedAnim;
				}
			});

			if (animation) {
				// 无论当前状态如何，切换动画时都自动播放新动画
				playAnimation(object, animation, playButton);
			}
		});

		animSelectRow.add(animSelect);

		// 播放/停止按钮直接放在下拉框旁边
		playButton.onClick(function() {
			const selectedAnim = animSelect.getValue();

			// 查找选中的动画
			const animation = animations.find(anim => {
				if (anim instanceof THREE.AnimationClip) {
					return anim.name === selectedAnim;
				} else {
					return anim.name === selectedAnim;
				}
			});

			if (animation) {
				if (!state.isPlaying) {
					// 播放选中的动画
					playAnimation(object, animation, playButton);
				} else {
					// 停止当前动画
					stopAnimation(object, playButton);
				}
			}
		});

		animSelectRow.add(playButton);
		animationsList.add(animSelectRow);

		// 显示动画面板
		container.setDisplay('');
	}

	signals.objectSelected.add(function(object) {
		if (object !== null) {
			// 检查对象本身的animations数组
			if (object.animations && object.animations.length > 0) {
				createAnimationControls(object, object.animations);
			}
			// 检查MRPP自定义动画信息
			else if (object.userData && object.userData.animations && object.userData.animations.length > 0) {
				createAnimationControls(object, object.userData.animations);
			}
			else {
				container.setDisplay('none');
			}
		} else {
			container.setDisplay('none');
		}
	});

	signals.objectRemoved.add(function(object) {
		if (object !== null) {
			// 移除动画状态
			if (animationStates.has(object.uuid)) {
				const state = animationStates.get(object.uuid);
				if (state.currentAction) {
					state.currentAction.stop();
				}
				animationStates.delete(object.uuid);
			}

			if (object.animations && object.animations.length > 0) {
				mixer.uncacheRoot(object);
			}
		}
	});

	const container = new UIPanel();
	container.setDisplay('none');

	container.add(new UIText(strings.getKey('sidebar/animations')).setTextTransform('uppercase'));
	container.add(new UIBreak());
	container.add(new UIBreak());

	const animationsList = new UIDiv();
	container.add(animationsList);

	const mixerTimeScaleRow = new UIRow();
	const mixerTimeScaleNumber = new UINumber(1.0).setWidth('60px').setRange(-10, 10);
	mixerTimeScaleNumber.onChange(function() {
		mixer.timeScale = mixerTimeScaleNumber.getValue();
	});

	mixerTimeScaleRow.add(new UIText(strings.getKey('sidebar/animations/timescale')).setWidth('90px'));
	mixerTimeScaleRow.add(mixerTimeScaleNumber);

	container.add(mixerTimeScaleRow);

	return container;
}

export { SidebarAnimation };
