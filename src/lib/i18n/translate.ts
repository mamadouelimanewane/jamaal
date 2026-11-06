import type { Locale } from "./config";
import { IT } from "./it";

export type TParams = Record<string, string | number>;
/** Traduit un texte français (la phrase française sert de clé ; sans traduction, le français reste). */
export type T = (fr: string, params?: TParams) => string;

function fill(s: string, params?: TParams) {
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

export function translator(locale: Locale): T {
  if (locale === "fr") return (fr, params) => fill(fr, params);
  return (fr, params) => {
    let it = IT[fr];
    if (it === undefined) {
      const core = fr.trim();
      const hit = core !== fr ? IT[core] : undefined;
      it = hit === undefined ? fr : fr.slice(0, fr.indexOf(core)) + hit + fr.slice(fr.indexOf(core) + core.length);
    }
    return fill(it, params);
  };
}

/** Variante d'un contenu de la base : texte italien s'il est rempli, sinon le français. */
export function pick<V>(locale: Locale, fr: V, it: V | null | undefined): V {
  if (locale !== "it" || it === null || it === undefined) return fr;
  if (typeof it === "string" && !it.trim()) return fr;
  if (Array.isArray(it) && !it.length) return fr;
  return it;
}
