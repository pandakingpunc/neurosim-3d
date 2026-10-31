import type { Network } from "./network";
import { REGION_INDEX } from "./regions";

export interface SimParams {
  paused: boolean;
  speed: number; // adım / kare
  threshold: number; // ateşleme eşiği
  synapticStrength: number; // sinaps ağırlığı
  excitability: number; // spontan ateşleme olasılığı (adım başına)
  leak: number; // membran sızıntısı
  inhibition: number; // inhibitör nöron oranı
  refractory: number; // refrakter adım sayısı
}

export const DEFAULT_PARAMS: SimParams = {
  paused: false,
  speed: 1,
  threshold: 1,
  synapticStrength: 0.32,
  excitability: 0.003,
  leak: 0.06,
  inhibition: 0.2,
  refractory: 6,
};

const D = 8; // maksimum gecikme (adım)
const HISTORY = 240;

export class BrainSim {
  net: Network;
  params: SimParams;
  v: Float32Array;
  glow: Float32Array;
  refr: Int16Array;
  edgeGlow: Float32Array;
  delayBuf: Float32Array[];
  step = 0;
  acc = 0;

  pulseCap = 2000;
  pulseEdge: Int32Array;
  pulseT: Float32Array;
  pulseSpeed: Float32Array;
  pulseCount = 0;

  history = new Float32Array(HISTORY);
  histIdx = 0;
  frameSpikes = 0;
  totalSpikes = 0;
  regionSpikes: Float32Array;
  stimFlash = 0;

  constructor(net: Network, params: SimParams) {
    this.net = net;
    this.params = params;
    this.v = new Float32Array(net.count);
    this.glow = new Float32Array(net.count);
    this.refr = new Int16Array(net.count);
    this.edgeGlow = new Float32Array(net.edgeCount);
    this.delayBuf = Array.from({ length: D }, () => new Float32Array(net.count));
    this.pulseEdge = new Int32Array(this.pulseCap);
    this.pulseT = new Float32Array(this.pulseCap);
    this.pulseSpeed = new Float32Array(this.pulseCap);
    this.regionSpikes = new Float32Array(8);
    // başlangıç potansiyelleri rastgele
    for (let i = 0; i < net.count; i++) this.v[i] = Math.random() * 0.5;
  }

  reset() {
    this.v.fill(0);
    this.glow.fill(0);
    this.refr.fill(0);
    this.edgeGlow.fill(0);
    this.delayBuf.forEach((b) => b.fill(0));
    this.pulseCount = 0;
    this.history.fill(0);
    this.totalSpikes = 0;
    for (let i = 0; i < this.net.count; i++) this.v[i] = Math.random() * 0.5;
  }

  isInhibitory(i: number) {
    return this.net.rnd[i] < this.params.inhibition;
  }

  /** Kare başına çağrılır */
  tick() {
    this.frameSpikes = 0;
    if (!this.params.paused) {
      this.acc += this.params.speed;
      let guard = 0;
      while (this.acc >= 1 && guard < 12) {
        this.stepOnce();
        this.acc -= 1;
        guard++;
      }
      if (this.acc > 12) this.acc = 0;
    }
    this.history[this.histIdx] = this.frameSpikes;
    this.histIdx = (this.histIdx + 1) % HISTORY;
    this.stimFlash *= 0.9;
  }

  stepOnce() {
    const { net, params } = this;
    const n = net.count;
    const v = this.v;
    const glow = this.glow;
    const refr = this.refr;
    const cur = this.delayBuf[this.step % D];
    const leakKeep = 1 - params.leak;
    const stemIdx = REGION_INDEX.brainstem;
    const regionSpikes = this.regionSpikes;
    for (let r = 0; r < regionSpikes.length; r++) regionSpikes[r] *= 0.95;

    // 1) Girdileri topla, sızıntı uygula, spontan aktivite
    for (let i = 0; i < n; i++) {
      let vi = v[i] * leakKeep + cur[i];
      cur[i] = 0;
      const rate = net.region[i] === stemIdx ? params.excitability * 3 : params.excitability;
      if (Math.random() < rate) vi += params.threshold * (0.7 + Math.random() * 0.6);
      v[i] = vi;
      glow[i] *= 0.86;
      if (refr[i] > 0) refr[i]--;
    }

    // 2) Ateşleme
    const strength = params.synapticStrength;
    for (let i = 0; i < n; i++) {
      if (refr[i] > 0) {
        if (v[i] > 0) v[i] *= 0.5;
        continue;
      }
      if (v[i] >= params.threshold) {
        v[i] = -0.2;
        refr[i] = params.refractory;
        glow[i] = 1;
        this.frameSpikes++;
        this.totalSpikes++;
        regionSpikes[net.region[i]] += 1;
        const inh = this.isInhibitory(i);
        const w = inh ? -strength * 1.6 : strength;
        const start = net.edgeOffsets[i];
        const end = net.edgeOffsets[i + 1];
        for (let e = start; e < end; e++) {
          const t = net.edgeTargets[e];
          const d = net.edgeDelays[e];
          this.delayBuf[(this.step + d) % D][t] += w * (0.8 + Math.random() * 0.4);
          this.edgeGlow[e] = 1;
          if (this.pulseCount < this.pulseCap) {
            const p = this.pulseCount++;
            this.pulseEdge[p] = e;
            this.pulseT[p] = 0;
            this.pulseSpeed[p] = 1 / d;
          }
        }
      }
    }

    // 3) Sinaps parlaklığı & darbeler
    const eg = this.edgeGlow;
    for (let e = 0; e < eg.length; e++) eg[e] *= 0.85;
    let p = 0;
    while (p < this.pulseCount) {
      this.pulseT[p] += this.pulseSpeed[p];
      if (this.pulseT[p] >= 1) {
        const last = --this.pulseCount;
        this.pulseEdge[p] = this.pulseEdge[last];
        this.pulseT[p] = this.pulseT[last];
        this.pulseSpeed[p] = this.pulseSpeed[last];
      } else p++;
    }
    this.step++;
  }

  stimulateRegion(regionIdx: number, amount = 1.3) {
    const { net } = this;
    for (let i = 0; i < net.count; i++) {
      if (net.region[i] === regionIdx && Math.random() < 0.6) {
        this.v[i] += this.params.threshold * amount * (0.6 + Math.random() * 0.8);
      }
    }
    this.stimFlash = 1;
  }

  stimulateAt(idx: number, radius = 0.28) {
    const { net } = this;
    const x = net.positions[idx * 3], y = net.positions[idx * 3 + 1], z = net.positions[idx * 3 + 2];
    const r2 = radius * radius;
    for (let i = 0; i < net.count; i++) {
      const dx = net.positions[i * 3] - x;
      const dy = net.positions[i * 3 + 1] - y;
      const dz = net.positions[i * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) {
        const f = 1 - Math.sqrt(d2) / radius;
        this.v[i] += this.params.threshold * (1.2 + f);
      }
    }
    this.stimFlash = 1;
  }

  stimulateAll() {
    for (let i = 0; i < this.net.count; i++) {
      if (Math.random() < 0.35) this.v[i] += this.params.threshold * 1.5;
    }
    this.stimFlash = 1;
  }

  /** Son ~60 karedeki toplam ateşleme */
  recentSpikes() {
    let s = 0;
    for (let i = 0; i < 60; i++) s += this.history[(this.histIdx - 1 - i + HISTORY) % HISTORY];
    return s;
  }

  activeCount() {
    let c = 0;
    for (let i = 0; i < this.glow.length; i++) if (this.glow[i] > 0.3) c++;
    return c;
  }
}
