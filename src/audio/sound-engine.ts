export type SoundEvent =
  | "move"
  | "capture"
  | "castle"
  | "check"
  | "promote"
  | "game-over"
  | "illegal";

class WebAudioSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public play(event: SoundEvent): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (event) {
      case "move":
        this.playWoodTap(ctx, now, 185, 0.12, 0.065);
        break;
      case "capture":
        this.playWoodTap(ctx, now, 130, 0.19, 0.085);
        this.playWoodTap(ctx, now + 0.02, 290, 0.08, 0.045);
        break;
      case "castle":
        this.playWoodTap(ctx, now, 180, 0.12, 0.06);
        this.playWoodTap(ctx, now + 0.075, 210, 0.12, 0.06);
        break;
      case "promote":
        this.playTone(ctx, now, "triangle", 440, 660, 0.12, 0.11);
        this.playTone(ctx, now + 0.06, "triangle", 660, 880, 0.1, 0.14);
        break;
      case "check":
        this.playWoodTap(ctx, now, 165, 0.14, 0.07);
        this.playTone(ctx, now + 0.015, "sine", 620, 520, 0.11, 0.14);
        break;
      case "game-over":
        this.playTone(ctx, now, "triangle", 392, 392, 0.09, 0.22);
        this.playTone(ctx, now + 0.11, "triangle", 493.88, 493.88, 0.09, 0.24);
        this.playTone(ctx, now + 0.22, "triangle", 587.33, 587.33, 0.11, 0.36);
        break;
      case "illegal":
        this.playTone(ctx, now, "sawtooth", 115, 78, 0.07, 0.11);
        break;
    }
  }

  private playWoodTap(
    ctx: AudioContext,
    startTime: number,
    baseFreq: number,
    gainPeak: number,
    duration: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq * 1.4, startTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, startTime + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  private playTone(
    ctx: AudioContext,
    startTime: number,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    gainPeak: number,
    duration: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.015);
  }
}

export const soundEngine = new WebAudioSoundEngine();
