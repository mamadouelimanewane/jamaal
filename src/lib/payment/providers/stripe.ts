import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "../types";

/**
 * Stripe Checkout (cartes internationales / diaspora).
 * Montants en FCFA : Stripe gère XOF selon le compte.
 *
 * Env:
 *   STRIPE_SECRET_KEY=sk_...
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...  (si Elements plus tard)
 *
 * Dépendance : npm install stripe
 */
export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Carte bancaire",
  description: "Visa, Mastercard (Stripe).",
  available: !!process.env.STRIPE_SECRET_KEY,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe n'est pas configuré.");

    // Import dynamique pour ne pas casser le build si stripe n'est pas installé
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret, { apiVersion: "2025-02-24.acacia" as never });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail || undefined,
      client_reference_id: input.orderId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "xof",
            unit_amount: input.amount, // XOF zero-decimal
            product_data: {
              name: input.description || `Commande JAMAAL ${input.orderId.slice(-8)}`,
            },
          },
        },
      ],
      metadata: { orderId: input.orderId },
    });

    if (!session.url) throw new Error("Session Stripe sans URL.");

    return {
      redirect: true,
      url: session.url,
      externalRef: session.id,
    };
  },
};
