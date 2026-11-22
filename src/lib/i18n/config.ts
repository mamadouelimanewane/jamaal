/**
 * Site vitrine en trois langues : français (par défaut, adresses sans préfixe), italien (/it/…) et arabe (/ar/…, écrit
 * de droite à gauche). Le back-office, les API, les boutiques des revendeurs (/c/…) restent en français.
 */
export const LOCALES = ["fr", "it", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
/** Langues avec un préfixe d'adresse. */
export const PREFIXED: readonly Exclude<Locale, "fr">[] = ["it", "ar"];

export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", it: "Italiano", ar: "العربية" };
export const LOCALE_SHORT: Record<Locale, string> = { fr: "FR", it: "IT", ar: "ع" };

/** Sens d'écriture de la langue. */
export const dirOf = (l: Locale): "rtl" | "ltr" => (l === "ar" ? "rtl" : "ltr");

/** Langue choisie par le visiteur (gardée un an). */
export const LOCALE_COOKIE = "jamaal_lang";
/** En-tête interne posé par le proxy pour les pages serveur. */
export const LOCALE_HEADER = "x-jamaal-locale";
/** Chemin d'origine (avec /it ou /ar) pour les liens hreflang. */
export const PATH_HEADER = "x-jamaal-path";

export const isLocale = (v: unknown): v is Locale => v === "fr" || v === "it" || v === "ar";

/** Pages qui existent dans les autres langues (le site public). */
export function isLocalizablePath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/c/") || pathname === "/c" || pathname.startsWith("/livreur")) return false;
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return false;
  return true;
}

/** « /it/produits/x » → { locale: "it", path: "/produits/x" } ; « /ar » → arabe ; « /produits/x » → français. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  for (const l of PREFIXED) {
    if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return { locale: l, path: pathname.slice(l.length + 1) || "/" };
  }
  return { locale: "fr", path: pathname };
}

/** Adresse d'une page du site dans la langue voulue (liens internes seulement). */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [path] = href.split(/[?#]/);
  const current = splitLocale(path);
  if (current.locale !== "fr") {
    // Lien déjà préfixé : on le garde s'il est dans la bonne langue, sinon on change de préfixe.
    if (current.locale === locale) return href;
    return localizeHref(href.slice(current.locale.length + 1) || "/", locale);
  }
  if (locale === "fr" || !isLocalizablePath(path)) return href;
  return href === "/" ? `/${locale}` : href.startsWith("/?") || href.startsWith("/#") ? `/${locale}${href.slice(1)}` : `/${locale}${href}`;
}
