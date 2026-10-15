export type PaymentProviderId = "cod" | "wave" | "orange_money" | "stripe";

export interface CreatePaymentInput {
  orderId: string;
  amount: number; // FCFA entier
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  description?: string;
}

export interface CreatePaymentResult {
  /** true si le client doit être redirigé */
  redirect: boolean;
  /** URL Wave / OM / Stripe Checkout */
  url?: string;
  /** Référence externe (session id) */
  externalRef?: string;
  /** Pour COD : pas de redirect */
  message?: string;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  label: string;
  description: string;
  /** false si les clés API manquent (sauf COD) */
  available: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}
