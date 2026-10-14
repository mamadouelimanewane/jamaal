import type { PaymentProvider, PaymentProviderId } from "./types";
import { codProvider } from "./providers/cod";
import { waveProvider } from "./providers/wave";
import { orangeMoneyProvider } from "./providers/orange-money";
import { stripeProvider } from "./providers/stripe";
import { versusProvider } from "./providers/versus";

const all: PaymentProvider[] = [codProvider, waveProvider, orangeMoneyProvider, stripeProvider, versusProvider];

type Acceptance = { acceptWave: boolean; acceptOrangeMoney: boolean; acceptCard: boolean; acceptCashOnDelivery: boolean };

/** Le moyen de paiement est-il autorisé par le modèle économique (Admin > Modèle économique) ? */
export function isPaymentAccepted(id: PaymentProviderId, model: Acceptance): boolean {
  if (id === "versus") return model.acceptWave || model.acceptOrangeMoney || model.acceptCard;
  if (id === "wave") return model.acceptWave;
  if (id === "orange_money") return model.acceptOrangeMoney;
  if (id === "stripe") return model.acceptCard;
  return model.acceptCashOnDelivery;
}

/**
 * Providers proposés au panier : autorisés dans le modèle ET configurés (clés présentes).
 * Filet de sécurité : si aucun paiement en ligne n'est encore branché, le paiement à la
 * livraison reste proposé pour ne pas bloquer les ventes ; il disparaît dès que Wave ou
 * Orange Money est configuré.
 */
export function getAvailablePaymentProviders(model: Acceptance): PaymentProvider[] {
  // Versus configuré : un seul paiement en ligne (le client choisit Wave / Orange Money / carte chez Versus).
  const online = all.filter((p) => p.id !== "cod" && p.available && isPaymentAccepted(p.id, model) && (p.id === "versus" || !versusProvider.available));
  if (online.length) return model.acceptCashOnDelivery ? [...online, codProvider] : online;
  return [codProvider];
}

/** Le paiement à la livraison est-il proposé uniquement en secours (aucun paiement en ligne branché) ? */
export function isCashFallbackActive(model: Acceptance): boolean {
  return !model.acceptCashOnDelivery && getAvailablePaymentProviders(model).every((p) => p.id === "cod");
}

/** État de chaque moyen de paiement, pour l'écran d'administration. */
export function paymentProvidersStatus(model: Acceptance) {
  return all.map((p) => ({ id: p.id, label: p.label, configured: p.available, accepted: isPaymentAccepted(p.id, model) }));
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider | undefined {
  return all.find((p) => p.id === id);
}

export type { PaymentProvider, PaymentProviderId, CreatePaymentInput, CreatePaymentResult } from "./types";
