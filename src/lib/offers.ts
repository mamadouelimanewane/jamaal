/**
 * Offres de fêtes (coffrets à prix spécial) : calcul pur de la remise d'un panier.
 * Un coffret s'applique quand le panier contient au moins une unité de chacun de ses produits ;
 * il compte autant de fois que le produit le moins présent. La valeur d'un produit est son format
 * le moins cher du panier. Une seule offre (la plus avantageuse) par commande.
 */
export interface OfferRule {
  id: string;
  title: string;
  productIds: string[];
  packPrice: number;
}

export interface CartLine {
  productId: string;
  price: number;
  quantity: number;
}

export function offerDiscount(offers: OfferRule[], lines: CartLine[]): { offer: OfferRule; packs: number; discount: number } | null {
  let best: { offer: OfferRule; packs: number; discount: number } | null = null;
  for (const offer of offers) {
    const ids = [...new Set(offer.productIds)];
    if (ids.length < 1 || offer.packPrice <= 0) continue;
    let packs = Infinity;
    let packValue = 0;
    for (const id of ids) {
      const mine = lines.filter((l) => l.productId === id && l.quantity > 0);
      if (!mine.length) {
        packs = 0;
        break;
      }
      packs = Math.min(packs, mine.reduce((s, l) => s + l.quantity, 0));
      packValue += Math.min(...mine.map((l) => l.price));
    }
    if (!packs || !Number.isFinite(packs)) continue;
    const per = packValue - offer.packPrice;
    if (per <= 0) continue;
    const discount = per * packs;
    if (!best || discount > best.discount) best = { offer, packs, discount };
  }
  return best;
}

/** Valeur « à l'unité » d'un coffret (somme du format le moins cher de chaque produit). */
export function packValue(products: { id: string; minPrice: number }[], productIds: string[]): number {
  return [...new Set(productIds)].reduce((s, id) => s + (products.find((p) => p.id === id)?.minPrice ?? 0), 0);
}

/** Remise d'un code sur un montant (pur) : pourcentage (1 à 90 %) ou montant fixe, jamais plus que le montant. */
export function codeDiscount(kind: "PERCENT" | "FIXED", value: number, base: number): number {
  if (base <= 0 || value <= 0) return 0;
  const raw = kind === "PERCENT" ? Math.round((base * Math.min(90, value)) / 100) : value;
  return Math.max(0, Math.min(base, raw));
}

export type DiscountCodeRef =
  | { source: "coupon"; id: string; code: string; kind: "PERCENT" | "FIXED"; value: number; consultantId: null }
  | { source: "promo"; id: string; code: string; kind: "PERCENT"; value: number; consultantId: string }
  | { error: string };

/**
 * Code saisi au panier : code JAMAAL (Admin > Codes promo, codes anniversaire) ou code d'un
 * revendeur (Mon marketing). Vérifie activité, date d'expiration et nombre d'utilisations.
 */
export async function resolveDiscountCode(raw: string): Promise<DiscountCodeRef | null> {
  const { prisma } = await import("@/lib/prisma");
  const code = raw.trim().toUpperCase().slice(0, 40);
  if (!code) return null;
  const now = Date.now();
  const coupon = await prisma.coupon.findFirst({ where: { code: { equals: code, mode: "insensitive" } } });
  if (coupon) {
    if (!coupon.active) return { error: "Ce code n'est plus actif." };
    if (coupon.expiresAt && coupon.expiresAt.getTime() < now) return { error: "Ce code a expiré." };
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { error: "Ce code a déjà été utilisé." };
    return { source: "coupon", id: coupon.id, code: coupon.code, kind: coupon.type === "POURCENTAGE" ? "PERCENT" : "FIXED", value: coupon.value, consultantId: null };
  }
  const promo = await prisma.promoCode.findFirst({ where: { code: { equals: code, mode: "insensitive" } }, include: { consultant: { select: { active: true } } } });
  if (promo) {
    if (!promo.consultant.active) return { error: "Ce code n'est plus actif." };
    if (promo.expiresAt && promo.expiresAt.getTime() < now) return { error: "Ce code a expiré." };
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return { error: "Ce code a atteint son nombre d'utilisations." };
    return { source: "promo", id: promo.id, code: promo.code, kind: "PERCENT", value: promo.discountPct, consultantId: promo.consultantId };
  }
  return null;
}
