/**
 * Envoi d'argent vers le wallet d'un membre (versement de commissions).
 *
 * - Wave : API « Payout » de Wave Business (clé dédiée WAVE_PAYOUT_API_KEY, distincte de la
 *   clé de paiement). Vérifier le format exact avec la documentation Wave Business lors de
 *   l'activation du compte.
 * - Orange Money : l'accès aux transferts dépend du contrat (Sonatel ou agrégateur : PayDunya,
 *   CinetPay, InTouch…). Connecteur générique : ORANGE_PAYOUT_URL + ORANGE_PAYOUT_TOKEN, à
 *   adapter au format de l'agrégateur retenu.
 *
 * Sans configuration, rien n'est envoyé : les commissions restent « à verser ».
 * Fichier serveur uniquement (jamais importé côté navigateur).
 */

export type WalletProvider = "WAVE" | "ORANGE_MONEY";
export const WALLET_LABELS: Record<WalletProvider, string> = { WAVE: "Wave", ORANGE_MONEY: "Orange Money" };

export type PayoutRequest = {
  /** Identifiant interne du versement : sert de référence et de clé d'idempotence. */
  reference: string;
  amount: number;
  mobile: string;
  name: string;
};

export type PayoutResult = { status: "VERSE" | "EN_COURS" | "ECHEC"; providerRef?: string; error?: string };

export function isWalletProvider(v: unknown): v is WalletProvider {
  return v === "WAVE" || v === "ORANGE_MONEY";
}

export function payoutProvidersConfig() {
  return {
    WAVE: !!process.env.WAVE_PAYOUT_API_KEY,
    ORANGE_MONEY: !!(process.env.ORANGE_PAYOUT_URL && process.env.ORANGE_PAYOUT_TOKEN),
  } satisfies Record<WalletProvider, boolean>;
}

/** Numéro au format international sénégalais : +221XXXXXXXXX. */
export function normalizeWalletNumber(raw: string): string | null {
  let digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length === 9) digits = `221${digits}`;
  if (!/^2217\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

async function sendWave(req: PayoutRequest): Promise<PayoutResult> {
  const res = await fetch("https://api.wave.com/v1/payout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WAVE_PAYOUT_API_KEY}`,
      "Content-Type": "application/json",
      "idempotency-key": req.reference,
    },
    body: JSON.stringify({
      currency: "XOF",
      receive_amount: String(req.amount),
      mobile: req.mobile,
      name: req.name,
      client_reference: req.reference,
      payment_reason: "Commissions JAMAAL",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; status?: string; message?: string; payout_error?: { error_code?: string; reason?: string } };
  if (!res.ok) return { status: "ECHEC", error: data.message ?? `Wave a répondu ${res.status}` };
  if (data.status === "succeeded") return { status: "VERSE", providerRef: data.id };
  if (data.status === "failed") return { status: "ECHEC", providerRef: data.id, error: data.payout_error?.reason ?? data.payout_error?.error_code ?? "Versement refusé par Wave" };
  return { status: "EN_COURS", providerRef: data.id };
}

/** Relit l'état d'un versement Wave en cours. */
export async function refreshWave(providerRef: string): Promise<PayoutResult> {
  const res = await fetch(`https://api.wave.com/v1/payout/${encodeURIComponent(providerRef)}`, {
    headers: { Authorization: `Bearer ${process.env.WAVE_PAYOUT_API_KEY}` },
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; payout_error?: { reason?: string } };
  if (!res.ok) return { status: "EN_COURS", providerRef, error: `Wave a répondu ${res.status}` };
  if (data.status === "succeeded") return { status: "VERSE", providerRef };
  if (data.status === "failed") return { status: "ECHEC", providerRef, error: data.payout_error?.reason ?? "Versement refusé par Wave" };
  return { status: "EN_COURS", providerRef };
}

async function sendOrange(req: PayoutRequest): Promise<PayoutResult> {
  const res = await fetch(process.env.ORANGE_PAYOUT_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ORANGE_PAYOUT_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": req.reference,
    },
    body: JSON.stringify({
      amount: req.amount,
      currency: "XOF",
      recipient: req.mobile,
      recipientName: req.name,
      reference: req.reference,
      description: "Commissions JAMAAL",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; reference?: string; status?: string; message?: string };
  if (!res.ok) return { status: "ECHEC", error: data.message ?? `Orange Money a répondu ${res.status}` };
  const status = String(data.status ?? "").toLowerCase();
  const ref = data.id ?? data.reference;
  if (["success", "succeeded", "successful", "completed"].includes(status)) return { status: "VERSE", providerRef: ref };
  if (["failed", "failure", "rejected", "error"].includes(status)) return { status: "ECHEC", providerRef: ref, error: data.message ?? "Versement refusé" };
  return { status: "EN_COURS", providerRef: ref };
}

export async function sendPayout(provider: WalletProvider, req: PayoutRequest): Promise<PayoutResult> {
  try {
    return provider === "WAVE" ? await sendWave(req) : await sendOrange(req);
  } catch (error) {
    return { status: "ECHEC", error: error instanceof Error ? error.message : "Erreur réseau" };
  }
}
