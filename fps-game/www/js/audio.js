/* 以 Web Audio API 即時合成音效，無需外部音檔，確保離線可用 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _env(node, dur, peak = 1, attack = 0.005) {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  _noiseBuffer(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  shoot() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // 低頻爆震
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    this._env(osc, 0.14, 0.5);
    osc.start(t); osc.stop(t + 0.15);
    // 高頻爆裂 (雜訊)
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.12);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1200;
    src.connect(hp);
    this._env(hp, 0.1, 0.35);
    src.start(t); src.stop(t + 0.12);
  }

  enemyShoot() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    this._env(osc, 0.1, 0.18);
    osc.start(t); osc.stop(t + 0.11);
  }

  reload() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 0.12, 0.26].forEach((d, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 380 + i * 120;
      const g = this._env(o, 0.06, 0.14);
      o.start(t + d); o.stop(t + d + 0.06);
    });
  }

  hit() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.05);
    this._env(o, 0.06, 0.25);
    o.start(t); o.stop(t + 0.07);
  }

  kill() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 880, 1200].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      const g = this._env(o, 0.14, 0.2);
      o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.14);
    });
  }

  hurt() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.2);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    src.connect(lp);
    this._env(lp, 0.2, 0.4);
    src.start(t); src.stop(t + 0.2);
  }

  empty() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 200;
    this._env(o, 0.05, 0.1);
    o.start(t); o.stop(t + 0.05);
  }

  wave() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const g = this._env(o, 0.3, 0.18);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
    });
  }
}

const Audio = new AudioEngine();
