import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrainScene, type VisualSettings } from "./components/BrainScene";
import { ActivityGraph, Section, Slider, Toggle } from "./components/ui";
import { generateNetwork } from "./brain/network";
import { BrainSim, DEFAULT_PARAMS, type SimParams } from "./brain/simulation";
import { REGIONS } from "./brain/regions";
import { cn } from "./utils/cn";

interface Preset {
  name: string;
  icon: string;
  desc: string;
  params: Partial<SimParams>;
}

const PRESETS: Preset[] = [
  {
    name: "Dinlenme",
    icon: "🧘",
    desc: "Normal uyanık, sakin beyin aktivitesi. Düzensiz, düşük seviyeli ateşlemeler.",
    params: { threshold: 1, synapticStrength: 0.32, excitability: 0.003, leak: 0.06, inhibition: 0.2, refractory: 6 },
  },
  {
    name: "Odaklanma",
    icon: "🎯",
    desc: "Yoğun düşünce. Artan uyarılabilirlik ve daha güçlü sinaptik iletişim.",
    params: { threshold: 0.95, synapticStrength: 0.42, excitability: 0.005, leak: 0.05, inhibition: 0.22, refractory: 5 },
  },
  {
    name: "Derin Uyku",
    icon: "🌙",
    desc: "Yavaş dalga uykusu. Nadir fakat geniş, senkron ateşleme dalgaları.",
    params: { threshold: 1.2, synapticStrength: 0.6, excitability: 0.0007, leak: 0.03, inhibition: 0.15, refractory: 14 },
  },
  {
    name: "Kafein",
    icon: "☕",
    desc: "Adenozin reseptörleri bloke: eşik düşer, nöronlar daha kolay ateşlenir.",
    params: { threshold: 0.8, synapticStrength: 0.36, excitability: 0.007, leak: 0.07, inhibition: 0.2, refractory: 4 },
  },
  {
    name: "Nöbet",
    icon: "⚡",
    desc: "Epileptik aktivite: inhibisyon çöker, kontrolsüz zincirleme ateşleme yayılır.",
    params: { threshold: 0.75, synapticStrength: 0.85, excitability: 0.004, leak: 0.04, inhibition: 0.03, refractory: 3 },
  },
  {
    name: "Anestezi",
    icon: "💤",
    desc: "Genel anestezi: sinaptik iletim baskılanır, aktivite neredeyse durur.",
    params: { threshold: 1.6, synapticStrength: 0.12, excitability: 0.0003, leak: 0.1, inhibition: 0.3, refractory: 10 },
  },
];

export default function App() {
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
  const [stats, setStats] = useState({ rate: 0, active: 0, total: 0, regionRates: [] as number[] });
  const [panelOpen, setPanelOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

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

  // Nöron sayısı / bağlantı değişimini geciktir (debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      setNeuronCount(pendingCount);
      setConnectivity(pendingK);
    }, 400);
    return () => clearTimeout(t);
  }, [pendingCount, pendingK]);

  // İstatistikler
  useEffect(() => {
    const id = setInterval(() => {
      setStats({
        rate: sim.recentSpikes(),
        active: sim.activeCount(),
        total: sim.totalSpikes,
        regionRates: Array.from(sim.regionSpikes),
      });
    }, 250);
    return () => clearInterval(id);
  }, [sim]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const update = (p: Partial<SimParams>) => {
    setParams((prev) => ({ ...prev, ...p }));
    if (!("paused" in p) && !("speed" in p)) setPresetIdx(null);
  };

  const applyPreset = (i: number) => {
    setParams((prev) => ({ ...prev, ...PRESETS[i].params }));
    setPresetIdx(i);
    showToast(`${PRESETS[i].icon} ${PRESETS[i].name} modu etkin`);
  };

  const onNeuronClick = useCallback(
    (idx: number) => {
      sim.stimulateAt(idx);
      setSelectedRegion(sim.net.region[idx]);
    },
    [sim]
  );

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

  const region = selectedRegion !== null ? REGIONS[selectedRegion] : null;
  const maxRegionRate = Math.max(1, ...stats.regionRates);

  // Klavye kısayolları
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        update({ paused: !paramsRef.current.paused });
      } else if (e.key === "s" || e.key === "S") {
        sim.stimulateAll();
      } else if (e.key === "r" || e.key === "R") {
        sim.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05070f] font-sans text-slate-100">
      <BrainScene sim={sim} visual={visual} onNeuronClick={onNeuronClick} />

      {/* Başlık */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-4">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0a0e1c]/70 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                NeuroSim <span className="text-cyan-400">3D</span>
              </h1>
              <p className="text-[11px] text-slate-400">İnteraktif İnsan Beyni & Nöron Ateşleme Simülatörü</p>
            </div>
          </div>
        </div>

        {/* Canlı istatistikler */}
        <div className="pointer-events-auto hidden gap-2 md:flex">
          <Stat label="Nöron" value={neuronCount.toLocaleString("tr-TR")} />
          <Stat label="Sinaps" value={sim.net.edgeCount.toLocaleString("tr-TR")} />
          <Stat label="Ateşleme / sn" value={stats.rate.toLocaleString("tr-TR")} accent />
          <Stat label="Aktif nöron" value={stats.active.toLocaleString("tr-TR")} />
          <Stat label="Toplam" value={formatBig(stats.total)} />
        </div>
      </header>

      {/* Alt ipucu + oynatma çubuğu */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a0e1c]/75 px-3 py-2 backdrop-blur-md">
          <button
            onClick={() => update({ paused: !params.paused })}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-black transition hover:bg-cyan-400"
            title="Oynat / Duraklat (Boşluk)"
          >
            {params.paused ? "▶" : "❚❚"}
          </button>
          <button
            onClick={() => sim.stimulateAll()}
            className="rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/25"
            title="Tüm beyni uyar (S)"
          >
            ⚡ Uyar
          </button>
          <button
            onClick={() => {
              sim.reset();
              showToast("Simülasyon sıfırlandı");
            }}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
            title="Sıfırla (R)"
          >
            ↺ Sıfırla
          </button>
          <div className="mx-1 h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Hız</span>
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
          <span className="hidden text-[11px] text-slate-500 sm:block">
            Beyne tıkla → yerel uyarım · Sürükle → döndür
          </span>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-4 py-1.5 text-sm text-cyan-200 backdrop-blur-md">
          {toast}
        </div>
      )}

      {/* Sol: Kontrol paneli */}
      <aside
        className={cn(
          "absolute left-4 top-24 bottom-20 z-10 w-[300px] transition-transform duration-300",
          !panelOpen && "-translate-x-[calc(100%+1rem)]"
        )}
      >
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="absolute -right-9 top-0 flex h-9 w-9 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-[#0a0e1c]/80 text-slate-300 backdrop-blur-md hover:text-white"
          title="Ayarlar"
        >
          {panelOpen ? "‹" : "⚙"}
        </button>
        <div className="scrollbar-thin h-full overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e1c]/80 p-3 backdrop-blur-md">
          <div className="space-y-3">
            <Section title="Zihinsel Durum">
              <div className="grid grid-cols-3 gap-1.5">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(i)}
                    title={p.desc}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] transition",
                      presetIdx === i
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                        : "border-white/8 bg-white/[0.02] text-slate-300 hover:bg-white/8"
                    )}
                  >
                    <span className="text-lg leading-none">{p.icon}</span>
                    {p.name}
                  </button>
                ))}
              </div>
              {presetIdx !== null && (
                <p className="text-[11px] leading-snug text-slate-400">{PRESETS[presetIdx].desc}</p>
              )}
            </Section>

            <Section title="Nöron Dinamikleri">
              <Slider
                label="Uyarılabilirlik"
                hint="Nöronların kendiliğinden ateşlenme olasılığı"
                value={params.excitability}
                min={0}
                max={0.012}
                step={0.0002}
                onChange={(v) => update({ excitability: v })}
                format={(v) => (v * 1000).toFixed(1) + "‰"}
              />
              <Slider
                label="Sinaps gücü"
                hint="Bir ateşlemenin komşu nörona aktardığı potansiyel"
                value={params.synapticStrength}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update({ synapticStrength: v })}
                format={(v) => v.toFixed(2)}
              />
              <Slider
                label="Ateşleme eşiği"
                hint="Aksiyon potansiyeli için gereken membran potansiyeli"
                value={params.threshold}
                min={0.5}
                max={2}
                step={0.05}
                onChange={(v) => update({ threshold: v })}
                format={(v) => v.toFixed(2) + " mV"}
              />
              <Slider
                label="Membran sızıntısı"
                hint="Potansiyelin ne kadar hızlı dinlenme seviyesine döndüğü"
                value={params.leak}
                min={0.005}
                max={0.2}
                step={0.005}
                onChange={(v) => update({ leak: v })}
                format={(v) => (v * 100).toFixed(1) + "%"}
              />
              <Slider
                label="İnhibitör nöron oranı"
                hint="GABAerjik (baskılayıcı) nöronların oranı"
                value={params.inhibition}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => update({ inhibition: v })}
                format={(v) => Math.round(v * 100) + "%"}
              />
              <Slider
                label="Refrakter süre"
                hint="Ateşlemeden sonra nöronun tekrar ateşleyemediği süre"
                value={params.refractory}
                min={1}
                max={20}
                step={1}
                onChange={(v) => update({ refractory: v })}
                format={(v) => v + " adım"}
              />
            </Section>

            <Section title="Ağ Yapısı">
              <Slider
                label="Nöron sayısı"
                value={pendingCount}
                min={400}
                max={5000}
                step={100}
                onChange={setPendingCount}
                format={(v) => v.toLocaleString("tr-TR")}
              />
              <Slider
                label="Bağlantı / nöron"
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
                🎲 Ağı yeniden oluştur
              </button>
            </Section>

            <Section title="Görünüm">
              <Toggle label="Sinapsları göster" checked={visual.showSynapses} onChange={(v) => setVisual({ ...visual, showSynapses: v })} />
              <Toggle label="Sinyal darbeleri" checked={visual.showPulses} onChange={(v) => setVisual({ ...visual, showPulses: v })} />
              <Toggle label="Beyin kabuğu" checked={visual.showShell} onChange={(v) => setVisual({ ...visual, showShell: v })} />
              <Toggle label="Bölge etiketleri" checked={visual.showLabels} onChange={(v) => setVisual({ ...visual, showLabels: v })} />
              <Toggle label="Otomatik döndür" checked={visual.autoRotate} onChange={(v) => setVisual({ ...visual, autoRotate: v })} />
              <Slider
                label="Nöron boyutu"
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
          "absolute right-4 top-24 bottom-20 z-10 w-[300px] transition-transform duration-300",
          !infoOpen && "translate-x-[calc(100%+1rem)]"
        )}
      >
        <button
          onClick={() => setInfoOpen((o) => !o)}
          className="absolute -left-9 top-0 flex h-9 w-9 items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-[#0a0e1c]/80 text-slate-300 backdrop-blur-md hover:text-white"
          title="Bilgi"
        >
          {infoOpen ? "›" : "ⓘ"}
        </button>
        <div className="scrollbar-thin h-full overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0e1c]/80 p-3 backdrop-blur-md">
          <div className="space-y-3">
            <Section title="Beyin Aktivitesi (EEG)">
              <ActivityGraph sim={sim} />
              <div className="grid grid-cols-3 gap-1 text-center md:hidden">
                <MiniStat label="Ateşleme/sn" value={stats.rate} />
                <MiniStat label="Aktif" value={stats.active} />
                <MiniStat label="Toplam" value={formatBig(stats.total)} />
              </div>
            </Section>

            <Section
              title="Beyin Bölgeleri"
              right={
                <button
                  onClick={() => setVisual({ ...visual, visibleRegions: REGIONS.map(() => true) })}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Tümünü göster
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
                        title="Göster/gizle (çift tık: yalnız bu)"
                        className="h-3.5 w-3.5 shrink-0 rounded-full border-2 transition"
                        style={{
                          borderColor: r.color,
                          background: on ? r.color : "transparent",
                          boxShadow: on ? `0 0 ${6 + act * 14}px ${r.color}` : "none",
                        }}
                      />
                      <button onClick={() => setSelectedRegion(i)} className="flex-1 text-left">
                        <div className="text-[12px] font-medium text-slate-200">{r.name}</div>
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
                        title={`${r.name} bölgesini uyar`}
                      >
                        ⚡
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={region ? region.name : "Bölge Bilgisi"}>
              {region ? (
                <div className="space-y-2">
                  <div className="h-1 w-12 rounded-full" style={{ background: region.color }} />
                  <p className="text-[12px] leading-relaxed text-slate-300">{region.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {region.functions.map((f) => (
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
                    ⚡ Bu bölgeyi uyar
                  </button>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-slate-400">
                  Bir bölgeye tıklayarak işlevlerini öğrenin ya da 3D modelde bir nörona tıklayarak yerel bir
                  uyarım başlatın.
                </p>
              )}
            </Section>

            <Section title="Nasıl Çalışır?">
              <ul className="space-y-1.5 text-[11px] leading-snug text-slate-400">
                <li>
                  <b className="text-slate-300">Membran potansiyeli:</b> Her nöron komşularından gelen sinyalleri
                  toplar; potansiyel <i>eşiği</i> aşınca <b className="text-white">ateşlenir</b> (parlar).
                </li>
                <li>
                  <b className="text-slate-300">Sinapslar:</b> Ateşleme, bağlı nöronlara gecikmeli bir darbe olarak
                  iletilir. Uyarıcı nöronlar potansiyeli artırır, inhibitör nöronlar düşürür.
                </li>
                <li>
                  <b className="text-slate-300">Refrakter dönem:</b> Ateşleyen nöron kısa süre tekrar ateşleyemez;
                  bu, sinyalin tek yönde yayılmasını sağlar.
                </li>
                <li>
                  <b className="text-slate-300">Beyin sapı</b> doğal bir "kalp pili" gibi daha sık ateşlenir ve
                  korteksi uyanık tutar.
                </li>
              </ul>
              <p className="text-[10px] text-slate-500">
                Kısayollar: <kbd className="rounded bg-white/10 px-1">Boşluk</kbd> duraklat ·{" "}
                <kbd className="rounded bg-white/10 px-1">S</kbd> uyar · <kbd className="rounded bg-white/10 px-1">R</kbd>{" "}
                sıfırla
              </p>
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
