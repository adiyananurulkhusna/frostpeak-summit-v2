// Frostpeak Drift — audio.js
// Every sound is synthesized with the Web Audio API. No audio files.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    sirenOn: false,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        // Engine: a low sawtooth whose pitch follows speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 50;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        // Siren: two alternating tones.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.type = 'square';
        this.sirenLfo.frequency.value = 1.4;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        this.sirenLfo.connect(lfoGain);
        lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.sirenLfo.start();
      } catch (e) {
        this.ctx = null;
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    engine(level, isPlow) {
      if (!this.ctx || this.muted) {
        if (this.engineGain) this.engineGain.gain.value = 0;
        return;
      }
      const base = isPlow ? 42 : 55;
      this.engineOsc.frequency.value = base + level * 130;
      this.engineGain.gain.value = level > 0.02 ? 0.05 + level * 0.06 : 0;
    },

    siren(on) {
      this.sirenOn = on;
      if (!this.ctx) return;
      this.sirenGain.gain.value = on && !this.muted ? 0.045 : 0;
    },

    blip(freq, dur, type, vol) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    noiseBurst(dur, vol) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(g);
      g.connect(this.master);
      src.start(t);
    },

    pickup() { this.blip(880, 0.12, 'sine', 0.25); setTimeout(() => this.blip(1320, 0.15, 'sine', 0.22), 70); },
    punch() { this.noiseBurst(0.08, 0.2); this.blip(160, 0.08, 'triangle', 0.25); },
    shoot() { this.noiseBurst(0.12, 0.3); this.blip(220, 0.1, 'square', 0.15); },
    emptyClick() { this.blip(1200, 0.05, 'square', 0.12); },
    crash() { this.noiseBurst(0.25, 0.35); this.blip(70, 0.25, 'sawtooth', 0.2); },
    door() { this.blip(300, 0.08, 'triangle', 0.18); setTimeout(() => this.blip(200, 0.1, 'triangle', 0.15), 60); },
    hurt() { this.blip(180, 0.2, 'sawtooth', 0.22); },
    missionComplete() {
      this.blip(523, 0.15, 'sine', 0.25);
      setTimeout(() => this.blip(659, 0.15, 'sine', 0.25), 130);
      setTimeout(() => this.blip(784, 0.3, 'sine', 0.28), 260);
    },
    gameOver() {
      this.blip(392, 0.3, 'sawtooth', 0.2);
      setTimeout(() => this.blip(311, 0.3, 'sawtooth', 0.2), 280);
      setTimeout(() => this.blip(233, 0.6, 'sawtooth', 0.22), 560);
    },
  };
  return A;
}
