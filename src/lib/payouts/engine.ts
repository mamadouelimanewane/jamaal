/**
 * Commissions par commande et crédits instantanés dans le wallet JAMAAL.
 *
 * 1. recordCommissionsForOrder : quand une commande ouvre droit à commission, on enregistre
 *    une ligne par bénéficiaire (vendeur, parrain direct, grand-parrain) avec les taux du
 *    modèle économique en vigueur. Idempotent (clé unique commande + membre + niveau).
 * 2. creditCommissionEntries : ajoute chaque commission au solde interne, de façon idempotente.
 *
 * Fichier serveur uniquement : jamais exposé comme action appelable depuis le navigateur.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { commissionRatesFor, type BusinessModel } from "@/lib/business-model";
import { effectiveTitle } from "@/lib/network";
import { commissionBase } from "@/lib/commission";
import { creditCommissionEntries, reverseWalletCreditsForOrder } from "@/lib/wallet";
import { withSpecialRates } from "@/lib/special-terms";

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
        select: { id: true, name: true, rank: true, specialTerms: true, sponsor: { select: { id: true, name: true, sponsorId: true, sponsor: { select: { id: true, name: true } } } } },
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
    // Le scénario dépend du rang du vendeur (rang attribué, sinon sa place dans la chaîne) et de la chaîne au-dessus de lui.
    const depth = !sponsor ? 0 : !sponsor.sponsorId ? 1 : 2;
    // Conditions spéciales du vendeur : ses taux propres remplacent ceux du modèle économique.
    const rates = withSpecialRates(commissionRatesFor(effectiveTitle(seller.rank, depth), !!sponsor?.sponsorId, m), seller.specialTerms);
    rows.push({ consultantId: seller.id, name: seller.name, level: "VENTE", rate: rates.seller, base, amount: 0 });
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

/** Enregistre puis crédite immédiatement les commissions dans les wallets JAMAAL. Ne lève jamais d'erreur. */
export async function runPayoutsForOrder(orderId: string) {
  try {
    const model = await getBusinessModel();
    const members = await recordCommissionsForOrder(orderId, model);
    // Le solde interne est crédité automatiquement ; le membre choisit ensuite le montant à retirer.
    if (members.length) await creditCommissionEntries({ orderId });
    refreshPages();
  } catch (error) {
    console.error("[payouts] commande", orderId, error);
  }
}

/**
 * Filet de sécurité (tâche quotidienne) : rattrape les commissions pas encore enregistrées ou créditées.
 * Idempotent : ne crédite jamais deux fois. Retourne ce qui a été rattrapé.
 */
export async function sweepMissedCommissions(now: Date = new Date(), max = 60) {
  const model = await getBusinessModel();
  const since = new Date(now.getTime() - 45 * 86_400_000);
  const candidates = await prisma.order.findMany({
    where: {
      consultantId: { not: null },
      status: { not: "ANNULEE" },
      createdAt: { gte: since },
      OR: [{ paymentStatus: "PAYE" }, { paymentMethod: "A_LA_LIVRAISON", status: "LIVREE" }],
    },
    select: { id: true, status: true, paymentStatus: true, paymentMethod: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const payable = candidates.filter((o) => isPayable(o, model));
  const done = new Set((await prisma.commissionEntry.findMany({ where: { orderId: { in: payable.map((o) => o.id) } }, select: { orderId: true } })).map((e) => e.orderId));
  const missed = payable.filter((o) => !done.has(o.id)).slice(0, max);
  for (const o of missed) await runPayoutsForOrder(o.id);
  const gainsCredites = await creditCommissionEntries();
  return { commandesRattrapees: missed.length, gainsCredites };
}
