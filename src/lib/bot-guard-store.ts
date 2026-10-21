/**
 * Robot anti-aspiration : état partagé (compteurs, liste des bannis) et décision pour une requête.
 * Fichier serveur, appelé par le proxy. Ne lève jamais d'erreur : en cas de panne de la base, le site
 * reste accessible (la protection se replie sur les compteurs en mémoire).
 *
 * - Compteurs de pages vues : en mémoire, par instance (rapides, aucun accès base par page).
 * - Bannis : en base (partagés entre toutes les instances), relus au plus toutes les 30 secondes.
 * - Statistiques : en base, une ligne par jour et par motif.
 */
import { prisma } from "@/lib/prisma";
import {
  API_LIMITS,
  BAN_SECONDS,
  classifyAgent,
  GOOD_BOT_LIMITS,
  HONEYPOT_PATH,
  HUMAN_LIMITS,
  hit,
  FETCH_LIMITS,
  requestCategory,
  isMachinePath,
  newCounter,
  visitorKey,
  type Counter,
} from "@/lib/bot-guard";

export type GuardVerdict =
  | { action: "allow" }
  | { action: "block"; status: 403; reason: string }
  | { action: "slow"; status: 429; reason: string; retryAfterSec: number };

const counters = new Map<string, Counter>();
let bans = new Map<string, number>(); // clé → fin du bannissement (ms)
let bansLoadedAt = 0;
let bansLoading: Promise<void> | null = null;

/** Protection désactivable en urgence (variable BOT_GUARD=off dans Vercel). */
export const guardEnabled = () => (process.env.BOT_GUARD ?? "on").toLowerCase() !== "off";

async function refreshBans(now: number) {
  if (now - bansLoadedAt < 30_000) return;
  if (!bansLoading) {
    bansLoading = prisma.botBan
      .findMany({ where: { until: { gt: new Date(now) } }, select: { key: true, until: true }, take: 5000 })
      .then((rows) => {
        bans = new Map(rows.map((r) => [r.key, r.until.getTime()]));
        bansLoadedAt = Date.now();
      })
      .catch(() => {
        bansLoadedAt = Date.now(); // base indisponible : on réessaiera plus tard, le site reste ouvert
      })
      .finally(() => {
        bansLoading = null;
      });
  }
  await bansLoading;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Compte une requête refusée (tableau de bord). Sans attendre, sans erreur. */
function countBlock(reason: string) {
  const day = today();
  void prisma.$executeRaw`INSERT INTO "BotBlockStat" ("day", "reason", "count") VALUES (${day}, ${reason}, 1)
    ON CONFLICT ("day", "reason") DO UPDATE SET "count" = "BotBlockStat"."count" + 1`.catch(() => {});
}

/** Bannit un visiteur (partagé entre les instances). */
export async function banVisitor(input: { key: string; ip: string; userAgent: string | null; reason: string; path: string; seconds: number }) {
  const until = new Date(Date.now() + input.seconds * 1000);
  bans.set(input.key, until.getTime());
  await prisma.botBan
    .upsert({
      where: { key: input.key },
      create: { key: input.key, ip: input.ip, userAgent: input.userAgent?.slice(0, 300) ?? null, reason: input.reason, path: input.path.slice(0, 200), until },
      update: { reason: input.reason, path: input.path.slice(0, 200), until, hits: { increment: 1 } },
    })
    .catch(() => {});
}

/** Décision pour une requête entrante. */
export async function guardRequest(input: { method: string; pathname: string; headers: Pick<Headers, "get">; ip: string }): Promise<GuardVerdict> {
  if (!guardEnabled()) return { action: "allow" };
  const { method, pathname, headers, ip } = input;
  if (isMachinePath(pathname)) return { action: "allow" };

  const ua = headers.get("user-agent");
  const kind = classifyAgent(ua);
  const key = visitorKey(ip, ua);
  const now = Date.now();

  // 1. Aspirateurs, scripts et robots de copie : refus immédiat.
  if (kind === "bad") {
    countBlock("aspirateur");
    return { action: "block", status: 403, reason: "aspirateur" };
  }

  // 2. Lien piège : seul un robot qui ignore robots.txt et suit les liens invisibles arrive ici.
  if (pathname === HONEYPOT_PATH || pathname.startsWith(`${HONEYPOT_PATH}/`)) {
    if (kind === "human") await banVisitor({ key, ip, userAgent: ua, reason: "lien piège suivi", path: pathname, seconds: BAN_SECONDS.honeypot });
    countBlock("piège");
    return { action: "block", status: 403, reason: "piège" };
  }

  // 3. Visiteur déjà banni.
  await refreshBans(now);
  const bannedUntil = bans.get(key);
  if (bannedUntil && bannedUntil > now) {
    // Revérifié en base (rare : seulement pour un banni) : un déblocage par l'admin s'applique tout de suite.
    const still = await prisma.botBan.findUnique({ where: { key }, select: { until: true } }).catch(() => ({ until: new Date(bannedUntil) }));
    if (still && still.until.getTime() > now) {
      countBlock("banni");
      return { action: "block", status: 403, reason: "banni" };
    }
    bans.delete(key);
    for (const k of counters.keys()) if (k.endsWith(key)) counters.delete(k);
  }

  // 4. Cadence : pages vues par minute, heure et jour.
  const category = requestCategory(method, headers);
  if (!category) return { action: "allow" };
  const isApi = pathname.startsWith("/api/");
  const bucket = isApi ? "api" : category;
  const limits = isApi ? API_LIMITS : category === "fetch" ? FETCH_LIMITS : kind === "good" ? GOOD_BOT_LIMITS : HUMAN_LIMITS;
  const ckey = `${bucket}:${key}`;
  let c = counters.get(ckey);
  if (!c) {
    c = newCounter(now);
    counters.set(ckey, c);
    if (counters.size > 20_000) {
      // Nettoyage : on oublie les visiteurs silencieux depuis plus d'une journée.
      for (const [k, v] of counters) if (now - v.day.start > 86_400_000) counters.delete(k);
    }
  }
  const r = hit(c, now, limits);
  if (!r.over) return { action: "allow" };

  // Au-delà de la limite horaire ou journalière de pages : c'est une copie du site, bannissement partagé.
  if (r.over !== "minute" && kind === "human" && bucket === "page") {
    await banVisitor({ key, ip, userAgent: ua, reason: r.over === "day" ? "trop de pages en une journée" : "trop de pages en une heure", path: pathname, seconds: r.over === "day" ? BAN_SECONDS.day : BAN_SECONDS.hour });
  }
  countBlock(`cadence-${r.over}`);
  return { action: "slow", status: 429, reason: r.over, retryAfterSec: Math.max(1, r.retryAfterSec) };
}

/** Pour l'administration : vide les compteurs locaux d'un visiteur débloqué. */
export function forgetVisitor(key: string) {
  bans.delete(key);
  for (const k of counters.keys()) if (k.endsWith(key)) counters.delete(k);
}

const page = (title: string, text: string) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · JAMAAL</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f1ee;color:#14213b;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:30rem;padding:2rem;text-align:center}h1{font:600 1.6rem Georgia,serif;margin:0 0 .5rem}a{color:#9c5a48;font-weight:600}</style></head>
<body><main><h1>${title}</h1><p>${text}</p><p><a href="/">Retour à l'accueil JAMAAL</a></p></main></body></html>`;

/** Réponse envoyée à un visiteur refusé ou freiné (page lisible pour un humain). */
export function guardResponse(v: Exclude<GuardVerdict, { action: "allow" }>): Response {
  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (v.action === "slow") {
    headers["Retry-After"] = String(v.retryAfterSec);
    const wait = v.retryAfterSec >= 3600 ? `${Math.ceil(v.retryAfterSec / 3600)} h` : v.retryAfterSec >= 60 ? `${Math.ceil(v.retryAfterSec / 60)} min` : `${v.retryAfterSec} s`;
    return new Response(page("Un instant…", `Beaucoup de pages ont été ouvertes en peu de temps depuis votre connexion. Réessayez dans ${wait}.`), { status: 429, headers });
  }
  return new Response(page("Accès refusé", "Cette navigation automatique n'est pas autorisée sur le site JAMAAL. Si vous êtes un client, écrivez-nous sur WhatsApp et nous vous aiderons."), { status: 403, headers });
}
