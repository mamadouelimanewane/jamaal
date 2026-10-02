import { Product, CategorySlug } from "./types";
import { demoProducts } from "./demo-catalog";
import officialRaw from "./official-catalog.json";
import choganRaw from "./chogan-catalog.json";

const officialProducts = [...(officialRaw as Product[]), ...(choganRaw as Product[])];

// Pour chaque catégorie : si l'import officiel contient des produits, on les
// utilise ; sinon on garde le catalogue de démonstration le temps que le
// catalogue officiel soit complété (voir import/README.md).
const officialCategories = new Set(officialProducts.map((p) => p.category));

export const products: Product[] = [
  ...officialProducts,
  ...demoProducts.filter((p) => !officialCategories.has(p.category)),
];

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
