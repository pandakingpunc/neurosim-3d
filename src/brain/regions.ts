export interface Region {
  id: string;
  name: string;
  color: string;
  labelPos: [number, number, number];
  description: string;
  functions: string[];
  share: number; // nöron dağılım oranı
}

export const REGIONS: Region[] = [
  {
    id: "frontal",
    name: "Frontal Lob",
    color: "#ff5e7a",
    labelPos: [0, 0.55, 1.25],
    description:
      "Beynin ön kısmı. Planlama, karar verme, kişilik, irade ve istemli hareketlerden sorumludur. Prefrontal korteks 'yönetici' işlevleri yürütür.",
    functions: ["Karar verme", "Planlama", "Motor kontrol", "Konuşma (Broca)", "Kişilik"],
    share: 0.26,
  },
  {
    id: "parietal",
    name: "Parietal Lob",
    color: "#ffd166",
    labelPos: [0, 1.15, -0.25],
    description:
      "Dokunma, sıcaklık, ağrı ve vücut pozisyonu gibi duyusal bilgileri işler. Uzamsal farkındalık ve navigasyonda kritik rol oynar.",
    functions: ["Dokunma duyusu", "Uzamsal algı", "Sayısal işlem", "Beden farkındalığı"],
    share: 0.17,
  },
  {
    id: "temporal",
    name: "Temporal Lob",
    color: "#06d6a0",
    labelPos: [1.35, -0.35, 0.1],
    description:
      "Kulakların hizasında yer alır. İşitme, dil anlama (Wernicke alanı), hafıza oluşumu ve yüz tanımadan sorumludur.",
    functions: ["İşitme", "Dil anlama", "Hafıza", "Yüz tanıma", "Duygu"],
    share: 0.17,
  },
  {
    id: "occipital",
    name: "Oksipital Lob",
    color: "#4cc9f0",
    labelPos: [0, 0.25, -1.5],
    description:
      "Beynin arka kısmı, görsel korteksi barındırır. Gözlerden gelen sinyalleri renk, şekil, hareket ve derinlik olarak yorumlar.",
    functions: ["Görme", "Renk algısı", "Hareket algısı", "Nesne tanıma"],
    share: 0.12,
  },
  {
    id: "limbic",
    name: "Limbik Sistem",
    color: "#f72585",
    labelPos: [0, -0.05, 0.05],
    description:
      "Beynin derininde yer alır. Hipokampus (hafıza), amigdala (korku/duygu) ve talamus (duyusal röle) gibi yapıları içerir.",
    functions: ["Duygular", "Hafıza konsolidasyonu", "Korku tepkisi", "Motivasyon", "Hormon kontrolü"],
    share: 0.1,
  },
  {
    id: "cerebellum",
    name: "Beyincik",
    color: "#b388ff",
    labelPos: [0, -1.05, -1.4],
    description:
      "Beynin %10'u kadar hacme sahip olsa da nöronların yarısından fazlasını barındırır. Denge, koordinasyon ve hassas hareket zamanlamasını sağlar.",
    functions: ["Denge", "Koordinasyon", "Motor öğrenme", "Kas tonusu"],
    share: 0.12,
  },
  {
    id: "brainstem",
    name: "Beyin Sapı",
    color: "#ff9f1c",
    labelPos: [0, -1.75, -0.05],
    description:
      "Beyni omuriliğe bağlar. Nefes alma, kalp atışı ve kan basıncı gibi yaşamsal işlevleri otomatik olarak yönetir. Uyanıklık düzeyini belirler.",
    functions: ["Nefes alma", "Kalp atışı", "Uyanıklık", "Refleksler", "Uyku döngüsü"],
    share: 0.06,
  },
];

export const REGION_INDEX: Record<string, number> = Object.fromEntries(
  REGIONS.map((r, i) => [r.id, i])
);
