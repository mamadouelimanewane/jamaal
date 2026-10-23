/**
 * Santé du réseau (pur, testé) : consultants qui décrochent (aucune vente depuis 21 jours), meilleurs parrains,
 * taux d'activation des nouveaux (1re vente dans les 30 jours), et regroupement des alertes par Leader.
 */
export const DROP_DAYS = 21;
export const ACTIVATION_DAYS = 30;
const DAY = 86_400_000;

export type Member = { id: string; name: string; city: string; whatsapp: string; sponsorId: string | null; createdAt: Date };
export type MemberSales = { lastSaleAt: Date | null; firstSaleAt: Date | null; sales30: number; revenue30: number };

const days = (now: Date, d: Date) => Math.floor((now.getTime() - d.getTime()) / DAY);

/** Sommet de la chaîne (Leader) d'un membre. */
export function leaderOf(id: string, byId: Map<string, Member>): Member | null {
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur?.sponsorId && byId.has(cur.sponsorId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.sponsorId);
  }
  return cur && cur.id !== id ? cur : null;
}

export function computeHealth(members: Member[], sales: Map<string, MemberSales>, now: Date) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const s = (id: string): MemberSales => sales.get(id) ?? { lastSaleAt: null, firstSaleAt: null, sales30: 0, revenue30: 0 };

  // 1. Décrocheurs : plus de vente depuis 21 jours (ou jamais vendu, inscrit depuis 21 jours)
  const droppers = members
    .map((m) => {
      const last = s(m.id).lastSaleAt;
      const idle = last ? days(now, last) : days(now, m.createdAt);
      return { m, idle, neverSold: !last };
    })
    .filter((x) => x.idle >= DROP_DAYS)
    .map((x) => ({ ...x, sponsor: x.m.sponsorId ? byId.get(x.m.sponsorId) ?? null : null, leader: leaderOf(x.m.id, byId) }))
    .sort((a, b) => Number(a.neverSold) - Number(b.neverSold) || a.idle - b.idle);

  // 2. Meilleurs parrains : ventes de leurs filleuls directs sur 30 jours, filleuls actifs
  const sponsors = new Map<string, { m: Member; filleuls: number; active: number; teamRevenue: number; teamSales: number; activated: number; newcomers: number }>();
  for (const m of members) {
    if (!m.sponsorId || !byId.has(m.sponsorId)) continue;
    const sp = sponsors.get(m.sponsorId) ?? { m: byId.get(m.sponsorId)!, filleuls: 0, active: 0, teamRevenue: 0, teamSales: 0, activated: 0, newcomers: 0 };
    const ms = s(m.id);
    sp.filleuls++;
    if (ms.sales30 > 0) sp.active++;
    sp.teamRevenue += ms.revenue30;
    sp.teamSales += ms.sales30;
    if (days(now, m.createdAt) >= ACTIVATION_DAYS && days(now, m.createdAt) <= 180) {
      sp.newcomers++;
      if (ms.firstSaleAt && ms.firstSaleAt.getTime() - m.createdAt.getTime() <= ACTIVATION_DAYS * DAY) sp.activated++;
    }
    sponsors.set(m.sponsorId, sp);
  }
  const topSponsors = [...sponsors.values()].sort((a, b) => b.teamRevenue - a.teamRevenue || b.active - a.active).slice(0, 10);

  // 3. Activation : nouveaux inscrits (il y a 30 à 180 jours) ayant fait leur 1re vente dans les 30 jours
  const cohort = members.filter((m) => days(now, m.createdAt) >= ACTIVATION_DAYS && days(now, m.createdAt) <= 180);
  const activated = cohort.filter((m) => {
    const f = s(m.id).firstSaleAt;
    return f && f.getTime() - m.createdAt.getTime() <= ACTIVATION_DAYS * DAY;
  });
  const byMonth = new Map<string, { joined: number; activated: number }>();
  for (const m of cohort) {
    const k = m.createdAt.toISOString().slice(0, 7);
    const v = byMonth.get(k) ?? { joined: 0, activated: 0 };
    v.joined++;
    if (activated.includes(m)) v.activated++;
    byMonth.set(k, v);
  }

  const active30 = members.filter((m) => s(m.id).sales30 > 0).length;
  return {
    totals: { members: members.length, active30, activeRate: members.length ? active30 / members.length : 0, droppers: droppers.length },
    droppers,
    topSponsors,
    activation: { joined: cohort.length, activated: activated.length, rate: cohort.length ? activated.length / cohort.length : null, byMonth: [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)) },
  };
}

/** Alertes à envoyer : pour chaque Leader (et chaque parrain direct qui n'est pas le Leader), ses décrocheurs. */
export function alertsByManager(droppers: ReturnType<typeof computeHealth>["droppers"]) {
  const out = new Map<string, { manager: Member; items: typeof droppers }>();
  for (const d of droppers) {
    for (const mgr of [d.leader, d.sponsor && d.sponsor.id !== d.leader?.id ? d.sponsor : null]) {
      if (!mgr) continue;
      const v = out.get(mgr.id) ?? { manager: mgr, items: [] };
      v.items.push(d);
      out.set(mgr.id, v);
    }
  }
  return [...out.values()];
}

/** Message d'alerte au Leader / parrain (pur, testé). */
export function managerAlertText(managerName: string, items: { m: Member; idle: number; neverSold: boolean; sponsor: Member | null }[], site: string, isLeader: boolean): string {
  const first = managerName.split(/\s+/)[0];
  const lines = items.slice(0, 8).map((d) => `• ${d.m.name} (${d.m.city}) : ${d.neverSold ? `pas encore de vente, inscrit·e il y a ${d.idle} j` : `aucune vente depuis ${d.idle} j`}${isLeader && d.sponsor ? ` · parrain ${d.sponsor.name.split(/\s+/)[0]}` : ""}`);
  return [
    `👋 ${first}, ${items.length} membre${items.length > 1 ? "s" : ""} de votre équipe ${items.length > 1 ? "ont" : "a"} besoin d'un coup de pouce :`,
    ...lines,
    items.length > 8 ? `… et ${items.length - 8} autre(s).` : "",
    "Un appel ou un message aujourd'hui fait souvent repartir les ventes 💪",
    `Votre équipe : ${site}/admin/mes-filleuls`,
  ]
    .filter(Boolean)
    .join("\n");
}
