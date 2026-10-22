/**
 * Rang affiché dans la barre du haut du revendeur : son titre dans le réseau (Leader, Parrain,
 * Consultant) et sa place au classement du mois. Le classement est recalculé au plus toutes les
 * 5 minutes par instance : la barre est affichée sur chaque page, sans alourdir la base.
 * Fichier serveur.
 */
import { getConsultantRankings } from "./ranking";
import { getMemberTitle } from "./network";

const TTL = 5 * 60_000;
let cached: { at: number; data: Promise<{ order: string[] }> } | null = null;

function monthlyOrder(now = Date.now()) {
  if (!cached || now - cached.at > TTL) {
    const data = getConsultantRankings()
      .then((all) => ({ order: all.filter((r) => r.monthlyRevenue > 0).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue).map((r) => r.consultantId) }))
      .catch(() => ({ order: [] as string[] }));
    cached = { at: now, data };
  }
  return cached.data;
}

/** Place (1 = premier) dans une liste triée, ou null si absent (aucune vente ce mois-ci). Pur, testé. */
export function placeIn(order: string[], id: string): number | null {
  const i = order.indexOf(id);
  return i >= 0 ? i + 1 : null;
}

export async function topBarRank(consultantId: string) {
  const [title, { order }] = await Promise.all([getMemberTitle(consultantId).catch(() => "Consultant" as const), monthlyOrder()]);
  return { title, place: placeIn(order, consultantId), total: order.length };
}
