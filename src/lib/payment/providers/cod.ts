import type { PaymentProvider, CreatePaymentResult } from "../types";

/** Paiement à la livraison ou chez le consultant — toujours disponible. */
export const codProvider: PaymentProvider = {
  id: "cod",
  label: "Paiement à la livraison",
  description: "Réglez en espèces ou mobile money auprès du livreur / consultant.",
  available: true,

  async createPayment(): Promise<CreatePaymentResult> {
    return {
      redirect: false,
      message: "Commande enregistrée. Le règlement se fera à la livraison.",
    };
  },
};
