/**
 * Prix « à partir de » d'un produit. JAMAAL ne vend pas les parfums de 15 ml : le prix d'appel est celui du plus
 * petit format vendu (25 ml / 30 ml, ex. 14 800 F). Les formats de moins de 25 ml et les recharges sont ignorés,
 * sauf si le produit n'existe que dans ces formats. Pur : utilisable côté serveur et navigateur.
 */
type Vol = { label?: unknown; price?: unknown };

/** Plus petit format vendu (ml). */
export const MIN_SOLD_ML = 25;

const mlOf = (label: unknown) => {
  if (typeof label !== "string") return null;
  const m = label.match(/(\d+(?:[.,]\d+)?)\s*ml/i);
  return m ? Number(m[1].replace(",", ".")) : null;
};
export const isRefill = (label: unknown) => typeof label === "string" && /recharge|refill|ricarica/i.test(label);
/** Format non vendu par JAMAAL : moins de 25 ml, ou recharge. */
export const isUnsoldFormat = (label: unknown) => {
  const ml = mlOf(label);
  return isRefill(label) || (ml !== null && ml < MIN_SOLD_ML);
};

export function startingPrice(regularPrice: number | null | undefined, volumes: unknown): number | null {
  const list = (Array.isArray(volumes) ? (volumes as Vol[]) : [])
    .map((v) => ({ unsold: isUnsoldFormat(v?.label), price: Number(v?.price) }))
    .filter((v) => Number.isFinite(v.price) && v.price > 0);
  const sold = list.filter((v) => !v.unsold);
  const pool = sold.length ? sold : list;
  if (pool.length) return Math.min(...pool.map((v) => v.price));
  return regularPrice && regularPrice > 0 ? regularPrice : null;
}
