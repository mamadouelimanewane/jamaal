import type { PaymentProvider, PaymentProviderId } from "./types";
import { codProvider } from "./providers/cod";
import { waveProvider } from "./providers/wave";
import { orangeMoneyProvider } from "./providers/orange-money";
import { stripeProvider } from "./providers/stripe";

const all: PaymentProvider[] = [codProvider, waveProvider, orangeMoneyProvider, stripeProvider];

type Acceptance = { acceptWave: boolean; acceptOrangeMoney: boolean; acceptCard: boolean; acceptCashOnDelivery: boolean };

/** Le moyen de paiement est-il autorisé par le modèle économique (Admin > Modèle économique) ? */
export function isPaymentAccepted(id: PaymentProviderId, model: Acceptance): boolean {
  if (id === "wave") return model.acceptWave;
  if (id === "orange_money") return model.acceptOrangeMoney;
  if (id === "stripe") return model.acceptCard;
  return model.acceptCashOnDelivery;
}

/**
 * Providers proposés au panier : autorisés dans le modèle ET configurés (clés présentes).
 * Le paiement à la livraison n'est proposé que si l'administrateur l'a explicitement activé
 * pour les cas spéciaux. Un moyen de paiement en ligne non configuré n'est jamais proposé.
 */
export function getAvailablePaymentProviders(model: Acceptance): PaymentProvider[] {
  const online = all.filter((p) => p.id !== "cod" && p.available && isPaymentAccepted(p.id, model));
  if (online.length) return model.acceptCashOnDelivery ? [...online, codProvider] : online;
  return model.acceptCashOnDelivery ? [codProvider] : [];
}

/** Le paiement à la livraison a-t-il été activé explicitement, sans autre option en ligne ? */
export function isCashFallbackActive(model: Acceptance): boolean {
  return model.acceptCashOnDelivery && getAvailablePaymentProviders(model).every((p) => p.id === "cod");
}

/** État de chaque moyen de paiement, pour l'écran d'administration. */
export function paymentProvidersStatus(model: Acceptance) {
  return all.map((p) => ({ id: p.id, label: p.label, configured: p.available, accepted: isPaymentAccepted(p.id, model) }));
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider | undefined {
  return all.find((p) => p.id === id);
}

export type { PaymentProvider, PaymentProviderId, CreatePaymentInput, CreatePaymentResult } from "./types";
