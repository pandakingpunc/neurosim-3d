import type { Lang } from "../i18n";

export interface Region {
  id: string;
  name: Record<Lang, string>;
  color: string;
  labelPos: [number, number, number];
  description: Record<Lang, string>;
  functions: Record<Lang, string[]>;
  share: number; // nöron dağılım oranı
}

export const REGIONS: Region[] = [
  {
    id: "frontal",
    name: { en: "Frontal Lobe", tr: "Frontal Lob" },
    color: "#ff5e7a",
    labelPos: [0, 0.55, 1.25],
    description: {
      en: "The front of the brain. Responsible for planning, decision-making, personality, willpower and voluntary movement. The prefrontal cortex runs the 'executive' functions.",
      tr: "Beynin ön kısmı. Planlama, karar verme, kişilik, irade ve istemli hareketlerden sorumludur. Prefrontal korteks 'yönetici' işlevleri yürütür.",
    },
    functions: {
      en: ["Decision-making", "Planning", "Motor control", "Speech (Broca)", "Personality"],
      tr: ["Karar verme", "Planlama", "Motor kontrol", "Konuşma (Broca)", "Kişilik"],
    },
    share: 0.26,
  },
  {
    id: "parietal",
    name: { en: "Parietal Lobe", tr: "Parietal Lob" },
    color: "#ffd166",
    labelPos: [0, 1.15, -0.25],
    description: {
      en: "Processes sensory information such as touch, temperature, pain and body position. Plays a key role in spatial awareness and navigation.",
      tr: "Dokunma, sıcaklık, ağrı ve vücut pozisyonu gibi duyusal bilgileri işler. Uzamsal farkındalık ve navigasyonda kritik rol oynar.",
    },
    functions: {
      en: ["Touch", "Spatial perception", "Numerical processing", "Body awareness"],
      tr: ["Dokunma duyusu", "Uzamsal algı", "Sayısal işlem", "Beden farkındalığı"],
    },
    share: 0.17,
  },
  {
    id: "temporal",
    name: { en: "Temporal Lobe", tr: "Temporal Lob" },
    color: "#06d6a0",
    labelPos: [1.35, -0.35, 0.1],
    description: {
      en: "Sits level with the ears. Responsible for hearing, language comprehension (Wernicke's area), memory formation and face recognition.",
      tr: "Kulakların hizasında yer alır. İşitme, dil anlama (Wernicke alanı), hafıza oluşumu ve yüz tanımadan sorumludur.",
    },
    functions: {
      en: ["Hearing", "Language comprehension", "Memory", "Face recognition", "Emotion"],
      tr: ["İşitme", "Dil anlama", "Hafıza", "Yüz tanıma", "Duygu"],
    },
    share: 0.17,
  },
  {
    id: "occipital",
    name: { en: "Occipital Lobe", tr: "Oksipital Lob" },
    color: "#4cc9f0",
    labelPos: [0, 0.25, -1.5],
    description: {
      en: "The back of the brain, home to the visual cortex. Interprets signals from the eyes as colour, shape, motion and depth.",
      tr: "Beynin arka kısmı, görsel korteksi barındırır. Gözlerden gelen sinyalleri renk, şekil, hareket ve derinlik olarak yorumlar.",
    },
    functions: {
      en: ["Vision", "Colour perception", "Motion perception", "Object recognition"],
      tr: ["Görme", "Renk algısı", "Hareket algısı", "Nesne tanıma"],
    },
    share: 0.12,
  },
  {
    id: "limbic",
    name: { en: "Limbic System", tr: "Limbik Sistem" },
    color: "#f72585",
    labelPos: [0, -0.05, 0.05],
    description: {
      en: "Lies deep inside the brain. Includes the hippocampus (memory), the amygdala (fear and emotion) and the hypothalamus (hormones). In this model the thalamus, the sensory relay station next to it, is lumped into this deep region too.",
      tr: "Beynin derininde yer alır. Hipokampus (hafıza), amigdala (korku/duygu) ve hipotalamus (hormonlar) gibi yapıları içerir. Bu modelde hemen yanındaki duyusal röle merkezi talamus da bu derin bölgeye dahil edildi.",
    },
    functions: {
      en: ["Emotions", "Memory consolidation", "Fear response", "Motivation", "Hormone control"],
      tr: ["Duygular", "Hafıza konsolidasyonu", "Korku tepkisi", "Motivasyon", "Hormon kontrolü"],
    },
    share: 0.1,
  },
  {
    id: "cerebellum",
    name: { en: "Cerebellum", tr: "Beyincik" },
    color: "#b388ff",
    labelPos: [0, -1.05, -1.4],
    description: {
      en: "Only about 10% of the brain's volume, yet it holds roughly 80% of its neurons (about 69 billion). Handles balance, coordination and the precise timing of movement.",
      tr: "Beynin hacminin yalnızca %10'u kadardır ama nöronlarının yaklaşık %80'ini (≈69 milyar) barındırır. Denge, koordinasyon ve hassas hareket zamanlamasını sağlar.",
    },
    functions: {
      en: ["Balance", "Coordination", "Motor learning", "Muscle tone"],
      tr: ["Denge", "Koordinasyon", "Motor öğrenme", "Kas tonusu"],
    },
    share: 0.12,
  },
  {
    id: "brainstem",
    name: { en: "Brainstem", tr: "Beyin Sapı" },
    color: "#ff9f1c",
    labelPos: [0, -1.75, -0.05],
    description: {
      en: "Connects the brain to the spinal cord. Automatically runs vital functions such as breathing, heart rate and blood pressure, and sets the level of wakefulness.",
      tr: "Beyni omuriliğe bağlar. Nefes alma, kalp atışı ve kan basıncı gibi yaşamsal işlevleri otomatik olarak yönetir. Uyanıklık düzeyini belirler.",
    },
    functions: {
      en: ["Breathing", "Heart rate", "Wakefulness", "Reflexes", "Sleep cycle"],
      tr: ["Nefes alma", "Kalp atışı", "Uyanıklık", "Refleksler", "Uyku döngüsü"],
    },
    share: 0.06,
  },
];

export const REGION_INDEX: Record<string, number> = Object.fromEntries(
  REGIONS.map((r, i) => [r.id, i])
);
