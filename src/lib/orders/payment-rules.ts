/**
 * Règle des statuts avant expédition : ils suivent le paiement.
 * - rien encaissé                 → « Non payée »  (NON_PAYEE)
 * - acompte ou paiement partiel   → « En attente » (EN_ATTENTE)
 * - payée en totalité             → « Confirmée »  (CONFIRMEE)
 * Expédiée, Livrée et Annulée ne dépendent pas de cette règle (le paiement à la livraison est encaissé
 * par le livreur à la remise du colis).
 */
import type { OrderStatus, PaymentStatus } from "@prisma/client";

export type PaymentStage = "AUCUN" | "PARTIEL" | "TOTAL";

export type PaymentFacts = {
  paymentStatus: PaymentStatus | string;
  depositPaidAt?: Date | string | null;
  installmentsPaid?: number | null;
};

/** Statuts réglés par le paiement (avant l'expédition). */
export const PAYMENT_DRIVEN: readonly OrderStatus[] = ["NON_PAYEE", "EN_ATTENTE", "CONFIRMEE"];
/** Commandes en cours (ni livrées ni annulées). */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ["NON_PAYEE", "EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NON_PAYEE: "Non payée",
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export function paymentStage(o: PaymentFacts): PaymentStage {
  if (o.paymentStatus === "PAYE") return "TOTAL";
  if (o.depositPaidAt || (o.installmentsPaid ?? 0) > 0) return "PARTIEL";
  return "AUCUN";
}

export function statusForPayment(stage: PaymentStage): "NON_PAYEE" | "EN_ATTENTE" | "CONFIRMEE" {
  return stage === "TOTAL" ? "CONFIRMEE" : stage === "PARTIEL" ? "EN_ATTENTE" : "NON_PAYEE";
}

/** Statut à appliquer après un changement de paiement (null : rien à changer). */
export function alignedStatus(o: PaymentFacts & { status: OrderStatus | string }): OrderStatus | null {
  if (!PAYMENT_DRIVEN.includes(o.status as OrderStatus)) return null;
  const want = statusForPayment(paymentStage(o));
  return want === o.status ? null : want;
}

/** Message d'erreur si le statut demandé contredit le paiement, sinon null. */
export function statusChangeError(o: PaymentFacts, target: OrderStatus): string | null {
  if (!PAYMENT_DRIVEN.includes(target)) return null;
  const stage = paymentStage(o);
  const want = statusForPayment(stage);
  if (target === want) return null;
  if (target === "CONFIRMEE") {
    return stage === "PARTIEL"
      ? "« Confirmée » exige le paiement total : seul un acompte ou une partie est encaissé, la commande reste « En attente »."
      : "« Confirmée » exige le paiement total : rien n'est encaissé, la commande reste « Non payée ».";
  }
  if (target === "EN_ATTENTE") {
    return stage === "TOTAL"
      ? "La commande est payée en totalité : son statut est « Confirmée »."
      : "« En attente » exige un acompte ou un paiement partiel : rien n'est encaissé, la commande reste « Non payée ».";
  }
  return stage === "TOTAL"
    ? "La commande est payée en totalité : son statut est « Confirmée »."
    : "Un acompte est déjà encaissé : la commande est « En attente ».";
}
