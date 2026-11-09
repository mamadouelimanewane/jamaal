/**
 * Attribution automatique des livraisons JAMAAL (Modèle économique › Livraison › « Automatique »).
 * Chaque livraison prête (« En préparation », sans livreur) est confiée au livreur validé le plus adapté :
 * en ligne de préférence, le plus proche du dépôt (où il récupère le colis), le moins chargé, dans la limite
 * de courses en cours fixée par l'administrateur. Sans livreur en ligne, le moins chargé est choisi.
 * Fichier serveur.
 */
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { haversineKm, isValidPoint, type LatLng } from "@/lib/delivery";
import { isFresh } from "@/lib/geo-track";
import { LIVREUR_ACTIVE } from "@/lib/livreur-signup";
import { advanceDelivery } from "@/lib/delivery-engine";

export type DispatchCandidate = { id: string; name: string; pos: LatLng | null; live: boolean; load: number };

/**
 * Choix du livreur (pur, testable) : en ligne d'abord ; puis distance au point de retrait + 1,5 km par
 * course en cours ; sans livreur en ligne, le moins chargé. Null si tous sont au maximum.
 */
export function pickLivreur(candidates: DispatchCandidate[], pickup: LatLng, maxActive: number): DispatchCandidate | null {
  const free = candidates.filter((c) => c.load < maxActive);
  if (!free.length) return null;
  const live = free.filter((c) => c.live);
  const pool = live.length ? live : free;
  const km = (c: DispatchCandidate) => (c.pos && isValidPoint(c.pos) ? haversineKm(c.pos, pickup) : 50);
  // En ligne : la distance compte (position fraîche) ; hors ligne : la charge d'abord, la position est ancienne.
  const score = (c: DispatchCandidate) => (live.length ? km(c) + c.load * 1.5 : c.load * 1000 + km(c));
  return [...pool].sort((a, b) => score(a) - score(b) || a.load - b.load || a.name.localeCompare(b.name, "fr"))[0];
}

/** Attribue les livraisons en attente (toutes, ou une seule). Renvoie le nombre de livraisons attribuées. */
export async function autoAssignPending(orderId?: string): Promise<number> {
  const model = await getBusinessModel();
  if (model.deliveryDispatch !== "AUTO") return 0;
  const orders = await prisma.order.findMany({
    where: {
      ...(orderId ? { id: orderId } : {}),
      status: { not: "ANNULEE" },
      deliveryMode: "LIVRAISON_JAMAAL",
      deliveryStatus: "A_PREPARER",
      livreurId: null,
      // Payée, ou payée à la livraison : jamais une commande en attente de paiement en ligne.
      OR: [{ paymentStatus: "PAYE" }, { paymentMethod: "A_LA_LIVRAISON" }],
    },
    orderBy: { createdAt: "asc" },
    take: 30,
    select: { id: true },
  });
  if (!orders.length) return 0;
  const livreurs = await prisma.livreur.findMany({
    where: { active: true, status: LIVREUR_ACTIVE, documents: { some: {} } },
    select: {
      id: true, name: true, lastLat: true, lastLng: true, lastSeenAt: true,
      _count: { select: { orders: { where: { status: { not: "ANNULEE" }, deliveryMode: "LIVRAISON_JAMAAL", deliveryStatus: { in: ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"] } } } } },
    },
  });
  const pool: DispatchCandidate[] = livreurs.map((l) => ({
    id: l.id,
    name: l.name,
    pos: l.lastLat != null && l.lastLng != null ? { lat: l.lastLat, lng: l.lastLng } : null,
    live: isFresh(l.lastSeenAt),
    load: l._count.orders,
  }));
  const depot = { lat: model.depotLat, lng: model.depotLng };
  let done = 0;
  for (const o of orders) {
    const pick = pickLivreur(pool, depot, model.dispatchMaxActive);
    if (!pick) break;
    // Toujours libre ? (un autre balayage ou l'équipe a pu l'attribuer entre-temps)
    if (!(await prisma.order.count({ where: { id: o.id, livreurId: null, deliveryStatus: "A_PREPARER" } }))) continue;
    try {
      await advanceDelivery(o.id, "ASSIGNEE", { kind: "admin" }, { livreurId: pick.id, note: `Attribution automatique à ${pick.name}${pick.live ? "" : " (hors ligne)"}` });
      pick.load += 1;
      done += 1;
    } catch (error) {
      // Déjà attribuée entre-temps, ou état changé : on passe à la suivante.
      console.warn("[attribution auto]", o.id, error instanceof Error ? error.message : error);
    }
  }
  return done;
}

let lastSweep = 0;

/**
 * Lance l'attribution automatique après la réponse (création ou paiement d'une commande, position d'un
 * livreur). Le balayage général est limité à une fois par minute.
 */
export function scheduleAutoAssign(orderId?: string) {
  if (!orderId) {
    const now = Date.now();
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
  }
  const run = () => autoAssignPending(orderId).then(() => undefined, (e) => console.error("[attribution auto]", e));
  try {
    after(run);
  } catch {
    void run();
  }
}
