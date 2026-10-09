/**
 * Module livraison : étapes, géolocalisation, code de remise, part du livreur.
 * Fichier serveur uniquement (appelé par les actions protégées admin / livreur).
 */
import { creditLivreurEarnings } from "@/lib/wallet";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { DELIVERY_LABELS, isValidPoint, type DeliveryStatus } from "@/lib/delivery";
import { runPayoutsForOrder } from "@/lib/payouts/engine";
import { isWalletProvider, payoutProvidersConfig, sendPayout } from "@/lib/payouts/providers";
import { notifyConsultantOfDelivery } from "@/lib/notifications";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getSiteUrl } from "@/lib/site-url";

/** Transitions autorisées : étape actuelle → étapes suivantes possibles. */
const NEXT: Record<DeliveryStatus, DeliveryStatus[]> = {
  A_PREPARER: ["ASSIGNEE", "ECHEC"],
  ASSIGNEE: ["RECUPEREE", "ECHEC"],
  RECUPEREE: ["EN_ROUTE", "ECHEC"],
  EN_ROUTE: ["LIVREE", "ECHEC"],
  LIVREE: [],
  ECHEC: ["ASSIGNEE"],
};

/** Statut de commande correspondant à chaque étape de livraison. */
const ORDER_STATUS: Partial<Record<DeliveryStatus, "CONFIRMEE" | "EXPEDIEE" | "LIVREE">> = {
  ASSIGNEE: "CONFIRMEE",
  RECUPEREE: "EXPEDIEE",
  EN_ROUTE: "EXPEDIEE",
  LIVREE: "LIVREE",
};

export class DeliveryError extends Error {}

type Actor = { kind: "admin" } | { kind: "livreur"; livreurId: string };

function refresh(orderId: string) {
  try {
    for (const p of ["/admin/livraisons", "/admin/mes-livraisons", "/admin/commandes", `/admin/commandes/${orderId}`, `/suivi/${orderId}`]) revalidatePath(p);
  } catch {
    // hors contexte de requête
  }
}

/**
 * Fait passer une livraison à l'étape suivante, en enregistrant la position du livreur.
 * - Un livreur n'agit que sur ses propres livraisons ; « Livrée » exige le code du client.
 * - L'admin peut attribuer un livreur, signaler un échec ou forcer une étape (sans code).
 */
export async function advanceDelivery(
  orderId: string,
  to: DeliveryStatus,
  actor: Actor,
  opts: { lat?: number | null; lng?: number | null; code?: string; note?: string; livreurId?: string } = {}
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, deliveryStatus: true, deliveryCode: true, livreurId: true, deliveryMode: true, customerName: true, customerPhone: true, deliveryContactName: true, deliveryContactPhone: true, deliveryTarget: true, livreurShare: true },
  });
  if (!order || order.deliveryMode !== "LIVRAISON_JAMAAL") throw new DeliveryError("Cette commande n'est pas une livraison JAMAAL.");
  if (order.status === "ANNULEE") throw new DeliveryError("Commande annulée.");
  // Livraison antérieure au module, déjà confiée à un livreur : considérée comme attribuée.
  const from = (order.deliveryStatus ?? (order.livreurId ? "ASSIGNEE" : "A_PREPARER")) as DeliveryStatus;

  if (actor.kind === "livreur") {
    if (order.livreurId !== actor.livreurId) throw new DeliveryError("Cette livraison ne vous est pas attribuée.");
    if (to === "ASSIGNEE") throw new DeliveryError("Seule l'équipe JAMAAL attribue les livraisons.");
  }
  if (!NEXT[from].includes(to) && !(actor.kind === "admin" && to !== from)) {
    throw new DeliveryError(`Étape impossible : « ${DELIVERY_LABELS[from]} » → « ${DELIVERY_LABELS[to]} ».`);
  }
  if (to === "LIVREE" && actor.kind === "livreur") {
    if (!order.deliveryCode || (opts.code ?? "").trim() !== order.deliveryCode) throw new DeliveryError("Code de livraison incorrect : demandez au client le code à 4 chiffres affiché sur son suivi.");
  }
  if (to === "ECHEC" && !(opts.note ?? "").trim()) throw new DeliveryError("Indiquez la raison de l'échec.");

  const livreurId = to === "ASSIGNEE" ? opts.livreurId ?? order.livreurId : actor.kind === "livreur" ? actor.livreurId : order.livreurId;
  if (to === "ASSIGNEE" && !livreurId) throw new DeliveryError("Choisissez un livreur.");

  const point = { lat: Number(opts.lat), lng: Number(opts.lng) };
  const hasPoint = isValidPoint(point);
  const orderStatus = ORDER_STATUS[to];
  const now = new Date();

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: to,
        ...(to === "ASSIGNEE" ? { livreurId } : {}),
        ...(orderStatus && !(orderStatus === "CONFIRMEE" && order.status !== "EN_ATTENTE") ? { status: orderStatus } : {}),
        ...(to === "LIVREE" ? { deliveredAt: now } : {}),
      },
    }),
    prisma.deliveryEvent.create({
      data: { orderId, livreurId, status: to, lat: hasPoint ? point.lat : null, lng: hasPoint ? point.lng : null, note: opts.note?.trim().slice(0, 300) || null },
    }),
    ...(orderStatus && orderStatus !== order.status ? [prisma.orderStatusHistory.create({ data: { orderId, status: orderStatus } })] : []),
    ...(hasPoint && actor.kind === "livreur" ? [prisma.livreur.update({ where: { id: actor.livreurId }, data: { lastLat: point.lat, lastLng: point.lng, lastSeenAt: now } })] : []),
  ]);

  // Effets après la réponse : messages au client, commissions, part du livreur.
  const effects = async () => {
    try {
      await afterStep(orderId, to, order);
    } catch (error) {
      console.error("[livraison]", orderId, to, error);
    }
  };
  // Après la réponse si on est dans une requête ; sinon (tâche de fond, test) tout de suite.
  try {
    after(effects);
  } catch {
    await effects();
  }
  refresh(orderId);
}

type StepOrder = {
  customerName: string;
  customerPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactPhone: string | null;
  deliveryTarget: string | null;
  livreurShare: number;
};

async function afterStep(orderId: string, to: DeliveryStatus, order: StepOrder) {
  const site = await getSiteUrl().catch(() => "");
  const track = site ? `${site}/suivi/${orderId}` : "";
  // La personne qui reçoit le colis : le client, ou le vendeur s'il se fait livrer à sa propre adresse.
  const atVendor = order.deliveryTarget === "VENDEUR";
  const contactName = order.deliveryContactName ?? order.customerName;
  const contactPhone = order.deliveryContactPhone ?? order.customerPhone;
  if (to === "EN_ROUTE" && contactPhone) {
    const o = await prisma.order.findUnique({ where: { id: orderId }, select: { deliveryCode: true, livreur: { select: { name: true } } } });
    await sendWhatsApp({
      to: contactPhone,
      kind: atVendor ? "reseller" : "client",
      text: `Bonjour ${contactName}, ${atVendor ? `la commande JAMAAL de ${order.customerName}` : "votre commande JAMAAL"} est en route${o?.livreur ? ` avec ${o.livreur.name}` : ""}. Suivez-la en direct : ${track}\nCode de livraison à donner au livreur : ${o?.deliveryCode ?? ""}`,
    });
  }
  if (to === "LIVREE") {
    // Chaque effet est indépendant : l'échec d'une notification ne bloque pas les versements.
    const safely = (label: string, fn: () => Promise<unknown>) => fn().catch((e) => console.error(`[livraison] ${label}`, orderId, e));
    await safely("commissions", () => runPayoutsForOrder(orderId));
    await safely("part livreur", () => recordLivreurEarning(orderId));
    await safely("consultant", () => notifyConsultantOfDelivery(orderId));
    // Livré chez le vendeur : il est déjà prévenu par la notification consultant ci-dessus.
    if (!atVendor && contactPhone) await safely("client", () => sendWhatsApp({ to: contactPhone, kind: "client", text: `Merci ${contactName} ! Votre commande JAMAAL a bien été livrée. À très vite.` }));
  }
}

/** Enregistre la part du livreur sur une livraison effectuée, puis la verse sur son wallet. */
export async function recordLivreurEarning(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { livreurId: true, livreurShare: true, deliveryStatus: true } });
  if (!order?.livreurId || order.deliveryStatus !== "LIVREE" || order.livreurShare <= 0) return;
  await prisma.livreurEarning.createMany({ data: [{ livreurId: order.livreurId, orderId, amount: order.livreurShare }], skipDuplicates: true });
  // Créditée sur le wallet JAMAAL du livreur, qu'il retire vers Wave / Orange Money quand il veut.
  await creditLivreurEarnings({ orderId });
}

/** Verse les gains « à verser » des livreurs (wallet renseigné et prestataire configuré). */
export async function payLivreurs(livreurIds?: string[]) {
  const model = await getBusinessModel();
  if (!model.payoutsEnabled) return 0;
  const config = payoutProvidersConfig();
  const earnings = await prisma.livreurEarning.findMany({
    where: { status: "A_VERSER", ...(livreurIds ? { livreurId: { in: livreurIds } } : {}) },
    include: { livreur: { select: { name: true, walletProvider: true, walletNumber: true } } },
  });
  let sent = 0;
  for (const e of earnings) {
    const { walletProvider, walletNumber, name } = e.livreur;
    if (!isWalletProvider(walletProvider) || !walletNumber || !config[walletProvider]) continue;
    // Réservation atomique : un autre appel ne versera pas la même part.
    const claimed = await prisma.livreurEarning.updateMany({ where: { id: e.id, status: "A_VERSER" }, data: { status: "EN_COURS", provider: walletProvider } });
    if (!claimed.count) continue;
    const result = await sendPayout(walletProvider, { reference: `liv-${e.id}`, amount: e.amount, mobile: walletNumber, name });
    await prisma.livreurEarning.update({
      where: { id: e.id },
      data:
        result.status === "VERSE"
          ? { status: "VERSE", providerRef: result.providerRef ?? null, error: null }
          : result.status === "ECHEC"
            ? { status: "A_VERSER", providerRef: result.providerRef ?? null, error: result.error?.slice(0, 300) ?? null }
            : { status: "EN_COURS", providerRef: result.providerRef ?? null },
    });
    if (result.status === "VERSE") sent += 1;
  }
  return sent;
}
