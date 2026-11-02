import type { Network } from "./network";
import { REGION_INDEX, REGIONS } from "./regions";

export interface SimParams {
  paused: boolean;
  speed: number; // gerçek zamanda saniyedeki adım çarpanı (1 = 60 adım/sn)
  threshold: number; // ateşleme eşiği
  synapticStrength: number; // sinaps ağırlığı
  excitability: number; // spontan ateşleme olasılığı (adım başına)
  leak: number; // membran sızıntısı
  inhibition: number; // inhibitör nöron oranı
  refractory: number; // refrakter adım sayısı
  adaptation: number; // ateşleme başına eşiğin geçici artışı (spike-frekans adaptasyonu)
  adaptTau: number; // adaptasyonun sönme süresi (adım)
  plasticity: boolean; // STDP öğrenmesi açık mı
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
  adaptation: 0,
  adaptTau: 60,
  plasticity: false,
};

const D = 8; // maksimum gecikme (adım)
const HISTORY = 240;
const STEPS_PER_SECOND = 60; // speed = 1 iken saniyedeki adım sayısı

export const PROBE_LEN = 240; // prob kaydı (adım)
export const RASTER_LEN = 240; // raster penceresi (adım)
export const RASTER_ROWS = 160; // rasterde gösterilen örnek nöron sayısı

// STDP (spike-timing-dependent plasticity)
const STDP_WINDOW = 20; // adım
const STDP_TAU = 6; // adım
const A_PLUS = 0.04; // potansiyasyon
const A_MINUS = 0.06; // depresyon (hafif baskın: rastgele eşleşmeler ağırlığı şişirmesin)
export const W_MAX = 3;
const W_DECAY = 0.0003; // adım başına 1'e geri dönüş (unutma), ~55 sn @1×
const STDP_EXP = Array.from({ length: STDP_WINDOW + 1 }, (_, i) => Math.exp(-i / STDP_TAU));

export class BrainSim {
  net: Network;
  params: SimParams;
  v: Float32Array;
  adapt: Float32Array; // dinamik eşik artışı
  glow: Float32Array;
  refr: Int16Array;
  lastSpike: Int32Array;
  dead: Uint8Array; // lezyonlu nöronlar
  deadCount = 0;
  weight: Float32Array; // kenar başına öğrenilmiş ağırlık çarpanı (1 = başlangıç)
  weightsDirty = false;
  edgeGlow: Float32Array;
  delayBuf: Float32Array[];
  step = 0;
  acc = 0;

  pulseCap = 2000;
  pulseEdge: Int32Array;
  pulseT: Float32Array;
  pulseSpeed: Float32Array;
  pulseCount = 0;

  history = new Float32Array(HISTORY); // kare başına ateşleme
  historyDt = new Float32Array(HISTORY); // kare süresi (sn)
  histIdx = 0;
  frameSpikes = 0;
  totalSpikes = 0;
  regionSpikes: Float32Array;
  regionCounts: Uint32Array;
  stimFlash = 0;

  // Nöron probu
  probe = -1;
  probeV = new Float32Array(PROBE_LEN);
  probeTh = new Float32Array(PROBE_LEN);
  probeSpike = new Uint8Array(PROBE_LEN);
  probeHead = 0;
  probeSpikes = 0; // proplanan nöronun toplam ateşlemesi
  probeFrameSpikes = 0; // bu karede (ses için)

  // Raster
  rasterIds: Int32Array;
  rasterRow: Int32Array; // nöron -> satır (-1: örnekte yok)
  raster = new Uint8Array(RASTER_ROWS * RASTER_LEN);
  rasterHead = 0;

  constructor(net: Network, params: SimParams) {
    this.net = net;
    this.params = params;
    const n = net.count;
    this.v = new Float32Array(n);
    this.adapt = new Float32Array(n);
    this.glow = new Float32Array(n);
    this.refr = new Int16Array(n);
    this.lastSpike = new Int32Array(n).fill(-1e6);
    this.dead = new Uint8Array(n);
    this.weight = new Float32Array(net.edgeCount).fill(1);
    this.edgeGlow = new Float32Array(net.edgeCount);
    this.delayBuf = Array.from({ length: D }, () => new Float32Array(n));
    this.pulseEdge = new Int32Array(this.pulseCap);
    this.pulseT = new Float32Array(this.pulseCap);
    this.pulseSpeed = new Float32Array(this.pulseCap);
    this.regionSpikes = new Float32Array(REGIONS.length);
    this.regionCounts = new Uint32Array(REGIONS.length);
    for (let i = 0; i < n; i++) this.regionCounts[net.region[i]]++;

    // Raster örneklemi: nöronları bölgeye göre sırala, eşit aralıklı seç
    const order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => net.region[a] - net.region[b] || net.positions[a * 3 + 2] - net.positions[b * 3 + 2]
    );
    const rows = Math.min(RASTER_ROWS, n);
    this.rasterIds = new Int32Array(rows);
    this.rasterRow = new Int32Array(n).fill(-1);
    for (let r = 0; r < rows; r++) {
      const id = order[Math.floor(((r + 0.5) * n) / rows)];
      this.rasterIds[r] = id;
      this.rasterRow[id] = r;
    }

    // başlangıç potansiyelleri rastgele
    for (let i = 0; i < n; i++) this.v[i] = Math.random() * 0.5;
  }

  /** Aktiviteyi sıfırlar; öğrenilen ağırlıklar ve lezyonlar korunur */
  reset() {
    this.v.fill(0);
    this.adapt.fill(0);
    this.glow.fill(0);
    this.refr.fill(0);
    this.lastSpike.fill(-1e6);
    this.edgeGlow.fill(0);
    this.delayBuf.forEach((b) => b.fill(0));
    this.pulseCount = 0;
    this.history.fill(0);
    this.historyDt.fill(0);
    this.regionSpikes.fill(0);
    this.raster.fill(0);
    this.probeV.fill(0);
    this.probeTh.fill(0);
    this.probeSpike.fill(0);
    this.probeSpikes = 0;
    this.totalSpikes = 0;
    this.acc = 0;
    for (let i = 0; i < this.net.count; i++) this.v[i] = this.dead[i] ? 0 : Math.random() * 0.5;
  }

  resetWeights() {
    this.weight.fill(1);
    this.weightsDirty = false;
  }

  isInhibitory(i: number) {
    return this.net.rnd[i] < this.params.inhibition;
  }

  /** Kare başına çağrılır; dt saniye cinsinden (ekran tazeleme hızından bağımsız) */
  tick(dt: number) {
    const frameDt = Math.min(Math.max(dt, 0), 0.1);
    this.frameSpikes = 0;
    this.probeFrameSpikes = 0;
    if (!this.params.paused) {
      this.acc += this.params.speed * frameDt * STEPS_PER_SECOND;
      let guard = 0;
      while (this.acc >= 1 && guard < 30) {
        this.stepOnce();
        this.acc -= 1;
        guard++;
      }
      if (this.acc >= 1) this.acc = 0;
    }
    this.history[this.histIdx] = this.frameSpikes;
    this.historyDt[this.histIdx] = frameDt;
    this.histIdx = (this.histIdx + 1) % HISTORY;
    this.stimFlash *= 0.9;
  }

  stepOnce() {
    const { net, params } = this;
    const n = net.count;
    const v = this.v;
    const adapt = this.adapt;
    const glow = this.glow;
    const refr = this.refr;
    const dead = this.dead;
    const weight = this.weight;
    const s = this.step;
    const cur = this.delayBuf[s % D];
    const leakKeep = 1 - params.leak;
    const adaptKeep = 1 - 1 / Math.max(1, params.adaptTau);
    const stemIdx = REGION_INDEX.brainstem;
    const regionSpikes = this.regionSpikes;
    for (let r = 0; r < regionSpikes.length; r++) regionSpikes[r] *= 0.95;

    // 1) Sinaps parlaklığını söndür, mevcut darbeleri ilerlet.
    // Yeni darbeler bundan sonra doğar; böylece 1 adımlık sinapslarda da en az bir adım görünürler.
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

    // Öğrenilen ağırlıklar yavaşça başlangıca döner (unutma)
    if (this.weightsDirty) {
      let maxDev = 0;
      for (let e = 0; e < weight.length; e++) {
        const w = weight[e] + (1 - weight[e]) * W_DECAY;
        weight[e] = w;
        const d = w > 1 ? w - 1 : 1 - w;
        if (d > maxDev) maxDev = d;
      }
      if (maxDev < 0.01) {
        weight.fill(1);
        this.weightsDirty = false;
      }
    }

    // 2) Girdileri topla, sızıntı uygula, spontan aktivite
    for (let i = 0; i < n; i++) {
      if (dead[i]) {
        v[i] = 0;
        cur[i] = 0;
        glow[i] *= 0.86;
        continue;
      }
      let vi = v[i] * leakKeep + cur[i];
      cur[i] = 0;
      const rate = net.region[i] === stemIdx ? params.excitability * 3 : params.excitability;
      if (Math.random() < rate) vi += params.threshold * (0.7 + Math.random() * 0.6);
      v[i] = vi;
      adapt[i] *= adaptKeep;
      glow[i] *= 0.86;
      if (refr[i] > 0) refr[i]--;
    }

    // 3) Ateşleme
    const strength = params.synapticStrength;
    const plastic = params.plasticity;
    const rasterCol = this.rasterHead;
    const rasterRow = this.rasterRow;
    for (let r = 0; r < this.rasterIds.length; r++) this.raster[r * RASTER_LEN + rasterCol] = 0;
    for (let i = 0; i < n; i++) {
      if (dead[i]) continue;
      if (refr[i] > 0) {
        if (v[i] > 0) v[i] *= 0.5;
        continue;
      }
      if (v[i] >= params.threshold + adapt[i]) {
        v[i] = -0.2;
        refr[i] = params.refractory;
        adapt[i] += params.adaptation;
        glow[i] = 1;
        this.frameSpikes++;
        this.totalSpikes++;
        regionSpikes[net.region[i]] += 1;
        if (rasterRow[i] >= 0) this.raster[rasterRow[i] * RASTER_LEN + rasterCol] = 1;
        if (i === this.probe) {
          this.probeSpikes++;
          this.probeFrameSpikes++;
        }
        const inh = this.isInhibitory(i);

        if (plastic) {
          // LTP: bu ateşlemeden kısa süre önce gelen uyarıcı girdiler güçlenir
          for (let k = net.inOffsets[i]; k < net.inOffsets[i + 1]; k++) {
            const e = net.inEdges[k];
            const j = net.edgeFrom[e];
            if (this.isInhibitory(j)) continue;
            const dt = s - (this.lastSpike[j] + net.edgeDelays[e]);
            if (dt >= 0 && dt <= STDP_WINDOW) {
              weight[e] += A_PLUS * STDP_EXP[dt] * ((W_MAX - weight[e]) / (W_MAX - 1));
              this.weightsDirty = true;
            }
          }
          // LTD: sinyal, hedef zaten ateşledikten sonra varıyorsa bağ zayıflar
          if (!inh) {
            for (let e = net.edgeOffsets[i]; e < net.edgeOffsets[i + 1]; e++) {
              const t = net.edgeTargets[e];
              const dt = s + net.edgeDelays[e] - this.lastSpike[t];
              if (dt > 0 && dt <= STDP_WINDOW) {
                weight[e] -= A_MINUS * STDP_EXP[dt] * weight[e];
                this.weightsDirty = true;
              }
            }
          }
        }
        this.lastSpike[i] = s;

        const w = inh ? -strength * 1.6 : strength;
        const start = net.edgeOffsets[i];
        const end = net.edgeOffsets[i + 1];
        for (let e = start; e < end; e++) {
          const t = net.edgeTargets[e];
          const d = net.edgeDelays[e];
          this.delayBuf[(s + d) % D][t] += w * weight[e] * (0.8 + Math.random() * 0.4);
          this.edgeGlow[e] = 1;
          if (this.pulseCount < this.pulseCap) {
            const q = this.pulseCount++;
            this.pulseEdge[q] = e;
            this.pulseT[q] = 0;
            this.pulseSpeed[q] = 1 / d;
          }
        }
      }
    }
    this.rasterHead = (rasterCol + 1) % RASTER_LEN;

    // Prob kaydı
    if (this.probe >= 0) {
      const h = this.probeHead;
      const pi = this.probe;
      this.probeV[h] = v[pi];
      this.probeTh[h] = params.threshold + adapt[pi];
      this.probeSpike[h] = this.lastSpike[pi] === s ? 1 : 0;
      this.probeHead = (h + 1) % PROBE_LEN;
    }
    this.step++;
  }

  setProbe(i: number) {
    this.probe = i;
    this.probeV.fill(0);
    this.probeTh.fill(this.params.threshold);
    this.probeSpike.fill(0);
    this.probeHead = 0;
    this.probeSpikes = 0;
  }

  /** Prob nöronuna doğrudan akım enjekte et (patch-clamp gibi) */
  injectProbe(amount = 1.5) {
    if (this.probe < 0 || this.dead[this.probe]) return;
    this.v[this.probe] += this.params.threshold * amount;
  }

  stimulateRegion(regionIdx: number, amount = 1.3) {
    const { net } = this;
    for (let i = 0; i < net.count; i++) {
      if (net.region[i] === regionIdx && !this.dead[i] && Math.random() < 0.6) {
        this.v[i] += this.params.threshold * amount * (0.6 + Math.random() * 0.8);
      }
    }
    this.stimFlash = 1;
  }

  /** idx etrafındaki r yarıçaplı küredeki nöronlar için f(i, uzaklık oranı) çağırır */
  private forEachNear(idx: number, radius: number, f: (i: number, frac: number) => void) {
    const { net } = this;
    const x = net.positions[idx * 3], y = net.positions[idx * 3 + 1], z = net.positions[idx * 3 + 2];
    const r2 = radius * radius;
    for (let i = 0; i < net.count; i++) {
      const dx = net.positions[i * 3] - x;
      const dy = net.positions[i * 3 + 1] - y;
      const dz = net.positions[i * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) f(i, Math.sqrt(d2) / radius);
    }
  }

  /**
   * Elektrot benzeri yerel uyarım: merkezdeki nöronlar hemen, dış halka 1-3 adım sonra
   * ateşlenir. Aktivite merkezden dışa yayıldığı için tekrarlanan uyarım (STDP açıkken)
   * dışa giden yolları güçlendirir.
   */
  stimulateAt(idx: number, radius = 0.28) {
    this.forEachNear(idx, radius, (i, frac) => {
      if (this.dead[i]) return;
      const amount = this.params.threshold * (1.2 + (1 - frac));
      const lag = Math.min(3, Math.floor(frac * 4));
      if (lag === 0) this.v[i] += amount;
      else this.delayBuf[(this.step + lag) % D][i] += amount;
    });
    this.stimFlash = 1;
  }

  /** Lezyon: yarıçap içindeki nöronları kalıcı olarak susturur (inme/hasar modeli) */
  lesionAt(idx: number, radius = 0.26) {
    this.forEachNear(idx, radius, (i) => {
      if (!this.dead[i]) {
        this.dead[i] = 1;
        this.deadCount++;
        this.v[i] = 0;
        this.glow[i] = 0;
      }
    });
  }

  healAll() {
    this.dead.fill(0);
    this.deadCount = 0;
  }

  stimulateAll() {
    for (let i = 0; i < this.net.count; i++) {
      if (!this.dead[i] && Math.random() < 0.35) this.v[i] += this.params.threshold * 1.5;
    }
    this.stimFlash = 1;
  }

  /** Son ~1 saniyedeki (gerçek zaman) ateşleme sayısı */
  recentSpikes() {
    let s = 0;
    let t = 0;
    for (let i = 0; i < HISTORY && t < 1; i++) {
      const k = (this.histIdx - 1 - i + HISTORY) % HISTORY;
      s += this.history[k];
      t += this.historyDt[k];
    }
    return t > 0.2 ? Math.round(s / t) : 0;
  }

  /** Bölgenin nöron başına düşen güncel aktivitesi (bölge büyüklüğünden bağımsız) */
  regionRate(r: number) {
    const c = this.regionCounts[r];
    return c > 0 ? this.regionSpikes[r] / c : 0;
  }

  activeCount() {
    let c = 0;
    for (let i = 0; i < this.glow.length; i++) if (this.glow[i] > 0.3) c++;
    return c;
  }

  /** Öğrenme özeti: uyarıcı sinapslarda güçlenen / zayıflayan oranı */
  weightStats() {
    const { net, weight } = this;
    let exc = 0, up = 0, down = 0, sum = 0;
    for (let e = 0; e < net.edgeCount; e++) {
      if (this.isInhibitory(net.edgeFrom[e])) continue;
      const w = weight[e];
      exc++;
      sum += w;
      if (w > 1.25) up++;
      else if (w < 0.8) down++;
    }
    return { mean: exc ? sum / exc : 1, up: exc ? up / exc : 0, down: exc ? down / exc : 0 };
  }

  /** Prob nöronunun bağlantı bilgisi */
  probeInfo() {
    const i = this.probe;
    if (i < 0) return null;
    const { net, weight } = this;
    const outDeg = net.edgeOffsets[i + 1] - net.edgeOffsets[i];
    const inDeg = net.inOffsets[i + 1] - net.inOffsets[i];
    let win = 0;
    for (let k = net.inOffsets[i]; k < net.inOffsets[i + 1]; k++) win += weight[net.inEdges[k]];
    return {
      region: net.region[i],
      inhibitory: this.isInhibitory(i),
      dead: this.dead[i] === 1,
      outDeg,
      inDeg,
      meanInWeight: inDeg ? win / inDeg : 1,
    };
  }
}
