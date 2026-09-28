import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "../types";

/**
 * Orange Money Web Payment (Sénégal)
 * Flux typique :
 *  1. OAuth client_credentials → access_token
 *  2. POST webpayment → payment_url
 *  3. Redirect client → notif_url webhook
 *
 * Env (à adapter selon le contrat Sonatel / Max It reçu) :
 *   ORANGE_MONEY_CLIENT_ID=
 *   ORANGE_MONEY_CLIENT_SECRET=
 *   ORANGE_MONEY_MERCHANT_KEY=
 *   ORANGE_MONEY_TOKEN_URL=https://api.orange.com/oauth/v3/token
 *   ORANGE_MONEY_PAYMENT_URL=...  (endpoint webpayment fourni)
 *   ORANGE_MONEY_NOTIF_URL=https://votre-domaine/api/payment/orange/webhook
 *
 * Sans clés → provider indisponible (le checkout ne le propose pas).
 */
export const orangeMoneyProvider: PaymentProvider = {
  id: "orange_money",
  label: "Orange Money",
  description: "Payez avec Orange Money (OTP SMS).",
  available: !!(
    process.env.ORANGE_MONEY_CLIENT_ID &&
    process.env.ORANGE_MONEY_CLIENT_SECRET &&
    process.env.ORANGE_MONEY_MERCHANT_KEY
  ),

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const clientId = process.env.ORANGE_MONEY_CLIENT_ID!;
    const clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET!;
    const merchantKey = process.env.ORANGE_MONEY_MERCHANT_KEY!;
    const tokenUrl =
      process.env.ORANGE_MONEY_TOKEN_URL || "https://api.orange.com/oauth/v3/token";
    const paymentUrl = process.env.ORANGE_MONEY_PAYMENT_URL;
    const notifUrl = process.env.ORANGE_MONEY_NOTIF_URL;

    if (!paymentUrl) {
      throw new Error("ORANGE_MONEY_PAYMENT_URL non configuré.");
    }

    // 1. Token OAuth
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      console.error("[orange] token error", await tokenRes.text());
      throw new Error("Authentification Orange Money échouée.");
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // 2. Initier le paiement
    const initRes = await fetch(paymentUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        merchant_key: merchantKey,
        currency: "XOF",
        order_id: input.orderId,
        amount: input.amount,
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        ...(notifUrl ? { notif_url: notifUrl } : {}),
        lang: "fr",
      }),
    });

    if (!initRes.ok) {
      console.error("[orange] payment init error", await initRes.text());
      throw new Error("Impossible d'initier le paiement Orange Money.");
    }

    const data = (await initRes.json()) as {
      payment_url?: string;
      pay_token?: string;
      notif_token?: string;
    };

    const url = data.payment_url;
    if (!url) {
      throw new Error("Réponse Orange Money invalide (pas de payment_url).");
    }

    return {
      redirect: true,
      url,
      externalRef: data.pay_token || data.notif_token || input.orderId,
    };
  },
};
