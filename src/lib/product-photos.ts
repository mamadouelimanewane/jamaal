/**
 * Liste ordonnée des photos d'une fiche produit, telle qu'envoyée par le formulaire (champ caché
 * « photos », JSON). La première est la photo principale, les suivantes la galerie. Seules des
 * adresses https ou des chemins du site (/produits/…) sont acceptées. Pur.
 */
export const MAX_PRODUCT_PHOTOS = 12;

export function isAcceptablePhotoUrl(s: string): boolean {
  if (s.startsWith("/") && !s.startsWith("//")) return /^\/[\w\-./%]+$/.test(s) && !s.includes("..");
  try {
    const u = new URL(s);
    return u.protocol === "https:" && s.length <= 1000;
  } catch {
    return false;
  }
}

export function parsePhotoList(raw: FormDataEntryValue | null): { photo: string | null; gallery: string[] } | null {
  if (raw === null) return null; // champ absent : ancien formulaire, on ne touche pas aux photos
  let list: unknown;
  try {
    list = JSON.parse(String(raw) || "[]");
  } catch {
    throw new Error("Liste de photos illisible.");
  }
  if (!Array.isArray(list)) throw new Error("Liste de photos illisible.");
  const clean = [...new Set(list.map((x) => String(x ?? "").trim()).filter(Boolean))];
  const bad = clean.find((u) => !isAcceptablePhotoUrl(u));
  if (bad) throw new Error(`Adresse de photo refusée : ${bad.slice(0, 80)}`);
  if (clean.length > MAX_PRODUCT_PHOTOS) throw new Error(`${MAX_PRODUCT_PHOTOS} photos au plus par fiche.`);
  return { photo: clean[0] ?? null, gallery: clean.slice(1) };
}
