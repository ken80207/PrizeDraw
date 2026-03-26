/**
 * SoundManager — Web Audio API procedural sound effects.
 * No audio files needed. All sounds are generated via OscillatorNode,
 * GainNode, and BiquadFilterNode on the fly.
 *
 * AudioContext is lazily created on the first call that needs it
 * (requires a prior user gesture per browser autoplay policy).
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  // ── Context ────────────────────────────────────────────────────────────────

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Resume if suspended (e.g. after page-visibility change)
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private get now(): number {
    return this.getContext().currentTime;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Create a GainNode and schedule a linear fade-out over `duration` seconds. */
  private makeGain(gain = 0.3, duration = 0.1): GainNode {
    const ctx = this.getContext();
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, this.now);
    g.gain.linearRampToValueAtTime(0, this.now + duration);
    g.connect(ctx.destination);
    return g;
  }

  /** Play a simple oscillator burst. */
  private osc(
    type: OscillatorType,
    freq: number,
    endFreq: number,
    duration: number,
    gain = 0.25,
    startDelay = 0,
  ): void {
    const ctx = this.getContext();
    const t = this.now + startDelay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.linearRampToValueAtTime(endFreq, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.linearRampToValueAtTime(0, t + duration);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + duration + 0.01);
  }

  /** White noise burst via ScriptProcessorNode (fallback-safe). */
  private noise(
    duration: number,
    gain = 0.15,
    filterFreq = 2000,
    filterType: BiquadFilterType = "bandpass",
    startDelay = 0,
  ): void {
    const ctx = this.getContext();
    const t = this.now + startDelay;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, Math.ceil(bufferSize), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.linearRampToValueAtTime(0, t + duration);

    source.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    source.start(t);
    source.stop(t + duration + 0.01);
  }

  // ── Public sounds ──────────────────────────────────────────────────────────

  playTear(): void {
    if (!this.enabled) return;
    // Short paper-rip: white noise burst 100 ms, bandpass around 2 kHz
    this.noise(0.1, 0.3, 2000, "bandpass");
    // Add a very brief high-pitched crack
    this.osc("sawtooth", 3000, 1000, 0.05, 0.08);
  }

  playScratch(): void {
    if (!this.enabled) return;
    // Scratching: filtered noise 200 ms, sweep from low to high-pass
    this.noise(0.2, 0.2, 1500, "highpass");
    this.noise(0.15, 0.1, 800, "bandpass", 0.05);
  }

  playFlip(): void {
    if (!this.enabled) return;
    // Card flip: short click + brief whoosh
    this.osc("sine", 600, 400, 0.06, 0.3);
    this.noise(0.08, 0.12, 3000, "highpass", 0.02);
  }

  playCoinInsert(): void {
    if (!this.enabled) return;
    // Coin: sine sweep 800 → 1200 Hz over 150 ms
    this.osc("sine", 800, 1200, 0.15, 0.35);
    // Metallic ring
    this.osc("triangle", 1400, 1600, 0.08, 0.15, 0.05);
  }

  playReelSpin(): void {
    if (!this.enabled) return;
    // Reel: low rumble + repeating tick
    this.osc("sawtooth", 60, 80, 0.4, 0.12);
    // Three ticks
    for (let i = 0; i < 3; i++) {
      this.osc("square", 900, 700, 0.04, 0.08, i * 0.12);
    }
  }

  playReelStop(): void {
    if (!this.enabled) return;
    // Stop: sharp click + brief decay
    this.osc("square", 1000, 200, 0.08, 0.4);
    this.noise(0.05, 0.15, 1000, "bandpass", 0.01);
  }

  playLeverPull(): void {
    if (!this.enabled) return;
    // Lever: mechanical spring — descending pitch
    this.osc("sawtooth", 400, 100, 0.25, 0.25);
    this.osc("sine", 300, 80, 0.3, 0.15, 0.05);
  }

  playClawDescend(): void {
    if (!this.enabled) return;
    // Descend: motor hum with descending drone
    this.osc("sawtooth", 120, 80, 0.5, 0.15);
    // Motor whine
    this.osc("square", 900, 700, 0.5, 0.05);
  }

  playClawGrab(): void {
    if (!this.enabled) return;
    // Grab: metallic clank
    this.noise(0.12, 0.3, 4000, "bandpass");
    this.osc("triangle", 500, 200, 0.15, 0.25, 0.02);
  }

  playGachaRotate(): void {
    if (!this.enabled) return;
    // Rotate: ratchet clicks
    for (let i = 0; i < 5; i++) {
      this.osc("square", 800, 600, 0.03, 0.2, i * 0.07);
    }
  }

  playCapsuleDrop(): void {
    if (!this.enabled) return;
    // Drop: thud
    this.osc("sine", 180, 60, 0.2, 0.5);
    // Bounce
    this.osc("sine", 140, 80, 0.1, 0.3, 0.22);
  }

  playCapsuleOpen(): void {
    if (!this.enabled) return;
    // Open: pop + sparkle arpeggio
    this.osc("sine", 400, 800, 0.05, 0.4);
    // Sparkle: ascending notes
    const sparkleFreqs = [1047, 1319, 1568, 2093];
    sparkleFreqs.forEach((f, i) => {
      this.osc("sine", f, f * 1.05, 0.07, 0.15, 0.06 + i * 0.04);
    });
  }

  playWinSmall(): void {
    if (!this.enabled) return;
    // B/C/D grade: short happy chime, ascending arpeggio
    const notes = [523, 659, 784, 1047]; // C5-E5-G5-C6
    notes.forEach((f, i) => {
      this.osc("sine", f, f, 0.12, 0.3, i * 0.09);
    });
    // Harmony
    this.osc("triangle", 659, 659, 0.18, 0.15, 0.1);
  }

  playWinBig(): void {
    if (!this.enabled) return;
    // A grade: fanfare — longer, multiple harmonics
    const fanfare = [523, 659, 784, 1047, 1319];
    fanfare.forEach((f, i) => {
      this.osc("sine", f, f, 0.18, 0.35, i * 0.07);
      // Add an octave harmonic
      this.osc("triangle", f * 2, f * 2, 0.12, 0.15, i * 0.07 + 0.04);
    });
    // Bass note
    this.osc("sine", 261, 261, 0.5, 0.25, 0.1);
  }

  playJackpot(): void {
    if (!this.enabled) return;
    // Extended celebration: chord + sparkle shower
    // Major chord C-E-G
    [523, 659, 784].forEach((f) => {
      this.osc("sine", f, f, 0.8, 0.3);
    });
    // Sparkle shower — many brief tones
    const sparkles = [1047, 1319, 1568, 2093, 1760, 1397, 2637, 2349];
    sparkles.forEach((f, i) => {
      this.osc("sine", f, f * 1.1, 0.1, 0.18, 0.15 + i * 0.06);
    });
    // Triumphant bass
    this.osc("sawtooth", 130, 130, 0.9, 0.2, 0.05);
    // Final swell
    this.osc("sine", 784, 1047, 0.4, 0.35, 0.5);
  }

  playChat(): void {
    if (!this.enabled) return;
    // Soft ping
    this.osc("sine", 880, 880, 0.15, 0.15);
    this.osc("sine", 1100, 1100, 0.08, 0.1, 0.06);
  }

  playReaction(): void {
    if (!this.enabled) return;
    // Reaction: pop
    this.osc("sine", 300, 600, 0.05, 0.25);
  }

  playQueueAdvance(): void {
    if (!this.enabled) return;
    // Queue: ding
    this.osc("sine", 660, 880, 0.12, 0.3);
    this.osc("sine", 880, 880, 0.1, 0.2, 0.1);
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  toggle(): void {
    this.enabled = !this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const sounds = new SoundManager();
