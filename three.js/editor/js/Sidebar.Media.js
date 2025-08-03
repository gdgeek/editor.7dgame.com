import { UIPanel, UIBreak, UIRow, UIText, UIButton, UISelect, UINumber, UIDiv, UICheckbox } from './libs/ui.js';
import * as THREE from 'three';
import { SetValueCommand } from './commands/SetValueCommand.js';

function SidebarMedia(editor) {
    const strings = editor.strings;
    const signals = editor.signals;

    const mediaPlayers = new Map();

    function getMediaPlayer(object) {
        if (!mediaPlayers.has(object.uuid)) {
            // 确保userData存在
            if (!object.userData) {
                object.userData = {};
            }

            const mediaType = getMediaType(object);
            if (mediaType === 'video') {
				console.log("videourl", getMediaUrl(object));
                const videoElement = document.createElement('video');
                videoElement.crossOrigin = 'anonymous';
                videoElement.loop = object.userData.loop || false;
                videoElement.muted = object.userData.muted || false;
                videoElement.style.display = 'none';
                document.body.appendChild(videoElement);

                videoElement.addEventListener('error', function(e) {
                    console.error('视频错误:', e);
                    if (object === currentObject && currentTimeText) {
                        currentTimeText.setTextContent('加载视频失败');
                    }
                });

                const mediaPlayer = {
                    type: 'video',
                    element: videoElement,
                    texture: new THREE.VideoTexture(videoElement),
                    isPlaying: object.userData.play || false,
                    volume: object.userData.volume || 1.0,
                    rate: object.userData.rate || 1.0,
                    url: getMediaUrl(object),
                    loop: object.userData.loop || false,
                    muted: object.userData.muted || false,
                    loaded: false
                };

                videoElement.volume = object.userData.volume || 1.0;
                videoElement.rate = 1.0;

                videoElement.addEventListener('loadeddata', function() {
                    mediaPlayer.loaded = true;
                });

                mediaPlayers.set(object.uuid, mediaPlayer);
            } else if (mediaType === 'audio') {
				console.log("audiourl", getMediaUrl(object));
                const audioElement = document.createElement('audio');
                audioElement.crossOrigin = 'anonymous';
                audioElement.loop = object.userData.loop || true;
                audioElement.style.display = 'none';
                document.body.appendChild(audioElement);

                audioElement.addEventListener('error', function(e) {
                    console.error('音频错误:', e);
                    if (object === currentObject && currentTimeText) {
                        currentTimeText.setTextContent('加载音频失败');
                    }
                });

                const mediaPlayer = {
                    type: 'audio',
                    element: audioElement,
                    isPlaying: object.userData.play || false,
                    volume: object.userData.volume || 1.0,
                    rate: object.userData.rate || 1.0,
                    url: getMediaUrl(object),
                    loop: object.userData.loop || true,
                    loaded: false
                };

                audioElement.volume = object.userData.volume || 1.0;
                audioElement.rate = 1.0;

                audioElement.addEventListener('loadeddata', function() {
                    mediaPlayer.loaded = true;
                });

                mediaPlayers.set(object.uuid, mediaPlayer);
            }
        }
        return mediaPlayers.get(object.uuid);
    }

    function getMediaType(object) {
        if (object.userData && object.userData.type) {
            if (object.userData.type.toLowerCase() === 'video') return 'video';
            if (object.userData.type.toLowerCase() === 'sound') return 'audio';

            if (object.userData.type.toLowerCase() === 'particle') {
                if (object.userData.isVideo) return 'video';
                if (object.userData.isAudio) return 'audio';
            }
        }

        return null;
    }

    // 从对象获取媒体URL
    function getMediaUrl(object) {
		console.error("object", object);

        if (object.userData && object.userData.src) {
            return object.userData.src;
        }

        // Add support for particle media URLs
        if (object.userData) {
            // Check for audio URL in particles
            if (object.userData.audioUrl) {
                return object.userData.audioUrl;
            }

            // Check for other URL sources that might be used for particles
            if (object.userData.videoUrl) {
                return object.userData.videoUrl;
            }
        }

        return '';
    }

    // 更新对象的userData和UI
    function updateObjectUserData(object, key, value) {
        if (!object || !object.userData) return;

        const userData = JSON.parse(JSON.stringify(object.userData));

        userData[key] = value;

        editor.execute(new SetValueCommand(editor, object, 'userData', userData));

        const userDataTextarea = document.querySelector('.Sidebar .Panel .TextArea');
        if (userDataTextarea) {
            try {
                userDataTextarea.value = JSON.stringify(userData, null, '  ');
                const event = new Event('keyup');
                userDataTextarea.dispatchEvent(event);
            } catch (e) {
                console.error('Error updating userData textarea:', e);
            }
        }
    }

    function playMedia(object) {
        const player = getMediaPlayer(object);
        if (!player) return;

        const mediaElement = player.element;

        if (player.url && mediaElement.src !== player.url) {
            mediaElement.src = player.url;
        }

        if (mediaElement.paused) {
            mediaElement.play().then(() => {
                player.isPlaying = true;
                // 更新userData以实现双向绑定
                updateObjectUserData(object, 'play', true);
                updateUI(object);
            }).catch(error => {
                console.error('Error playing media:', error);
            });
        }
    }

    function pauseMedia(object) {
        const player = getMediaPlayer(object);
        if (!player) return;

        player.element.pause();
        player.isPlaying = false;

		// 更新userData以实现双向绑定
        updateObjectUserData(object, 'play', false);
        updateUI(object);
    }

    function setLoop(object, loop) {
        const player = getMediaPlayer(object);
        if (!player) return;

        player.loop = loop;
        player.element.loop = loop;

        updateObjectUserData(object, 'loop', loop);
    }

    function setMuted(object, muted) {
        const player = getMediaPlayer(object);
        if (!player || player.type !== 'video') return;

        player.muted = muted;
        player.element.muted = muted;

        updateObjectUserData(object, 'muted', muted);
    }

    function setVolume(object, volume) {
        const player = getMediaPlayer(object);
        if (!player) return;

        player.volume = volume;
        player.element.volume = volume;

        updateObjectUserData(object, 'volume', volume);
    }

    function setPlaybackRate(object, rate) {
        const player = getMediaPlayer(object);
        if (!player) return;

        player.playbackRate = rate;
        player.element.playbackRate = rate;

        updateObjectUserData(object, 'rate', rate);
    }

    // function setCurrentTime(object, time) {
    //     const player = getMediaPlayer(object);
    //     if (!player) return;

    //     player.element.currentTime = time;

    //     if (player.element.duration) {
    //         const progress = time / player.element.duration;
    //         updateObjectUserData(object, 'progress', progress);
    //     }
    // }

    // 更新视频的媒体纹理
    function updateVideoTexture(object) {
        const player = getMediaPlayer(object);
        if (!player || player.type !== 'video') return;

        // 如果对象有带有map的材质，则替换为视频纹理
        if (object.material && object.material.map) {
            object.material.map = player.texture;
            object.material.needsUpdate = true;
        }
    }

    // 根据媒体状态更新UI元素
    function updateUI(object) {
        if (!object || object !== currentObject) return;

        const player = getMediaPlayer(object);
        if (!player) return;

        if (playPauseCheckbox) {
            playPauseCheckbox.setValue(player.isPlaying);
        }

        updateTimeDisplay(object);
    }

    function updateTimeDisplay(object) {
        if (!object || object !== currentObject) return;

        const player = getMediaPlayer(object);
        if (!player || !currentTimeText) return;

        const currentTime = player.element.currentTime;
        const duration = player.element.duration || 0;

        currentTimeText.setTextContent(
            formatTime(currentTime) + ' / ' + formatTime(duration)
        );

    }

    function formatTime(seconds) {
        seconds = Math.floor(seconds);
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    function cleanupMediaPlayer(object) {
        if (mediaPlayers.has(object.uuid)) {
            const player = mediaPlayers.get(object.uuid);
            if (player.updateInterval) {
                clearInterval(player.updateInterval);
            }
            player.element.pause();
            player.element.src = '';
            player.element.load();
            document.body.removeChild(player.element);
            mediaPlayers.delete(object.uuid);

            if (currentObject === object) {
                currentObject = null;
            }
        }
    }

    let playPauseCheckbox = null;
    let currentTimeText = null;
    let volumeNumber = null;
    let rateNumber = null;
    let loopCheckbox = null;
    let mutedCheckbox = null;
    let currentObject = null;

    const container = new UIPanel();
    container.setDisplay('none');

    container.add(new UIText(strings.getKey('sidebar/media')).setTextTransform('uppercase'));
    container.add(new UIBreak());
    container.add(new UIBreak());

    const controlsPanel = new UIDiv();
    container.add(controlsPanel);

    function createMediaControls(object) {
        controlsPanel.clear();

        const mediaType = getMediaType(object);
        if (!mediaType) return;

        if (!object.userData) {
            object.userData = {};
        }

        if (mediaType === 'video') {
            // 如果未设置属性，则初始化视频属性
            if (object.userData.play === undefined) object.userData.play = false;
            if (object.userData.loop === undefined) object.userData.loop = true;
            if (object.userData.volume === undefined) object.userData.volume = 1.0;
            if (object.userData.muted === undefined) object.userData.muted = false;
            if (object.userData.rate === undefined) object.userData.rate = 1.0;
            // if (object.userData.progress === undefined) object.userData.progress = 0.0;
            // if (object.userData.currentTime === undefined) object.userData.currentTime = 0.0;
        } else if (mediaType === 'audio') {
            // 如果未设置属性，则初始化音频属性
            if (object.userData.play === undefined) object.userData.play = false;
            if (object.userData.loop === undefined) object.userData.loop = true;
            if (object.userData.volume === undefined) object.userData.volume = 1.0;
            if (object.userData.rate === undefined) object.userData.rate = 1.0;
            // if (object.userData.progress === undefined) object.userData.progress = 0.0;
            // if (object.userData.currentTime === undefined) object.userData.currentTime = 0.0;
        }

        const player = getMediaPlayer(object);
        if (!player) return;

        currentObject = object;

        const playPauseRow = new UIRow();
        playPauseRow.add(new UIText(strings.getKey('sidebar/media/play')).setWidth('90px'));

		playPauseCheckbox = new UICheckbox(object.userData.play);
		playPauseCheckbox.onChange(function() {
			if (player.isPlaying) {
				pauseMedia(object);
			} else {
				playMedia(object);
			}
		});

        playPauseRow.add(playPauseCheckbox);
        controlsPanel.add(playPauseRow);

        const loopRow = new UIRow();
        loopRow.add(new UIText(strings.getKey('sidebar/media/loop')).setWidth('90px'));

        loopCheckbox = new UICheckbox(object.userData.loop);
        loopCheckbox.onChange(function() {
            setLoop(object, loopCheckbox.getValue());
        });

        loopRow.add(loopCheckbox);
        controlsPanel.add(loopRow);

        if (player.type === 'video') {
            const mutedRow = new UIRow();
            mutedRow.add(new UIText(strings.getKey('sidebar/media/muted')).setWidth('90px'));

            mutedCheckbox = new UICheckbox(object.userData.muted);
            mutedCheckbox.onChange(function() {
                setMuted(object, mutedCheckbox.getValue());
            });

            mutedRow.add(mutedCheckbox);
            controlsPanel.add(mutedRow);
        }

        const timeRow = new UIRow();
        timeRow.add(new UIText(strings.getKey('sidebar/media/time')).setWidth('90px'));

        currentTimeText = new UIText('00:00 / 00:00').setWidth('120px');
        timeRow.add(currentTimeText);
        controlsPanel.add(timeRow);

        const volumeRow = new UIRow();
        volumeRow.add(new UIText(strings.getKey('sidebar/media/volume')).setWidth('90px'));

        volumeNumber = new UINumber(object.userData.volume).setWidth('120px').setRange(0, 1).setPrecision(2).setStep(0.05);
        volumeNumber.onChange(function() {
            setVolume(object, volumeNumber.getValue());
        });

        volumeRow.add(volumeNumber);
        controlsPanel.add(volumeRow);

        const rateRow = new UIRow();
        rateRow.add(new UIText(strings.getKey('sidebar/media/speed')).setWidth('90px'));

        rateNumber = new UINumber(1.0).setWidth('60px').setRange(0.25, 4).setPrecision(2).setStep(0.25);
        rateNumber.onChange(function() {
            setPlaybackRate(object, rateNumber.getValue());
        });

        rateRow.add(rateNumber);
        controlsPanel.add(rateRow);

        if (player.updateInterval) {
            clearInterval(player.updateInterval);
        }

        player.updateInterval = setInterval(function() {
            if (player.isPlaying) {
                if (player.type === 'video') {
                    updateVideoTexture(object);
                }

                if (object === currentObject) {
                    updateTimeDisplay(object);
                }
            }
        }, 1000/30);

        if (player.type === 'video') {
            updateVideoTexture(object);
        }

        if (player.url && player.element.src !== player.url) {
            player.element.src = player.url;
            player.element.load();
        }

        // 应用userData中的设置
        player.element.volume = object.userData.volume;
        player.element.rate = object.userData.rate;
        player.element.loop = object.userData.loop;
        if (player.type === 'video') {
            player.element.muted = object.userData.muted;
        }

        if (object.userData.currentTime !== undefined) {
            player.element.addEventListener('loadedmetadata', function() {
                if (object.userData.currentTime < player.element.duration) {
                    player.element.currentTime = object.userData.currentTime;
                    updateTimeDisplay(object);
                }
            });
        }

        if (object.userData.play === true) {
            playMedia(object);
        } else {
            pauseMedia(object);
        }

        updateUI(object);
    }

    signals.objectSelected.add(function(object) {
        if (object !== null) {
            const mediaType = getMediaType(object);

            if (mediaType) {
                createMediaControls(object);
                container.setDisplay('');
            } else {
                container.setDisplay('none');
            }
        } else {
            container.setDisplay('none');
        }
    });

    signals.objectRemoved.add(function(object) {
        cleanupMediaPlayer(object);
    });

    signals.sceneGraphChanged.add(function() {
        mediaPlayers.forEach((player, uuid) => {
            if (player.type === 'video' && player.isPlaying) {
                const object = editor.scene.getObjectByProperty('uuid', uuid);
                if (object) {
                    updateVideoTexture(object);
                }
            }
        });
    });

    function setupUserDataChangeListener() {
        const userDataTextarea = document.querySelector('.Sidebar .Panel .TextArea');
        if (!userDataTextarea) return;

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                    syncMediaControlsWithUserData();
                }
            });
        });

        observer.observe(userDataTextarea, { attributes: true });

        userDataTextarea.addEventListener('input', syncMediaControlsWithUserData);
    }

    function syncMediaControlsWithUserData() {
        if (!currentObject) return;

        createMediaControls(currentObject);
    }

    setupUserDataChangeListener();

    const sidebarObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                setupUserDataChangeListener();
            }
        });
    });

    sidebarObserver.observe(document.body, { childList: true, subtree: true });

    return container;
}

export { SidebarMedia };
