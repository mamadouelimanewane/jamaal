import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "../types";

/**
 * Wave Business Checkout API
 * Docs: https://docs.wave.com/checkout
 * POST https://api.wave.com/v1/checkout/sessions
 *
 * Env:
 *   WAVE_API_KEY=secret_xxx
 *   WAVE_API_BASE=https://api.wave.com/v1  (prod)
 */
export const waveProvider: PaymentProvider = {
  id: "wave",
  label: "Wave",
  description: "Payez avec votre compte Wave (recommandé au Sénégal).",
  available: !!process.env.WAVE_API_KEY,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const apiKey = process.env.WAVE_API_KEY;
    const base = process.env.WAVE_API_BASE || "https://api.wave.com/v1";

    if (!apiKey) {
      throw new Error("Wave n'est pas configuré (WAVE_API_KEY manquant).");
    }

    const res = await fetch(`${base}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(input.amount),
        currency: "XOF",
        success_url: input.successUrl,
        error_url: input.cancelUrl,
        client_reference: input.orderId,
        ...(input.customerPhone
          ? { restrict_payer_mobile: normalizeSnPhone(input.customerPhone) }
          : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[wave] checkout error", res.status, body);
      throw new Error("Impossible d'initier le paiement Wave. Réessayez.");
    }

    const data = (await res.json()) as {
      id: string;
      wave_launch_url: string;
    };

    return {
      redirect: true,
      url: data.wave_launch_url,
      externalRef: data.id,
    };
  },
};

function normalizeSnPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("221") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 9) return `+221${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+221${digits.slice(1)}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}
