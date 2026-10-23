/**
 * Détection de fraude sur les commissions (pur, testé). Signaux, chacun avec un poids ; une commande est mise
 * en vérification à partir d'un poids de 2. Les cas sont signalés à l'admin AVANT tout versement.
 * - AUTO_ACHAT : le client de la commande est le vendeur lui-même (même téléphone ou e-mail).
 * - ACHAT_PARRAIN : le client est le parrain ou le grand-parrain du vendeur (il touche vendeur + parrainage).
 * - FAUX_FILLEUL : deux membres partagent le même téléphone, e-mail ou n° de pièce d'identité.
 * - CLIENT_UNIQUE : un membre dont toutes les ventes (3 au moins) vont au même client.
 * - RETOURS : 30 % ou plus des commandes d'un membre annulées, remboursées ou retournées (5 commandes au moins).
 */
export type Signal = { kind: "AUTO_ACHAT" | "ACHAT_PARRAIN" | "LIVRAISON_VENDEUR" | "FAUX_FILLEUL" | "CLIENT_UNIQUE" | "RETOURS"; weight: number; detail: string };
export const HOLD_SCORE = 2;

export const tail = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};
const mail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
const same = (a: string, b: string) => !!a && a === b;

/** Distance approximative en mètres entre deux points GPS. */
export function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Person = { id: string; name: string; whatsapp: string | null; email: string | null };
export type OrderCtx = {
  order: { customerName: string; customerPhone: string | null; customerEmail: string | null; deliveryLat: number | null; deliveryLng: number | null };
  seller: Person & { deliveryLat: number | null; deliveryLng: number | null };
  upline: Person[];
};

export function orderSignals({ order, seller, upline }: OrderCtx): Signal[] {
  const out: Signal[] = [];
  const phone = tail(order.customerPhone);
  const email = mail(order.customerEmail);
  if (same(phone, tail(seller.whatsapp)) || same(email, mail(seller.email))) {
    out.push({ kind: "AUTO_ACHAT", weight: 3, detail: `Le client (${order.customerName}) a le même ${same(phone, tail(seller.whatsapp)) ? "numéro" : "e-mail"} que le vendeur ${seller.name}.` });
  }
  for (const u of upline) {
    if (same(phone, tail(u.whatsapp)) || same(email, mail(u.email))) {
      out.push({ kind: "ACHAT_PARRAIN", weight: 3, detail: `Le client est ${u.name}, dans la lignée de parrainage du vendeur ${seller.name} : il touche à la fois la vente et le parrainage.` });
    }
  }
  if (order.deliveryLat != null && order.deliveryLng != null && seller.deliveryLat != null && seller.deliveryLng != null && meters({ lat: order.deliveryLat, lng: order.deliveryLng }, { lat: seller.deliveryLat, lng: seller.deliveryLng }) < 80 && !out.length) {
    out.push({ kind: "LIVRAISON_VENDEUR", weight: 1, detail: `Livraison à l'adresse du vendeur ${seller.name} (fréquent quand il achète pour un client : à surveiller si cela se répète).` });
  }
  return out;
}

export const score = (s: Signal[]) => s.reduce((t, x) => t + x.weight, 0);

export type MemberCtx = { id: string; name: string; whatsapp: string | null; email: string | null; idNumber: string | null; sponsorId: string | null; createdAt: Date };

/** Membres qui partagent un téléphone, un e-mail ou une pièce d'identité : le plus récent est signalé. */
export function duplicateMembers(members: MemberCtx[]): { member: MemberCtx; other: MemberCtx; field: string }[] {
  const out: { member: MemberCtx; other: MemberCtx; field: string }[] = [];
  const fields: [string, (m: MemberCtx) => string][] = [
    ["numéro WhatsApp", (m) => tail(m.whatsapp)],
    ["e-mail", (m) => mail(m.email)],
    ["n° de pièce d'identité", (m) => (m.idNumber ?? "").replace(/\s+/g, "").toUpperCase()],
  ];
  for (const [field, get] of fields) {
    const seen = new Map<string, MemberCtx>();
    for (const m of [...members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      const v = get(m);
      if (!v || v.length < 4) continue;
      const first = seen.get(v);
      if (first) out.push({ member: m, other: first, field });
      else seen.set(v, m);
    }
  }
  return out;
}

/** Membre dont toutes les ventes (3 au moins) vont au même client. */
export function singleCustomer(orders: { customerPhone: string | null }[]): string | null {
  if (orders.length < 3) return null;
  const phones = new Set(orders.map((o) => tail(o.customerPhone)));
  return phones.size === 1 && [...phones][0] ? [...phones][0] : null;
}

/** Taux de commandes annulées après paiement, remboursées ou retournées (5 commandes au moins). */
export function returnRate(orders: { cancelledAfterPay: boolean; refunded: boolean; returned: boolean }[]): number | null {
  if (orders.length < 5) return null;
  return orders.filter((o) => o.cancelledAfterPay || o.refunded || o.returned).length / orders.length;
}
export const RETURN_RATE_LIMIT = 0.3;
