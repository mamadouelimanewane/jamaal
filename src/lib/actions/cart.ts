"use server";

import { prisma } from "@/lib/prisma";

export type CartPriceQuery = { productId: string; volumeLabel: string };
/** price = prix actuel ; null = article plus disponible à la vente. */
export type CartPrice = CartPriceQuery & { price: number | null };

/**
 * Prix actuels des articles d'un panier (même règle que createOrder) : permet au panier
 * enregistré dans le navigateur de se remettre à jour après un changement de prix.
 */
export async function getCartPrices(items: CartPriceQuery[]): Promise<CartPrice[]> {
  const list = items.slice(0, 50).filter((i) => typeof i.productId === "string" && typeof i.volumeLabel === "string");
  if (!list.length) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(list.map((i) => i.productId))] } },
    select: { id: true, regularPrice: true, testerPrice: true, volumes: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return list.map((item) => {
    const product = byId.get(item.productId);
    if (!product) return { ...item, price: null };
    const volumes = (product.volumes as { label: string; price: number }[] | null) ?? [];
    const volume = volumes.find((v) => v.label === item.volumeLabel);
    if (volume) return { ...item, price: volume.price };
    if (item.volumeLabel.toLowerCase().includes("échantillon") && product.testerPrice != null) {
      return { ...item, price: product.testerPrice };
    }
    if (!volumes.length && product.regularPrice != null) return { ...item, price: product.regularPrice };
    return { ...item, price: null };
  });
}

export type CartDiscountLine = { productId: string; volumeLabel: string; price: number; quantity: number };
export type CartDiscounts = {
  offer: { title: string; discount: number } | null;
  code: { code: string; discount: number; label: string } | { error: string } | null;
};

/**
 * Remises affichées au panier, calculées comme à la commande : offre de fêtes (coffret complet)
 * puis code promo. Les prix sont ceux du serveur, jamais ceux du navigateur.
 */
export async function previewCartDiscounts(lines: CartDiscountLine[], couponCode: string, ctx: { consultantId?: string | null } = {}): Promise<CartDiscounts> {
  const { offerDiscount, codeDiscount, resolveDiscountCode } = await import("@/lib/offers");
  const list = (Array.isArray(lines) ? lines : []).slice(0, 50);
  const prices = await getCartPrices(list.map((l) => ({ productId: String(l.productId), volumeLabel: String(l.volumeLabel) })));
  const priced = list
    .map((l, i) => ({ productId: String(l.productId), price: prices[i]?.price ?? 0, quantity: Math.max(0, Math.min(50, Math.round(Number(l.quantity) || 0))) }))
    .filter((l) => l.price > 0 && l.quantity > 0);
  let base = priced.reduce((s, l) => s + l.price * l.quantity, 0);
  const now = new Date();
  const offers = await prisma.offer.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } }, select: { id: true, title: true, productIds: true, packPrice: true } });
  const best = offerDiscount(offers, priced);
  if (best) base -= best.discount;
  let code: CartDiscounts["code"] = null;
  const typed = typeof couponCode === "string" ? couponCode.trim().slice(0, 40) : "";
  if (typed) {
    const ref = await resolveDiscountCode(typed, { consultantId: typeof ctx?.consultantId === "string" ? ctx.consultantId.slice(0, 40) || null : null });
    if (!ref) code = { error: "Code promo inconnu." };
    else if ("error" in ref) code = ref;
    else code = { code: ref.code, discount: codeDiscount(ref.kind, ref.value, base), label: ref.source === "giftcard" ? `carte cadeau (solde ${ref.value.toLocaleString("fr-FR")} FCFA, livraison comprise)` : ref.kind === "PERCENT" ? `−${ref.value} %` : `−${ref.value.toLocaleString("fr-FR")} FCFA` };
  }
  return { offer: best ? { title: best.packs > 1 ? `${best.offer.title} × ${best.packs}` : best.offer.title, discount: best.discount } : null, code };
}

/**
 * Panier en cours de commande (nom et téléphone saisis) : gardé pour une relance WhatsApp si la
 * commande n'est pas passée. Un seul panier ouvert par numéro, mis à jour à chaque changement.
 */
export async function saveCartDraft(input: { name: string; phone: string; consultantId?: string | null; lines: CartDiscountLine[] }): Promise<void> {
  const { headers } = await import("next/headers");
  const { clientIpFromHeaders, rateLimit } = await import("@/lib/rate-limit");
  const { canonicalizePhone } = await import("@/lib/phone");
  const phone = canonicalizePhone(String(input?.phone ?? ""));
  if (phone.length < 9 || phone.length > 15) return;
  const limited = await rateLimit(`cart-draft:${clientIpFromHeaders(await headers())}`, { limit: 20, windowMs: 3_600_000 });
  if (!limited.ok) return;
  const lines = (Array.isArray(input.lines) ? input.lines : []).slice(0, 30);
  const prices = await getCartPrices(lines.map((l) => ({ productId: String(l.productId), volumeLabel: String(l.volumeLabel) })));
  const products = await prisma.product.findMany({ where: { id: { in: lines.map((l) => String(l.productId)) } }, select: { id: true, name: true, slug: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = lines.flatMap((l, i) => {
    const p = byId.get(String(l.productId));
    const price = prices[i]?.price;
    const quantity = Math.max(1, Math.min(50, Math.round(Number(l.quantity) || 1)));
    return p && price ? [{ productId: p.id, name: p.name, slug: p.slug, volumeLabel: String(l.volumeLabel).slice(0, 60), price, quantity }] : [];
  });
  if (!items.length) return;
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const name = String(input.name ?? "").trim().slice(0, 120) || null;
  const consultantId = typeof input.consultantId === "string" && input.consultantId ? input.consultantId.slice(0, 40) : null;
  const open = await prisma.abandonedCart.findFirst({ where: { phone, orderedAt: null, remindedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  if (open) await prisma.abandonedCart.update({ where: { id: open.id }, data: { name, items, total, consultantId } });
  else await prisma.abandonedCart.create({ data: { phone, name, items, total, consultantId } });
}
