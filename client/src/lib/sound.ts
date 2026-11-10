export type SoundName =
  | "click"
  | "select"
  | "play"
  | "take"
  | "steal"
  | "dog"
  | "boss"
  | "roundStart"
  | "roundEnd"
  | "win"
  | "lose"
  | "error"
  | "prompt"
  | "turn";

const MUTE_KEY = "art-robbery.muted.v1";

class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private voiceBuffers = new Map<string, AudioBuffer>();
  private voiceLoads = new Map<string, Promise<AudioBuffer | null>>();

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // ignore storage failures
    }
    if (!muted) this.play("click");
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  unlock(): void {
    this.ensure();
  }

  preloadVoice(url: string): void {
    if (typeof window === "undefined") return;
    if (this.voiceBuffers.has(url) || this.voiceLoads.has(url)) return;
    const context = this.ensure();
    if (!context) return;
    const load = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("voice unavailable");
        return response.arrayBuffer();
      })
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) => {
            context.decodeAudioData(data, resolve, reject);
          })
      )
      .then((buffer) => {
        this.voiceBuffers.set(url, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => {
        this.voiceLoads.delete(url);
      });
    this.voiceLoads.set(url, load);
  }

  playVoice(url: string | undefined): void {
    if (!url || this.muted) return;
    const context = this.ensure();
    if (!context) return;
    const start = (buffer: AudioBuffer) => {
      if (this.muted) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 0.9;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    };
    const play = (buffer: AudioBuffer) => {
      if (context.state === "running") start(buffer);
      else void context.resume().then(() => start(buffer)).catch(() => undefined);
    };
    const ready = this.voiceBuffers.get(url);
    if (ready) {
      play(ready);
      return;
    }
    const loading = this.voiceLoads.get(url);
    if (loading) {
      void loading.then((buffer) => {
        if (buffer) play(buffer);
      });
      return;
    }
    this.preloadVoice(url);
    void this.voiceLoads.get(url)?.then((buffer) => {
      if (buffer) play(buffer);
    });
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const context = this.ensure();
    if (!context) return;
    if (context.state === "running") {
      this.render(context, name);
      return;
    }
    void context.resume().then(() => this.render(context, name)).catch(() => undefined);
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.context) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = 0.13;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }

  private render(context: AudioContext, name: SoundName): void {
    const t = context.currentTime;
    switch (name) {
      case "click":
        this.tone(context, t, { freq: 860, duration: 0.035, gain: 0.22, type: "sine" });
        break;
      case "select":
        this.tone(context, t, { freq: 620, endFreq: 760, duration: 0.07, gain: 0.24, type: "triangle" });
        break;
      case "play":
        this.noise(context, t, { duration: 0.09, gain: 0.18, type: "highpass", freq: 900 });
        this.tone(context, t + 0.01, { freq: 190, endFreq: 150, duration: 0.1, gain: 0.2, type: "sine" });
        break;
      case "take":
        this.tone(context, t, { freq: 680, endFreq: 920, duration: 0.08, gain: 0.22, type: "triangle" });
        this.tone(context, t + 0.055, { freq: 1080, duration: 0.05, gain: 0.12, type: "sine" });
        break;
      case "steal":
        this.noise(context, t, { duration: 0.16, gain: 0.24, type: "bandpass", freq: 1500, endFreq: 380 });
        this.tone(context, t + 0.03, { freq: 150, endFreq: 95, duration: 0.16, gain: 0.26, type: "sawtooth" });
        break;
      case "dog":
        this.tone(context, t, { freq: 210, endFreq: 180, duration: 0.08, gain: 0.22, type: "square" });
        this.tone(context, t + 0.11, { freq: 250, endFreq: 205, duration: 0.07, gain: 0.18, type: "square" });
        break;
      case "boss":
        this.tone(context, t, { freq: 110, endFreq: 104, duration: 0.42, gain: 0.28, type: "sine" });
        this.tone(context, t, { freq: 165, endFreq: 160, duration: 0.3, gain: 0.16, type: "triangle" });
        break;
      case "roundStart":
        this.arpeggio(context, t, [392, 523], 0.08, 0.18);
        break;
      case "roundEnd":
        this.arpeggio(context, t, [523, 659, 784], 0.09, 0.18);
        break;
      case "win":
        this.arpeggio(context, t, [523, 659, 784, 1046], 0.1, 0.22);
        break;
      case "lose":
        this.arpeggio(context, t, [392, 349, 262], 0.13, 0.18);
        break;
      case "error":
        this.tone(context, t, { freq: 145, endFreq: 110, duration: 0.16, gain: 0.24, type: "square" });
        break;
      case "prompt":
        this.arpeggio(context, t, [880, 1174], 0.07, 0.16);
        break;
      case "turn":
        this.tone(context, t, { freq: 660, duration: 0.05, gain: 0.14, type: "sine" });
        break;
    }
  }

  private tone(
    context: AudioContext,
    start: number,
    options: {
      freq: number;
      endFreq?: number;
      duration: number;
      gain: number;
      type: OscillatorType;
    }
  ): void {
    if (!this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.freq, start);
    if (options.endFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFreq),
        start + options.duration
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.02);
  }

  private noise(
    context: AudioContext,
    start: number,
    options: {
      duration: number;
      gain: number;
      type: BiquadFilterType;
      freq: number;
      endFreq?: number;
    }
  ): void {
    if (!this.master) return;
    const length = Math.max(1, Math.floor(context.sampleRate * options.duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.setValueAtTime(options.freq, start);
    if (options.endFreq) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(40, options.endFreq),
        start + options.duration
      );
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(options.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + options.duration + 0.02);
  }

  private arpeggio(
    context: AudioContext,
    start: number,
    notes: number[],
    step: number,
    gain: number
  ): void {
    notes.forEach((freq, index) => {
      this.tone(context, start + index * step, {
        freq,
        duration: 0.16,
        gain,
        type: "sine"
      });
    });
  }
}

export const sound = new SoundEngine();
