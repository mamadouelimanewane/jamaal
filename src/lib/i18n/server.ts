import { headers } from "next/headers";
import { LOCALE_HEADER, PATH_HEADER, isLocale, localizeHref, type Locale } from "./config";
import { translator, type T } from "./translate";

/** Langue de la page en cours (posée par le proxy d'après l'adresse /it/…). */
export async function getLocale(): Promise<Locale> {
  try {
    const v = (await headers()).get(LOCALE_HEADER);
    return isLocale(v) ? v : "fr";
  } catch {
    // Hors requête (scripts, tâches planifiées) : français.
    return "fr";
  }
}

export async function getT(): Promise<T> {
  return translator(await getLocale());
}

/** Chemin de la page sans préfixe de langue (pour les liens hreflang et le sélecteur de langue). */
export async function getBasePath(): Promise<string> {
  try {
    return (await headers()).get(PATH_HEADER) || "/";
  } catch {
    return "/";
  }
}

/** Adresse canonique et variantes FR/IT d'une page (balises hreflang). */
export async function pageAlternates(path: string) {
  const locale = await getLocale();
  const it = localizeHref(path, "it");
  return { canonical: locale === "it" ? it : path, languages: { fr: path, it, "x-default": path } };
}
