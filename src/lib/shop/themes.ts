/**
 * Bibliothèque de thèmes pour les boutiques personnelles des revendeurs (/c/<slug>).
 * Permet à chaque revendeur de personnaliser intégralement l'ambiance visuelle,
 * la palette de couleurs, le style des cartes et des boutons de sa page vitrine.
 */

export type ShopThemeId =
  | "luxury-rose"
  | "noir-gold"
  | "sahara-nude"
  | "midnight-navy"
  | "royal-emerald"
  | "pearl-minimal";

export interface ShopTheme {
  id: ShopThemeId;
  name: string;
  tagline: string;
  mood: string;
  palette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
  };
  isDark: boolean;
  styles: {
    pageBg: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    cardBg: string;
    cardBorder: string;
    avatarBorder: string;
    badgeStyle: string;
    buttonPrimary: string;
    buttonSecondary: string;
    waButton: string;
    shortcutHover: string;
    productCardBg: string;
    guaranteeBannerBg: string;
    logoInvert?: boolean;
  };
}

export const DEFAULT_THEME_ID: ShopThemeId = "luxury-rose";

export const SHOP_THEMES: ShopTheme[] = [
  {
    id: "luxury-rose",
    name: "Rose Poudré & Or Rose",
    tagline: "L'élégance signature de JAMAAL",
    mood: "Floral, doux, féminin et prestigieux",
    isDark: false,
    palette: {
      primary: "#16233a",
      accent: "#a97557",
      background: "#f6e9e3",
      surface: "#ffffff",
    },
    styles: {
      pageBg: "bg-gradient-to-b from-[#f6e9e3] via-[#fdfbfa] to-[#fdfbfa]",
      textPrimary: "text-[#16233a]",
      textSecondary: "text-[#16233a]/80",
      textMuted: "text-[#16233a]/55",
      cardBg: "bg-white border border-[#e7ded4] shadow-sm",
      cardBorder: "border-[#e7ded4]",
      avatarBorder: "border-white bg-[#16233a] shadow-xl",
      badgeStyle: "bg-white border-[#e7ded4] text-[#16233a] shadow-sm",
      buttonPrimary: "bg-[#16233a] hover:bg-[#1f2f4e] text-white",
      buttonSecondary: "bg-white border border-[#e7ded4] text-[#16233a] hover:bg-[#f6e9e3]",
      waButton: "bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/30",
      shortcutHover: "hover:border-[#16233a]/40 hover:bg-[#fcfaf8]",
      productCardBg: "bg-white border border-[#e7ded4] shadow-sm",
      guaranteeBannerBg: "bg-[#16233a] text-white",
      logoInvert: false,
    },
  },
  {
    id: "noir-gold",
    name: "Ébène & Or Impérial",
    tagline: "Haute parfumerie nocturne & luxe 24 carats",
    mood: "Mystérieux, opulent, ultra-raffiné",
    isDark: true,
    palette: {
      primary: "#f4e4bc",
      accent: "#d4af37",
      background: "#0c0c0e",
      surface: "#18181c",
    },
    styles: {
      pageBg: "bg-gradient-to-b from-[#0a0a0c] via-[#121216] to-[#0c0c0e]",
      textPrimary: "text-[#f5e6c4]",
      textSecondary: "text-[#ded2b4]/85",
      textMuted: "text-[#c2b697]/55",
      cardBg: "bg-[#16161b]/95 border border-[#d4af37]/30 shadow-xl shadow-black/40 backdrop-blur-md",
      cardBorder: "border-[#d4af37]/30",
      avatarBorder: "border-[#d4af37] bg-[#121216] shadow-xl shadow-[#d4af37]/20",
      badgeStyle: "bg-[#1a1a20] border-[#d4af37]/40 text-[#f5e6c4] shadow",
      buttonPrimary: "bg-gradient-to-r from-[#d4af37] to-[#b38f24] hover:from-[#e5c04c] hover:to-[#c29d2e] text-[#0a0a0c] font-bold shadow-md shadow-[#d4af37]/20",
      buttonSecondary: "bg-[#1a1a20] border border-[#d4af37]/40 text-[#f5e6c4] hover:bg-[#22222a]",
      waButton: "bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/30",
      shortcutHover: "hover:border-[#d4af37]/60 hover:bg-[#1c1c24]",
      productCardBg: "bg-[#16161b]/95 border border-[#d4af37]/30 shadow-lg shadow-black/40",
      guaranteeBannerBg: "bg-[#16161c] border border-[#d4af37]/40 text-[#f5e6c4]",
      logoInvert: true,
    },
  },
  {
    id: "sahara-nude",
    name: "Sable Chaud & Terracotta",
    tagline: "Chaleur solaire, ambre & épices précieuses",
    mood: "Chaleureux, terre cuite, lumineux, naturel",
    isDark: false,
    palette: {
      primary: "#3d2314",
      accent: "#c06c4b",
      background: "#f7eee3",
      surface: "#ffffff",
    },
    styles: {
      pageBg: "bg-gradient-to-b from-[#f7ede2] via-[#faf4ed] to-[#fbf7f2]",
      textPrimary: "text-[#3d2314]",
      textSecondary: "text-[#3d2314]/80",
      textMuted: "text-[#3d2314]/55",
      cardBg: "bg-white border border-[#e8d5c4] shadow-sm",
      cardBorder: "border-[#e8d5c4]",
      avatarBorder: "border-white bg-[#3d2314] shadow-xl",
      badgeStyle: "bg-white border-[#c06c4b]/30 text-[#3d2314] shadow-sm",
      buttonPrimary: "bg-[#c06c4b] hover:bg-[#a85837] text-white",
      buttonSecondary: "bg-white border border-[#e8d5c4] text-[#3d2314] hover:bg-[#f7ede2]",
      waButton: "bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/30",
      shortcutHover: "hover:border-[#c06c4b]/50 hover:bg-[#fdfaf7]",
      productCardBg: "bg-white border border-[#e8d5c4] shadow-sm",
      guaranteeBannerBg: "bg-[#3d2314] text-[#faf4ed]",
      logoInvert: false,
    },
  },
  {
    id: "midnight-navy",
    name: "Nuit Majestueuse & Platine",
    tagline: "Ciel étoilé de Dakar & brise saphir",
    mood: "Profond, moderne, charismatique, souverain",
    isDark: true,
    palette: {
      primary: "#f0f6fc",
      accent: "#38bdf8",
      background: "#080e1a",
      surface: "#0f172a",
    },
    styles: {
      pageBg: "bg-gradient-to-b from-[#080e1a] via-[#0d182b] to-[#09101e]",
      textPrimary: "text-[#f0f6fc]",
      textSecondary: "text-[#cbd5e1]/85",
      textMuted: "text-[#94a3b8]/60",
      cardBg: "bg-[#0f172a]/95 border border-[#38bdf8]/25 shadow-xl shadow-black/40 backdrop-blur-md",
      cardBorder: "border-[#38bdf8]/25",
      avatarBorder: "border-[#38bdf8] bg-[#0c1424] shadow-xl shadow-[#38bdf8]/20",
      badgeStyle: "bg-[#131e33] border-[#38bdf8]/35 text-[#f0f6fc] shadow",
      buttonPrimary: "bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#080e1a] font-bold shadow-md shadow-[#38bdf8]/25",
      buttonSecondary: "bg-[#131e33] border border-[#38bdf8]/30 text-[#f0f6fc] hover:bg-[#1a2844]",
      waButton: "bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/30",
      shortcutHover: "hover:border-[#38bdf8]/50 hover:bg-[#142036]",
      productCardBg: "bg-[#0f172a]/95 border border-[#38bdf8]/25 shadow-lg shadow-black/40",
      guaranteeBannerBg: "bg-[#0b1322] border border-[#38bdf8]/30 text-[#f0f6fc]",
      logoInvert: true,
    },
  },
  {
    id: "royal-emerald",
    name: "Émeraude Royale & Or Vert",
    tagline: "Essences botaniques & noblesse orientale",
    mood: "Opulent, naturel noble, riche, apaisant",
    isDark: true,
    palette: {
      primary: "#f4f7f2",
      accent: "#d4af37",
      background: "#04150f",
      surface: "#08231a",
    },
    styles: {
      pageBg: "bg-gradient-to-b from-[#04150f] via-[#07241b] to-[#051a13]",
      textPrimary: "text-[#f4f7f2]",
      textSecondary: "text-[#dce5d9]/85",
      textMuted: "text-[#a3b89f]/60",
      cardBg: "bg-[#08231a]/95 border border-[#d4af37]/30 shadow-xl shadow-black/40 backdrop-blur-md",
      cardBorder: "border-[#d4af37]/30",
      avatarBorder: "border-[#d4af37] bg-[#051c14] shadow-xl shadow-[#d4af37]/20",
      badgeStyle: "bg-[#0b2c21] border-[#d4af37]/35 text-[#f4f7f2] shadow",
      buttonPrimary: "bg-gradient-to-r from-[#d4af37] to-[#b89528] hover:from-[#e5c04c] hover:to-[#c7a432] text-[#04150f] font-bold shadow-md shadow-[#d4af37]/20",
      buttonSecondary: "bg-[#0b2c21] border border-[#d4af37]/30 text-[#f4f7f2] hover:bg-[#103a2c]",
      waButton: "bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/30",
      shortcutHover: "hover:border-[#d4af37]/50 hover:bg-[#0c3125]",
      productCardBg: "bg-[#08231a]/95 border border-[#d4af37]/30 shadow-lg shadow-black/40",
      guaranteeBannerBg: "bg-[#061e16] border border-[#d4af37]/30 text-[#f4f7f2]",
      logoInvert: true,
    },
  },
  {
    id: "pearl-minimal",
    name: "Perle Blanche & Marbre Épuré",
    tagline: "Minimalisme haute couture & pureté studio",
    mood: "Épuré, architectural, contemporain, cristallin",
    isDark: false,
    palette: {
      primary: "#0f172a",
      accent: "#475569",
      background: "#f8fafc",
      surface: "#ffffff",
    },
    styles: {
      pageBg: "bg-gradient-to-b from-[#f8fafc] via-[#ffffff] to-[#f8fafc]",
      textPrimary: "text-[#0f172a]",
      textSecondary: "text-[#334155]",
      textMuted: "text-[#64748b]",
      cardBg: "bg-white border border-[#e2e8f0] shadow-sm",
      cardBorder: "border-[#e2e8f0]",
      avatarBorder: "border-white bg-[#0f172a] shadow-xl ring-1 ring-slate-200",
      badgeStyle: "bg-white border-[#cbd5e1] text-[#0f172a] shadow-sm",
      buttonPrimary: "bg-[#0f172a] hover:bg-[#1e293b] text-white font-medium",
      buttonSecondary: "bg-white border border-[#cbd5e1] text-[#0f172a] hover:bg-slate-50",
      waButton: "bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/30",
      shortcutHover: "hover:border-[#0f172a]/50 hover:bg-slate-50",
      productCardBg: "bg-white border border-[#e2e8f0] shadow-sm",
      guaranteeBannerBg: "bg-[#0f172a] text-white",
      logoInvert: false,
    },
  },
];

/**
 * Récupère un thème par son identifiant.
 * Si l'identifiant est absent ou inconnu, retourne le thème signature par défaut.
 */
export function getShopTheme(themeId: string | null | undefined): ShopTheme {
  const found = SHOP_THEMES.find((t) => t.id === themeId);
  return found ?? SHOP_THEMES[0]!;
}
