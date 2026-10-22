"use server";

import { auth } from "@/lib/auth";
import { searchCatalog } from "@/lib/search-index";

/**
 * Recherche du catalogue pour les champs de l'espace membre (Produits, Mon marketing, kit…) : même moteur
 * que la recherche du site (nom, code Chogan, catégorie, notes, parfum d'inspiration, fautes de frappe).
 * Renvoie les identifiants (slugs) dans l'ordre de pertinence.
 */
export async function catalogSlugs(query: string, limit = 60): Promise<string[]> {
  const session = await auth();
  if (!session?.user) return [];
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  try {
    const r = await searchCatalog(q, Math.min(Math.max(1, limit), 200));
    return r.hits.map((h) => h.doc.slug);
  } catch {
    return [];
  }
}
