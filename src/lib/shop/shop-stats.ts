/**
 * Statistiques de la boutique personnelle (/c/<slug>) : visites, clics WhatsApp, clics produits,
 * commandes en ligne attribuées. Les fonctions pures (période, série par jour, taux) sont testées.
 */

export const SHOP_EVENT_KINDS = ["visite", "whatsapp", "produit"] as const;
export const SOCIAL_SOURCES = ["whatsapp", "facebook", "instagram", "tiktok", "snapchat", "google", "autre", "direct"] as const;
export type SocialSource = (typeof SOCIAL_SOURCES)[number];
export const isSocialSource = (v: unknown): v is SocialSource => SOCIAL_SOURCES.includes(v as SocialSource);

/**
 * D'où vient une visite. Les liens de partage JAMAAL portent utm_source, mais une publication Facebook,
 * Instagram ou TikTok partagée à la main n'en a pas : on reconnaît alors l'identifiant de clic ajouté
 * par la plateforme (fbclid, ttclid, gclid…), le site d'où l'on arrive, ou le navigateur intégré à
 * l'application (Facebook, Instagram, TikTok ouvrent les liens dans leur propre navigateur).
 */
export function detectSource(input: { search?: string; referrer?: string; userAgent?: string; host?: string }): SocialSource {
  const p = new URLSearchParams(input.search ?? "");
  const utm = (p.get("utm_source") ?? "").toLowerCase().trim();
  const fromName = (v: string): SocialSource | null => {
    if (!v) return null;
    if (/whatsapp|^wa$|wa\.me/.test(v)) return "whatsapp";
    if (/instagram|^ig$/.test(v)) return "instagram";
    if (/facebook|^fb$|messenger/.test(v)) return "facebook";
    if (/tiktok|bytedance|musical/.test(v)) return "tiktok";
    if (/snapchat|^snap$/.test(v)) return "snapchat";
    if (/google|youtube/.test(v)) return "google";
    return null;
  };
  const byUtm = fromName(utm);
  if (byUtm) return byUtm;
  const ua = input.userAgent ?? "";
  // Instagram ajoute lui aussi fbclid à ses liens : son navigateur intégré passe avant.
  if (p.has("igshid") || p.has("igsh") || /Instagram/i.test(ua)) return "instagram";
  if (p.has("ttclid")) return "tiktok";
  if (p.has("fbclid")) return "facebook";
  if (p.has("gclid") || p.has("gbraid") || p.has("wbraid")) return "google";
  if (p.has("sc_cid") || p.has("ScCid")) return "snapchat";

  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return "facebook";
  if (/musical_ly|Bytedance|TikTok|trill_/i.test(ua)) return "tiktok";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/WhatsApp/i.test(ua)) return "whatsapp";

  let refHost = "";
  try {
    refHost = input.referrer ? new URL(input.referrer).hostname.toLowerCase() : "";
  } catch {}
  if (refHost && input.host && (refHost === input.host.toLowerCase() || refHost.endsWith(`.${input.host.toLowerCase()}`))) refHost = "";
  if (refHost) {
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(refHost)) return "whatsapp";
    if (/(^|\.)instagram\.com$/.test(refHost)) return "instagram";
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(refHost)) return "facebook";
    if (/(^|\.)tiktok\.com$/.test(refHost)) return "tiktok";
    if (/(^|\.)snapchat\.com$/.test(refHost)) return "snapchat";
    if (/(^|\.)google\.[a-z.]+$|(^|\.)youtube\.com$|(^|\.)bing\.com$/.test(refHost)) return "google";
    return "autre";
  }
  return utm ? "autre" : "direct";
}
export type ShopEventKind = (typeof SHOP_EVENT_KINDS)[number];
export const isShopEventKind = (v: unknown): v is ShopEventKind => SHOP_EVENT_KINDS.includes(v as ShopEventKind);

export const STAT_PERIODS = [7, 30, 90] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];
export const parsePeriod = (v: unknown): StatPeriod => (STAT_PERIODS.includes(Number(v) as StatPeriod) ? (Number(v) as StatPeriod) : 30);

/** Jour calendaire (Dakar = UTC toute l'année). */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Début (00:00 UTC) du premier jour d'une période de `days` jours finissant aujourd'hui. */
export function periodStart(days: number, now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

export type StatEvent = { kind: string; sid: string | null; productId: string | null; source?: string | null; createdAt: Date };

/** Visiteurs distincts : un identifiant de visite compte une fois ; sans identifiant, chaque visite compte. */
export function countVisitors(events: StatEvent[]): number {
  const sids = new Set<string>();
  let anonymous = 0;
  for (const e of events) {
    if (e.kind !== "visite") continue;
    if (e.sid) sids.add(e.sid);
    else anonymous++;
  }
  return sids.size + anonymous;
}

export type DayPoint = { day: string; visitors: number; whatsapp: number; products: number };

/** Une entrée par jour de la période (jours vides compris), dans l'ordre. */
export function dailySeries(events: StatEvent[], days: number, now = new Date()): DayPoint[] {
  const start = periodStart(days, now);
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    keys.push(dayKey(d));
  }
  const by = new Map(keys.map((k) => [k, { sids: new Set<string>(), anon: 0, whatsapp: 0, products: 0 }]));
  for (const e of events) {
    const b = by.get(dayKey(e.createdAt));
    if (!b) continue;
    if (e.kind === "visite") {
      if (e.sid) b.sids.add(e.sid);
      else b.anon++;
    } else if (e.kind === "whatsapp") b.whatsapp++;
    else if (e.kind === "produit") b.products++;
  }
  return keys.map((day) => {
    const b = by.get(day)!;
    return { day, visitors: b.sids.size + b.anon, whatsapp: b.whatsapp, products: b.products };
  });
}

/** Produits les plus cliqués : [productId, clics], du plus cliqué au moins cliqué. */
export function topProducts(events: StatEvent[], max = 5): [string, number][] {
  const m = new Map<string, number>();
  for (const e of events) if (e.kind === "produit" && e.productId) m.set(e.productId, (m.get(e.productId) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
}

/** Pourcentage arrondi (0 si pas de base). */
export const rate = (part: number, base: number) => (base > 0 ? Math.round((part / base) * 1000) / 10 : 0);

/** Évolution en % par rapport à la période précédente (null si pas de point de comparaison). */
export const trend = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
