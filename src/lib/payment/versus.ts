/**
 * Passerelle de paiement Versus Business (Wave, Orange Money, carte bancaire).
 * Une seule intégration derrière les trois moyens de paiement du site : dès que les variables
 * ci-dessous sont renseignées, Wave / Orange Money / Carte passent par Versus.
 *
 * Env :
 *   VERSUS_BASE_URL        https://business-staging.versusfintech.com (tests) ou l'URL de production
 *   VERSUS_LOGIN           identifiant API
 *   VERSUS_PASSWORD        mot de passe API
 *   VERSUS_WEBHOOK_TOKEN   (recommandé) secret ajouté à l'URL du webhook : ?token=...
 *   VERSUS_MERCHANT_NAME   (facultatif) nom affiché au client, « JAMAAL » par défaut
 */

export const versusConfigured = () => !!(process.env.VERSUS_BASE_URL && process.env.VERSUS_LOGIN && process.env.VERSUS_PASSWORD);

const base = () => (process.env.VERSUS_BASE_URL ?? "").replace(/\/$/, "");

let cached: { token: string; expiresAt: number } | null = null;

async function token(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const res = await fetch(`${base()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ login: process.env.VERSUS_LOGIN, password: process.env.VERSUS_PASSWORD }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { data?: { access_token?: string; expires_in?: number } } | null;
  const t = json?.data?.access_token;
  if (!res.ok || !t) {
    console.error("[versus] connexion refusée", res.status);
    throw new Error("Le service de paiement est momentanément indisponible.");
  }
  // expires_in est en secondes ; à défaut on renouvelle toutes les 10 minutes.
  cached = { token: t, expiresAt: Date.now() + (json?.data?.expires_in ? json.data.expires_in * 1000 : 600_000) };
  return t;
}

async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${await token()}`, ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 && retry) {
    await token(true);
    return api(path, init, false);
  }
  return res;
}

type Service = { id: number; code: string; service_type?: { code?: string } };
let services: { list: Service[]; at: number } | null = null;

/** Identifiant du service « carte bancaire » (peut différer entre test et production). */
async function cardServiceId(): Promise<number | null> {
  if (!services || Date.now() - services.at > 3_600_000) {
    const res = await api("/api/services");
    const json = (await res.json().catch(() => null)) as { data?: Service[] } | null;
    services = { list: Array.isArray(json?.data) ? json.data : [], at: Date.now() };
  }
  return services.list.find((s) => s.service_type?.code === "CARD_PAYMENT")?.id ?? null;
}

export interface VersusPaymentInput {
  /** Identifiant de commande JAMAAL (ou wdep_… pour un dépôt de wallet). */
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  description?: string;
  /** « card » ouvre directement le paiement par carte ; sinon le client choisit Wave / Orange Money sur la page Versus. */
  channel: "choice" | "card";
}

/** Sépare le prénom du reste du nom (Versus demande un prénom et un nom). */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || "Client", last: parts[0] || "JAMAAL" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Référence externe : l'id de commande, suivi d'un suffixe pour qu'un nouvel essai ne soit jamais refusé comme doublon. */
export const externalReferenceFor = (orderId: string) => `${orderId}~${Math.random().toString(36).slice(2, 7)}`;
export const orderIdFromReference = (ref: string) => ref.split("~")[0];

export async function createVersusPayment(input: VersusPaymentInput): Promise<{ url: string; paymentReference: string }> {
  const { first, last } = splitName(input.customerName);
  const body: Record<string, unknown> = {
    name: (input.description ?? "Commande JAMAAL").slice(0, 120),
    merchant_name: process.env.VERSUS_MERCHANT_NAME || "JAMAAL",
    first_name: first,
    last_name: last,
    external_reference: externalReferenceFor(input.orderId),
    order_reference: input.orderId.slice(-12),
    amount: input.amount,
    currency: "XOF",
    success_url: input.successUrl,
    failure_url: input.cancelUrl,
    metadata: { orderId: input.orderId },
    ...(input.customerEmail ? { email: input.customerEmail } : {}),
    ...(input.customerPhone ? { phone_number: input.customerPhone } : {}),
  };
  if (input.channel === "card") {
    const id = await cardServiceId();
    if (id) body.service_id = id;
  }
  const res = await api("/api/payment", { method: "POST", body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { data?: { link?: string; payment_reference?: string } } | null;
  const url = json?.data?.link;
  const paymentReference = json?.data?.payment_reference;
  if (!res.ok || !url || !paymentReference) {
    console.error("[versus] paiement refusé", res.status, JSON.stringify(json).slice(0, 400));
    throw new Error("Impossible d'initier le paiement. Réessayez.");
  }
  return { url, paymentReference };
}

export interface VersusPayment {
  status: string;
  amount: number;
  currency: string;
  externalReference: string;
}

/** Relit un paiement chez Versus (c'est la seule source de vérité : le contenu d'un webhook n'est jamais cru tel quel). */
export async function getVersusPayment(paymentReference: string): Promise<VersusPayment | null> {
  const res = await fetch(`${base()}/api/payment/${encodeURIComponent(paymentReference)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { data?: { payment?: { status?: string; amount?: number | string; currency?: string; external_reference?: string } } } | null;
  const p = json?.data?.payment;
  if (!p?.status) return null;
  return { status: String(p.status), amount: Number(p.amount), currency: String(p.currency ?? ""), externalReference: String(p.external_reference ?? "") };
}

/** Adaptateur commun aux trois moyens de paiement : le client est redirigé vers la page de paiement Versus. */
export async function payViaVersus(
  input: import("./types").CreatePaymentInput,
  channel: "choice" | "card"
): Promise<import("./types").CreatePaymentResult> {
  const { url, paymentReference } = await createVersusPayment({ ...input, channel });
  return { redirect: true, url, externalRef: paymentReference };
}
