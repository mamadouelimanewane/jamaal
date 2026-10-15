/**
 * Passerelle de paiement Versus Business (Wave, Orange Money, carte bancaire).
 * Une seule intégration derrière les trois moyens de paiement du site : dès que les variables
 * ci-dessous sont renseignées, Wave / Orange Money / Carte passent par Versus.
 *
 * Le moyen est choisi une seule fois, dans le panier. Versus prépare alors le paiement avec le
 * numéro déjà saisi et renvoie un lien direct vers l'application (Wave, Orange Money) ou la page
 * carte : le client n'a rien à choisir ni à ressaisir.
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

export type VersusChannel = "wave" | "orange_money" | "card";

/** Service Versus de chaque moyen de paiement (les identifiants peuvent différer entre test et production). */
const SERVICE_MATCH: Record<VersusChannel, (s: Service) => boolean> = {
  wave: (s) => s.code === "SN_WAVE_PAYMENT_ONLINE",
  orange_money: (s) => s.code === "SN_ORANGE_MONEY_PAYMENT_ONLINE",
  card: (s) => s.service_type?.code === "CARD_PAYMENT",
};

async function serviceId(channel: VersusChannel): Promise<number | null> {
  if (!services || Date.now() - services.at > 3_600_000) {
    const res = await api("/api/services");
    const json = (await res.json().catch(() => null)) as { data?: Service[] } | null;
    services = { list: Array.isArray(json?.data) ? json.data : [], at: Date.now() };
  }
  return services.list.find(SERVICE_MATCH[channel])?.id ?? null;
}

/** Numéro sénégalais au format international (+221…), ou null s'il n'est pas exploitable. */
export function toSenegalNumber(raw?: string | null): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  const national = digits.startsWith("221") && digits.length === 12 ? digits.slice(3) : digits.length === 10 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^7\d{8}$/.test(national) ? `+221${national}` : null;
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
  /** Moyen choisi dans le panier : le client n'a rien à choisir ni à ressaisir chez Versus. */
  channel: VersusChannel;
}

const secureUrl = (u: string) => /^https:\/\/\S+$/i.test(u);

/** Sépare le prénom du reste du nom (Versus demande un prénom et un nom). */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || "Client", last: parts[0] || "JAMAAL" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Référence externe : l'id de commande, suivi d'un suffixe pour qu'un nouvel essai ne soit jamais refusé comme doublon. */
export const externalReferenceFor = (orderId: string) => `${orderId}~${Math.random().toString(36).slice(2, 7)}`;
export const orderIdFromReference = (ref: string) => ref.split("~")[0];

/** Lien direct vers l'application du moyen de paiement (Wave, Orange Money / Max it, page carte). */
export function directLink(channel: VersusChannel, links: Record<string, string> | null | undefined): string | null {
  if (!links) return null;
  const pick = channel === "wave" ? links.WAVE : channel === "orange_money" ? links.OM || links.MAXIT : links.CARD_PAYMENT;
  return pick && secureUrl(pick) ? pick : null;
}

/** Attente du lien direct après la création (réglable pour les tests). */
export const linkPolling = { tries: 8, delayMs: 1000 };

export async function createVersusPayment(input: VersusPaymentInput): Promise<{ url: string; paymentReference: string; direct: boolean }> {
  const { first, last } = splitName(input.customerName);
  const account = input.channel === "card" ? null : toSenegalNumber(input.customerPhone);
  const service = account || input.channel === "card" ? await serviceId(input.channel).catch(() => null) : null;
  const body: Record<string, unknown> = {
    name: (input.description ?? "Commande JAMAAL").slice(0, 120),
    merchant_name: process.env.VERSUS_MERCHANT_NAME || "JAMAAL",
    first_name: first,
    last_name: last,
    external_reference: externalReferenceFor(input.orderId),
    order_reference: input.orderId.slice(-12),
    amount: input.amount,
    currency: "XOF",
    // Versus refuse toute adresse de retour qui ne commence pas par https:// : on l'omet plutôt que d'échouer.
    ...(secureUrl(input.successUrl) ? { success_url: input.successUrl } : {}),
    ...(secureUrl(input.cancelUrl) ? { failure_url: input.cancelUrl } : {}),
    metadata: { orderId: input.orderId },
    ...(input.customerEmail ? { email: input.customerEmail } : {}),
    ...(account ? { phone_number: account } : {}),
    // Moyen + numéro connus : Versus prépare directement le paiement (aucune page de choix, aucun numéro à ressaisir).
    // Si le service ou le numéro manque, on retombe sur la page Versus où le client choisit lui-même.
    ...(service ? { service_id: service, ...(account ? { payment_account_number: account } : {}) } : {}),
  };
  const res = await api("/api/payment", { method: "POST", body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { data?: { link?: string; payment_reference?: string } } | null;
  const hosted = json?.data?.link;
  const paymentReference = json?.data?.payment_reference;
  if (!res.ok || !hosted || !paymentReference) {
    console.error("[versus] paiement refusé", res.status, JSON.stringify(json).slice(0, 400));
    throw new Error("Impossible d'initier le paiement. Réessayez.");
  }
  if (!body.service_id) return { url: hosted, paymentReference, direct: false };

  // Les instructions de paiement (lien Wave / Orange Money / carte) arrivent quelques secondes après la création.
  for (let i = 0; i < linkPolling.tries; i++) {
    const p = await getVersusPayment(paymentReference).catch(() => null);
    const link = directLink(input.channel, p?.links);
    if (link) return { url: link, paymentReference, direct: true };
    await new Promise((r) => setTimeout(r, linkPolling.delayMs));
  }
  return { url: hosted, paymentReference, direct: false };
}

export interface VersusPayment {
  status: string;
  amount: number;
  currency: string;
  externalReference: string;
  /** Liens de paiement par moyen (WAVE, OM, MAXIT, CARD_PAYMENT) une fois les instructions prêtes. */
  links: Record<string, string> | null;
}

/** Relit un paiement chez Versus (c'est la seule source de vérité : le contenu d'un webhook n'est jamais cru tel quel). */
export async function getVersusPayment(paymentReference: string): Promise<VersusPayment | null> {
  const res = await fetch(`${base()}/api/payment/${encodeURIComponent(paymentReference)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: { payment?: { status?: string; amount?: number | string; currency?: string; external_reference?: string; payment_links?: Record<string, string> | null } };
  } | null;
  const p = json?.data?.payment;
  if (!p?.status) return null;
  return {
    status: String(p.status),
    amount: Number(p.amount),
    currency: String(p.currency ?? ""),
    externalReference: String(p.external_reference ?? ""),
    links: p.payment_links && typeof p.payment_links === "object" ? p.payment_links : null,
  };
}

/** Les paiements gérés par Versus sont repérés par ce préfixe sur la référence enregistrée. */
export const VERSUS_REF_PREFIX = "versus:";
export const isVersusRef = (ref?: string | null) => !!ref && ref.startsWith(VERSUS_REF_PREFIX);
export const rawVersusRef = (ref: string) => (isVersusRef(ref) ? ref.slice(VERSUS_REF_PREFIX.length) : ref);

/** Adaptateur commun aux moyens de paiement : le client est envoyé directement vers Wave, Orange Money ou la page carte. */
export async function payViaVersus(
  input: import("./types").CreatePaymentInput,
  channel: VersusChannel
): Promise<import("./types").CreatePaymentResult> {
  const { url, paymentReference } = await createVersusPayment({ ...input, channel });
  return { redirect: true, url, externalRef: VERSUS_REF_PREFIX + paymentReference };
}
