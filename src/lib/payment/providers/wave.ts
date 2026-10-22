import type { PaymentProvider, CreatePaymentInput, CreatePaymentResult } from "../types";
import { payViaVersus, versusConfigured } from "../versus";
import { explainWaveError } from "../wave-errors";
import { prisma } from "@/lib/prisma";

/**
 * Wave Business Checkout API
 * Docs: https://docs.wave.com/checkout
 * POST https://api.wave.com/v1/checkout/sessions
 *
 * Env:
 *   WAVE_API_KEY=wave_sn_prod_xxx   (Wave Business > Développeurs > Clés API, accès « Checkout »)
 *   WAVE_WEBHOOK_SECRET=wave_sn_WHS_xxx (secret du webhook /api/payment/wave/webhook)
 *   WAVE_API_BASE=https://api.wave.com/v1  (facultatif)
 *   PAYMENT_GATEWAY=direct  (met Versus en pause : Wave passe par cette intégration directe)
 */
export const waveProvider: PaymentProvider = {
  id: "wave",
  label: "Wave",
  description: "Payez avec votre compte Wave (recommandé au Sénégal).",
  available: !!process.env.WAVE_API_KEY || versusConfigured(),

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Versus (si configuré) : ouverture directe de Wave avec le montant et le numéro déjà saisi.
    if (versusConfigured()) return payViaVersus(input, "wave");
    const apiKey = process.env.WAVE_API_KEY?.trim();
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
        // Pas de restrict_payer_mobile : le client peut payer depuis n'importe quel compte Wave
        // (souvent le téléphone d'un proche) ; la commande est identifiée par client_reference.
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[wave] checkout error", res.status, body);
      const info = explainWaveError(res.status, body);
      // Dernière erreur gardée pour l'administrateur (Admin › Versements › Tester Wave).
      const value = JSON.stringify({ ...info, at: new Date().toISOString() });
      await prisma.setting.upsert({ where: { key: "wave_last_error" }, create: { key: "wave_last_error", value }, update: { value } }).catch(() => {});
      throw new Error(`Impossible d'initier le paiement Wave (code ${info.code}). Réessayez ou choisissez un autre moyen de paiement.`);
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

