import { REGIONS, REGION_INDEX } from "./regions";

export interface Network {
  count: number;
  positions: Float32Array; // xyz
  region: Uint8Array;
  rnd: Float32Array; // nöron başına sabit rastgele sayı (inhibitör seçimi için)
  edgeOffsets: Int32Array; // CSR
  edgeTargets: Int32Array;
  edgeDelays: Uint8Array;
  edgeFrom: Int32Array;
  edgeCount: number;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function wrinkle(x: number, y: number, z: number) {
  return (
    1 +
    0.055 * Math.sin(7.3 * x + 2.1) * Math.sin(6.1 * y + 0.7) * Math.sin(8.2 * z + 1.3) +
    0.035 * Math.sin(11 * x * y + 3 * z) * Math.cos(5 * y - 4 * z)
  );
}

/** Yarımkürenin orta hatta bakan yüzünü düzleştirir (longitudinal fissür). x yarımküre merkezine göredir. */
export function flattenMedial(x: number, side: number) {
  return side * x < -0.3 ? -side * 0.3 + (x + side * 0.3) * 0.35 : x;
}

export function generateNetwork(count: number, k: number, seed = 1): Network {
  const rnd = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const region = new Uint8Array(count);
  const nrnd = new Float32Array(count);

  const randDir = (): [number, number, number] => {
    const z = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(t), r * Math.sin(t), z];
  };

  const RI = REGION_INDEX;
  const cerebrumIds = [RI.frontal, RI.parietal, RI.temporal, RI.occipital];
  const share = (id: string) => REGIONS[RI[id]].share;
  const nLimbic = Math.round(count * share("limbic"));
  const nCereb = Math.round(count * share("cerebellum"));
  const nStem = Math.round(count * share("brainstem"));
  const nCortex = count - nLimbic - nCereb - nStem;

  let i = 0;
  const put = (x: number, y: number, z: number, reg: number) => {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    region[i] = reg;
    nrnd[i] = rnd();
    i++;
  };

  // --- Serebral korteks (iki yarımküre) ---
  let placed = 0;
  while (placed < nCortex) {
    const side = rnd() < 0.5 ? -1 : 1;
    const [dx, dy, dz] = randDir();
    const r = 0.84 + 0.16 * Math.pow(rnd(), 0.6);
    let x = dx * 0.8 * r;
    let y = dy * 0.86 * r;
    let z = dz * 1.2 * r;
    if (y < 0) y *= 0.72;
    const w = wrinkle(x + side * 0.42, y, z);
    x *= w;
    y *= w;
    z *= w;
    // kabuktaki gibi medial yüzeyi düzleştir; yoksa nöronlar karşı yarımküreye taşar
    x = flattenMedial(x, side);
    x += side * 0.42;
    if (Math.abs(x) < 0.1 && y > -0.35) continue; // longitudinal fissür
    if (y < -0.55 && z < -0.35) continue; // beyincik için yer aç
    let reg: number;
    if (z > 0.3) reg = cerebrumIds[0];
    else if (z < -0.78) reg = cerebrumIds[3];
    else if (y < -0.02 && Math.abs(x) > 0.55) reg = cerebrumIds[2];
    else reg = cerebrumIds[1];
    put(x, y, z, reg);
    placed++;
  }

  // --- Limbik sistem (derin yapılar) ---
  for (let j = 0; j < nLimbic; j++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const [dx, dy, dz] = randDir();
    const r = Math.pow(rnd(), 0.5);
    put(side * 0.3 + dx * 0.28 * r, -0.12 + dy * 0.22 * r, -0.05 + dz * 0.45 * r, RI.limbic);
  }

  // --- Beyincik ---
  for (let j = 0; j < nCereb; j++) {
    const [dx, dy, dz] = randDir();
    const r = 0.8 + 0.2 * Math.pow(rnd(), 0.6);
    const w = 1 + 0.06 * Math.sin(20 * dy + 14 * dx);
    put(dx * 0.62 * r * w, -0.85 + dy * 0.34 * r * w, -0.85 + dz * 0.42 * r * w, RI.cerebellum);
  }

  // --- Beyin sapı ---
  for (let j = 0; j < nStem; j++) {
    const y = -0.45 - rnd() * 1.25;
    const a = rnd() * Math.PI * 2;
    const rr = 0.17 * Math.sqrt(rnd()) * (1 - (y + 0.45) * 0.15);
    put(Math.cos(a) * rr, y, -0.25 + (y + 0.45) * 0.18 + Math.sin(a) * rr, RI.brainstem);
  }

  // --- Bağlantılar (k en yakın komşu + uzun menzilli) ---
  const adj: number[][] = new Array(count);
  const dists: number[][] = new Array(count);
  for (let a = 0; a < count; a++) {
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const bestIdx: number[] = [];
    const bestD: number[] = [];
    for (let b = 0; b < count; b++) {
      if (a === b) continue;
      const dx = positions[b * 3] - ax;
      const dy = positions[b * 3 + 1] - ay;
      const dz = positions[b * 3 + 2] - az;
      const d = dx * dx + dy * dy + dz * dz;
      if (bestIdx.length < k) {
        let p = bestIdx.length;
        bestIdx.push(b);
        bestD.push(d);
        while (p > 0 && bestD[p - 1] > d) {
          bestD[p] = bestD[p - 1];
          bestIdx[p] = bestIdx[p - 1];
          p--;
        }
        bestD[p] = d;
        bestIdx[p] = b;
      } else if (d < bestD[k - 1]) {
        let p = k - 1;
        while (p > 0 && bestD[p - 1] > d) {
          bestD[p] = bestD[p - 1];
          bestIdx[p] = bestIdx[p - 1];
          p--;
        }
        bestD[p] = d;
        bestIdx[p] = b;
      }
    }
    adj[a] = bestIdx;
    dists[a] = bestD.map((d) => Math.sqrt(d));

    // uzun menzilli bağlantılar
    const longCount = region[a] === RI.brainstem ? 3 : rnd() < 0.2 ? 1 : 0;
    for (let l = 0; l < longCount; l++) {
      const b = Math.floor(rnd() * count);
      if (b === a) continue;
      const dx = positions[b * 3] - ax;
      const dy = positions[b * 3 + 1] - ay;
      const dz = positions[b * 3 + 2] - az;
      adj[a].push(b);
      dists[a].push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  }

  let edgeCount = 0;
  for (let a = 0; a < count; a++) edgeCount += adj[a].length;
  const edgeOffsets = new Int32Array(count + 1);
  const edgeTargets = new Int32Array(edgeCount);
  const edgeDelays = new Uint8Array(edgeCount);
  const edgeFrom = new Int32Array(edgeCount);
  let e = 0;
  for (let a = 0; a < count; a++) {
    edgeOffsets[a] = e;
    for (let j = 0; j < adj[a].length; j++) {
      edgeTargets[e] = adj[a][j];
      edgeFrom[e] = a;
      edgeDelays[e] = Math.min(7, 1 + Math.floor(dists[a][j] * 5));
      e++;
    }
  }
  edgeOffsets[count] = e;

  return {
    count,
    positions,
    region,
    rnd: nrnd,
    edgeOffsets,
    edgeTargets,
    edgeDelays,
    edgeFrom,
    edgeCount,
  };
}
