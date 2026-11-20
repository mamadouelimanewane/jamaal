import type { PaymentProvider } from "../types";
import { payViaVersus, versusConfigured } from "../versus";

/**
 * Le contrat Kwingo 2 / Orange Money Sénégal doit être intégré après validation de ses
 * endpoints, signatures et recherches de statut. Les anciens paramètres génériques
 * ORANGE_MONEY_* ne prouvent pas qu'un paiement a été reçu et ne doivent pas activer le checkout.
 * Le mode Orange via Versus reste utilisable, car le paiement est vérifié côté serveur chez Versus.
 */
export const orangeMoneyProvider: PaymentProvider = {
  id: "orange_money",
  label: "Orange Money",
  description: versusConfigured()
    ? "Paiement Orange Money vérifié par Versus."
    : "Orange Money sera proposé après validation de l’intégration officielle.",
  available: versusConfigured(),

  async createPayment(input) {
    if (versusConfigured()) return payViaVersus(input, "orange_money");
    throw new Error("Orange Money n’est pas activé : l’intégration Kwingo 2 doit être validée.");
  },
};
