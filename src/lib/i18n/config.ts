/**
 * Site vitrine bilingue : français (par défaut, adresses sans préfixe) et italien (adresses /it/…).
 * Le back-office, les API, les boutiques des revendeurs (/c/…) restent en français.
 */
export const LOCALES = ["fr", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

/** Langue choisie par le visiteur (gardée un an). */
export const LOCALE_COOKIE = "jamaal_lang";
/** En-tête interne posé par le proxy pour les pages serveur. */
export const LOCALE_HEADER = "x-jamaal-locale";
/** Chemin d'origine (avec /it) pour les liens hreflang. */
export const PATH_HEADER = "x-jamaal-path";

export const isLocale = (v: unknown): v is Locale => v === "fr" || v === "it";

/** Pages qui existent en italien (le site public). */
export function isLocalizablePath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/c/") || pathname === "/c" || pathname.startsWith("/livreur")) return false;
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return false;
  return true;
}

/** « /it/produits/x » → { locale: "it", path: "/produits/x" } ; « /produits/x » → français. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  if (pathname === "/it" || pathname.startsWith("/it/")) return { locale: "it", path: pathname.slice(3) || "/" };
  return { locale: "fr", path: pathname };
}

/** Adresse d'une page du site dans la langue voulue (liens internes seulement). */
export function localizeHref(href: string, locale: Locale): string {
  if (locale === "fr" || !href.startsWith("/") || href.startsWith("//")) return href;
  const [path] = href.split(/[?#]/);
  if (path === "/it" || path.startsWith("/it/") || !isLocalizablePath(path)) return href;
  return href === "/" ? "/it" : href.startsWith("/?") || href.startsWith("/#") ? `/it${href.slice(1)}` : `/it${href}`;
}
