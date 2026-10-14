import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "../types";
import { payViaVersus, versusConfigured } from "../versus";

/**
 * Paiement en ligne via Versus Business : un seul bouton au panier. Le client choisit Wave,
 * Orange Money ou carte bancaire sur la page de paiement sécurisée de Versus.
 */
export const versusProvider: PaymentProvider = {
  id: "versus",
  label: "Wave, Orange Money ou carte",
  description: "Vous choisissez votre moyen de paiement sur la page sécurisée.",
  available: versusConfigured(),

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return payViaVersus(input, "choice");
  },
};
