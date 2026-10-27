/**
 * Bibliothèque de thèmes haute couture pour les boutiques personnelles des revendeurs (/c/<slug>).
 * Chaque thème transforme la boutique en un véritable site web e-commerce de marque de luxe,
 * tout en conservant l'identité et le lien direct vers le conseiller personnel.
 *
 * Inspirés des codes graphiques et de l'univers officiel de JAMAAL Luxury Cosmetics :
 *  - Top bar e-commerce & bannière d'annonces de réassurance
 *  - Header de navigation prestigieux (logo officiel + cartouche conseiller agréé)
 *  - Hero banner immersif grand format avec photo officielle
 *  - Grille de produits haute définition avec badges 30% d'essence
 *  - Réassurance 4 piliers "Les Attentions JAMAAL"
 *  - Avis clients et footer complet de grande marque
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
  description: string;
  /** Emoji représentatif du thème pour les swatches */
  emoji: string;
  palette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    /** Couleur du glow/halo de l'avatar */
    glow: string;
  };
  isDark: boolean;
  styles: {
    /** Fond de page : dégradé multi-stops luxe */
    pageBg: string;
    /** Overlay subtil sur le haut (hero) */
    heroOverlay: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    /** Texte accentué (prix, highlights) */
    textAccent: string;
    /** Cartes produit et raccourcis — glassmorphism */
    cardBg: string;
    cardBorder: string;
    /** Effet hover des cartes */
    cardHover: string;
    /** Bordure + glow de l'avatar */
    avatarBorder: string;
    avatarRing: string;
    /** Badges de titre, ville */
    badgeStyle: string;
    /** Bouton principal (Commander, CTA) */
    buttonPrimary: string;
    /** Bouton secondaire */
    buttonSecondary: string;
    /** Bouton WhatsApp */
    waButton: string;
    /** Hover des raccourcis / liens */
    shortcutHover: string;
    /** Fond des cartes produit */
    productCardBg: string;
    productCardHover: string;
    /** Bandeau de réassurance */
    guaranteeBannerBg: string;
    guaranteeBannerText: string;
    /** Étoiles d'avis */
    starColor: string;
    /** Séparateur décoratif (ligne or, rose, platine…) */
    dividerStyle: string;
    /** Prix mis en valeur */
    priceStyle: string;
    logoInvert?: boolean;
  };
}

export const DEFAULT_THEME_ID: ShopThemeId = "pearl-minimal";

export const SHOP_THEMES: ShopTheme[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ROSE ÉLYSÉE — L'élégance signature de la Maison JAMAAL
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "luxury-rose",
    name: "Rose poudré",
    tagline: "Une boutique douce et lumineuse",
    mood: "Doux, lumineux et raffiné",
    description: "Fond ivoire, rose poudré et détails cuivrés pour une vitrine délicate.",
    emoji: "🌸",
    isDark: false,
    palette: {
      primary: "#1a1a2e",
      accent: "#c9956b",
      background: "#fef6f0",
      surface: "#ffffff",
      glow: "#c9956b",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#fce8df_0%,_#fef6f0_35%,_#fdfaf8_70%,_#ffffff_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#fce8df]/70 via-[#fef6f0]/40 to-transparent",
      textPrimary: "text-[#1a1a2e]",
      textSecondary: "text-[#1a1a2e]/80",
      textMuted: "text-[#1a1a2e]/50",
      textAccent: "text-[#b07a50]",
      cardBg: "bg-white/90 backdrop-blur-md border border-[#f0e0d4] shadow-[0_4px_20px_rgba(201,149,107,0.10)]",
      cardBorder: "border-[#f0e0d4]",
      cardHover: "hover:shadow-[0_8px_30px_rgba(201,149,107,0.20)] hover:border-[#c9956b]/70 hover:-translate-y-1",
      avatarBorder: "border-[#c9956b] bg-[#1a1a2e]",
      avatarRing: "ring-4 ring-[#c9956b]/25 ring-offset-2 ring-offset-[#fef6f0]",
      badgeStyle: "bg-white/95 border border-[#e8d0bf] text-[#1a1a2e] shadow-sm backdrop-blur-md",
      buttonPrimary: "bg-gradient-to-br from-[#c9956b] to-[#b07a50] hover:from-[#d4a37a] hover:to-[#be875c] text-white font-semibold shadow-[0_4px_16px_rgba(201,149,107,0.35)] hover:shadow-[0_6px_22px_rgba(201,149,107,0.48)] transition-all",
      buttonSecondary: "bg-white/90 border border-[#e8d0bf] text-[#1a1a2e] hover:bg-[#fce8df]/50 hover:border-[#c9956b]/60 transition-all font-semibold",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_16px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#c9956b]/50 hover:bg-white hover:shadow-[0_4px_18px_rgba(201,149,107,0.15)]",
      productCardBg: "bg-white/95 backdrop-blur-md border border-[#f0e0d4] shadow-[0_4px_16px_rgba(201,149,107,0.08)]",
      productCardHover: "hover:shadow-[0_10px_32px_rgba(201,149,107,0.22)] hover:-translate-y-1 hover:border-[#c9956b]/80",
      guaranteeBannerBg: "bg-gradient-to-br from-[#1a1a2e] via-[#24243e] to-[#1a1a2e] border border-[#c9956b]/30 shadow-xl",
      guaranteeBannerText: "text-[#fef6f0]",
      starColor: "text-[#c9956b]",
      dividerStyle: "border-[#f0e0d4]",
      priceStyle: "text-[#b07a50] font-bold font-mono",
      logoInvert: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. NOIR & OR IMPÉRIAL — Le prestige intemporel de la haute parfumerie
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "noir-gold",
    name: "Noir & or",
    tagline: "Un contraste élégant et affirmé",
    mood: "Sobre, profond et affirmé",
    description: "Un fond sombre et des accents dorés pour une vitrine plus contrastée.",
    emoji: "👑",
    isDark: true,
    palette: {
      primary: "#f4f1ea",
      accent: "#d4af37",
      background: "#0b0c10",
      surface: "#14161d",
      glow: "#d4af37",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#1a1d26_0%,_#0e1017_40%,_#0b0c10_75%,_#07070a_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#d4af37]/15 via-[#14161d]/50 to-transparent",
      textPrimary: "text-[#f4f1ea]",
      textSecondary: "text-[#f4f1ea]/85",
      textMuted: "text-[#f4f1ea]/50",
      textAccent: "text-[#e5c158]",
      cardBg: "bg-[#14161d]/90 backdrop-blur-md border border-[#d4af37]/25 shadow-[0_4px_24px_rgba(0,0,0,0.6)]",
      cardBorder: "border-[#d4af37]/25",
      cardHover: "hover:shadow-[0_8px_32px_rgba(212,175,55,0.22)] hover:border-[#d4af37]/60 hover:-translate-y-1",
      avatarBorder: "border-[#d4af37] bg-[#0b0c10]",
      avatarRing: "ring-4 ring-[#d4af37]/30 ring-offset-2 ring-offset-[#0b0c10]",
      badgeStyle: "bg-[#181a24] border border-[#d4af37]/35 text-[#f4f1ea] shadow-md backdrop-blur-md",
      buttonPrimary: "bg-gradient-to-br from-[#d4af37] via-[#c49b2c] to-[#a88220] hover:from-[#e5c158] hover:to-[#c49b2c] text-[#0b0c10] font-bold shadow-[0_4px_18px_rgba(212,175,55,0.40)] hover:shadow-[0_6px_26px_rgba(212,175,55,0.55)] transition-all",
      buttonSecondary: "bg-[#181a24]/90 border border-[#d4af37]/40 text-[#f4f1ea] hover:bg-[#202330] hover:border-[#d4af37]/70 transition-all font-semibold",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_16px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.50)] font-semibold transition-all",
      shortcutHover: "hover:border-[#d4af37]/60 hover:bg-[#1a1d28] hover:shadow-[0_4px_20px_rgba(212,175,55,0.18)]",
      productCardBg: "bg-[#12141c]/95 backdrop-blur-md border border-[#d4af37]/20 shadow-[0_4px_20px_rgba(0,0,0,0.7)]",
      productCardHover: "hover:shadow-[0_10px_34px_rgba(212,175,55,0.25),0_2px_10px_rgba(0,0,0,0.9)] hover:-translate-y-1 hover:border-[#d4af37]/65",
      guaranteeBannerBg: "bg-gradient-to-br from-[#12141c] via-[#1a1d28] to-[#12141c] border border-[#d4af37]/30 shadow-2xl",
      guaranteeBannerText: "text-[#f4f1ea]",
      starColor: "text-[#d4af37]",
      dividerStyle: "border-[#d4af37]/25",
      priceStyle: "text-[#e5c158] font-bold font-mono",
      logoInvert: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. MAISON BLANCHE & OR SOLAIRE — L'exacte ambiance du site web officiel JAMAAL
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "pearl-minimal",
    name: "JAMAAL Signature",
    tagline: "L'esprit du site jamaal.sn",
    mood: "Épuré, chaleureux et intemporel",
    description: "Ivoire, bleu profond et terracotta dans une mise en page claire inspirée de jamaal.sn.",
    emoji: "🏛️",
    isDark: false,
    palette: {
      primary: "#1e2a3a",
      accent: "#9c6254",
      background: "#fdfbfa",
      surface: "#ffffff",
      glow: "#d4af37",
    },
    styles: {
      pageBg: "bg-[#fdfbfa]",
      heroOverlay: "bg-[#fdfbfa]/70",
      textPrimary: "text-[#1e2a3a]",
      textSecondary: "text-[#1e2a3a]/80",
      textMuted: "text-[#1e2a3a]/50",
      textAccent: "text-[#9c6254]",
      cardBg: "bg-white border border-[#eadfda] shadow-sm",
      cardBorder: "border-[#eadfda]",
      cardHover: "hover:shadow-md hover:border-[#9c6254]/50",
      avatarBorder: "border-[#1e2a3a] bg-[#1e2a3a]",
      avatarRing: "ring-4 ring-[#9c6254]/20 ring-offset-2 ring-offset-[#fdfbfa]",
      badgeStyle: "bg-white border border-[#eadfda] text-[#1e2a3a] shadow-sm backdrop-blur-md",
      buttonPrimary: "bg-[#1e2a3a] hover:bg-[#2b3a4e] text-white font-semibold transition-colors",
      buttonSecondary: "bg-white border border-[#eadfda] text-[#1e2a3a] hover:bg-[#f5ede8] hover:border-[#9c6254]/60 transition-all font-semibold",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_16px_rgba(37,211,102,0.32)] hover:shadow-[0_6px_22px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#9c6254]/40 hover:bg-[#faf6f3] hover:shadow-[0_4px_16px_rgba(30,42,58,0.08)]",
      productCardBg: "bg-white border border-[#eadfda] shadow-sm",
      productCardHover: "hover:shadow-md hover:border-[#9c6254]/60",
      guaranteeBannerBg: "bg-[#f5ede8] border border-[#eadfda]",
      guaranteeBannerText: "text-[#1e2a3a]",
      starColor: "text-[#d4af37]",
      dividerStyle: "border-[#eadfda]",
      priceStyle: "text-[#9c6254] font-bold font-mono",
      logoInvert: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ÉMERAUDE PRIVÉE & OR — Les salons confidentiels de parfum de niche
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "royal-emerald",
    name: "Vert profond",
    tagline: "Une identité naturelle et distinctive",
    mood: "Naturel, feutré et distinctif",
    description: "Vert forêt et laiton doux pour une boutique au caractère singulier.",
    emoji: "💎",
    isDark: true,
    palette: {
      primary: "#e8f0e8",
      accent: "#c8a94a",
      background: "#04140a",
      surface: "#091e10",
      glow: "#c8a94a",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#0d2916_0%,_#061a0d_40%,_#04140a_75%,_#020a05_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#c8a94a]/15 via-[#091e10]/50 to-transparent",
      textPrimary: "text-[#e8f0e8]",
      textSecondary: "text-[#e8f0e8]/85",
      textMuted: "text-[#e8f0e8]/50",
      textAccent: "text-[#dfbe59]",
      cardBg: "bg-[#091e10]/90 backdrop-blur-md border border-[#c8a94a]/25 shadow-[0_4px_24px_rgba(0,0,0,0.65)]",
      cardBorder: "border-[#c8a94a]/25",
      cardHover: "hover:shadow-[0_8px_32px_rgba(200,169,74,0.24)] hover:border-[#c8a94a]/60 hover:-translate-y-1",
      avatarBorder: "border-[#c8a94a] bg-[#04140a]",
      avatarRing: "ring-4 ring-[#c8a94a]/30 ring-offset-2 ring-offset-[#04140a]",
      badgeStyle: "bg-[#0c2615] border border-[#c8a94a]/35 text-[#e8f0e8] shadow-md backdrop-blur-md",
      buttonPrimary: "bg-gradient-to-br from-[#c8a94a] via-[#b89535] to-[#9c7a20] hover:from-[#dfbe59] hover:to-[#b89535] text-[#04140a] font-bold shadow-[0_4px_18px_rgba(200,169,74,0.40)] hover:shadow-[0_6px_26px_rgba(200,169,74,0.55)] transition-all",
      buttonSecondary: "bg-[#0c2615]/90 border border-[#c8a94a]/35 text-[#e8f0e8] hover:bg-[#12331d] hover:border-[#c8a94a]/65 transition-all font-semibold",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_16px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.50)] font-semibold transition-all",
      shortcutHover: "hover:border-[#c8a94a]/55 hover:bg-[#0e2c18] hover:shadow-[0_4px_20px_rgba(200,169,74,0.18)]",
      productCardBg: "bg-[#081b0e]/95 backdrop-blur-md border border-[#c8a94a]/20 shadow-[0_4px_20px_rgba(0,0,0,0.7)]",
      productCardHover: "hover:shadow-[0_10px_34px_rgba(200,169,74,0.26),0_2px_10px_rgba(0,0,0,0.9)] hover:-translate-y-1 hover:border-[#c8a94a]/65",
      guaranteeBannerBg: "bg-gradient-to-br from-[#081b0e] via-[#0e2c18] to-[#081b0e] border border-[#c8a94a]/30 shadow-2xl",
      guaranteeBannerText: "text-[#e8f0e8]",
      starColor: "text-[#c8a94a]",
      dividerStyle: "border-[#c8a94a]/25",
      priceStyle: "text-[#dfbe59] font-bold font-mono",
      logoInvert: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. BLEU NUIT SAPHIR & PLATINE — La nuit royale méditerranéenne
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "midnight-navy",
    name: "Bleu nuit",
    tagline: "Une allure contemporaine et feutrée",
    mood: "Calme, contemporain et profond",
    description: "Bleu nuit et détails clairs pour mettre les produits au premier plan.",
    emoji: "🌌",
    isDark: true,
    palette: {
      primary: "#f0f4fc",
      accent: "#60a5fa",
      background: "#060b18",
      surface: "#0d162e",
      glow: "#60a5fa",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#121e3f_0%,_#091125_40%,_#060b18_75%,_#03050c_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#60a5fa]/15 via-[#0d162e]/50 to-transparent",
      textPrimary: "text-[#f0f4fc]",
      textSecondary: "text-[#f0f4fc]/85",
      textMuted: "text-[#f0f4fc]/50",
      textAccent: "text-[#93c5fd]",
      cardBg: "bg-[#0d162e]/90 backdrop-blur-md border border-[#60a5fa]/25 shadow-[0_4px_24px_rgba(0,0,0,0.65)]",
      cardBorder: "border-[#60a5fa]/25",
      cardHover: "hover:shadow-[0_8px_32px_rgba(96,165,250,0.22)] hover:border-[#60a5fa]/60 hover:-translate-y-1",
      avatarBorder: "border-[#60a5fa] bg-[#060b18]",
      avatarRing: "ring-4 ring-[#60a5fa]/30 ring-offset-2 ring-offset-[#060b18]",
      badgeStyle: "bg-[#101b38] border border-[#60a5fa]/35 text-[#f0f4fc] shadow-md backdrop-blur-md",
      buttonPrimary: "bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] hover:from-[#60a5fa] hover:to-[#2563eb] text-white font-bold shadow-[0_4px_18px_rgba(37,99,235,0.40)] hover:shadow-[0_6px_26px_rgba(37,99,235,0.55)] transition-all",
      buttonSecondary: "bg-[#101b38]/90 border border-[#60a5fa]/35 text-[#f0f4fc] hover:bg-[#16244a] hover:border-[#60a5fa]/65 transition-all font-semibold",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_16px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.50)] font-semibold transition-all",
      shortcutHover: "hover:border-[#60a5fa]/55 hover:bg-[#132042] hover:shadow-[0_4px_20px_rgba(96,165,250,0.18)]",
      productCardBg: "bg-[#0b1328]/95 backdrop-blur-md border border-[#60a5fa]/20 shadow-[0_4px_20px_rgba(0,0,0,0.7)]",
      productCardHover: "hover:shadow-[0_10px_34px_rgba(96,165,250,0.25),0_2px_10px_rgba(0,0,0,0.9)] hover:-translate-y-1 hover:border-[#60a5fa]/65",
      guaranteeBannerBg: "bg-gradient-to-br from-[#0b1328] via-[#132042] to-[#0b1328] border border-[#60a5fa]/30 shadow-2xl",
      guaranteeBannerText: "text-[#f0f4fc]",
      starColor: "text-[#fbbf24]",
      dividerStyle: "border-[#60a5fa]/25",
      priceStyle: "text-[#93c5fd] font-bold font-mono",
      logoInvert: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. AMBRE SAHARIEN & TERRACOTTA — La chaleur solaire des épices précieuses
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "sahara-nude",
    name: "Sable & terracotta",
    tagline: "Une palette chaude et accueillante",
    mood: "Solaire, chaleureux et naturel",
    description: "Tons sable et terracotta pour une boutique chaleureuse et accueillante.",
    emoji: "✨",
    isDark: false,
    palette: {
      primary: "#241408",
      accent: "#b56938",
      background: "#fbf6f0",
      surface: "#ffffff",
      glow: "#d48850",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#f5e5d3_0%,_#fbf6f0_40%,_#fffcf9_75%,_#fbf6f0_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#f5e5d3]/70 via-[#fbf6f0]/40 to-transparent",
      textPrimary: "text-[#241408]",
      textSecondary: "text-[#241408]/80",
      textMuted: "text-[#241408]/50",
      textAccent: "text-[#a05525]",
      cardBg: "bg-white/90 backdrop-blur-md border border-[#ebd8c5] shadow-[0_4px_20px_rgba(181,105,56,0.10)]",
      cardBorder: "border-[#ebd8c5]",
      cardHover: "hover:shadow-[0_8px_30px_rgba(181,105,56,0.20)] hover:border-[#b56938]/60 hover:-translate-y-1",
      avatarBorder: "border-[#b56938] bg-[#241408]",
      avatarRing: "ring-4 ring-[#b56938]/25 ring-offset-2 ring-offset-[#fbf6f0]",
      badgeStyle: "bg-white/95 border border-[#ebd8c5] text-[#241408] shadow-sm backdrop-blur-md",
      buttonPrimary: "bg-gradient-to-br from-[#b56938] via-[#a05525] to-[#864016] hover:from-[#c87642] hover:to-[#a05525] text-white font-semibold shadow-[0_4px_16px_rgba(181,105,56,0.35)] hover:shadow-[0_6px_22px_rgba(181,105,56,0.48)] transition-all",
      buttonSecondary: "bg-white/90 border border-[#ebd8c5] text-[#241408] hover:bg-[#f5e5d3]/50 hover:border-[#b56938]/60 transition-all font-semibold",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_16px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_24px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#b56938]/50 hover:bg-white hover:shadow-[0_4px_18px_rgba(181,105,56,0.15)]",
      productCardBg: "bg-white/95 backdrop-blur-md border border-[#ebd8c5] shadow-[0_4px_16px_rgba(181,105,56,0.08)]",
      productCardHover: "hover:shadow-[0_10px_32px_rgba(181,105,56,0.22)] hover:-translate-y-1 hover:border-[#b56938]/70",
      guaranteeBannerBg: "bg-gradient-to-br from-[#241408] via-[#331c0c] to-[#241408] border border-[#b56938]/30 shadow-xl",
      guaranteeBannerText: "text-[#fbf6f0]",
      starColor: "text-[#b56938]",
      dividerStyle: "border-[#ebd8c5]",
      priceStyle: "text-[#a05525] font-bold font-mono",
      logoInvert: false,
    },
  },
];

/**
 * Récupère un thème par son identifiant.
 * Si l'identifiant est absent ou inconnu, retourne le thème signature par défaut (JAMAAL Signature).
 */
export function getShopTheme(themeId: string | null | undefined): ShopTheme {
  const found = SHOP_THEMES.find((t) => t.id === themeId);
  return found ?? SHOP_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}