/**
 * Thèmes des boutiques personnelles des revendeurs (/c/<slug>), version 2.
 *
 * 14 thèmes clairs, chacun avec sa palette, son couple de polices, la forme du portrait,
 * une frise décorative facultative et trois accents au choix. La page applique ces valeurs
 * en variables CSS : aucune classe dynamique, et des contrastes vérifiés (texte ≥ 4,5:1).
 *
 * Les anciens identifiants (première version) restent acceptés et sont convertis.
 */

export const SHOP_THEME_IDS = [
  "maison",
  "champagne",
  "teranga",
  "galerie",
  "rose",
  "arcenciel",
  "ciel",
  "emeraude",
  "lavande",
  "safran",
  "rouge",
  "argent",
  "violet",
  "or",
] as const;

export type ShopThemeId = (typeof SHOP_THEME_IDS)[number];

export interface ShopTheme {
  id: ShopThemeId;
  name: string;
  /** Une ligne pour le sélecteur. */
  mood: string;
  /** Fond de page, cartes, encre, texte secondaire, filets, fond doux (bandeaux, portrait). */
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  /** Trois accents au choix du revendeur (texte et boutons, lisibles sur le fond et en blanc dessus). */
  accents: [string, string, string];
  /** Section foncée (« Commander ») et pied de page. */
  dark: string;
  darkInk: string;
  darkAccent: string;
  footer: string;
  footerInk: string;
  /** Variables CSS des polices (déclarées par next/font dans le layout des boutiques). */
  display: string;
  body: string;
  /** Familles pour les aperçus hors boutique (sans chargement de police). */
  displayName: string;
  bodyName: string;
  /** Forme du portrait (border-radius). */
  portrait: string;
  /** Frise décorative sous l'en-tête (fond CSS) ou rien. */
  decor: string | null;
  /** Teintes de fond des photos produits, en rotation. */
  tints: string[];
}

const t = (x: ShopTheme) => x;

export const SHOP_THEMES: ShopTheme[] = [
  t({
    id: "maison", name: "Maison JAMAAL", mood: "La signature : ivoire, bleu nuit, or rose",
    bg: "#FBF8F4", surface: "#FFFFFF", ink: "#1D2F4F", muted: "#4A5872", line: "#E7DCD3", soft: "#F4ECE5",
    accents: ["#8E5244", "#1D2F4F", "#7A6A3A"],
    dark: "#1D2F4F", darkInk: "#F4ECE4", darkAccent: "#E3BFB2", footer: "#142339", footerInk: "#D5DAE4",
    display: "--f-cormorant", body: "--f-jost", displayName: "Cormorant Garamond", bodyName: "Jost",
    portrait: "220px 220px 12px 12px", decor: null,
    tints: ["#EEF1F6", "#F7ECE8", "#F1EEF5", "#E9ECF1"],
  }),
  t({
    id: "champagne", name: "Champagne Doré", mood: "Lumineux et précieux : crème, brun, or bronze",
    bg: "#F7F1E6", surface: "#FFFDF8", ink: "#2B2418", muted: "#5E5240", line: "#E3D6BF", soft: "#EFE4CF",
    accents: ["#7A5D24", "#8E5244", "#2B2418"],
    dark: "#3A3022", darkInk: "#F7F1E6", darkAccent: "#E6CF9C", footer: "#2B2418", footerInk: "#E3D6BF",
    display: "--f-bodoni", body: "--f-manrope", displayName: "Bodoni Moda", bodyName: "Manrope",
    portrait: "12px", decor: "linear-gradient(90deg,#C9A45A,#EBD9AC,#C9A45A)",
    tints: ["#F3EAD8", "#EFE4CF", "#F6EEDF", "#EDE3D0"],
  }),
  t({
    id: "teranga", name: "Teranga", mood: "Luxe sénégalais : sable, terre cuite, indigo",
    bg: "#F3EADF", surface: "#FBF6EF", ink: "#2A1F1A", muted: "#5C4A3E", line: "#DCCBB6", soft: "#EADCCB",
    accents: ["#96462A", "#24324F", "#725512"],
    dark: "#24324F", darkInk: "#F3EADF", darkAccent: "#E9B48F", footer: "#1E2A42", footerInk: "#DCCBB6",
    display: "--f-fraunces", body: "--f-dmsans", displayName: "Fraunces", bodyName: "DM Sans",
    portrait: "28px", decor: "repeating-linear-gradient(90deg,#A4502F 0 28px,#24324F 28px 56px,#E3A21A 56px 84px)",
    tints: ["#EADCCB", "#E5D3C0", "#EFE3D4", "#E0D0BD"],
  }),
  t({
    id: "galerie", name: "Galerie Blanche", mood: "Éditorial minimaliste : blanc, noir, bleu JAMAAL",
    bg: "#FFFFFF", surface: "#F5F5F4", ink: "#111111", muted: "#52525B", line: "#E4E4E2", soft: "#EFEFED",
    accents: ["#1D2F4F", "#111111", "#8E5244"],
    dark: "#111111", darkInk: "#FFFFFF", darkAccent: "#D4D4D8", footer: "#111111", footerInk: "#D4D4D8",
    display: "--f-instrument", body: "--f-intertight", displayName: "Instrument Serif", bodyName: "Inter Tight",
    portrait: "0px", decor: null,
    tints: ["#F5F5F4", "#EFEFED"],
  }),
  t({
    id: "rose", name: "Rose Poudré", mood: "Féminin et romantique : rose poudré, prune",
    bg: "#FCF1F3", surface: "#FFFFFF", ink: "#4A1F2E", muted: "#6E4452", line: "#F3D5DC", soft: "#F8E1E7",
    accents: ["#A23D62", "#4A1F2E", "#8C5A4C"],
    dark: "#4A1F2E", darkInk: "#FCF1F3", darkAccent: "#F3B9CA", footer: "#3A1724", footerInk: "#F3D5DC",
    display: "--font-playfair", body: "--f-montserrat", displayName: "Playfair Display", bodyName: "Montserrat",
    portrait: "999px", decor: null,
    tints: ["#F8E1E7", "#FBEAEE", "#F3D5DC", "#FBEAEE"],
  }),
  t({
    id: "arcenciel", name: "Arc-en-ciel", mood: "Joyeux et coloré : une couleur par parfum",
    bg: "#FFFCF7", surface: "#FFFFFF", ink: "#1F2340", muted: "#4B5070", line: "#EFE9DF", soft: "#F4EFE6",
    accents: ["#6A3FA0", "#2756A5", "#B23A2A"],
    dark: "#1F2340", darkInk: "#FFFCF7", darkAccent: "#FFD27A", footer: "#1F2340", footerInk: "#E6E3F0",
    display: "--f-dmserif", body: "--f-outfit", displayName: "DM Serif Display", bodyName: "Outfit",
    portrait: "32px", decor: "linear-gradient(90deg,#E4572E,#F3A712,#F6D743,#4CB963,#2E86DE,#8E5BD6)",
    tints: ["#FDE2D6", "#FFF1C9", "#DDF3E2", "#DCE7F8", "#EBDFF8", "#FDE0EA"],
  }),
  t({
    id: "ciel", name: "Ciel & Marine", mood: "Bleu ciel, bleu marine et une 2ᵉ couleur",
    bg: "#EEF6FC", surface: "#FFFFFF", ink: "#13294B", muted: "#3E5577", line: "#D6E6F3", soft: "#DCEBF8",
    accents: ["#7D5E17", "#B0442D", "#A23D62"],
    dark: "#13294B", darkInk: "#EEF6FC", darkAccent: "#D4AF5A", footer: "#0E1F3A", footerInk: "#D6E6F3",
    display: "--f-caslon", body: "--f-nunito", displayName: "Libre Caslon Display", bodyName: "Nunito Sans",
    portrait: "999px 999px 24px 24px", decor: "linear-gradient(90deg,#BFDDF4,#13294B)",
    tints: ["#DCEBF8", "#E8F2FB", "#D3E6F6", "#E8F2FB"],
  }),
  t({
    id: "emeraude", name: "Jardin d'Émeraude", mood: "Botanique et apaisant : émeraude, sauge, or",
    bg: "#F4F1E8", surface: "#FBF9F3", ink: "#163A2E", muted: "#44584F", line: "#DED7C2", soft: "#DCE5D7",
    accents: ["#2F6B52", "#77591F", "#163A2E"],
    dark: "#163A2E", darkInk: "#F4F1E8", darkAccent: "#D9BE7E", footer: "#102C23", footerInk: "#DED7C2",
    display: "--f-gilda", body: "--f-karla", displayName: "Gilda Display", bodyName: "Karla",
    portrait: "200px 200px 200px 24px", decor: null,
    tints: ["#DCE5D7", "#E6EBDD", "#EDE7D6", "#D5E0D2"],
  }),
  t({
    id: "lavande", name: "Lavande", mood: "Doux et poétique : lilas, violet profond",
    bg: "#F6F3FB", surface: "#FFFFFF", ink: "#2E2148", muted: "#574B6E", line: "#E2DAEE", soft: "#ECE5F6",
    accents: ["#6B4FA0", "#4A3577", "#7E4C8E"],
    dark: "#2E2148", darkInk: "#F6F3FB", darkAccent: "#CDBDF0", footer: "#241A39", footerInk: "#E2DAEE",
    display: "--f-marcellus", body: "--f-lato", displayName: "Marcellus", bodyName: "Lato",
    portrait: "999px", decor: null,
    tints: ["#ECE5F6", "#E6DDF3", "#F1ECF8", "#E2DAEE"],
  }),
  t({
    id: "safran", name: "Safran & Bordeaux", mood: "Chaud et festif : safran, bordeaux, crème",
    bg: "#FBF5E8", surface: "#FFFFFF", ink: "#3A1018", muted: "#66404A", line: "#EBDCBD", soft: "#F6E6C2",
    accents: ["#6E1A2C", "#8C5A00", "#3A1018"],
    dark: "#6E1A2C", darkInk: "#FBF5E8", darkAccent: "#F2C14E", footer: "#3A1018", footerInk: "#EBDCBD",
    display: "--f-prata", body: "--f-worksans", displayName: "Prata", bodyName: "Work Sans",
    portrait: "24px", decor: "repeating-linear-gradient(90deg,#E3A21A 0 18px,#6E1A2C 18px 36px)",
    tints: ["#F6E6C2", "#F3DCCB", "#F8EDD3", "#EFD9C9"],
  }),
  t({
    id: "rouge", name: "Rouge Passion", mood: "Audacieux et glamour : écarlate, crème, noir",
    bg: "#FFF8F3", surface: "#FFFFFF", ink: "#2A0A10", muted: "#5E3A3F", line: "#EBD6D3", soft: "#F7E4E1",
    accents: ["#B3122E", "#2A0A10", "#8C0E24"],
    dark: "#2A0A10", darkInk: "#FFF8F3", darkAccent: "#FF8A9B", footer: "#1A0609", footerInk: "#EBD6D3",
    display: "--f-cinzel", body: "--f-raleway", displayName: "Cinzel", bodyName: "Raleway",
    portrait: "4px", decor: "linear-gradient(90deg,#B3122E,#2A0A10)",
    tints: ["#F7E4E1", "#FBEDEA", "#F3DAD6", "#FBEDEA"],
  }),
  t({
    id: "argent", name: "Argent Platine", mood: "Moderne et raffiné : argent, gris perle, graphite",
    bg: "#F2F3F5", surface: "#FFFFFF", ink: "#23272E", muted: "#4F5560", line: "#DADDE2", soft: "#E6E8EC",
    accents: ["#4A515C", "#23272E", "#1D2F4F"],
    dark: "#23272E", darkInk: "#F2F3F5", darkAccent: "#C9CED6", footer: "#1A1D22", footerInk: "#DADDE2",
    display: "--f-tenor", body: "--f-inter", displayName: "Tenor Sans", bodyName: "Inter",
    portrait: "16px", decor: "linear-gradient(90deg,#B8BEC7,#F2F3F5,#9AA1AC)",
    tints: ["#E6E8EC", "#EEF0F2", "#E1E4E8", "#EEF0F2"],
  }),
  t({
    id: "violet", name: "Violet Améthyste", mood: "Royal et vibrant : violet, lilas, magenta",
    bg: "#FAF7FF", surface: "#FFFFFF", ink: "#24093F", muted: "#4E3A66", line: "#E3D6FA", soft: "#EDE3FF",
    accents: ["#6A1FD1", "#B0186D", "#4A0FA0"],
    dark: "#24093F", darkInk: "#FAF7FF", darkAccent: "#E3A6FF", footer: "#1A062E", footerInk: "#E3D6FA",
    display: "--f-yeseva", body: "--f-quicksand", displayName: "Yeseva One", bodyName: "Quicksand",
    portrait: "999px", decor: "linear-gradient(90deg,#6A1FD1,#C21E7A)",
    tints: ["#EDE3FF", "#F5EEFF", "#FBE6F3", "#F5EEFF"],
  }),
  t({
    id: "or", name: "Or Impérial", mood: "Art déco et prestigieux : or, ivoire, brun",
    bg: "#FFFBF0", surface: "#FFFFFF", ink: "#2B2205", muted: "#5A4C24", line: "#E6D49A", soft: "#F6EBC8",
    accents: ["#7A5C00", "#2B2205", "#8E5244"],
    dark: "#2B2205", darkInk: "#FFFBF0", darkAccent: "#E5C35A", footer: "#1F1803", footerInk: "#E6D49A",
    display: "--f-italiana", body: "--f-josefin", displayName: "Italiana", bodyName: "Josefin Sans",
    portrait: "210px 210px 0 0", decor: "linear-gradient(90deg,#C9A227,#F3E3A3,#C9A227)",
    tints: ["#F6EBC8", "#FBF3DC", "#F2E4B8", "#FBF3DC"],
  }),
];

export const DEFAULT_THEME_ID: ShopThemeId = "maison";

/** Anciens identifiants (première version des thèmes) vers les nouveaux. */
export const LEGACY_THEME_IDS: Record<string, ShopThemeId> = {
  "luxury-rose": "maison",
  "noir-gold": "champagne",
  "sahara-nude": "teranga",
  "midnight-navy": "ciel",
  "royal-emerald": "emeraude",
  "pearl-minimal": "galerie",
};

/** Identifiant valide (nouveau ou ancien) vers l'identifiant courant, sinon le thème par défaut. */
export function normalizeThemeId(id: string | null | undefined): ShopThemeId {
  const v = String(id ?? "").trim();
  if ((SHOP_THEME_IDS as readonly string[]).includes(v)) return v as ShopThemeId;
  return LEGACY_THEME_IDS[v] ?? DEFAULT_THEME_ID;
}

export function getShopTheme(themeId: string | null | undefined): ShopTheme {
  const id = normalizeThemeId(themeId);
  return SHOP_THEMES.find((x) => x.id === id)!;
}

/* ── Personnalisation ───────────────────────────────────────────────────── */

export const SHOP_HEROES = [
  { id: "portrait", label: "Mon portrait" },
  { id: "showcase", label: "Un produit vedette" },
  { id: "banner", label: "Bannière" },
] as const;
export type ShopHero = (typeof SHOP_HEROES)[number]["id"];

export const SHOP_TYPOS = [
  { id: "theme", label: "Celle du thème" },
  { id: "classique", label: "Classique JAMAAL" },
] as const;
export type ShopTypo = (typeof SHOP_TYPOS)[number]["id"];

/** Sections que le revendeur peut masquer. */
export const SHOP_SECTIONS = [
  { id: "services", label: "Services (Parfum ADN, catalogue, offrir…)" },
  { id: "products", label: "Mes coups de cœur" },
  { id: "steps", label: "Comment commander" },
  { id: "reviews", label: "Avis clients" },
] as const;
export type ShopSection = (typeof SHOP_SECTIONS)[number]["id"];

export function normalizeHero(v: unknown): ShopHero {
  return SHOP_HEROES.some((h) => h.id === v) ? (v as ShopHero) : "portrait";
}
export function normalizeTypo(v: unknown): ShopTypo {
  return v === "classique" ? "classique" : "theme";
}
export function normalizeAccent(v: unknown): 0 | 1 | 2 {
  const n = Number(v);
  return n === 1 || n === 2 ? n : 0;
}
export function normalizeHidden(v: unknown): ShopSection[] {
  const list: unknown[] = Array.isArray(v) ? v : [];
  return SHOP_SECTIONS.map((s) => s.id).filter((id) => list.includes(id));
}

export interface ShopLook {
  theme: ShopTheme;
  accent: string;
  hero: ShopHero;
  typo: ShopTypo;
  hidden: ShopSection[];
  /** Variables CSS à poser sur la racine de la page. */
  vars: Record<string, string>;
}

/** Réglages enregistrés du revendeur vers l'apparence finale de sa boutique. */
export function shopLook(opts: { theme?: string | null; accent?: unknown; hero?: unknown; typo?: unknown; hidden?: unknown }): ShopLook {
  const theme = getShopTheme(opts.theme);
  const accent = theme.accents[normalizeAccent(opts.accent)];
  const typo = normalizeTypo(opts.typo);
  const display = typo === "classique" ? "--font-playfair" : theme.display;
  const body = typo === "classique" ? "--font-poppins" : theme.body;
  return {
    theme,
    accent,
    hero: normalizeHero(opts.hero),
    typo,
    hidden: normalizeHidden(opts.hidden),
    vars: {
      "--s-bg": theme.bg,
      "--s-surface": theme.surface,
      "--s-ink": theme.ink,
      "--s-muted": theme.muted,
      "--s-line": theme.line,
      "--s-soft": theme.soft,
      "--s-acc": accent,
      "--s-dark": theme.dark,
      "--s-dark-ink": theme.darkInk,
      "--s-dark-acc": theme.darkAccent,
      "--s-footer": theme.footer,
      "--s-footer-ink": theme.footerInk,
      "--s-portrait": theme.portrait,
      "--s-display": `var(${display}), Georgia, serif`,
      "--s-body": `var(${body}), system-ui, sans-serif`,
    },
  };
}

/* ── Contraste (WCAG) : utilisé par les tests pour garantir la lisibilité ── */

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
