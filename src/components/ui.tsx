import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { PROBE_LEN, RASTER_LEN, type BrainSim } from "../brain/simulation";
import { REGIONS } from "../brain/regions";

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block" title={hint}>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-cyan-300">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="brain-slider w-full"
        style={{ background: `linear-gradient(90deg, #22d3ee ${pct}%, rgba(148,163,184,0.2) ${pct}%)` }}
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] text-slate-300 transition hover:bg-white/5"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-4 w-8 rounded-full transition-colors",
          checked ? "bg-cyan-500" : "bg-slate-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
            checked ? "left-4.5" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</h3>
        {right}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

/** EEG benzeri aktivite grafiği */
export function ActivityGraph({ sim, color = "#22d3ee" }: { sim: BrainSim; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      // ızgara
      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += H / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }
      const h = sim.history;
      const N = h.length;
      let max = 1;
      for (let i = 0; i < N; i++) if (h[i] > max) max = h[i];
      max = Math.max(max, sim.net.count * 0.02);
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const v = h[(sim.histIdx + i) % N];
        const x = (i / (N - 1)) * W;
        const y = H - 3 - (v / max) * (H - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // dolgu
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sim, color]);
  return <canvas ref={ref} width={320} height={80} className="h-20 w-full rounded-lg bg-black/30" />;
}

/** Prob nöronunun membran potansiyeli (osiloskop) */
export function ProbeScope({ sim, labels }: { sim: BrainSim; labels: { v: string; th: string } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      const top = sim.params.threshold * 2.4; // görüntü aralığı: -0.4 .. 2.4×eşik
      const bot = -0.4;
      const yOf = (v: number) => H - 4 - ((Math.min(top, Math.max(bot, v)) - bot) / (top - bot)) * (H - 8);
      // sıfır çizgisi
      ctx.strokeStyle = "rgba(148,163,184,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yOf(0) + 0.5);
      ctx.lineTo(W, yOf(0) + 0.5);
      ctx.stroke();
      const N = PROBE_LEN;
      const xOf = (i: number) => (i / (N - 1)) * W;
      // dinamik eşik (adaptasyonla yükselir)
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(251,191,36,0.75)";
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const k = (sim.probeHead + i) % N;
        const y = yOf(sim.probeTh[k]);
        if (i === 0) ctx.moveTo(xOf(i), y);
        else ctx.lineTo(xOf(i), y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // potansiyel + aksiyon potansiyelleri
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const k = (sim.probeHead + i) % N;
        const x = xOf(i);
        if (sim.probeSpike[k]) {
          ctx.lineTo(x, yOf(top));
          ctx.lineTo(x, yOf(sim.probeV[k]));
        } else if (i === 0) ctx.moveTo(x, yOf(sim.probeV[k]));
        else ctx.lineTo(x, yOf(sim.probeV[k]));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(34,211,238,0.85)";
      ctx.fillText(labels.v, 6, 12);
      ctx.fillStyle = "rgba(251,191,36,0.85)";
      ctx.fillText(labels.th, 6, 24);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sim, labels.v, labels.th]);
  return <canvas ref={ref} width={320} height={96} className="h-24 w-full rounded-lg bg-black/40" />;
}

/** Spike raster: her satır bir nöron (bölgeye göre sıralı), her nokta bir ateşleme */
export function RasterPlot({ sim }: { sim: BrainSim }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const rows = sim.rasterIds.length;
    const colors = Array.from(sim.rasterIds, (id) => REGIONS[sim.net.region[id]].color);
    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      const rh = H / rows;
      const cw = W / RASTER_LEN;
      for (let r = 0; r < rows; r++) {
        const base = r * RASTER_LEN;
        const dead = sim.dead[sim.rasterIds[r]];
        if (dead) {
          ctx.fillStyle = "rgba(100,110,130,0.18)";
          ctx.fillRect(0, r * rh, W, Math.max(1, rh));
          continue;
        }
        ctx.fillStyle = colors[r];
        for (let i = 0; i < RASTER_LEN; i++) {
          const k = (sim.rasterHead + i) % RASTER_LEN;
          if (sim.raster[base + k]) ctx.fillRect(i * cw, r * rh, Math.max(1.5, cw), Math.max(1, rh));
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
  return <canvas ref={ref} width={320} height={120} className="h-[120px] w-full rounded-lg bg-black/30" />;
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-white/10 text-[10px]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2 py-0.5 font-semibold transition",
            value === o.id ? "bg-cyan-500/25 text-cyan-300" : "text-slate-400 hover:bg-white/10"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
