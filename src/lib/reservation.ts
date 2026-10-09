/**
 * Réservation d'un produit en rupture : le client paie un acompte, JAMAAL commande chez Chogan,
 * puis le client règle le solde à l'arrivée du produit. Pur (utilisable partout).
 */

export interface ReservationSettings {
  enabled: boolean;
  /** Part du prix des produits payée à la réservation (en %). */
  depositPercent: number;
  /** Délai annoncé au client. */
  delayLabel: string;
  /** L'acompte est-il remboursé si le client annule avant l'arrivée du produit ? */
  refundable: boolean;
}

export const DEFAULT_RESERVATION: ReservationSettings = {
  enabled: true,
  depositPercent: 30,
  delayLabel: "15 à 21 jours",
  refundable: true,
};

export function normalizeReservation(raw: unknown): ReservationSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pct = Math.round(Number(r.depositPercent));
  const delay = typeof r.delayLabel === "string" ? r.delayLabel.trim().slice(0, 60) : "";
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_RESERVATION.enabled,
    depositPercent: Number.isFinite(pct) && pct >= 10 && pct <= 100 ? pct : DEFAULT_RESERVATION.depositPercent,
    delayLabel: delay || DEFAULT_RESERVATION.delayLabel,
    refundable: typeof r.refundable === "boolean" ? r.refundable : DEFAULT_RESERVATION.refundable,
  };
}

/** Acompte sur le prix des produits, arrondi à la centaine supérieure (jamais plus que le prix). */
export function depositFor(productsTotal: number, percent: number): number {
  if (productsTotal <= 0) return 0;
  return Math.min(productsTotal, Math.ceil((productsTotal * percent) / 100 / 100) * 100);
}

export type ReservationStatus = "ACOMPTE_ATTENDU" | "RESERVEE" | "DISPONIBLE" | "SOLDEE" | "ANNULEE";

export const RESERVATION_LABELS: Record<ReservationStatus, string> = {
  ACOMPTE_ATTENDU: "Acompte attendu",
  RESERVEE: "Réservée (acompte payé)",
  DISPONIBLE: "Arrivée, solde à régler",
  SOLDEE: "Soldée",
  ANNULEE: "Annulée",
};

export interface PayableOrder {
  total: number;
  isReservation: boolean;
  depositAmount: number;
  depositPaidAt: Date | string | null;
  reservationStatus: string | null;
}

/**
 * Montant à encaisser maintenant : l'acompte tant qu'il n'est pas payé, puis le solde
 * (seulement une fois le produit arrivé). Null : rien à payer pour l'instant.
 */
export function amountDue(o: PayableOrder): { amount: number; part: "ACOMPTE" | "SOLDE" | "TOTAL" } | null {
  if (!o.isReservation) return { amount: o.total, part: "TOTAL" };
  if (o.reservationStatus === "ANNULEE" || o.reservationStatus === "SOLDEE") return null;
  if (!o.depositPaidAt) return { amount: o.depositAmount, part: "ACOMPTE" };
  if (o.reservationStatus !== "DISPONIBLE") return null;
  return { amount: Math.max(0, o.total - o.depositAmount), part: "SOLDE" };
}

/** Reste à payer à la remise du colis (paiement à la livraison). */
export function balanceOf(o: Pick<PayableOrder, "total" | "isReservation" | "depositAmount" | "depositPaidAt">): number {
  return o.isReservation && o.depositPaidAt ? Math.max(0, o.total - o.depositAmount) : o.total;
}

/** Message WhatsApp « votre produit est arrivé » et lien wa.me prérempli pour l'envoyer à la main. */
export function arrivalMessage(o: {
  id: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  depositAmount: number;
  deliveryMode: string;
  product: string;
}, baseUrl: string, price: (n: number) => string): { text: string; url: string | null } {
  const balance = Math.max(0, o.total - o.depositAmount);
  const text =
    `Bonjour ${o.customerName}, bonne nouvelle : votre ${o.product} réservé chez JAMAAL est arrivé ! ` +
    `Reste à régler : ${price(balance)}. Payez en ligne ici : ${baseUrl.replace(/\/$/, "")}/commande/${o.id}` +
    (o.deliveryMode === "LIVRAISON_JAMAAL" ? " ou à la livraison." : ", ou au retrait.") +
    " Merci de votre confiance.";
  const digits = (o.customerPhone ?? "").replace(/\D/g, "").replace(/^00/, "");
  const phone = digits.length === 9 ? `221${digits}` : digits;
  return { text, url: phone.length >= 8 ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null };
}
