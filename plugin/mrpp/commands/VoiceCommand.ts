import * as THREE from 'three';
import { UIDiv, UIText, UIInput, UIButton } from '../../../three.js/editor/js/libs/ui.js';
import { SetCommandValueCommand } from '../../commands/SetCommandValueCommand.js';
import { normalizeVoiceText, readVoiceText, validateVoiceText } from './VoiceCommandData.js';
import type { MrppEditor, MrppCommand, MrppObject3D } from '../../types/mrpp.js';

class VoiceCommand {
  phraseInput!: any;
  pinyinInput!: any;
  errorText!: any;
  statusText!: any;
  confirmButton!: any;
  cancelButton!: any;

  constructor(public editor: MrppEditor, public object: THREE.Object3D, public component: MrppCommand) {}

  static Create(): MrppCommand {
    return {
      type: 'Voice',
      parameters: {
        uuid: THREE.MathUtils.generateUUID(), action: '', parameter: '', pinyin: ''
      }
    };
  }

  private setStatus(state: string): void {
    this.statusText.setValue(this.editor.strings.getKey('sidebar/command/voice/' + state));
    this.statusText.dom.dataset.state = state;
  }

  private refreshDraftState(): void {
    const previous = readVoiceText(this.component.parameters);
    const changed = this.phraseInput.getValue() !== previous.phrase || this.pinyinInput.getValue() !== previous.pinyin;
    const configured = !!(previous.phrase || previous.pinyin || (this.component.parameters.action ?? this.component.parameters.voice));
    this.setStatus(changed ? 'editing' : configured ? 'configured' : 'empty');
    this.confirmButton.setTextContent(this.editor.strings.getKey('sidebar/command/voice/' + (configured ? 'confirm' : 'create')));
    this.confirmButton.setDisabled(!changed && configured);
    this.cancelButton.setHidden(!changed);
  }

  // Commit the canonical action+pinyin pair together, retaining the event identity.
  update(): void {
    const text = normalizeVoiceText(this.phraseInput.getValue(), this.pinyinInput.getValue());
    const previous = readVoiceText(this.component.parameters);
    const unchanged = text.phrase === previous.phrase && text.pinyin === previous.pinyin;
    if (unchanged && !Object.hasOwn(this.component.parameters, 'phrase') && !Object.hasOwn(this.component.parameters, 'pinyin')) {
      this.updateUI();
      return;
    }
    const commands: MrppCommand[] = [];
    this.editor.scene.traverse((object: THREE.Object3D) => {
      commands.push(...((object as MrppObject3D).commands ?? []));
    });
    const error = validateVoiceText(text, commands, this.component);
    if (error) {
      this.errorText.setValue(this.editor.strings.getKey('sidebar/command/voice/' + error));
      return;
    }
    if (unchanged) {
      this.updateUI();
      return;
    }
    const parameters: MrppCommand['parameters'] = { ...this.component.parameters, action: text.phrase, pinyin: text.pinyin };
    delete parameters.phrase;
    delete parameters.voice;
    this.editor.execute(new SetCommandValueCommand(
      this.editor, this.object as MrppObject3D, this.component, 'parameters',
      parameters
    ));
    this.updateUI();
    this.setStatus('confirmed');
  }

  updateUI(): void {
    const text = readVoiceText(this.component.parameters);
    this.phraseInput.setValue(text.phrase);
    this.pinyinInput.setValue(text.pinyin);
    const parameters = this.component.parameters;
    const unknownLegacy = !Object.hasOwn(parameters, 'phrase') && !Object.hasOwn(parameters, 'pinyin')
      && !!(parameters.action ?? parameters.voice) && !text.pinyin;
    this.errorText.setValue(unknownLegacy ? this.editor.strings.getKey('sidebar/command/voice/unknown_legacy') : '');
    this.refreshDraftState();
  }

  renderer(container: any, remove?: any): void {
    const strings = this.editor.strings;
    const card = new UIDiv().setClass('mrpp-voice-card');
    const header = new UIDiv().setClass('mrpp-voice-header');
    header.add(new UIText(strings.getKey('sidebar/command/select/voice')).setClass('mrpp-voice-title'));
    this.statusText = new UIText('').setClass('mrpp-voice-status');
    this.statusText.dom.setAttribute('role', 'status');
    header.add(this.statusText);
    if (remove) {
      remove.addClass('mrpp-voice-remove');
      header.add(remove);
    }
    card.add(header);
    const body = new UIDiv().setClass('mrpp-voice-body');
    const field = (key: string, input: any, hint: string): void => {
      const group = new UIDiv().setClass('mrpp-voice-field');
      const label = document.createElement('label');
      label.htmlFor = input.dom.id;
      label.textContent = strings.getKey('sidebar/command/voice/' + key);
      group.dom.appendChild(label);
      group.add(input);
      const help = new UIText(strings.getKey('sidebar/command/voice/' + hint)).setClass('mrpp-voice-help');
      help.dom.id = input.dom.id + '-help';
      input.dom.setAttribute('aria-describedby', help.dom.id);
      group.add(help);
      body.add(group);
    };
    this.phraseInput = new UIInput().setId('voice-phrase-' + this.component.parameters.uuid);
    this.phraseInput.dom.setAttribute('aria-label', strings.getKey('sidebar/command/voice/phrase'));
    this.phraseInput.dom.placeholder = strings.getKey('sidebar/command/voice/phrase_placeholder');
    field('phrase', this.phraseInput, 'description');
    this.pinyinInput = new UIInput().setId('voice-pinyin-' + this.component.parameters.uuid);
    this.pinyinInput.dom.setAttribute('aria-label', strings.getKey('sidebar/command/voice/pinyin'));
    this.pinyinInput.dom.placeholder = strings.getKey('sidebar/command/voice/pinyin_placeholder');
    this.pinyinInput.dom.spellcheck = false;
    this.pinyinInput.dom.autocapitalize = 'none';
    field('pinyin', this.pinyinInput, 'hint');
    this.errorText = new UIText('').setClass('mrpp-voice-error');
    this.errorText.dom.setAttribute('role', 'alert');
    body.add(this.errorText);
    const actions = new UIDiv().setClass('mrpp-voice-actions');
    this.confirmButton = new UIButton('').addClass('mrpp-voice-confirm').onClick(() => this.update());
    this.cancelButton = new UIButton(strings.getKey('sidebar/command/voice/cancel')).onClick(() => this.updateUI());
    actions.add(this.confirmButton, this.cancelButton);
    body.add(actions);
    for (const input of [this.phraseInput, this.pinyinInput]) {
      input.dom.style.padding = '';
      input.dom.style.border = '';
      input.dom.addEventListener('input', () => {
        this.errorText.setValue('');
        this.refreshDraftState();
      });
      input.dom.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.isComposing && !this.confirmButton.dom.disabled) {
          event.preventDefault();
          this.update();
        }
      });
    }
    card.add(body);
    container.add(card);
    this.updateUI();
  }
}

export { VoiceCommand };
