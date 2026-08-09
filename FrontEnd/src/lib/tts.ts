export interface TTSVoiceOption {
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}

export class TextToSpeechManager {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  public isSupported: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.isSupported = true;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  public getAvailableVoices(langPrefix?: string): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const all = this.synth.getVoices();
    if (langPrefix) {
      const filtered = all.filter(v => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
      return filtered.length > 0 ? filtered : all;
    }
    return all;
  }

  public speak(
    text: string,
    options: {
      rate?: number;
      pitch?: number;
      volume?: number;
      voiceName?: string;
      onEnd?: () => void;
      onError?: () => void;
    }
  ) {
    if (!this.synth) {
      if (options.onEnd) setTimeout(options.onEnd, 3000);
      return;
    }

    this.cancel();

    // Remove LaTeX math formatting characters for cleaner audio reading
    const cleanText = text
      .replace(/\\\([^)]+\\\)/g, ' mathematical expression ')
      .replace(/\$\$[^$]+\$\$/g, ' equation ')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
      .replace(/[\$\\]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    if (options.voiceName) {
      const selected = this.voices.find(v => v.name === options.voiceName);
      if (selected) utterance.voice = selected;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('TTS utterance error:', e);
      this.currentUtterance = null;
      if (options.onError) options.onError();
      else if (options.onEnd) options.onEnd();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  }

  public resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  public cancel() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return !!(this.synth && (this.synth.speaking || this.synth.pending));
  }
}

export const ttsManager = new TextToSpeechManager();
