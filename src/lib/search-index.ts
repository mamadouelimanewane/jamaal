/**
 * Index de recherche du catalogue, gardé en mémoire 5 minutes (≈ 600 produits : la recherche
 * se fait sans requête SQL à chaque frappe).
 */
import { prisma } from "./prisma";
import { getCategories } from "./db-categories";
import { prepare, search, suggest, brandFacets, categoryFacets, type SearchDoc } from "./search-engine";

type Index = ReturnType<typeof prepare>;
let cache: { at: number; index: Index } | null = null;
let loading: Promise<Index> | null = null;
const TTL = 5 * 60_000;

async function load(): Promise<Index> {
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, slug: true, name: true, choganCode: true, number: true, inspiredBy: true, inspiredBrand: true,
        category: true, family: true, topNotes: true, heartNotes: true, baseNotes: true, regularPrice: true,
        volumes: true, testerPrice: true, photo: true, colorFrom: true, colorTo: true, reviewCount: true, badge: true,
      },
    }),
    getCategories(),
  ]);
  const labels = new Map(categories.map((c) => [c.slug as string, c.navLabel.replace("JAMAAL ", "")]));
  const docs: SearchDoc[] = rows.map((r) => {
    const volumes = (r.volumes as { price: number }[] | null) ?? [];
    const prices = [r.regularPrice, ...volumes.map((v) => v.price)].filter((p): p is number => typeof p === "number" && p > 0);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      choganCode: r.choganCode,
      number: r.number,
      inspiredBy: r.inspiredBy,
      inspiredBrand: r.inspiredBrand,
      category: r.category,
      categoryLabel: labels.get(r.category) ?? r.category,
      family: r.family,
      notes: [...r.topNotes, ...r.heartNotes, ...r.baseNotes],
      price: prices.length ? Math.min(...prices) : null,
      photo: r.photo,
      colorFrom: r.colorFrom,
      colorTo: r.colorTo,
      popularity: r.reviewCount + (r.badge === "bestseller" ? 30 : 0) + (r.inspiredBy ? 5 : 0),
    };
  });
  return prepare(docs);
}

export async function getSearchIndex(): Promise<Index> {
  if (cache && Date.now() - cache.at < TTL) return cache.index;
  loading ??= load()
    .then((index) => {
      cache = { at: Date.now(), index };
      return index;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function searchCatalog(query: string, limit = 60) {
  const index = await getSearchIndex();
  let q = query.trim().slice(0, 80);
  let corrected: string | null = null;
  let res = search(index, q, limit);
  if (!res.total) {
    const s = suggest(index, q);
    if (s) {
      const alt = search(index, s, limit);
      if (alt.total) {
        corrected = s;
        q = s;
        res = alt;
      }
    }
  }
  return { query: q, corrected, hits: res.hits, total: res.total, brands: brandFacets(res.hits), categories: categoryFacets(res.hits) };
}
