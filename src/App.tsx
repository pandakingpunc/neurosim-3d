import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrainScene, type Tool, type VisualSettings } from "./components/BrainScene";
import { ActivityGraph, ProbeScope, RasterPlot, Section, Slider, Tabs, Toggle } from "./components/ui";
import { SpikeAudio } from "./audio";
import { generateNetwork } from "./brain/network";
import { BrainSim, DEFAULT_PARAMS, type SimParams } from "./brain/simulation";
import { REGIONS } from "./brain/regions";
import { LANGS, STRINGS, initialLang, saveLang, type Lang, type PresetId } from "./i18n";
import { cn } from "./utils/cn";

interface Preset {
  id: PresetId;
  icon: string;
  params: Partial<SimParams>;
}

const PRESETS: Preset[] = [
  {
    id: "rest",
    icon: "🧘",
    params: { threshold: 1, synapticStrength: 0.32, excitability: 0.003, leak: 0.06, inhibition: 0.2, refractory: 6, adaptation: 0, adaptTau: 60 },
  },
  {
    id: "focus",
    icon: "🎯",
    params: { threshold: 0.95, synapticStrength: 0.42, excitability: 0.005, leak: 0.05, inhibition: 0.22, refractory: 5, adaptation: 0, adaptTau: 60 },
  },
  {
    id: "sleep",
    icon: "🌙",
    // Güçlü adaptasyon + güçlü yerel bağlantı: yukarı/aşağı durumlar, gezen yavaş dalgalar
    params: { threshold: 1, synapticStrength: 0.9, excitability: 0.0006, leak: 0.03, inhibition: 0.12, refractory: 14, adaptation: 0.8, adaptTau: 60 },
  },
  {
    id: "caffeine",
    icon: "☕",
    params: { threshold: 0.8, synapticStrength: 0.36, excitability: 0.007, leak: 0.07, inhibition: 0.2, refractory: 4, adaptation: 0, adaptTau: 60 },
  },
  {
    id: "seizure",
    icon: "⚡",
    // İnhibisyon çöker; hızlı ve güçlü adaptasyon sürekli doygunluk yerine ritmik patlamalar üretir
    params: { threshold: 0.75, synapticStrength: 0.85, excitability: 0.004, leak: 0.04, inhibition: 0.03, refractory: 8, adaptation: 3, adaptTau: 30 },
  },
  {
    id: "anesthesia",
    icon: "💤",
    params: { threshold: 1.6, synapticStrength: 0.12, excitability: 0.0003, leak: 0.1, inhibition: 0.3, refractory: 10, adaptation: 0, adaptTau: 60 },
  },
];

const TOOLS: [Tool, string][] = [
  ["stimulate", "⚡"],
  ["probe", "🔬"],
  ["lesion", "✂"],
];
const TOOL_ACTIVE: Record<Tool, string> = {
  stimulate: "bg-amber-400/20 text-amber-300",
  probe: "bg-cyan-500/25 text-cyan-300",
  lesion: "bg-rose-500/25 text-rose-300",
};
const pct = (x: number) => (x * 100).toFixed(1) + "%";

const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 768;

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = STRINGS[lang];
  const [neuronCount, setNeuronCount] = useState(2200);
  const [pendingCount, setPendingCount] = useState(2200);
  const [connectivity, setConnectivity] = useState(6);
  const [pendingK, setPendingK] = useState(6);
  const [seed, setSeed] = useState(1);
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS });
  const [presetIdx, setPresetIdx] = useState<number | null>(0);
  const [visual, setVisual] = useState<VisualSettings>({
    showSynapses: true,
    showPulses: true,
    showShell: true,
    showLabels: true,
    autoRotate: true,
    visibleRegions: REGIONS.map(() => true),
    neuronSize: 1,
  });
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>("stimulate");
  const [sound, setSound] = useState(false);
  const [eegTab, setEegTab] = useState<"eeg" | "raster">("eeg");
  const [probeOn, setProbeOn] = useState(false);
  const audio = useMemo(() => new SpikeAudio(), []);
  useEffect(() => () => audio.dispose(), [audio]);
  const [stats, setStats] = useState({
    rate: 0,
    active: 0,
    total: 0,
    regionRates: [] as number[],
    dead: 0,
    learnUp: 0,
    learnDown: 0,
    learned: false,
    probe: null as ReturnType<BrainSim["probeInfo"]>,
    probeSpikes: 0,
  });
  // Dar ekranda iki panel birden sahneyi kapatır; başta kapalı açılır
  const [panelOpen, setPanelOpen] = useState(() => !isNarrow());
  const [infoOpen, setInfoOpen] = useState(() => !isNarrow());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Dil: belge dili, başlık ve tercih
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = STRINGS[lang].docTitle;
    saveLang(lang);
  }, [lang]);

  // Ağ ve simülasyon
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const sim = useMemo(() => {
    const net = generateNetwork(neuronCount, connectivity, seed);
    return new BrainSim(net, paramsRef.current);
  }, [neuronCount, connectivity, seed]);

  useEffect(() => {
    sim.params = params;
  }, [params, sim]);

  // Geliştirme sırasında tarayıcı testleri için (üretim derlemesine girmez)
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __sim: BrainSim }).__sim = sim;
  }, [sim]);

  // Nöron sayısı / bağlantı değişimini geciktir (debounce)
  useEffect(() => {
    const id = setTimeout(() => {
      setNeuronCount(pendingCount);
      setConnectivity(pendingK);
    }, 400);
    return () => clearTimeout(id);
  }, [pendingCount, pendingK]);

  // İstatistikler
  useEffect(() => {
    setProbeOn(false); // yeni ağda eski prob yok
    const id = setInterval(() => {
      const ws = sim.weightsDirty ? sim.weightStats() : null;
      setStats({
        rate: sim.recentSpikes(),
        active: sim.activeCount(),
        total: sim.totalSpikes,
        regionRates: REGIONS.map((_, i) => sim.regionRate(i)),
        dead: sim.deadCount,
        learnUp: ws ? ws.up : 0,
        learnDown: ws ? ws.down : 0,
        learned: !!ws,
        probe: sim.probeInfo(),
        probeSpikes: sim.probeSpikes,
      });
    }, 250);
    return () => clearInterval(id);
  }, [sim]);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const update = (p: Partial<SimParams>) => {
    setParams((prev) => ({ ...prev, ...p }));
    if (!("paused" in p) && !("speed" in p) && !("plasticity" in p)) setPresetIdx(null);
  };

  const applyPreset = (i: number) => {
    setParams((prev) => ({ ...prev, ...PRESETS[i].params }));
    setPresetIdx(i);
    showToast(t.presetToast(PRESETS[i].icon, t.presets[PRESETS[i].id].name));
  };

  const toolRef = useRef(tool);
  toolRef.current = tool;
  const tRef = useRef(t);
  tRef.current = t;
  const langRef = useRef(lang);
  langRef.current = lang;
  const onNeuronClick = useCallback(
    (idx: number) => {
      const reg = sim.net.region[idx];
      const tool = toolRef.current;
      if (tool === "probe") {
        sim.setProbe(idx);
        setProbeOn(true);
        setInfoOpen(true);
        if (isNarrow()) setPanelOpen(false);
        showToast(tRef.current.probe.toast(REGIONS[reg].name[langRef.current]));
      } else if (tool === "lesion") {
        const before = sim.deadCount;
        sim.lesionAt(idx);
        showToast(tRef.current.lesionToast(sim.deadCount - before));
      } else {
        sim.stimulateAt(idx);
      }
      setSelectedRegion(reg);
    },
    [sim]
  );

  const closeProbe = () => {
    sim.setProbe(-1);
    setProbeOn(false);
  };

  const toggleSound = () => {
    const on = !audio.enabled;
    void audio.setEnabled(on);
    setSound(on);
  };

  const toggleRegion = (i: number) =>
    setVisual((v) => {
      const vr = [...v.visibleRegions];
      vr[i] = !vr[i];
      return { ...v, visibleRegions: vr };
    });

  const soloRegion = (i: number) =>
    setVisual((v) => {
      const allSolo = v.visibleRegions.every((x, j) => x === (j === i));
      return { ...v, visibleRegions: REGIONS.map((_, j) => (allSolo ? true : j === i)) };
    });

  const togglePanel = () => {
    const open = !panelOpen;
    setPanelOpen(open);
    if (open && isNarrow()) setInfoOpen(false);
  };
  const toggleInfo = () => {
    const open = !infoOpen;
    setInfoOpen(open);
    if (open && isNarrow()) setPanelOpen(false);
  };

  const region = selectedRegion !== null ? REGIONS[selectedRegion] : null;
  const maxRegionRate = Math.max(1e-6, ...stats.regionRates);
  const fmt = (n: number) => n.toLocaleString(t.locale);

  const toggleSoundRef = useRef(toggleSound);
  toggleSoundRef.current = toggleSound;

  // Klavye kısayolları
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        // Odaktaki düğme boşlukla ayrıca tıklanmasın
        if (tag === "BUTTON") (e.target as HTMLElement).blur();
        update({ paused: !paramsRef.current.paused });
      } else if (e.key === "s" || e.key === "S") {
        sim.stimulateAll();
      } else if (e.key === "r" || e.key === "R") {
        sim.reset();
      } else if (e.key === "m" || e.key === "M") {
        if (!e.repeat) toggleSoundRef.current();
      } else if (e.key === "1") setTool("stimulate");
      else if (e.key === "2") setTool("probe");
      else if (e.key === "3") setTool("lesion");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05070f] font-sans text-slate-100">
      <BrainScene sim={sim} visual={visual} lang={lang} tool={tool} audio={audio} onNeuronClick={onNeuronClick} />

      {/* Başlık */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-2 p-4">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0a0e1c]/70 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                NeuroSim <span className="text-cyan-400">3D</span>
              </h1>
              <p className="text-[11px] text-slate-400">{t.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-start gap-2">
          {/* Canlı istatistikler */}
          <div className="hidden gap-2 lg:flex">
            <Stat label={t.stats.neurons} value={fmt(neuronCount)} />
            <Stat label={t.stats.synapses} value={fmt(sim.net.edgeCount)} />
            <Stat label={t.stats.rate} value={fmt(stats.rate)} accent />
            <Stat label={t.stats.active} value={fmt(stats.active)} />
            <Stat label={t.stats.total} value={formatBig(stats.total)} />
          </div>
          {/* Dil seçici */}
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-[#0a0e1c]/70 backdrop-blur-md">
            {LANGS.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={cn(
                  "px-2.5 py-2 font-mono text-[11px] font-semibold uppercase transition",
                  lang === l ? "bg-cyan-500/25 text-cyan-300" : "text-slate-400 hover:bg-white/10"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Alt ipucu + oynatma çubuğu */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex w-max max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0a0e1c]/75 px-3 py-2 backdrop-blur-md">
          <button
            onClick={() => update({ paused: !params.paused })}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-black transition hover:bg-cyan-400"
            title={t.playPause}
          >
            {params.paused ? "▶" : "❚❚"}
          </button>
          <button
            onClick={() => sim.stimulateAll()}
            className="whitespace-nowrap rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/25"
            title={t.stimulateAllTitle}
          >
            ⚡<span className="hidden sm:inline"> {t.stimulate}</span>
          </button>
          <button
            onClick={() => {
              sim.reset();
              showToast(t.resetToast);
            }}
            className="whitespace-nowrap rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
            title={t.resetTitle}
          >
            ↺<span className="hidden sm:inline"> {t.reset}</span>
          </button>
          <div className="mx-1 h-6 w-px bg-white/10" />
          <div className="flex items-center gap-1 text-[11px] text-slate-400 sm:gap-2">
            <span className="hidden sm:inline">{t.speed}</span>
            {[0.25, 0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => update({ speed: s })}
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono transition",
                  params.speed === s ? "bg-cyan-500/25 text-cyan-300" : "hover:bg-white/10"
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <div className="flex overflow-hidden rounded-xl border border-white/10">
            {TOOLS.map(([id, icon], k) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                aria-pressed={tool === id}
                title={t.toolTitle(t.tools[id].name, String(k + 1))}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 text-xs font-semibold transition",
                  tool === id ? TOOL_ACTIVE[id] : "text-slate-400 hover:bg-white/10"
                )}
              >
                <span>{icon}</span>
                <span className="hidden md:inline">{t.tools[id].name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            title={t.soundTitle}
            className={cn(
              "rounded-xl border px-2 py-1.5 text-xs transition",
              sound ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-white/10 text-slate-400 hover:bg-white/10"
            )}
          >
            {sound ? "🔊" : "🔈"}
          </button>
          <div className="mx-1 hidden h-6 w-px bg-white/10 2xl:block" />
          <span className="hidden whitespace-nowrap text-[11px] text-slate-500 2xl:block">{t.tools[tool].hint}</span>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-400/40 bg-cyan-500/15 px-4 py-1.5 text-sm text-cyan-200 backdrop-blur-md">
          {toast}
        </div>
      )}

      {/* Sol: Kontrol paneli */}
      <aside
        className={cn(
          "absolute left-4 top-24 bottom-28 lg:bottom-20 z-10 w-[300px] max-w-[calc(100vw-4.5rem)] transition-transform duration-300",
          !panelOpen && "-translate-x-[calc(100%+1rem)]"
        )}
      >
        <button
          onClick={togglePanel}
          className="absolute -right-9 top-0 flex h-9 w-9 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-[#0a0e1c]/80 text-slate-300 backdrop-blur-md hover:text-white"
          title={t.settings}
        >
          {panelOpen ? "‹" : "⚙"}
        </button>
        <div className="scrollbar-thin h-full overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e1c]/80 p-3 backdrop-blur-md">
          <div className="space-y-3">
            <Section title={t.sections.mentalState}>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(i)}
                    title={t.presets[p.id].desc}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] transition",
                      presetIdx === i
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                        : "border-white/8 bg-white/[0.02] text-slate-300 hover:bg-white/8"
                    )}
                  >
                    <span className="text-lg leading-none">{p.icon}</span>
                    {t.presets[p.id].name}
                  </button>
                ))}
              </div>
              {presetIdx !== null && (
                <p className="text-[11px] leading-snug text-slate-400">{t.presets[PRESETS[presetIdx].id].desc}</p>
              )}
            </Section>

            <Section title={t.sections.dynamics}>
              <Slider
                label={t.sliders.excitability}
                hint={t.sliders.excitabilityHint}
                value={params.excitability}
                min={0}
                max={0.012}
                step={0.0002}
                onChange={(v) => update({ excitability: v })}
                format={(v) => (v * 1000).toFixed(1) + "‰"}
              />
              <Slider
                label={t.sliders.strength}
                hint={t.sliders.strengthHint}
                value={params.synapticStrength}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update({ synapticStrength: v })}
                format={(v) => v.toFixed(2)}
              />
              <Slider
                label={t.sliders.threshold}
                hint={t.sliders.thresholdHint}
                value={params.threshold}
                min={0.5}
                max={2}
                step={0.05}
                onChange={(v) => update({ threshold: v })}
                format={(v) => v.toFixed(2)}
              />
              <Slider
                label={t.sliders.leak}
                hint={t.sliders.leakHint}
                value={params.leak}
                min={0.005}
                max={0.2}
                step={0.005}
                onChange={(v) => update({ leak: v })}
                format={(v) => (v * 100).toFixed(1) + "%"}
              />
              <Slider
                label={t.sliders.inhibition}
                hint={t.sliders.inhibitionHint}
                value={params.inhibition}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => update({ inhibition: v })}
                format={(v) => Math.round(v * 100) + "%"}
              />
              <Slider
                label={t.sliders.refractory}
                hint={t.sliders.refractoryHint}
                value={params.refractory}
                min={1}
                max={20}
                step={1}
                onChange={(v) => update({ refractory: v })}
                format={(v) => v + " " + t.sliders.steps}
              />
              <Slider
                label={t.sliders.adaptation}
                hint={t.sliders.adaptationHint}
                value={params.adaptation}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => update({ adaptation: v })}
                format={(v) => v.toFixed(2)}
              />
            </Section>

            <Section title={t.sections.learning}>
              <div title={t.plasticityHint}>
                <Toggle label={t.plasticity} checked={params.plasticity} onChange={(v) => update({ plasticity: v })} />
              </div>
              <p className="px-2 text-[11px] leading-snug text-slate-400">
                {stats.learned
                  ? t.learnStats(pct(stats.learnUp), pct(stats.learnDown))
                  : params.plasticity
                    ? t.plasticityHint
                    : t.learnIdle}
              </p>
              {stats.learned && (
                <button
                  onClick={() => {
                    sim.resetWeights();
                    showToast(t.forgetToast);
                  }}
                  className="w-full rounded-lg border border-amber-300/30 py-1.5 text-[12px] text-amber-200 transition hover:bg-amber-300/10"
                >
                  {t.forget}
                </button>
              )}
              <div className="flex items-center justify-between px-2 pt-1 text-[12px]">
                <span className="text-slate-300">{t.lesioned}</span>
                <span className="font-mono text-rose-300">{fmt(stats.dead)}</span>
              </div>
              {stats.dead > 0 ? (
                <button
                  onClick={() => {
                    sim.healAll();
                    showToast(t.healToast);
                  }}
                  className="w-full rounded-lg border border-rose-300/30 py-1.5 text-[12px] text-rose-200 transition hover:bg-rose-300/10"
                >
                  {t.heal}
                </button>
              ) : (
                <p className="px-2 text-[11px] leading-snug text-slate-500">{t.lesionHint}</p>
              )}
            </Section>

            <Section title={t.sections.network}>
              <Slider
                label={t.sliders.neuronCount}
                value={pendingCount}
                min={400}
                max={5000}
                step={100}
                onChange={setPendingCount}
                format={fmt}
              />
              <Slider
                label={t.sliders.connections}
                value={pendingK}
                min={2}
                max={12}
                step={1}
                onChange={setPendingK}
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="w-full rounded-lg border border-white/10 py-1.5 text-[12px] text-slate-300 transition hover:bg-white/10"
              >
                {t.rebuild}
              </button>
            </Section>

            <Section title={t.sections.view}>
              <Toggle label={t.toggles.synapses} checked={visual.showSynapses} onChange={(v) => setVisual({ ...visual, showSynapses: v })} />
              <Toggle label={t.toggles.pulses} checked={visual.showPulses} onChange={(v) => setVisual({ ...visual, showPulses: v })} />
              <Toggle label={t.toggles.shell} checked={visual.showShell} onChange={(v) => setVisual({ ...visual, showShell: v })} />
              <Toggle label={t.toggles.labels} checked={visual.showLabels} onChange={(v) => setVisual({ ...visual, showLabels: v })} />
              <Toggle label={t.toggles.autoRotate} checked={visual.autoRotate} onChange={(v) => setVisual({ ...visual, autoRotate: v })} />
              <Slider
                label={t.toggles.neuronSize}
                value={visual.neuronSize}
                min={0.4}
                max={2.5}
                step={0.1}
                onChange={(v) => setVisual({ ...visual, neuronSize: v })}
                format={(v) => v.toFixed(1) + "×"}
              />
            </Section>
          </div>
        </div>
      </aside>

      {/* Sağ: Bölgeler & bilgi */}
      <aside
        className={cn(
          "absolute right-4 top-24 bottom-28 lg:bottom-20 z-10 w-[300px] max-w-[calc(100vw-4.5rem)] transition-transform duration-300",
          !infoOpen && "translate-x-[calc(100%+1rem)]"
        )}
      >
        <button
          onClick={toggleInfo}
          className="absolute -left-9 top-0 flex h-9 w-9 items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-[#0a0e1c]/80 text-slate-300 backdrop-blur-md hover:text-white"
          title={t.info}
        >
          {infoOpen ? "›" : "ⓘ"}
        </button>
        <div className="scrollbar-thin h-full overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e1c]/80 p-3 backdrop-blur-md">
          <div className="space-y-3">
            {probeOn && stats.probe && (
              <Section
                title={t.sections.probe}
                right={
                  <button onClick={closeProbe} className="text-[12px] text-slate-400 hover:text-white" title={t.probe.close}>
                    ✕
                  </button>
                }
              >
                <ProbeScope sim={sim} labels={{ v: t.probe.legendV, th: "- - " + t.probe.legendTh }} />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-slate-500">{t.probe.region}</span>
                  <span className="text-right font-medium" style={{ color: REGIONS[stats.probe.region].color }}>
                    {REGIONS[stats.probe.region].name[lang]}
                  </span>
                  <span className="text-slate-500">{t.probe.type}</span>
                  <span className={cn("text-right", stats.probe.inhibitory ? "text-violet-300" : "text-emerald-300")}>
                    {stats.probe.inhibitory ? t.probe.inhibitory : t.probe.excitatory}
                    {stats.probe.dead && <span className="text-rose-300"> · {t.probe.lesioned}</span>}
                  </span>
                  <span className="text-slate-500">
                    {t.probe.inputs} / {t.probe.outputs}
                  </span>
                  <span className="text-right font-mono text-slate-200">
                    {stats.probe.inDeg} / {stats.probe.outDeg}
                  </span>
                  <span className="text-slate-500">{t.probe.inWeight}</span>
                  <span className="text-right font-mono text-amber-200">{stats.probe.meanInWeight.toFixed(2)}×</span>
                  <span className="text-slate-500">{t.probe.spikes}</span>
                  <span className="text-right font-mono text-cyan-300">{fmt(stats.probeSpikes)}</span>
                </div>
                <button
                  onClick={() => sim.injectProbe()}
                  disabled={stats.probe.dead}
                  className="w-full rounded-lg bg-cyan-500/90 py-1.5 text-[12px] font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-40"
                >
                  {t.probe.inject}
                </button>
              </Section>
            )}

            <Section
              title={t.sections.eeg}
              right={
                <Tabs
                  value={eegTab}
                  onChange={setEegTab}
                  options={[
                    { id: "eeg", label: t.eegTab },
                    { id: "raster", label: t.rasterTab },
                  ]}
                />
              }
            >
              {eegTab === "eeg" ? (
                <ActivityGraph sim={sim} />
              ) : (
                <>
                  <RasterPlot sim={sim} />
                  <p className="text-[10px] leading-snug text-slate-500">{t.rasterHint}</p>
                </>
              )}
              <div className="grid grid-cols-3 gap-1 text-center lg:hidden">
                <MiniStat label={t.stats.rateShort} value={fmt(stats.rate)} />
                <MiniStat label={t.stats.activeShort} value={fmt(stats.active)} />
                <MiniStat label={t.stats.total} value={formatBig(stats.total)} />
              </div>
            </Section>

            <Section
              title={t.sections.regions}
              right={
                <button
                  onClick={() => setVisual({ ...visual, visibleRegions: REGIONS.map(() => true) })}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  {t.showAll}
                </button>
              }
            >
              <div className="space-y-1">
                {REGIONS.map((r, i) => {
                  const on = visual.visibleRegions[i];
                  const act = (stats.regionRates[i] ?? 0) / maxRegionRate;
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition",
                        selectedRegion === i ? "border-white/20 bg-white/8" : "border-transparent hover:bg-white/5",
                        !on && "opacity-45"
                      )}
                    >
                      <button
                        onClick={() => toggleRegion(i)}
                        onDoubleClick={() => soloRegion(i)}
                        title={t.regionToggleTitle}
                        className="h-3.5 w-3.5 shrink-0 rounded-full border-2 transition"
                        style={{
                          borderColor: r.color,
                          background: on ? r.color : "transparent",
                          boxShadow: on ? `0 0 ${6 + act * 14}px ${r.color}` : "none",
                        }}
                      />
                      <button onClick={() => setSelectedRegion(i)} className="flex-1 text-left">
                        <div className="text-[12px] font-medium text-slate-200">{r.name[lang]}</div>
                        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full transition-all duration-200"
                            style={{ width: `${Math.round(act * 100)}%`, background: r.color }}
                          />
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          sim.stimulateRegion(i);
                          setSelectedRegion(i);
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition hover:bg-white/10"
                        style={{ color: r.color }}
                        title={t.stimulateRegionTitle(r.name[lang])}
                      >
                        ⚡
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={region ? region.name[lang] : t.sections.regionInfo}>
              {region ? (
                <div className="space-y-2">
                  <div className="h-1 w-12 rounded-full" style={{ background: region.color }} />
                  <p className="text-[12px] leading-relaxed text-slate-300">{region.description[lang]}</p>
                  <div className="flex flex-wrap gap-1">
                    {region.functions[lang].map((f) => (
                      <span
                        key={f}
                        className="rounded-full border px-2 py-0.5 text-[10px]"
                        style={{ borderColor: region.color + "55", color: region.color }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => sim.stimulateRegion(selectedRegion!)}
                    className="w-full rounded-lg py-1.5 text-[12px] font-semibold text-black transition hover:brightness-110"
                    style={{ background: region.color }}
                  >
                    {t.stimulateThisRegion}
                  </button>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-slate-400">{t.regionPlaceholder}</p>
              )}
            </Section>

            <Section title={t.sections.howItWorks}>
              <ul className="space-y-1.5 text-[11px] leading-snug text-slate-400">
                {t.how.map(([head, body]) => (
                  <li key={head}>
                    <b className="text-slate-300">{head}</b> {body}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] leading-snug text-slate-500">{t.modelNote}</p>
              <p className="text-[10px] text-slate-500">
                {t.shortcuts} <kbd className="rounded bg-white/10 px-1">{t.kbSpace}</kbd> {t.kbPause} ·{" "}
                <kbd className="rounded bg-white/10 px-1">S</kbd> {t.kbStim} ·{" "}
                <kbd className="rounded bg-white/10 px-1">R</kbd> {t.kbReset} ·{" "}
                <kbd className="rounded bg-white/10 px-1">1</kbd>
                <kbd className="ml-0.5 rounded bg-white/10 px-1">2</kbd>
                <kbd className="ml-0.5 rounded bg-white/10 px-1">3</kbd> {t.kbTools} ·{" "}
                <kbd className="rounded bg-white/10 px-1">M</kbd> {t.kbSound}
              </p>
              {!probeOn && <p className="text-[10px] leading-snug text-slate-500">{t.probe.placeholder}</p>}
            </Section>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="min-w-[88px] rounded-xl border border-white/10 bg-[#0a0e1c]/70 px-3 py-2 backdrop-blur-md">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("font-mono text-sm font-semibold", accent ? "text-cyan-300" : "text-slate-100")}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/5 px-1 py-1">
      <div className="text-[9px] uppercase text-slate-500">{label}</div>
      <div className="font-mono text-xs text-cyan-300">{value}</div>
    </div>
  );
}

function formatBig(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
