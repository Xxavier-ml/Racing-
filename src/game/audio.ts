export class NairobiAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private driftNoiseGain: GainNode | null = null;
  private muted = false;
  private started = false;

  public init(): void {
    if (this.started || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.35;
      master.connect(ctx.destination);

      // Engine synth
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscB.type = 'triangle';
      oscA.frequency.value = 55;
      oscB.frequency.value = 110;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;

      const eGain = ctx.createGain();
      eGain.gain.value = 0.0;

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(eGain);
      eGain.connect(master);

      oscA.start();
      oscB.start();

      // Drift tire screech (filtered white noise)
      const bufSize = ctx.sampleRate * 1.5;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const screechFilter = ctx.createBiquadFilter();
      screechFilter.type = 'bandpass';
      screechFilter.frequency.value = 1350;
      screechFilter.Q.value = 4.5;

      const screechGain = ctx.createGain();
      screechGain.gain.value = 0;

      noiseSrc.connect(screechFilter);
      screechFilter.connect(screechGain);
      screechGain.connect(master);
      noiseSrc.start();

      this.ctx = ctx;
      this.masterGain = master;
      this.engineOscA = oscA;
      this.engineOscB = oscB;
      this.engineFilter = filter;
      this.engineGain = eGain;
      this.driftNoiseGain = screechGain;
      this.started = true;
    } catch {
      // Audio blocked or unavailable
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.35, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateTelemetry(speedAbs: number, isDrifting: boolean, isBoosting: boolean, active: boolean): void {
    if (!this.ctx || !this.engineOscA || !this.engineOscB || !this.engineFilter || !this.engineGain || !this.driftNoiseGain) {
      return;
    }
    if (this.ctx.state === 'suspended' && active) {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.driftNoiseGain.gain.setTargetAtTime(0, now, 0.04);
      return;
    }

    const rpmNorm = Math.min(1, speedAbs / 60);
    const gearCycle = (rpmNorm * 4) % 1;
    const baseFreq = 48 + rpmNorm * 68 + gearCycle * 28 + (isBoosting ? 24 : 0);

    this.engineOscA.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOscB.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(220 + rpmNorm * 680 + (isBoosting ? 350 : 0), now, 0.06);
    this.engineGain.gain.setTargetAtTime(0.08 + rpmNorm * 0.09, now, 0.06);

    const driftLevel = isDrifting && speedAbs > 10 ? 0.09 : 0;
    this.driftNoiseGain.gain.setTargetAtTime(driftLevel, now, 0.04);
  }

  public playMatatuHorn(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = [392, 493.88, 587.33]; // Classic Kenyan matatu multi-tone triad
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.setValueAtTime(0.08, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  }

  public playCheckpointChime(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playCollisionThud(intensity: number): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.32, 0.08 + intensity * 0.012);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125 + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playCountdownTone(go: boolean): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = go ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(go ? 880 : 440, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(go ? 0.16 : 0.11, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + (go ? 0.34 : 0.18));
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (go ? 0.36 : 0.2));
  }

  public playNearMissChime(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.started = false;
    }
  }
}
