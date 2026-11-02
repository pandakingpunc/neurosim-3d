import type { BrainSim } from "./brain/simulation";

/**
 * Elektrofizyoloji hoparlörü: her karede o karedeki ateşlemeler kadar kısa "tık"
 * içeren bir ses tamponu üretip kesintisiz sıraya koyar. Prob nöronunun ateşlemesi
 * daha belirgin, ayrı bir tık olarak duyulur.
 */
export class SpikeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextTime = 0;
  private click: Float32Array | null = null;
  private pop: Float32Array | null = null;
  enabled = false;

  /** Kullanıcı etkileşiminde çağrılmalı (tarayıcı otomatik oynatma kuralı) */
  async setEnabled(on: boolean) {
    this.enabled = on;
    if (on) {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) {
          this.enabled = false;
          return;
        }
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 6000;
        this.master.connect(lp).connect(this.ctx.destination);
        this.click = makeClick(this.ctx.sampleRate, 0.0025, 0);
        this.pop = makeClick(this.ctx.sampleRate, 0.006, 1);
      }
      if (this.ctx.state !== "running") await this.ctx.resume().catch(() => undefined);
      this.nextTime = 0;
    } else if (this.ctx && this.ctx.state === "running") {
      await this.ctx.suspend().catch(() => undefined);
    }
  }

  /** Her kareden sonra çağrılır */
  frame(sim: BrainSim, dt: number) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || !this.master || ctx.state !== "running" || !this.click || !this.pop) return;
    const len = Math.max(1, Math.round(Math.min(Math.max(dt, 0.004), 0.1) * ctx.sampleRate));
    const n = Math.min(40, sim.frameSpikes);
    const probeN = sim.probeFrameSpikes;
    if (n === 0 && probeN === 0) {
      // sessiz kare: zaman çizelgesini yine de ilerlet
      if (this.nextTime > ctx.currentTime) this.nextTime += len / ctx.sampleRate;
      return;
    }
    const buf = ctx.createBuffer(1, len + this.pop.length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const amp = 0.18 / Math.sqrt(Math.max(1, n / 6)); // yoğun patlamada kulak yormasın
    for (let k = 0; k < n; k++) addAt(data, this.click, Math.floor(Math.random() * len), amp * (0.6 + Math.random() * 0.8));
    for (let k = 0; k < probeN; k++) addAt(data, this.pop, Math.floor(Math.random() * len), 0.55);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    // Gecikme birikmesin: geride kaldıysak ya da çok öndeysek yeniden hizala
    const now = ctx.currentTime;
    if (this.nextTime < now + 0.02 || this.nextTime > now + 0.25) this.nextTime = now + 0.05;
    src.start(this.nextTime);
    this.nextTime += len / ctx.sampleRate;
  }

  dispose() {
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

/** Kısa iki fazlı tık (aksiyon potansiyeli dalga biçimine benzer) */
function makeClick(rate: number, dur: number, kind: 0 | 1) {
  const n = Math.max(8, Math.round(rate * dur));
  const out = new Float32Array(n);
  const f = kind === 0 ? 2600 : 900;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.exp(-i / (n * 0.25));
    out[i] = Math.sin(2 * Math.PI * f * t) * env + (kind === 0 ? (Math.random() * 2 - 1) * 0.35 * env : 0);
  }
  return out;
}

function addAt(dst: Float32Array, src: Float32Array, at: number, gain: number) {
  const m = Math.min(src.length, dst.length - at);
  for (let i = 0; i < m; i++) dst[at + i] += src[i] * gain;
}
