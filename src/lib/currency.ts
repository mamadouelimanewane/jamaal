/** Les prix sont stockés en FCFA (nombres entiers), format d'affichage local Sénégal/UEMOA. */
export function formatPrice(n: number): string {
  return Math.round(n).toLocaleString("fr-FR") + " FCFA";
}

/**
 * Version arabe du site : les prix s'affichent en ouguiya mauritanienne (MRU), convertis depuis le FCFA.
 * Taux = nombre de FCFA pour 1 ouguiya (Admin > Réglages). Le paiement, lui, reste en FCFA.
 */
export const MRU_DEFAULT_RATE = 14.7;

export function toMru(xof: number, rate: number = MRU_DEFAULT_RATE): number {
  const r = Number.isFinite(rate) && rate > 0 ? rate : MRU_DEFAULT_RATE;
  return Math.round(xof / r);
}

/**
 * « 3 347 MRU », isolé de gauche à droite (caractères Unicode LRI…PDI) : dans une phrase en arabe,
 * le montant reste lisible dans le même ordre partout (sinon « MRU 3 347 » sur certaines lignes).
 */
export function formatMru(xof: number, rate: number = MRU_DEFAULT_RATE): string {
  return "\u2066" + toMru(xof, rate).toLocaleString("fr-FR") + " MRU\u2069";
}

export type PriceFormatter = (xof: number) => string;

/** Formateur de prix d'une langue : ouguiya pour l'arabe, FCFA sinon. */
export function priceFormatter(locale: string, mruRate: number = MRU_DEFAULT_RATE): PriceFormatter {
  return locale === "ar" ? (n) => formatMru(n, mruRate) : formatPrice;
}
