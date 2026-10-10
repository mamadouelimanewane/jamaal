/**
 * Index de recherche du catalogue, en mémoire et toujours à jour : chaque recherche vérifie
 * d'abord une empreinte de la base (au plus une fois par seconde) et reconstruit l'index si
 * un produit, un format ou une collection a changé.
 */
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { getCategories } from "./db-categories";
import { createVersionedCache } from "./search-cache";
import { prepare, search, suggest, brandFacets, categoryFacets, type SearchDoc } from "./search-engine";

async function load() {
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, slug: true, name: true, choganCode: true, number: true, inspiredBy: true, inspiredBrand: true,
        category: true, family: true, topNotes: true, heartNotes: true, baseNotes: true, regularPrice: true,
        volumes: true, testerPrice: true, photo: true, colorFrom: true, colorTo: true, reviewCount: true, badge: true,
        shortDescription: true, longDescription: true, variants: { select: { volumeLabel: true } },
      },
    }),
    getCategories(),
  ]);
  const labels = new Map(categories.map((c) => [c.slug as string, c.navLabel.replace("JAMAAL ", "")]));
  const docs: SearchDoc[] = rows.map((r) => {
    const volumes = (r.volumes as { label?: string; price?: number }[] | null) ?? [];
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
      description: [r.shortDescription, ...r.longDescription].join(" "),
      volumes: [...volumes.map((v) => v.label ?? ""), ...r.variants.map((v) => v.volumeLabel)].filter(Boolean),
      price: prices.length ? Math.min(...prices) : null,
      photo: r.photo,
      colorFrom: r.colorFrom,
      colorTo: r.colorTo,
      popularity: r.reviewCount + (r.badge === "bestseller" ? 30 : 0) + (r.inspiredBy ? 5 : 0),
    };
  });
  return prepare(docs);
}

/** Empreinte de la base : change dès qu'un produit, un format ou une collection change (≈ 2 ms). */
async function version() {
  // Empreinte de toutes les lignes (et pas seulement de la date la plus récente) : insensible aux
  // horloges décalées entre scripts SQL et application.
  const [rows, cats] = await Promise.all([
    prisma.$queryRaw<{ p: string | null; v: string | null }[]>`
      SELECT
        (SELECT md5(string_agg("id" || ':' || "updatedAt"::text, ',' ORDER BY "id")) FROM "Product") AS p,
        (SELECT md5(string_agg("productId" || ':' || "volumeLabel", ',' ORDER BY "id")) FROM "ProductVariant") AS v`,
    prisma.category.findMany({ select: { slug: true, navLabel: true }, orderBy: { slug: "asc" } }),
  ]);
  const catHash = createHash("sha1").update(JSON.stringify(cats)).digest("hex").slice(0, 10);
  return `${rows[0]?.p ?? "0"}:${rows[0]?.v ?? "0"}:${catHash}`;
}

const cache = createVersionedCache({ load, version, checkEveryMs: 1000 });

export function getSearchIndex() {
  return cache.get();
}

/** À appeler après une modification du catalogue (prise en compte immédiate sur cette instance). */
export function invalidateSearchIndex() {
  cache.invalidate();
}

import { expandQueryWithAI } from "./search-ai";

export async function searchCatalog(query: string, limit = 60) {
  const index = await getSearchIndex();
  let q = query.trim().slice(0, 80);
  let corrected: string | null = null;
  let res = search(index, q, limit);

  // Étape 1 : correction orthographique classique
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

  // Étape 2 : expansion IA si la requête ressemble à du langage naturel (> 2 mots, peu de résultats)
  // On n'appelle l'IA que si c'est une vraie phrase naturelle, pas un simple code ou nom de marque
  const isNaturalLanguage = q.split(" ").length >= 3 || (res.total < 3 && q.split(" ").length >= 2);
  if (isNaturalLanguage && res.total < 5 && process.env.GOOGLE_AI_API_KEY) {
    const expansion = await expandQueryWithAI(q).catch(() => null);
    if (expansion?.keywords?.length) {
      const aiQuery = expansion.keywords.join(" ");
      const aiRes = search(index, aiQuery, limit);
      if (aiRes.total > res.total) {
        res = aiRes;
        corrected = expansion.corrected || q;
        q = aiQuery;
      }
    }
  }

  return { query: q, corrected, hits: res.hits, total: res.total, brands: brandFacets(res.hits), categories: categoryFacets(res.hits) };
}

