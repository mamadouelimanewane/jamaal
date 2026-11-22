/** Code revendeur accepté dans l'adresse du catalogue Meta (même format que ?ref= sur le site). */
export const cleanRef = (ref: string | null | undefined): string | null => {
  const r = (ref ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{2,48}$/.test(r) ? r : null;
};

/**
 * Lien d'un produit dans le catalogue Meta. Catalogue personnel d'un revendeur (?ref=…) : chaque lien porte son code,
 * la vente lui est attribuée, et la visite est comptée comme venant de Facebook dans ses statistiques.
 */
export function catalogProductLink(base: string, productSlug: string, ref: string | null): string {
  const url = `${base.replace(/\/$/, "")}/produits/${productSlug}`;
  if (!ref) return url;
  const q = new URLSearchParams({ ref, utm_source: "facebook", utm_medium: "paid", utm_campaign: "catalogue-revendeur" });
  return `${url}?${q.toString()}`;
}

/** Adresse du catalogue personnel d'un revendeur, à coller dans son Commerce Manager. */
export const resellerCatalogUrl = (origin: string, slug: string) => `${origin.replace(/\/$/, "")}/api/meta/catalog?ref=${encodeURIComponent(slug)}`;
