/**
 * Commissions par commande et versements automatiques sur wallet (Wave / Orange Money).
 *
 * 1. recordCommissionsForOrder : quand une commande ouvre droit à commission, on enregistre
 *    une ligne par bénéficiaire (vendeur, parrain direct, grand-parrain) avec les taux du
 *    modèle économique en vigueur. Idempotent (clé unique commande + membre + niveau).
 * 2. processPayouts : pour chaque membre ayant un wallet, on regroupe ses commissions
 *    « à verser » dans un versement et on l'envoie. Réussi → commissions « versées » et
 *    versement inscrit dans l'historique (CommissionPayment). Échec → les commissions
 *    restent à verser et pourront être renvoyées.
 *
 * Fichier serveur uniquement : jamais exposé comme action appelable depuis le navigateur.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { sponsorRatesFor, type BusinessModel } from "@/lib/business-model";
import { commissionBase } from "@/lib/commission";
import { creditCommissionEntries, reverseWalletCreditsForOrder } from "@/lib/wallet";
import { isWalletProvider, payoutProvidersConfig, refreshWave, sendPayout, WALLET_LABELS, type PayoutResult } from "./providers";

export type Level = "VENTE" | "NIVEAU_1" | "NIVEAU_2";

/** Rafraîchit les pages concernées (sans effet hors d'une requête, ex. tâche de fond). */
function refreshPages() {
  try {
    revalidatePath("/admin/versements");
    revalidatePath("/admin/mes-gains");
  } catch {
    // appelé hors contexte de requête : les pages se mettront à jour au prochain affichage
  }
}

/** La commande ouvre-t-elle droit à commission maintenant, selon le déclencheur choisi ? */
function isPayable(order: { status: string; paymentStatus: string; paymentMethod: string }, model: BusinessModel) {
  if (order.status === "ANNULEE") return false;
  const cashed = order.paymentStatus === "PAYE" || (order.paymentMethod === "A_LA_LIVRAISON" && order.status === "LIVREE");
  if (!cashed) return false;
  return model.payoutTrigger === "PAID" || order.status === "LIVREE";
}

export type PlannedCommission = { consultantId: string; name: string; level: Level; rate: number; base: number; amount: number };

/** Commissions prévues sur une commande avec les taux actuels (sans rien écrire). */
export async function plannedCommissions(orderId: string, model?: BusinessModel) {
  const m = model ?? (await getBusinessModel());
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      total: true,
      deliveryFee: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      consultant: {
        select: { id: true, name: true, sponsor: { select: { id: true, name: true, sponsorId: true, sponsor: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!order) return null;
  const base = commissionBase(order);
  const rows: PlannedCommission[] = [];
  const seller = order.consultant;
  if (seller) {
    const sponsor = seller.sponsor;
    const grand = sponsor?.sponsor;
    const rates = sponsorRatesFor(!!sponsor?.sponsorId, m);
    rows.push({ consultantId: seller.id, name: seller.name, level: "VENTE", rate: m.sellerPct, base, amount: 0 });
    if (sponsor) rows.push({ consultantId: sponsor.id, name: sponsor.name, level: "NIVEAU_1", rate: rates.level1, base, amount: 0 });
    if (sponsor && grand) rows.push({ consultantId: grand.id, name: grand.name, level: "NIVEAU_2", rate: rates.level2, base, amount: 0 });
  }
  for (const r of rows) r.amount = Math.round((base * r.rate) / 100);
  return { order, base, rows: rows.filter((r) => r.amount > 0), payable: isPayable(order, m) };
}

/** Enregistre les commissions dues sur une commande (sans rien envoyer). Renvoie les membres concernés. */
export async function recordCommissionsForOrder(orderId: string, model?: BusinessModel): Promise<string[]> {
  const m = model ?? (await getBusinessModel());
  const plan = await plannedCommissions(orderId, m);
  if (!plan || !plan.payable || !plan.rows.length) return [];
  await prisma.commissionEntry.createMany({
    data: plan.rows.map((r) => ({ consultantId: r.consultantId, orderId, level: r.level, rate: r.rate, base: r.base, amount: r.amount })),
    skipDuplicates: true,
  });
  return plan.rows.map((r) => r.consultantId);
}

/** Annule les commissions pas encore versées d'une commande (commande annulée). */
export async function cancelCommissionsForOrder(orderId: string) {
  await prisma.commissionEntry.updateMany({ where: { orderId, status: "A_VERSER", payoutId: null }, data: { status: "ANNULE" } });
  await reverseWalletCreditsForOrder(orderId);
}

async function settle(payoutId: string, consultantId: string, amount: number, provider: string, result: PayoutResult) {
  if (result.status === "VERSE") {
    await prisma.$transaction([
      prisma.payout.update({ where: { id: payoutId }, data: { status: "VERSE", providerRef: result.providerRef ?? null, error: null } }),
      prisma.commissionEntry.updateMany({ where: { payoutId }, data: { status: "VERSE" } }),
      prisma.commissionPayment.create({
        data: { consultantId, amount, periodLabel: `Versement ${WALLET_LABELS[provider as "WAVE"] ?? provider}`, note: result.providerRef ? `Réf. ${result.providerRef}` : "Versement automatique" },
      }),
    ]);
  } else if (result.status === "ECHEC") {
    // Les commissions redeviennent disponibles pour un prochain versement.
    await prisma.$transaction([
      prisma.payout.update({ where: { id: payoutId }, data: { status: "ECHEC", providerRef: result.providerRef ?? null, error: result.error?.slice(0, 500) ?? null } }),
      prisma.commissionEntry.updateMany({ where: { payoutId }, data: { payoutId: null } }),
    ]);
  } else {
    await prisma.payout.update({ where: { id: payoutId }, data: { status: "EN_COURS", providerRef: result.providerRef ?? null } });
  }
}

/**
 * Verse les commissions « à verser » des membres indiqués (ou de tous). Ne fait rien pour un
 * membre sans wallet, si le prestataire n'est pas configuré, ou sous le montant minimal.
 */
export async function processPayouts(consultantIds?: string[], model?: BusinessModel) {
  const m = model ?? (await getBusinessModel());
  if (!m.payoutsEnabled) return { sent: 0, skipped: 0 };
  const config = payoutProvidersConfig();

  const pending = await prisma.commissionEntry.groupBy({
    by: ["consultantId"],
    where: { status: "A_VERSER", payoutId: null, ...(consultantIds ? { consultantId: { in: consultantIds } } : {}) },
    _sum: { amount: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const p of pending) {
    const amount = p._sum.amount ?? 0;
    const member = await prisma.consultant.findUnique({ where: { id: p.consultantId }, select: { id: true, name: true, walletProvider: true, walletNumber: true, walletHolderName: true } });
    if (!member || !isWalletProvider(member.walletProvider) || !member.walletNumber || !config[member.walletProvider] || amount <= 0 || amount < m.minPayout) {
      skipped += 1;
      continue;
    }

    // Réserve les commissions pour ce versement (un appel concurrent ne pourra pas les reprendre).
    const payout = await prisma.payout.create({
      data: { consultantId: member.id, amount: 0, provider: member.walletProvider, walletNumber: member.walletNumber },
    });
    const claimed = await prisma.commissionEntry.updateMany({
      where: { consultantId: member.id, status: "A_VERSER", payoutId: null },
      data: { payoutId: payout.id },
    });
    const total = (await prisma.commissionEntry.aggregate({ where: { payoutId: payout.id }, _sum: { amount: true } }))._sum.amount ?? 0;
    if (!claimed.count || total <= 0) {
      await prisma.payout.delete({ where: { id: payout.id } });
      continue;
    }
    await prisma.payout.update({ where: { id: payout.id }, data: { amount: total } });

    const result = await sendPayout(member.walletProvider, { reference: payout.id, amount: total, mobile: member.walletNumber, name: member.walletHolderName || member.name });
    await settle(payout.id, member.id, total, member.walletProvider, result);
    if (result.status !== "ECHEC") sent += 1;
  }

  refreshPages();
  return { sent, skipped };
}

/** Enregistre puis verse les commissions d'une commande. Ne lève jamais d'erreur. */
export async function runPayoutsForOrder(orderId: string) {
  try {
    const model = await getBusinessModel();
    const members = await recordCommissionsForOrder(orderId, model);
    // Les commissions sont créditées sur le wallet JAMAAL des membres, qui les retirent quand ils veulent.
    if (members.length) await creditCommissionEntries({ orderId });
    refreshPages();
  } catch (error) {
    console.error("[payouts] commande", orderId, error);
  }
}

/** Relit l'état d'un versement en cours (Wave). */
export async function refreshPayout(payoutId: string) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status !== "EN_COURS" || !payout.providerRef || payout.provider !== "WAVE" || !payoutProvidersConfig().WAVE) return;
  const result = await refreshWave(payout.providerRef);
  if (result.status !== "EN_COURS") await settle(payout.id, payout.consultantId, payout.amount, payout.provider, result);
}
