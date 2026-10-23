/**
 * Détection de fraude (serveur) : contrôle de chaque vente avant que les commissions soient créditées, recherche
 * quotidienne des membres suspects, et décision de l'admin (libérer ou annuler les commissions bloquées).
 */
import { prisma } from "@/lib/prisma";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { creditCommissionEntries } from "@/lib/wallet";
import { duplicateMembers, HOLD_SCORE, orderSignals, RETURN_RATE_LIMIT, returnRate, score, singleCustomer, tail } from "./rules";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;

async function alertAdmins(title: string, message: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title, message: message.slice(0, 500) })) }).catch(() => {});
  notifyTeamWhatsApp(`🚨 ${title}\n${message}\nÀ vérifier : Admin › Contrôle des commissions.`);
}

/** Crée le signalement s'il n'existe pas encore. Renvoie true s'il est nouveau. */
async function raise(data: { key: string; kind: string; consultantId: string; orderId?: string | null; details: string; score: number }) {
  try {
    await prisma.fraudFlag.create({ data: { ...data, orderId: data.orderId ?? null } });
    return true;
  } catch {
    return false; // déjà signalé (clé unique)
  }
}

/**
 * Contrôle d'une vente juste après l'enregistrement de ses commissions, avant leur crédit sur les wallets :
 * - vente suspecte (auto-achat, achat du parrain) : toutes ses commissions passent « EN_REVUE » ;
 * - membre déjà signalé (faux filleul, retours…) : ses commissions passent « EN_REVUE ».
 * Ne lève jamais d'erreur.
 */
export async function screenOrder(orderId: string): Promise<number> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, customerName: true, customerPhone: true, customerEmail: true, deliveryLat: true, deliveryLng: true, total: true,
        consultant: { select: { id: true, name: true, whatsapp: true, email: true, deliveryLat: true, deliveryLng: true, sponsor: { select: { id: true, name: true, whatsapp: true, email: true, sponsor: { select: { id: true, name: true, whatsapp: true, email: true } } } } } },
      },
    });
    if (!order?.consultant) return 0;
    const c = order.consultant;
    const upline = [c.sponsor, c.sponsor?.sponsor].filter((u): u is NonNullable<typeof u> => !!u).map((u) => ({ id: u.id, name: u.name, whatsapp: u.whatsapp, email: u.email }));
    const signals = orderSignals({ order, seller: c, upline });
    let held = 0;
    if (score(signals) >= HOLD_SCORE) {
      const r = await prisma.commissionEntry.updateMany({ where: { orderId, status: "A_VERSER", payoutId: null }, data: { status: "EN_REVUE" } });
      held += r.count;
      const kind = signals.sort((a, b) => b.weight - a.weight)[0].kind;
      if (await raise({ key: `order:${orderId}`, kind, consultantId: c.id, orderId, details: signals.map((s) => s.detail).join(" "), score: score(signals) })) {
        await alertAdmins(`Commissions bloquées : ${kind === "AUTO_ACHAT" ? "auto-achat" : "achat du parrain"} possible`, `${c.name}, commande ${orderId.slice(-8).toUpperCase()} (${fcfa(order.total)}). ${signals[0].detail}`);
      }
    }
    // Membres sous surveillance (signalement ouvert sur le membre) : leurs commissions de cette vente attendent.
    const watched = await prisma.fraudFlag.findMany({ where: { status: "OUVERT", orderId: null }, select: { consultantId: true } });
    if (watched.length) {
      const r = await prisma.commissionEntry.updateMany({ where: { orderId, status: "A_VERSER", payoutId: null, consultantId: { in: [...new Set(watched.map((w) => w.consultantId))] } }, data: { status: "EN_REVUE" } });
      held += r.count;
    }
    return held;
  } catch (e) {
    console.error("[fraude] contrôle", orderId, e);
    return 0;
  }
}

/** Tâche quotidienne : faux filleuls (coordonnées partagées), ventes toutes au même client, retours abusifs. */
export async function scanMembers(now = new Date()) {
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const members = await prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, whatsapp: true, email: true, idNumber: true, sponsorId: true, createdAt: true } });
  const byId = new Map(members.map((m) => [m.id, m]));
  let created = 0;

  for (const d of duplicateMembers(members)) {
    const related = d.member.sponsorId === d.other.id ? " (son parrain)" : "";
    if (await raise({ key: `member:FAUX_FILLEUL:${d.member.id}:${d.other.id}`, kind: "FAUX_FILLEUL", consultantId: d.member.id, details: `${d.member.name} a le même ${d.field} que ${d.other.name}${related} : possible faux filleul créé pour toucher des commissions.`, score: 3 })) {
      created++;
      await alertAdmins("Faux filleul possible", `${d.member.name} et ${d.other.name}${related} partagent le même ${d.field}. Leurs nouvelles commissions sont mises en vérification.`);
    }
  }

  const orders = await prisma.order.findMany({
    where: { consultantId: { not: null }, createdAt: { gte: since } },
    select: { consultantId: true, customerPhone: true, status: true, paymentStatus: true, paidAt: true, refundedAt: true, _count: { select: { returns: true } } },
  });
  const byMember = new Map<string, typeof orders>();
  for (const o of orders) byMember.set(o.consultantId!, [...(byMember.get(o.consultantId!) ?? []), o]);
  for (const [id, list] of byMember) {
    const m = byId.get(id);
    if (!m) continue;
    const valid = list.filter((o) => o.status !== "ANNULEE");
    const only = singleCustomer(valid);
    if (only && only !== tail(m.whatsapp)) {
      if (await raise({ key: `member:CLIENT_UNIQUE:${id}`, kind: "CLIENT_UNIQUE", consultantId: id, details: `Les ${valid.length} ventes de ${m.name} (90 jours) vont toutes au même client (…${only.slice(-4)}) : compte peut-être créé pour un seul acheteur.`, score: 2 })) {
        created++;
        await alertAdmins("Ventes toutes au même client", `${m.name} : ${valid.length} ventes au même numéro en 90 jours.`);
      }
    }
    const rate = returnRate(list.map((o) => ({ cancelledAfterPay: o.status === "ANNULEE" && !!o.paidAt, refunded: !!o.refundedAt, returned: o._count.returns > 0 })));
    if (rate != null && rate >= RETURN_RATE_LIMIT) {
      if (await raise({ key: `member:RETOURS:${id}:${now.toISOString().slice(0, 7)}`, kind: "RETOURS", consultantId: id, details: `${Math.round(rate * 100)} % des ${list.length} commandes de ${m.name} (90 jours) ont été annulées après paiement, remboursées ou retournées.`, score: 2 })) {
        created++;
        await alertAdmins("Retours anormaux", `${m.name} : ${Math.round(rate * 100)} % de commandes annulées, remboursées ou retournées sur 90 jours.`);
      }
    }
  }
  return { nouveaux: created };
}

/** Décision de l'admin : VALIDE (pas de fraude, commissions créditées) ou FRAUDE (commissions annulées). */
export async function resolveFlag(flagId: string, decision: "VALIDE" | "FRAUDE", by: string | null) {
  const flag = await prisma.fraudFlag.findUnique({ where: { id: flagId } });
  if (!flag || flag.status !== "OUVERT") return { ok: false, count: 0 };
  await prisma.fraudFlag.update({ where: { id: flagId }, data: { status: decision, resolvedAt: new Date(), resolvedBy: by } });
  // Commissions concernées : celles de la vente signalée, ou celles du membre (sauf ventes encore signalées).
  let where: { status: string; orderId?: string | { notIn: string[] }; consultantId?: string };
  if (flag.orderId) where = { status: "EN_REVUE", orderId: flag.orderId };
  else {
    const stillOpen = await prisma.fraudFlag.count({ where: { status: "OUVERT", orderId: null, consultantId: flag.consultantId } });
    if (stillOpen && decision === "VALIDE") return { ok: true, count: 0 }; // un autre signalement le garde sous surveillance
    const openOrders = (await prisma.fraudFlag.findMany({ where: { status: "OUVERT", orderId: { not: null } }, select: { orderId: true } })).map((f) => f.orderId!);
    where = { status: "EN_REVUE", consultantId: flag.consultantId, orderId: { notIn: openOrders } };
  }
  const r = await prisma.commissionEntry.updateMany({ where, data: { status: decision === "VALIDE" ? "A_VERSER" : "ANNULE" } });
  if (decision === "VALIDE") await creditCommissionEntries(flag.orderId ? { orderId: flag.orderId } : { consultantId: flag.consultantId });
  return { ok: true, count: r.count };
}
