export type Lang = "en" | "tr";

export const LANGS: Lang[] = ["en", "tr"];
const STORAGE_KEY = "neurosim-lang";

/** Öncelik: ?lang= parametresi, sonra kayıtlı tercih, yoksa İngilizce */
export function initialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "tr") return q;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "tr") return saved;
  } catch {
    /* depolama kapalı olabilir */
  }
  return "en";
}

export function saveLang(lang: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export type PresetId = "rest" | "focus" | "sleep" | "caffeine" | "seizure" | "anesthesia";

const en = {
  locale: "en-US",
  docTitle: "NeuroSim 3D — Interactive Brain Neuron Simulator",
  subtitle: "Interactive Human Brain & Neuron Firing Simulator",
  stats: {
    neurons: "Neurons",
    synapses: "Synapses",
    rate: "Spikes / s",
    active: "Active neurons",
    total: "Total",
    rateShort: "Spikes/s",
    activeShort: "Active",
  },
  playPause: "Play / Pause (Space)",
  stimulate: "Stimulate",
  stimulateAllTitle: "Stimulate the whole brain (S)",
  reset: "Reset",
  resetTitle: "Reset (R)",
  resetToast: "Simulation reset",
  speed: "Speed",
  clickHint: "Click brain → local stimulus · Drag → rotate",
  presetToast: (icon: string, name: string) => `${icon} ${name} mode on`,
  settings: "Settings",
  info: "Info",
  sections: {
    mentalState: "Mental State",
    dynamics: "Neuron Dynamics",
    network: "Network Structure",
    view: "View",
    eeg: "Brain Activity (EEG-like)",
    regions: "Brain Regions",
    regionInfo: "Region Info",
    howItWorks: "How It Works",
  },
  presets: {
    rest: { name: "Resting", desc: "Normal awake, calm brain activity. Irregular, low-level firing." },
    focus: { name: "Focus", desc: "Intense thinking. Higher excitability and stronger synaptic communication." },
    sleep: { name: "Deep Sleep", desc: "Slow-wave sleep. Rare but broad, synchronised waves of firing." },
    caffeine: { name: "Caffeine", desc: "Adenosine receptors blocked: the threshold drops and neurons fire more easily." },
    seizure: { name: "Seizure", desc: "Epileptic activity: inhibition collapses and runaway chain firing spreads." },
    anesthesia: { name: "Anaesthesia", desc: "General anaesthesia: synaptic transmission is suppressed and activity nearly stops." },
  } as Record<PresetId, { name: string; desc: string }>,
  sliders: {
    excitability: "Excitability",
    excitabilityHint: "Chance that a neuron fires spontaneously in each step",
    strength: "Synaptic strength",
    strengthHint: "Potential one spike passes to a connected neuron",
    threshold: "Firing threshold",
    thresholdHint: "Membrane potential needed for an action potential (model units)",
    leak: "Membrane leak",
    leakHint: "How fast the potential decays back to rest",
    inhibition: "Inhibitory neuron share",
    inhibitionHint: "Share of GABAergic (inhibitory) neurons",
    refractory: "Refractory period",
    refractoryHint: "Time after a spike during which the neuron cannot fire again",
    steps: "steps",
    neuronCount: "Neuron count",
    connections: "Connections / neuron",
  },
  rebuild: "🎲 Rebuild network",
  toggles: {
    synapses: "Show synapses",
    pulses: "Signal pulses",
    shell: "Brain shell",
    labels: "Region labels",
    autoRotate: "Auto-rotate",
    neuronSize: "Neuron size",
  },
  showAll: "Show all",
  regionToggleTitle: "Show/hide (double-click: show only this)",
  stimulateRegionTitle: (name: string) => `Stimulate ${name}`,
  stimulateThisRegion: "⚡ Stimulate this region",
  regionPlaceholder:
    "Click a region to learn what it does, or click a neuron in the 3D model to trigger a local stimulus.",
  how: [
    ["Membrane potential:", "Each neuron sums the signals from its neighbours; when the potential crosses the threshold it fires (lights up)."],
    ["Synapses:", "A spike travels to connected neurons as a delayed pulse. Excitatory neurons raise the potential, inhibitory ones lower it."],
    ["Refractory period:", "A neuron that just fired cannot fire again for a short time, so the signal keeps moving forward."],
    ["The brainstem", "fires more often, like a natural pacemaker, keeping the cortex awake."],
  ] as [string, string][],
  modelNote:
    "This is a simplified educational model: neuron counts and region proportions are not to scale, and potentials are in model units.",
  shortcuts: "Shortcuts:",
  kbSpace: "Space",
  kbPause: "pause",
  kbStim: "stimulate",
  kbReset: "reset",
};

export type Strings = typeof en;

const tr: Strings = {
  locale: "tr-TR",
  docTitle: "NeuroSim 3D — İnsan Beyni Nöron Simülatörü",
  subtitle: "İnteraktif İnsan Beyni & Nöron Ateşleme Simülatörü",
  stats: {
    neurons: "Nöron",
    synapses: "Sinaps",
    rate: "Ateşleme / sn",
    active: "Aktif nöron",
    total: "Toplam",
    rateShort: "Ateşleme/sn",
    activeShort: "Aktif",
  },
  playPause: "Oynat / Duraklat (Boşluk)",
  stimulate: "Uyar",
  stimulateAllTitle: "Tüm beyni uyar (S)",
  reset: "Sıfırla",
  resetTitle: "Sıfırla (R)",
  resetToast: "Simülasyon sıfırlandı",
  speed: "Hız",
  clickHint: "Beyne tıkla → yerel uyarım · Sürükle → döndür",
  presetToast: (icon: string, name: string) => `${icon} ${name} modu etkin`,
  settings: "Ayarlar",
  info: "Bilgi",
  sections: {
    mentalState: "Zihinsel Durum",
    dynamics: "Nöron Dinamikleri",
    network: "Ağ Yapısı",
    view: "Görünüm",
    eeg: "Beyin Aktivitesi (EEG benzeri)",
    regions: "Beyin Bölgeleri",
    regionInfo: "Bölge Bilgisi",
    howItWorks: "Nasıl Çalışır?",
  },
  presets: {
    rest: { name: "Dinlenme", desc: "Normal uyanık, sakin beyin aktivitesi. Düzensiz, düşük seviyeli ateşlemeler." },
    focus: { name: "Odaklanma", desc: "Yoğun düşünce. Artan uyarılabilirlik ve daha güçlü sinaptik iletişim." },
    sleep: { name: "Derin Uyku", desc: "Yavaş dalga uykusu. Nadir fakat geniş, senkron ateşleme dalgaları." },
    caffeine: { name: "Kafein", desc: "Adenozin reseptörleri bloke: eşik düşer, nöronlar daha kolay ateşlenir." },
    seizure: { name: "Nöbet", desc: "Epileptik aktivite: inhibisyon çöker, kontrolsüz zincirleme ateşleme yayılır." },
    anesthesia: { name: "Anestezi", desc: "Genel anestezi: sinaptik iletim baskılanır, aktivite neredeyse durur." },
  },
  sliders: {
    excitability: "Uyarılabilirlik",
    excitabilityHint: "Nöronun her adımda kendiliğinden ateşlenme olasılığı",
    strength: "Sinaps gücü",
    strengthHint: "Bir ateşlemenin bağlı nörona aktardığı potansiyel",
    threshold: "Ateşleme eşiği",
    thresholdHint: "Aksiyon potansiyeli için gereken membran potansiyeli (model birimi)",
    leak: "Membran sızıntısı",
    leakHint: "Potansiyelin ne kadar hızlı dinlenme seviyesine döndüğü",
    inhibition: "İnhibitör nöron oranı",
    inhibitionHint: "GABAerjik (baskılayıcı) nöronların oranı",
    refractory: "Refrakter süre",
    refractoryHint: "Ateşlemeden sonra nöronun tekrar ateşleyemediği süre",
    steps: "adım",
    neuronCount: "Nöron sayısı",
    connections: "Bağlantı / nöron",
  },
  rebuild: "🎲 Ağı yeniden oluştur",
  toggles: {
    synapses: "Sinapsları göster",
    pulses: "Sinyal darbeleri",
    shell: "Beyin kabuğu",
    labels: "Bölge etiketleri",
    autoRotate: "Otomatik döndür",
    neuronSize: "Nöron boyutu",
  },
  showAll: "Tümünü göster",
  regionToggleTitle: "Göster/gizle (çift tık: yalnız bu)",
  stimulateRegionTitle: (name: string) => `${name} bölgesini uyar`,
  stimulateThisRegion: "⚡ Bu bölgeyi uyar",
  regionPlaceholder:
    "Bir bölgeye tıklayarak işlevlerini öğrenin ya da 3D modelde bir nörona tıklayarak yerel bir uyarım başlatın.",
  how: [
    ["Membran potansiyeli:", "Her nöron komşularından gelen sinyalleri toplar; potansiyel eşiği aşınca ateşlenir (parlar)."],
    ["Sinapslar:", "Ateşleme, bağlı nöronlara gecikmeli bir darbe olarak iletilir. Uyarıcı nöronlar potansiyeli artırır, inhibitör nöronlar düşürür."],
    ["Refrakter dönem:", "Ateşleyen nöron kısa süre tekrar ateşleyemez; bu, sinyalin ileri doğru yayılmasını sağlar."],
    ["Beyin sapı", "doğal bir \"kalp pili\" gibi daha sık ateşlenir ve korteksi uyanık tutar."],
  ],
  modelNote:
    "Bu basitleştirilmiş bir eğitim modelidir: nöron sayıları ve bölge oranları gerçek ölçekte değildir, potansiyeller model birimindedir.",
  shortcuts: "Kısayollar:",
  kbSpace: "Boşluk",
  kbPause: "duraklat",
  kbStim: "uyar",
  kbReset: "sıfırla",
};

export const STRINGS: Record<Lang, Strings> = { en, tr };
