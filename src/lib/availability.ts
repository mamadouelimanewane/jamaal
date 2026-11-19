/**
 * Disponibilité à Dakar d'un produit : en stock s'il a du stock (sur au moins un de ses formats, quand il en a).
 * Les listes du site et des boutiques montrent toujours les produits disponibles en premier.
 */
export function inStockOf(stock: number, variants?: { stock: number }[] | null): boolean {
  return variants && variants.length ? variants.some((v) => v.stock > 0) : stock > 0;
}

/** Disponibles d'abord, sans changer l'ordre à l'intérieur de chaque groupe (tri stable). */
export function availableFirst<T extends { inStock?: boolean }>(list: T[]): T[] {
  return [...list.filter((p) => p.inStock !== false), ...list.filter((p) => p.inStock === false)];
}
