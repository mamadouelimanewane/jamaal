/**
 * Catalogue vu par le revendeur (Produits, Mon marketing, kit) : tous les produits, avec leur catégorie
 * lisible et leur prix de départ, pour la recherche et le partage. Fichier serveur.
 */
import { prisma } from "./prisma";
import { getCategories } from "./db-categories";
import { getBusinessModel } from "./business-model-store";
import { commissionRatesFor, type Scenario } from "./business-model";
import { withSpecialRates } from "./special-terms";
import { depthFromLoaded, effectiveTitle } from "./network";

export type ResellerProduct = {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  price: number | null;
  choganCode: string | null;
  inspiredBy: string | null;
  inspiredBrand: string | null;
  category: string;
  categoryLabel: string;
  family: string | null;
  shortDescription: string | null;
  /** Plusieurs formats (30 ml, 70 ml…) : le prix affiché est « à partir de ». */
  multiFormat: boolean;
};

/** Prix de départ : le plus petit prix de format, sinon le prix du produit. Pur, testé. */
export function startingPrice(regularPrice: number | null, volumes: unknown): number | null {
  const list = Array.isArray(volumes) ? (volumes as { price?: unknown }[]).map((v) => Number(v?.price)).filter((n) => Number.isFinite(n) && n > 0) : [];
  if (list.length) return Math.min(...list);
  return regularPrice && regularPrice > 0 ? regularPrice : null;
}

export async function resellerCatalog(): Promise<ResellerProduct[]> {
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, slug: true, name: true, photo: true, regularPrice: true, volumes: true, choganCode: true, inspiredBy: true, inspiredBrand: true, category: true, family: true, shortDescription: true },
      orderBy: { name: "asc" },
    }),
    getCategories(),
  ]);
  const labels = new Map(categories.map((c) => [c.slug as string, (c.navLabel || c.label).replace("JAMAAL ", "")]));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    photo: r.photo,
    price: startingPrice(r.regularPrice, r.volumes),
    choganCode: r.choganCode,
    inspiredBy: r.inspiredBy,
    inspiredBrand: r.inspiredBrand,
    category: r.category,
    categoryLabel: labels.get(r.category) ?? r.category,
    family: r.family,
    shortDescription: r.shortDescription,
    multiFormat: Array.isArray(r.volumes) && r.volumes.length > 1,
  }));
}

/** Cas de vente du revendeur (selon son rang et sa chaîne) et sa commission sur ses propres ventes (%). */
export async function myCommissionCase(consultantId: string): Promise<{ rate: number; scenario: Scenario }> {
  const [c, model] = await Promise.all([
    prisma.consultant.findUnique({ where: { id: consultantId }, select: { rank: true, sponsorId: true, specialTerms: true, sponsor: { select: { sponsorId: true } } } }),
    getBusinessModel(),
  ]);
  const r = withSpecialRates(commissionRatesFor(c ? effectiveTitle(c.rank, depthFromLoaded(c)) : "Consultant", !!c?.sponsor?.sponsorId, model), c?.specialTerms);
  return { rate: r.seller, scenario: r.scenario };
}

export const mySellerRate = async (consultantId: string) => (await myCommissionCase(consultantId)).rate;
