/**
 * Mise à jour automatique des prix d'une fiche à partir de sa fiche Chogan (pur, testé).
 * Les formats gardent leur libellé et leur code ; seul le prix change. Renvoie null s'il n'y a rien à changer.
 */
import type { ChoganPreview } from "./preview";

type Volume = { label: string; price: number; code?: string | null; [k: string]: unknown };
export type PricedProduct = { publicPrice: number | null; regularPrice: number | null; volumes: unknown };
export type PriceUpdate = { publicPrice: number; regularPrice: number; volumes?: Volume[]; changes: string[] };

const key = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
/** Écart minimal pour changer un prix (arrondis du taux de change). */
const MIN_DIFF = 50;

export function priceUpdate(p: PricedProduct, preview: Pick<ChoganPreview, "publicPrice" | "regularPrice" | "volumes">): PriceUpdate | null {
  const changes: string[] = [];
  const volumes = Array.isArray(p.volumes) ? (p.volumes as Volume[]) : null;
  let nextVolumes: Volume[] | undefined;
  if (volumes?.length) {
    const fresh = new Map((preview.volumes ?? []).map((v) => [key(v.label), v.price]));
    let touched = false;
    nextVolumes = volumes.map((v) => {
      const price = fresh.get(key(v.label)) ?? (volumes.length === 1 ? preview.regularPrice : undefined);
      if (price && Math.abs(price - v.price) >= MIN_DIFF) {
        touched = true;
        changes.push(`${v.label} : ${v.price.toLocaleString("fr-FR")} → ${price.toLocaleString("fr-FR")} F`);
        return { ...v, price };
      }
      return v;
    });
    if (!touched) nextVolumes = undefined;
  }
  const regularChanged = p.regularPrice == null || Math.abs(preview.regularPrice - p.regularPrice) >= MIN_DIFF;
  const publicChanged = p.publicPrice == null || Math.abs(preview.publicPrice - p.publicPrice) >= MIN_DIFF;
  if (regularChanged && !volumes?.length) changes.push(`prix : ${(p.regularPrice ?? 0).toLocaleString("fr-FR")} → ${preview.regularPrice.toLocaleString("fr-FR")} F`);
  if (!nextVolumes && !regularChanged && !publicChanged) return null;
  return { publicPrice: preview.publicPrice, regularPrice: preview.regularPrice, ...(nextVolumes ? { volumes: nextVolumes } : {}), changes };
}
