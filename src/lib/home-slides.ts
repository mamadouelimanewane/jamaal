/**
 * Diapositives du carrousel d'accueil : types, thèmes, valeurs par défaut et contrôle.
 * Pur (sans base de données) : utilisable dans le navigateur.
 */
export interface HeroSlide {
  id: string;
  /** Petit titre au-dessus du slogan (« Nouveauté », « Soins visage »…). */
  eyebrow: string;
  /** Slogan principal. Le texte entre *astérisques* est mis en valeur. */
  title: string;
  subtitle: string;
  ctaLabel: string;
  /** Lien du bouton : /collections/…, /produits/…, ou une adresse complète. */
  href: string;
  /** Visuel. Vide : photo d'un produit de la gamme visée par le lien. */
  image: string;
  /** Couleur du fond (thème) : nuit, rose, sable, vert, bordeaux. */
  theme: SlideTheme;
  active: boolean;
}

export const SLIDE_THEMES = {
  nuit: { label: "Nuit", from: "#14213b", to: "#273b60", accent: "#d9a99d", text: "#fbf7f0" },
  rose: { label: "Rose poudré", from: "#6b3a35", to: "#a96a5e", accent: "#f6dcd3", text: "#fff8f5" },
  sable: { label: "Sable", from: "#3c3227", to: "#7a6650", accent: "#ecd9b8", text: "#fdf8ef" },
  vert: { label: "Vert", from: "#173a30", to: "#2f6150", accent: "#cfe5c9", text: "#f5fbf3" },
  bordeaux: { label: "Bordeaux", from: "#3d1424", to: "#6e2a40", accent: "#efc7c9", text: "#fff6f6" },
} as const;
export type SlideTheme = keyof typeof SLIDE_THEMES;

export const MAX_SLIDES = 10;

export const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: "parfums",
    eyebrow: "La maison JAMAAL",
    title: "Le parfum d'une *présence.*",
    subtitle: "Des extraits de parfum concentrés à 30 %, pensés pour celles et ceux qui laissent une empreinte.",
    ctaLabel: "Explorer les parfums",
    href: "/collections/parfum-femme",
    image: "",
    theme: "nuit",
    active: true,
  },
  {
    id: "soins-visage",
    eyebrow: "Soins visage",
    title: "Votre peau, *révélée.*",
    subtitle: "Sérums, crèmes et masques formulés en Italie pour une peau nette, souple et lumineuse sous le soleil de Dakar.",
    ctaLabel: "Découvrir les soins",
    href: "/collections/soins-visage",
    image: "",
    theme: "rose",
    active: true,
  },
  {
    id: "maquillage",
    eyebrow: "Maquillage",
    title: "La couleur, *en toute confiance.*",
    subtitle: "Teints, lèvres et regards : des textures qui tiennent et des teintes pensées pour toutes les carnations.",
    ctaLabel: "Voir le maquillage",
    href: "/collections/maquillage",
    image: "",
    theme: "bordeaux",
    active: true,
  },
  {
    id: "maison",
    eyebrow: "Maison",
    title: "Une maison qui sent *le propre.*",
    subtitle: "Lessives, nettoyants et parfums d'intérieur concentrés : moins de produit, plus d'efficacité.",
    ctaLabel: "Entretien de la maison",
    href: "/collections/entretien-maison",
    image: "",
    theme: "sable",
    active: true,
  },
  {
    id: "bien-etre",
    eyebrow: "Bien-être",
    title: "L'énergie *au quotidien.*",
    subtitle: "Compléments alimentaires et cafés fonctionnels pour accompagner vos journées.",
    ctaLabel: "Compléments et café",
    href: "/collections/complement-alimentaire",
    image: "",
    theme: "vert",
    active: true,
  },
];

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Contrôle et nettoie un carrousel (données du formulaire ou de la base). */
export function normalizeSlides(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw)) return DEFAULT_SLIDES;
  const out: HeroSlide[] = [];
  for (const [i, r] of raw.slice(0, MAX_SLIDES).entries()) {
    if (!r || typeof r !== "object") continue;
    const s = r as Record<string, unknown>;
    const title = text(s.title, 90);
    if (!title) continue;
    let href = text(s.href, 300) || "/";
    if (!/^\/(?!\/)/.test(href) && !/^https:\/\//i.test(href)) href = "/";
    const image = text(s.image, 500);
    const theme = (typeof s.theme === "string" && s.theme in SLIDE_THEMES ? s.theme : "nuit") as SlideTheme;
    out.push({
      id: text(s.id, 40).replace(/[^\w-]/g, "") || `slide-${i + 1}`,
      eyebrow: text(s.eyebrow, 40),
      title,
      subtitle: text(s.subtitle, 220),
      ctaLabel: text(s.ctaLabel, 40) || "Découvrir",
      href,
      image: /^https:\/\//i.test(image) || image.startsWith("/") ? image : "",
      theme,
      active: s.active !== false,
    });
  }
  return out;
}

/** Gamme visée par un lien « /collections/slug ». */
export function categoryFromHref(href: string): string | null {
  const m = href.match(/^\/collections\/([\w-]+)/);
  return m ? m[1] : null;
}

