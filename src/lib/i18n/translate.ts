import type { Locale } from "./config";
import { IT } from "./it";
import { AR } from "./ar";

const DICT: Record<Exclude<Locale, "fr">, Record<string, string>> = { it: IT, ar: AR };

export type TParams = Record<string, string | number>;
/** Traduit un texte français (la phrase française sert de clé ; sans traduction, le français reste). */
export type T = (fr: string, params?: TParams) => string;

function fill(s: string, params?: TParams) {
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

export function translator(locale: Locale): T {
  if (locale === "fr") return (fr, params) => fill(fr, params);
  const dict = DICT[locale];
  return (fr, params) => {
    let out = dict[fr];
    if (out === undefined) {
      const core = fr.trim();
      const hit = core !== fr ? dict[core] : undefined;
      out = hit === undefined ? fr : fr.slice(0, fr.indexOf(core)) + hit + fr.slice(fr.indexOf(core) + core.length);
    }
    return fill(out, params);
  };
}

/** Variante d'un contenu de la base : texte italien s'il est rempli (en italien seulement), sinon le français. */
export function pick<V>(locale: Locale, fr: V, it: V | null | undefined): V {
  if (locale !== "it" || it === null || it === undefined) return fr;
  if (typeof it === "string" && !it.trim()) return fr;
  if (Array.isArray(it) && !it.length) return fr;
  return it;
}
