/**
 * Envoi d'argent vers le wallet d'un membre (versement de commissions).
 *
 * - Wave : API « Payout » de Wave Business. Clé WAVE_PAYOUT_API_KEY, ou à défaut la clé de paiement
 *   WAVE_API_KEY si l'accès « Payout » y a été coché dans Wave Business > Développeurs.
 * - Orange Money : l'accès aux transferts dépend du contrat (Sonatel ou agrégateur : PayDunya,
 *   CinetPay, InTouch…). Connecteur générique : ORANGE_PAYOUT_URL + ORANGE_PAYOUT_TOKEN, à
 *   adapter au format de l'agrégateur retenu.
 *
 * Sans configuration, rien n'est envoyé : les retraits restent en attente (versement à la main).
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

/**
 * VERSE : argent reçu. EN_COURS : accepté, à relire. ECHEC : refusé pour ce destinataire (le montant revient au membre).
 * BLOQUE : rien n'a été envoyé à cause du compte JAMAAL (clé sans accès « Payout », solde Wave Business insuffisant…) :
 * la demande reste en attente et sera renvoyée automatiquement.
 */
export type PayoutResult = { status: "VERSE" | "EN_COURS" | "ECHEC" | "BLOQUE"; providerRef?: string; error?: string };

/** Clé Wave des versements : la clé dédiée WAVE_PAYOUT_API_KEY, sinon la clé de paiement si elle a aussi l'accès « Payout ». */
const waveKey = () => process.env.WAVE_PAYOUT_API_KEY || process.env.WAVE_API_KEY || "";
/** D'où vient la clé Wave des versements (affichage admin). */
export function wavePayoutKeySource(): "dediee" | "paiement" | null {
  return process.env.WAVE_PAYOUT_API_KEY ? "dediee" : process.env.WAVE_API_KEY ? "paiement" : null;
}
/** Les 4 derniers caractères de la clé Wave des versements (pour vérifier laquelle est en place). */
export const wavePayoutKeyTail = () => waveKey().slice(-4) || null;

/** Solde du compte Wave Business (API « Balance ») : null si la clé n'y a pas accès ou en cas d'erreur. */
export async function waveBusinessBalance(): Promise<number | null> {
  if (!waveKey()) return null;
  try {
    const res = await fetch("https://api.wave.com/v1/balance", { headers: { Authorization: `Bearer ${waveKey()}` }, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { amount?: string | number };
    const n = Number(data.amount);
    return Number.isFinite(n) ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/** Erreur due au compte JAMAAL (pas au destinataire) : la demande reste en attente. */
const accountProblem = (status: number, text: string) => status === 401 || status === 403 || /insufficient|balance|funds|solde|permission|scope|not.?allowed|unauthori[sz]ed/i.test(text);

export function isWalletProvider(v: unknown): v is WalletProvider {
  return v === "WAVE" || v === "ORANGE_MONEY";
}

export function payoutProvidersConfig() {
  return {
    WAVE: !!waveKey(),
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
      Authorization: `Bearer ${waveKey()}`,
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
  const data = (await res.json().catch(() => ({}))) as { id?: string; status?: string; message?: string; code?: string; payout_error?: { error_code?: string; reason?: string } };
  if (!res.ok) {
    const msg = data.message ?? `Wave a répondu ${res.status}`;
    if (accountProblem(res.status, `${data.code ?? ""} ${msg}`)) return { status: "BLOQUE", error: res.status === 401 || res.status === 403 ? `Clé Wave sans accès « Payout » (${msg})` : msg };
    return { status: "ECHEC", error: msg };
  }
  if (data.status === "succeeded") return { status: "VERSE", providerRef: data.id };
  if (data.status === "failed") {
    const why = data.payout_error?.reason ?? data.payout_error?.error_code ?? "Versement refusé par Wave";
    // Solde Wave Business insuffisant : rien n'est perdu, la demande sera renvoyée.
    if (/insufficient|balance|funds/i.test(`${data.payout_error?.error_code ?? ""} ${why}`)) return { status: "BLOQUE", error: `Solde Wave Business insuffisant (${why})` };
    return { status: "ECHEC", providerRef: data.id, error: why };
  }
  return { status: "EN_COURS", providerRef: data.id };
}

/** Relit l'état d'un versement Wave en cours. */
export async function refreshWave(providerRef: string): Promise<PayoutResult> {
  const res = await fetch(`https://api.wave.com/v1/payout/${encodeURIComponent(providerRef)}`, {
    headers: { Authorization: `Bearer ${waveKey()}` },
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
  if (!res.ok) {
    const msg = data.message ?? `Orange Money a répondu ${res.status}`;
    return accountProblem(res.status, msg) ? { status: "BLOQUE", error: msg } : { status: "ECHEC", error: msg };
  }
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
