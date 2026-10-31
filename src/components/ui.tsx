import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";
import type { BrainSim } from "../brain/simulation";

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
