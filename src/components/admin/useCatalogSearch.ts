"use client";

import { useEffect, useMemo, useState } from "react";
import { catalogSlugs } from "@/lib/actions/catalog-search";
import { findProducts, type FindableProduct } from "@/lib/product-finder";

/**
 * Résultats de recherche pour une liste de produits déjà chargée : réponse immédiate dans le navigateur, puis
 * classement du moteur du site (catégories, notes, fautes de frappe) dès qu'il arrive.
 */
export function useCatalogSearch<T extends FindableProduct & { slug: string }>(products: T[], query: string, limit = 8): { results: T[]; searching: boolean } {
  const q = query.trim();
  const local = useMemo(() => findProducts(products, q, limit), [products, q, limit]);
  const [server, setServer] = useState<{ q: string; slugs: string[] } | null>(null);

  useEffect(() => {
    if (q.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      catalogSlugs(q, Math.max(limit, 40))
        .then((slugs) => alive && setServer({ q, slugs }))
        .catch(() => alive && setServer({ q, slugs: [] }));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, limit]);

  return useMemo(() => {
    if (q.length < 2) return { results: [], searching: false };
    if (!server || server.q !== q) return { results: local, searching: true };
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const ranked = server.slugs.map((s) => bySlug.get(s)).filter((p): p is T => !!p);
    // Le moteur du site d'abord ; ce que seule la recherche locale a trouvé ensuite.
    const seen = new Set(ranked.map((p) => p.slug));
    const merged = [...ranked, ...local.filter((p) => !seen.has(p.slug))];
    return { results: merged.slice(0, limit), searching: false };
  }, [q, server, local, products, limit]);
}
