/**
 * Bibliothèque de thèmes haute couture pour les boutiques personnelles des revendeurs (/c/<slug>).
 * Chaque thème définit une identité visuelle complète, inspirée des codes esthétiques des grandes
 * maisons de parfumerie et de cosmétiques de luxe mondiales.
 *
 * Niveaux de soin :
 *  – Dégradés multi-stops sur le fond de page
 *  – Glassmorphism + backdrop-blur pour les cartes
 *  – Micro-animations (ring, glow, shimmer) sur les éléments interactifs
 *  – Hiérarchie typographique avec tracking et letter-spacing luxe
 *  – Séparateurs décoratifs et accents d'or/platine/cristal
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

export const DEFAULT_THEME_ID: ShopThemeId = "luxury-rose";

export const SHOP_THEMES: ShopTheme[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. ROSE ÉLYSÉE — Parfumerie féminine, floral poudré, or rose signature
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "luxury-rose",
    name: "Rose Élysée",
    tagline: "L'élégance signature de JAMAAL",
    mood: "Floral, poudré, féminin, prestige parisien",
    description: "Inspiré des boutiques de parfumerie de la rue du Faubourg Saint-Honoré. Rose poudré soyeux, or rose 18 carats et blanc crème immaculé.",
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
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#fce8df_0%,_#fef6f0_40%,_#fdfaf8_70%,_#fff8f4_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#fce8df]/60 to-transparent",
      textPrimary: "text-[#1a1a2e]",
      textSecondary: "text-[#1a1a2e]/75",
      textMuted: "text-[#1a1a2e]/45",
      textAccent: "text-[#b07a50]",
      cardBg: "bg-white/80 backdrop-blur-sm border border-[#f0e0d4] shadow-[0_2px_16px_rgba(201,149,107,0.08)]",
      cardBorder: "border-[#f0e0d4]",
      cardHover: "hover:shadow-[0_4px_24px_rgba(201,149,107,0.18)] hover:border-[#d4a882]/60 hover:-translate-y-0.5",
      avatarBorder: "border-[#c9956b] bg-[#1a1a2e]",
      avatarRing: "ring-4 ring-[#c9956b]/20 ring-offset-2 ring-offset-[#fef6f0]",
      badgeStyle: "bg-white/90 border border-[#e8d0bf] text-[#1a1a2e] shadow-sm backdrop-blur-sm",
      buttonPrimary: "bg-gradient-to-br from-[#c9956b] to-[#a8704a] hover:from-[#d9a87a] hover:to-[#b87f55] text-white font-semibold shadow-[0_4px_14px_rgba(168,112,74,0.35)] hover:shadow-[0_6px_20px_rgba(168,112,74,0.45)] transition-all",
      buttonSecondary: "bg-white/80 border border-[#e8d0bf] text-[#1a1a2e] hover:bg-[#fef0e8] hover:border-[#c9956b]/60 transition-all",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#c9956b]/50 hover:bg-[#fff8f4] hover:shadow-[0_2px_12px_rgba(201,149,107,0.12)]",
      productCardBg: "bg-white/85 backdrop-blur-sm border border-[#f0e0d4] shadow-[0_2px_10px_rgba(201,149,107,0.07)]",
      productCardHover: "hover:shadow-[0_6px_20px_rgba(201,149,107,0.20)] hover:-translate-y-1 hover:border-[#c9956b]/40",
      guaranteeBannerBg: "bg-gradient-to-br from-[#1a1a2e] to-[#2d2d4e]",
      guaranteeBannerText: "text-[#f5e8dc]",
      starColor: "text-[#c9956b]",
      dividerStyle: "border-[#e8d0bf]",
      priceStyle: "text-[#b07a50] font-bold",
      logoInvert: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ÉBÈNE & OR — Nuit de haute parfumerie, opulence 24 carats
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "noir-gold",
    name: "Ébène & Or",
    tagline: "Haute parfumerie nocturne · Opulence 24 carats",
    mood: "Mystérieux, somptueux, ultra-raffiné, maison de parfum privée",
    description: "L'esthétique des grandes maisons de parfumerie niche : Serge Lutens, Mancera, Amouage. Ébène profond, or 24 carats et lumières de soie.",
    emoji: "✨",
    isDark: true,
    palette: {
      primary: "#f5e6c4",
      accent: "#d4af37",
      background: "#08080a",
      surface: "#141418",
      glow: "#d4af37",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#1c1508_0%,_#0d0d0f_35%,_#080808_65%,_#060608_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#d4af37]/8 to-transparent",
      textPrimary: "text-[#f5e6c4]",
      textSecondary: "text-[#e0ccaa]/80",
      textMuted: "text-[#b8a07a]/55",
      textAccent: "text-[#d4af37]",
      cardBg: "bg-[#141418]/90 backdrop-blur-md border border-[#d4af37]/20 shadow-[0_4px_24px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(212,175,55,0.08)]",
      cardBorder: "border-[#d4af37]/20",
      cardHover: "hover:border-[#d4af37]/50 hover:shadow-[0_8px_32px_rgba(212,175,55,0.15),0_2px_8px_rgba(0,0,0,0.8)] hover:-translate-y-0.5",
      avatarBorder: "border-[#d4af37] bg-[#0d0d0f]",
      avatarRing: "ring-4 ring-[#d4af37]/25 ring-offset-2 ring-offset-[#08080a]",
      badgeStyle: "bg-[#1a1a1e]/90 border border-[#d4af37]/30 text-[#f5e6c4] backdrop-blur-sm shadow-[inset_0_1px_0_rgba(212,175,55,0.1)]",
      buttonPrimary: "bg-gradient-to-br from-[#d4af37] via-[#c49b27] to-[#a87e1e] hover:from-[#e5c04c] hover:via-[#d4af37] hover:to-[#b89028] text-[#08080a] font-bold shadow-[0_4px_16px_rgba(212,175,55,0.40)] hover:shadow-[0_6px_24px_rgba(212,175,55,0.55)] transition-all",
      buttonSecondary: "bg-[#1a1a1e]/80 border border-[#d4af37]/30 text-[#f5e6c4] hover:bg-[#222228] hover:border-[#d4af37]/55 transition-all",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_14px_rgba(37,211,102,0.30)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#d4af37]/45 hover:bg-[#1c1c22] hover:shadow-[0_2px_12px_rgba(212,175,55,0.10)]",
      productCardBg: "bg-[#141418]/90 backdrop-blur-md border border-[#d4af37]/15 shadow-[0_4px_20px_rgba(0,0,0,0.55)]",
      productCardHover: "hover:shadow-[0_8px_28px_rgba(212,175,55,0.20),0_2px_8px_rgba(0,0,0,0.7)] hover:-translate-y-1 hover:border-[#d4af37]/40",
      guaranteeBannerBg: "bg-gradient-to-br from-[#141418] to-[#1c1a10] border border-[#d4af37]/25",
      guaranteeBannerText: "text-[#f5e6c4]",
      starColor: "text-[#d4af37]",
      dividerStyle: "border-[#d4af37]/20",
      priceStyle: "text-[#d4af37] font-bold",
      logoInvert: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. AMBRE SAHARIEN — Terracotta, cuivre et sables chauds
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "sahara-nude",
    name: "Ambre Saharien",
    tagline: "Chaleur solaire · Ambre, cuivre & épices précieuses",
    mood: "Sensuel, chaleureux, authentique, terre & lumière",
    description: "L'âme des souks de Marrakech et des marchés de Dakar réinterprétée en luxe contemporain. Sable fin, cuivre brûlé et soleil couchant.",
    emoji: "🔥",
    isDark: false,
    palette: {
      primary: "#2d1a0e",
      accent: "#c8622a",
      background: "#faf2e8",
      surface: "#ffffff",
      glow: "#c8622a",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#f5e0ca_0%,_#faf2e8_40%,_#fcf7f1_70%,_#fdfaf6_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#c8622a]/10 to-transparent",
      textPrimary: "text-[#2d1a0e]",
      textSecondary: "text-[#2d1a0e]/72",
      textMuted: "text-[#2d1a0e]/45",
      textAccent: "text-[#a84e1f]",
      cardBg: "bg-white/80 backdrop-blur-sm border border-[#edd8c0] shadow-[0_2px_16px_rgba(200,98,42,0.08)]",
      cardBorder: "border-[#edd8c0]",
      cardHover: "hover:shadow-[0_4px_24px_rgba(200,98,42,0.18)] hover:border-[#c8622a]/40 hover:-translate-y-0.5",
      avatarBorder: "border-[#c8622a] bg-[#2d1a0e]",
      avatarRing: "ring-4 ring-[#c8622a]/20 ring-offset-2 ring-offset-[#faf2e8]",
      badgeStyle: "bg-white/90 border border-[#e4c5a4] text-[#2d1a0e] shadow-sm backdrop-blur-sm",
      buttonPrimary: "bg-gradient-to-br from-[#c8622a] to-[#a04820] hover:from-[#d97035] hover:to-[#b05525] text-white font-semibold shadow-[0_4px_14px_rgba(160,72,32,0.38)] hover:shadow-[0_6px_20px_rgba(160,72,32,0.50)] transition-all",
      buttonSecondary: "bg-white/80 border border-[#e4c5a4] text-[#2d1a0e] hover:bg-[#fdf5ec] hover:border-[#c8622a]/50 transition-all",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#c8622a]/45 hover:bg-[#fdf6ee] hover:shadow-[0_2px_12px_rgba(200,98,42,0.12)]",
      productCardBg: "bg-white/85 backdrop-blur-sm border border-[#edd8c0] shadow-[0_2px_10px_rgba(200,98,42,0.07)]",
      productCardHover: "hover:shadow-[0_6px_20px_rgba(200,98,42,0.20)] hover:-translate-y-1 hover:border-[#c8622a]/35",
      guaranteeBannerBg: "bg-gradient-to-br from-[#2d1a0e] to-[#4a2c1a]",
      guaranteeBannerText: "text-[#faf0e2]",
      starColor: "text-[#c8622a]",
      dividerStyle: "border-[#e4c5a4]",
      priceStyle: "text-[#a84e1f] font-bold",
      logoInvert: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. MINUIT SAPHIR — Nuit bleue de Dakar, platine et brise océane
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "midnight-navy",
    name: "Minuit Saphir",
    tagline: "Ciel étoilé de Dakar · Brise saphir & platine",
    mood: "Majestueux, moderne, charismatique, souverain",
    description: "L'élégance des parfumeurs de niche new-yorkais et londoniens. Bleu nuit profond comme l'Atlantique, éclats de saphir et platine scintillant.",
    emoji: "💎",
    isDark: true,
    palette: {
      primary: "#e8f0fc",
      accent: "#4da6d4",
      background: "#040c1a",
      surface: "#0a1628",
      glow: "#4da6d4",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#0d1f3c_0%,_#060f1e_35%,_#040c1a_65%,_#030a16_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#4da6d4]/8 to-transparent",
      textPrimary: "text-[#e8f0fc]",
      textSecondary: "text-[#bdd0eb]/80",
      textMuted: "text-[#7896b8]/55",
      textAccent: "text-[#7dc4e8]",
      cardBg: "bg-[#0a1628]/90 backdrop-blur-md border border-[#4da6d4]/18 shadow-[0_4px_24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(77,166,212,0.07)]",
      cardBorder: "border-[#4da6d4]/18",
      cardHover: "hover:border-[#4da6d4]/45 hover:shadow-[0_8px_32px_rgba(77,166,212,0.18),0_2px_8px_rgba(0,0,0,0.7)] hover:-translate-y-0.5",
      avatarBorder: "border-[#4da6d4] bg-[#060f1e]",
      avatarRing: "ring-4 ring-[#4da6d4]/22 ring-offset-2 ring-offset-[#040c1a]",
      badgeStyle: "bg-[#0d1e36]/90 border border-[#4da6d4]/28 text-[#e8f0fc] backdrop-blur-sm shadow-[inset_0_1px_0_rgba(77,166,212,0.08)]",
      buttonPrimary: "bg-gradient-to-br from-[#4da6d4] to-[#2980b0] hover:from-[#62b8e2] hover:to-[#3592c4] text-white font-semibold shadow-[0_4px_16px_rgba(77,166,212,0.38)] hover:shadow-[0_6px_24px_rgba(77,166,212,0.52)] transition-all",
      buttonSecondary: "bg-[#0d1e36]/80 border border-[#4da6d4]/28 text-[#e8f0fc] hover:bg-[#122540] hover:border-[#4da6d4]/50 transition-all",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_14px_rgba(37,211,102,0.30)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#4da6d4]/42 hover:bg-[#0f2038] hover:shadow-[0_2px_12px_rgba(77,166,212,0.12)]",
      productCardBg: "bg-[#0a1628]/90 backdrop-blur-md border border-[#4da6d4]/15 shadow-[0_4px_20px_rgba(0,0,0,0.50)]",
      productCardHover: "hover:shadow-[0_8px_28px_rgba(77,166,212,0.22),0_2px_8px_rgba(0,0,0,0.65)] hover:-translate-y-1 hover:border-[#4da6d4]/38",
      guaranteeBannerBg: "bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] border border-[#4da6d4]/20",
      guaranteeBannerText: "text-[#e8f0fc]",
      starColor: "text-[#7dc4e8]",
      dividerStyle: "border-[#4da6d4]/18",
      priceStyle: "text-[#7dc4e8] font-bold",
      logoInvert: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. IMPÉRIAL VERT — Jade, malachite et or oriental
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "royal-emerald",
    name: "Impérial Vert",
    tagline: "Jade, malachite & or oriental",
    mood: "Opulent, botanique noble, mystique, Orient & Africa",
    description: "La richesse des jardins de Fès et des traditions oud orientales. Vert malachite profond, reflets jade et or antique comme les parfumeries du Moyen-Orient.",
    emoji: "💚",
    isDark: true,
    palette: {
      primary: "#e8f0e8",
      accent: "#c8a94a",
      background: "#030f08",
      surface: "#071a0e",
      glow: "#c8a94a",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#0d2015_0%,_#061410_35%,_#030f08_65%,_#020c06_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#c8a94a]/8 to-transparent",
      textPrimary: "text-[#e8f0e8]",
      textSecondary: "text-[#ccdacc]/78",
      textMuted: "text-[#82a882]/55",
      textAccent: "text-[#c8a94a]",
      cardBg: "bg-[#071a0e]/90 backdrop-blur-md border border-[#c8a94a]/18 shadow-[0_4px_24px_rgba(0,0,0,0.60),inset_0_1px_0_rgba(200,169,74,0.07)]",
      cardBorder: "border-[#c8a94a]/18",
      cardHover: "hover:border-[#c8a94a]/48 hover:shadow-[0_8px_32px_rgba(200,169,74,0.18),0_2px_8px_rgba(0,0,0,0.8)] hover:-translate-y-0.5",
      avatarBorder: "border-[#c8a94a] bg-[#061410]",
      avatarRing: "ring-4 ring-[#c8a94a]/22 ring-offset-2 ring-offset-[#030f08]",
      badgeStyle: "bg-[#0a2014]/90 border border-[#c8a94a]/28 text-[#e8f0e8] backdrop-blur-sm shadow-[inset_0_1px_0_rgba(200,169,74,0.08)]",
      buttonPrimary: "bg-gradient-to-br from-[#c8a94a] via-[#b09038] to-[#8c7024] hover:from-[#d8bb5a] hover:via-[#c8a94a] hover:to-[#9e8030] text-[#030f08] font-bold shadow-[0_4px_16px_rgba(200,169,74,0.42)] hover:shadow-[0_6px_24px_rgba(200,169,74,0.58)] transition-all",
      buttonSecondary: "bg-[#0a2014]/80 border border-[#c8a94a]/28 text-[#e8f0e8] hover:bg-[#102818] hover:border-[#c8a94a]/50 transition-all",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_14px_rgba(37,211,102,0.30)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#c8a94a]/42 hover:bg-[#0d2418] hover:shadow-[0_2px_12px_rgba(200,169,74,0.10)]",
      productCardBg: "bg-[#071a0e]/90 backdrop-blur-md border border-[#c8a94a]/14 shadow-[0_4px_20px_rgba(0,0,0,0.55)]",
      productCardHover: "hover:shadow-[0_8px_28px_rgba(200,169,74,0.20),0_2px_8px_rgba(0,0,0,0.72)] hover:-translate-y-1 hover:border-[#c8a94a]/38",
      guaranteeBannerBg: "bg-gradient-to-br from-[#071a0e] to-[#0d2415] border border-[#c8a94a]/22",
      guaranteeBannerText: "text-[#e8f0e8]",
      starColor: "text-[#c8a94a]",
      dividerStyle: "border-[#c8a94a]/18",
      priceStyle: "text-[#c8a94a] font-bold",
      logoInvert: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CRISTAL BLANC — Marbre, lumière et minimalisme haute couture
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "pearl-minimal",
    name: "Cristal Blanc",
    tagline: "Marbre glacé · Minimalisme haute couture",
    mood: "Épuré, sculptural, cristallin, cool luxury contemporain",
    description: "L'esthétique des boutiques flagship Maison Francis Kurkdjian et Jo Malone London. Marbre blanc Carrare, platine satiné et lumière naturelle zénithale.",
    emoji: "🤍",
    isDark: false,
    palette: {
      primary: "#0a0f1a",
      accent: "#8899aa",
      background: "#f7f9fb",
      surface: "#ffffff",
      glow: "#8899aa",
    },
    styles: {
      pageBg: "bg-[radial-gradient(ellipse_at_top,_#eef2f7_0%,_#f7f9fb_40%,_#ffffff_70%,_#f7f9fb_100%)]",
      heroOverlay: "bg-gradient-to-b from-[#8899aa]/5 to-transparent",
      textPrimary: "text-[#0a0f1a]",
      textSecondary: "text-[#0a0f1a]/70",
      textMuted: "text-[#0a0f1a]/40",
      textAccent: "text-[#4a6070]",
      cardBg: "bg-white/85 backdrop-blur-sm border border-[#dde5ee] shadow-[0_2px_16px_rgba(100,130,160,0.08)]",
      cardBorder: "border-[#dde5ee]",
      cardHover: "hover:shadow-[0_4px_24px_rgba(100,130,160,0.16)] hover:border-[#8899aa]/50 hover:-translate-y-0.5",
      avatarBorder: "border-[#0a0f1a] bg-[#0a0f1a]",
      avatarRing: "ring-4 ring-[#0a0f1a]/10 ring-offset-2 ring-offset-[#f7f9fb]",
      badgeStyle: "bg-white/90 border border-[#cdd8e4] text-[#0a0f1a] shadow-sm backdrop-blur-sm",
      buttonPrimary: "bg-gradient-to-br from-[#0a0f1a] to-[#1e2d3d] hover:from-[#1e2d3d] hover:to-[#2d3f52] text-white font-semibold shadow-[0_4px_14px_rgba(10,15,26,0.30)] hover:shadow-[0_6px_20px_rgba(10,15,26,0.42)] transition-all",
      buttonSecondary: "bg-white/85 border border-[#cdd8e4] text-[#0a0f1a] hover:bg-[#eef2f7] hover:border-[#8899aa]/60 transition-all",
      waButton: "bg-gradient-to-br from-[#25D366] to-[#1aad54] hover:from-[#2de374] hover:to-[#20ba59] text-white shadow-[0_4px_14px_rgba(37,211,102,0.32)] hover:shadow-[0_6px_20px_rgba(37,211,102,0.45)] font-semibold transition-all",
      shortcutHover: "hover:border-[#0a0f1a]/35 hover:bg-[#eef2f7] hover:shadow-[0_2px_12px_rgba(100,130,160,0.10)]",
      productCardBg: "bg-white/85 backdrop-blur-sm border border-[#dde5ee] shadow-[0_2px_10px_rgba(100,130,160,0.07)]",
      productCardHover: "hover:shadow-[0_6px_20px_rgba(100,130,160,0.18)] hover:-translate-y-1 hover:border-[#8899aa]/40",
      guaranteeBannerBg: "bg-gradient-to-br from-[#0a0f1a] to-[#1e2d3d]",
      guaranteeBannerText: "text-[#e8edf5]",
      starColor: "text-[#6a8090]",
      dividerStyle: "border-[#dde5ee]",
      priceStyle: "text-[#0a0f1a] font-bold",
      logoInvert: false,
    },
  },
];

/**
 * Récupère un thème par son identifiant.
 * Si l'identifiant est absent ou inconnu, retourne le thème signature par défaut (Rose Élysée).
 */
export function getShopTheme(themeId: string | null | undefined): ShopTheme {
  const found = SHOP_THEMES.find((t) => t.id === themeId);
  return found ?? SHOP_THEMES[0]!;
}
