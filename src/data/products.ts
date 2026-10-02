import { Product, CategorySlug } from "./types";
import choganRaw from "./chogan-catalog.json";

// Catalogue 100 % Chogan (voir scripts/import-chogan.mjs). Il alimente le seed de la base ;
// le site lit ensuite les produits en base (modifiables depuis le back-office).
export const products: Product[] = choganRaw as Product[];

export function getProductsByCategory(category: CategorySlug | string): Product[] {
  return products.filter((p) => p.category === category);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getBestsellers(category?: string, count = 3): Product[] {
  const pool = category ? getProductsByCategory(category) : products;
  return [...pool].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, count);
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.number !== undefined && `n°${p.number}` === q) return true;
    if (p.number !== undefined && String(p.number) === q.replace(/\D/g, "")) return true;
    return false;
  });
}
