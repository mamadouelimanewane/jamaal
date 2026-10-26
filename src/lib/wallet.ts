/**
 * Wallet JAMAAL des revendeurs et des livreurs.
 *
 * Registre de mouvements (WalletTransaction) :
 * - crédits : commissions, primes, parts de livraison, dépôts (Wave / Orange Money) ;
 * - débits : retraits vers Wave / Orange Money, paiement d'une commande avec le wallet ;
 * - corrections : annulation d'une commande, ajustement par l'admin.
 * Solde disponible = mouvements validés + retraits en attente (bloqués jusqu'au versement).
 * Fichier serveur.
 */
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { getBusinessModel } from "./business-model-store";
import { payoutChannels } from "./business-model";
import { COLLECT_LABELS, COLLECT_REF_PREFIX, collectRefusal, type CollectMethod } from "./special-terms";
import { isWalletProvider, payoutProvidersConfig, refreshWave, sendPayout, WALLET_LABELS, type PayoutResult, type WalletProvider } from "./payouts/providers";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { alertWalletCredits, alertWithdrawalPaid } from "@/lib/whatsapp/alerts";
import { notifyWalletCredits, type WalletCreditNotice } from "./wallet-notify";

export type OwnerType = "CONSULTANT" | "LIVREUR";
export type Owner = { type: OwnerType; id: string };
type Tx = Prisma.TransactionClient;

export const KIND_LABELS: Record<string, string> = {
  COMMISSION: "Commission",
  PRIME: "Prime",
  LIVRAISON: "Livraison effectuée",
  DEPOT: "Dépôt",
  RETRAIT: "Retrait",
  PAIEMENT: "Paiement d'une commande",
  ANNULATION: "Annulation",
  AJUSTEMENT: "Ajustement JAMAAL",
};
export const STATUS_LABELS: Record<string, string> = { EN_ATTENTE: "En attente", VALIDE: "Validé", ECHEC: "Échec", ANNULE: "Annulé" };

export class WalletError extends Error {}

/** Montant minimal d'un retrait (FCFA). */
export async function minWithdrawal() {
  const m = await getBusinessModel();
  return Math.max(500, m.minPayout || 0);
}

/** Solde disponible et détail. */
export async function walletBalance(owner: Owner, db: Tx | typeof prisma = prisma) {
  const rows = await db.walletTransaction.groupBy({
    by: ["status", "kind"],
    where: { ownerType: owner.type, ownerId: owner.id, status: { in: ["VALIDE", "EN_ATTENTE"] } },
    _sum: { amount: true },
  });
  let balance = 0, pendingOut = 0, pendingIn = 0, earned = 0;
  for (const r of rows) {
    const s = r._sum.amount ?? 0;
    if (r.status === "VALIDE") {
      balance += s;
      if (["COMMISSION", "PRIME", "LIVRAISON"].includes(r.kind)) earned += s;
    } else if (r.kind === "RETRAIT" || r.kind === "PAIEMENT") {
      balance += s; // bloqué
      pendingOut += -s;
    } else if (r.kind === "DEPOT") pendingIn += s;
  }
  return { balance, pendingOut, pendingIn, earned };
}

/** Coordonnées de versement du titulaire. */
export async function ownerWallet(owner: Owner) {
  if (owner.type === "CONSULTANT") {
    const c = await prisma.consultant.findUnique({ where: { id: owner.id }, select: { name: true, walletProvider: true, walletNumber: true, walletHolderName: true, whatsapp: true, email: true } });
    return c ? { name: c.name, provider: c.walletProvider, number: c.walletNumber, holder: c.walletHolderName ?? c.name, phone: c.whatsapp, email: c.email } : null;
  }
  const l = await prisma.livreur.findUnique({ where: { id: owner.id }, select: { name: true, walletProvider: true, walletNumber: true, phone: true } });
  return l ? { name: l.name, provider: l.walletProvider, number: l.walletNumber, holder: l.name, phone: l.phone, email: null } : null;
}

/** Crédite les commissions et primes enregistrées mais pas encore créditées (idempotent). */
export async function creditCommissionEntries(where: Prisma.CommissionEntryWhereInput = {}) {
  const entries = await prisma.commissionEntry.findMany({ where: { ...where, status: "A_VERSER", payoutId: null, amount: { gt: 0 } } });
  const credited: { consultantId: string; amount: number; prime: boolean }[] = [];
  const notices: WalletCreditNotice[] = [];
  for (const e of entries) {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.commissionEntry.updateMany({ where: { id: e.id, status: "A_VERSER", payoutId: null }, data: { status: "WALLET" } });
      if (!claim.count) return;
      credited.push({ consultantId: e.consultantId, amount: e.amount, prime: e.level.startsWith("PRIME_") });
      notices.push({ ownerType: "CONSULTANT", ownerId: e.consultantId, amount: e.amount, level: e.level, orderId: e.orderId, rate: e.rate, base: e.base });
      await tx.walletTransaction.upsert({
        where: { sourceId: `ce:${e.id}` },
        update: {},
        create: {
          ownerType: "CONSULTANT",
          ownerId: e.consultantId,
          amount: e.amount,
          kind: e.level.startsWith("PRIME_") ? "PRIME" : "COMMISSION",
          sourceId: `ce:${e.id}`,
          orderId: e.orderId.startsWith("PRIME-") ? null : e.orderId,
          note: e.level.startsWith("PRIME_") ? `Prime d'équipe ${e.orderId.replace("PRIME-EQUIPE-", "")}` : `${e.rate} % de ${e.base.toLocaleString("fr-FR")} F`,
        },
      });
    });
  }
  alertWalletCredits(credited);
  // Notification dans l'application pour chaque bénéficiaire (vendeur, parrains, primes).
  await notifyWalletCredits(notices);
  return entries.length;
}

/** Crédite la part du livreur d'une livraison effectuée (idempotent). */
export async function creditLivreurEarnings(where: Prisma.LivreurEarningWhereInput = {}) {
  const earnings = await prisma.livreurEarning.findMany({ where: { ...where, status: "A_VERSER", amount: { gt: 0 } } });
  const notices: WalletCreditNotice[] = [];
  for (const e of earnings) {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.livreurEarning.updateMany({ where: { id: e.id, status: "A_VERSER" }, data: { status: "WALLET" } });
      if (!claim.count) return;
      notices.push({ ownerType: "LIVREUR", ownerId: e.livreurId, amount: e.amount, level: "LIVRAISON", orderId: e.orderId });
      await tx.walletTransaction.upsert({
        where: { sourceId: `le:${e.id}` },
        update: {},
        create: { ownerType: "LIVREUR", ownerId: e.livreurId, amount: e.amount, kind: "LIVRAISON", sourceId: `le:${e.id}`, orderId: e.orderId, note: "Part de livraison" },
      });
    });
  }
  await notifyWalletCredits(notices);
  return earnings.length;
}

/** Commande annulée : les gains déjà crédités sur les wallets sont repris. */
export async function reverseWalletCreditsForOrder(orderId: string) {
  const credits = await prisma.walletTransaction.findMany({ where: { orderId, kind: { in: ["COMMISSION", "LIVRAISON"] }, status: "VALIDE", amount: { gt: 0 } } });
  for (const c of credits) {
    await prisma.walletTransaction.upsert({
      where: { sourceId: `annul:${c.id}` },
      update: {},
      create: { ownerType: c.ownerType, ownerId: c.ownerId, amount: -c.amount, kind: "ANNULATION", sourceId: `annul:${c.id}`, orderId, note: `Commande ${orderId.slice(-8).toUpperCase()} annulée` },
    });
  }
  // Vente encaissée par le revendeur puis annulée : il rend l'argent au client, son débit est annulé.
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { paymentRef: true } });
  if (order?.paymentRef?.startsWith(COLLECT_REF_PREFIX)) {
    const debits = await prisma.walletTransaction.findMany({ where: { orderId, kind: "PAIEMENT", status: "VALIDE", amount: { lt: 0 } } });
    for (const d of debits) {
      await prisma.walletTransaction.upsert({
        where: { sourceId: `annul:${d.id}` },
        update: {},
        create: { ownerType: d.ownerType, ownerId: d.ownerId, amount: -d.amount, kind: "PAIEMENT", sourceId: `annul:${d.id}`, orderId, note: `Commande ${orderId.slice(-8).toUpperCase()} annulée : encaissement repris` },
      });
    }
  }
  await prisma.commissionEntry.updateMany({ where: { orderId, status: "WALLET" }, data: { status: "ANNULE" } });
  await prisma.livreurEarning.updateMany({ where: { orderId, status: "WALLET" }, data: { status: "ANNULE" } });
}

/** Verrou par titulaire, le temps d'une transaction (deux retraits simultanés ne passent pas). */
async function lockOwner(tx: Tx, owner: Owner) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${owner.type}:${owner.id}`}))`;
}

/**
 * Demande de retrait vers le compte Wave / Orange Money du titulaire. Le montant est bloqué
 * aussitôt ; il est envoyé automatiquement si le versement est configuré, sinon JAMAAL le
 * verse à la main depuis Admin › Wallets.
 */
export async function requestWithdrawal(owner: Owner, amount: number, by: string | null) {
  if (!Number.isInteger(amount) || amount <= 0) throw new WalletError("Montant invalide.");
  const min = await minWithdrawal();
  if (amount < min) throw new WalletError(`Retrait minimal : ${min.toLocaleString("fr-FR")} F.`);
  const w = await ownerWallet(owner);
  if (!w || !isWalletProvider(w.provider) || !w.number) throw new WalletError("Renseignez d'abord votre compte Wave ou Orange Money (numéro et titulaire).");
  const channels = payoutChannels(await getBusinessModel());
  if (!channels.includes(w.provider)) throw new WalletError(`Les retraits vers ${WALLET_LABELS[w.provider]} ne sont plus proposés : enregistrez un compte ${channels.map((c) => WALLET_LABELS[c]).join(" ou ")} ci-dessous.`);
  const tx = await prisma.$transaction(async (db) => {
    await lockOwner(db, owner);
    const { balance } = await walletBalance(owner, db);
    if (amount > balance) throw new WalletError(`Solde insuffisant : ${balance.toLocaleString("fr-FR")} F disponibles.`);
    return db.walletTransaction.create({
      data: { ownerType: owner.type, ownerId: owner.id, amount: -amount, kind: "RETRAIT", status: "EN_ATTENTE", provider: w.provider, phone: w.number, createdBy: by, note: `Vers ${WALLET_LABELS[w.provider as WalletProvider]} ${w.number}` },
    });
  });
  await sendWithdrawal(tx.id);
  return prisma.walletTransaction.findUniqueOrThrow({ where: { id: tx.id } });
}

/**
 * Envoie un retrait en attente sur le compte Wave / Orange Money choisi par le membre, sans validation manuelle,
 * dès que le versement automatique est configuré. BLOQUE (problème du compte JAMAAL : clé, solde) : rien n'est
 * envoyé, le retrait reste en attente et repart à la prochaine relance ; l'équipe est prévenue.
 */
export async function sendWithdrawal(txId: string) {
  const model = await getBusinessModel();
  const t = await prisma.walletTransaction.findUnique({ where: { id: txId } });
  if (!t || t.kind !== "RETRAIT" || t.status !== "EN_ATTENTE" || t.providerRef || !isWalletProvider(t.provider) || !t.phone) return;
  if (!model.payoutsEnabled || !payoutProvidersConfig()[t.provider]) return;
  // Réserve l'envoi (deux relances simultanées n'envoient pas deux fois ; Wave déduplique aussi par la référence).
  const claim = await prisma.walletTransaction.updateMany({ where: { id: t.id, status: "EN_ATTENTE", providerRef: null }, data: { providerRef: "envoi" } });
  if (!claim.count) return;
  const w = await ownerWallet({ type: t.ownerType as OwnerType, id: t.ownerId });
  const result = await sendPayout(t.provider, { reference: t.id, amount: -t.amount, mobile: t.phone, name: w?.holder ?? "" });
  await applyWithdrawalResult(t.id, result);
  if (result.status === "BLOQUE" && t.error !== result.error) {
    notifyTeamWhatsApp(`⚠️ Retrait automatique bloqué : ${(-t.amount).toLocaleString("fr-FR")} F vers ${t.phone} (${w?.name ?? "membre"}). Cause : ${result.error}. Il repartira tout seul à la prochaine relance (ou Admin > Wallets).`);
  }
}

async function applyWithdrawalResult(txId: string, result: PayoutResult) {
  await prisma.walletTransaction.update({
    where: { id: txId },
    data:
      result.status === "VERSE"
        ? { status: "VALIDE", providerRef: result.providerRef ?? null, error: null }
        : result.status === "ECHEC"
          ? { status: "ECHEC", providerRef: result.providerRef ?? null, error: result.error?.slice(0, 300) ?? "Échec du versement" }
          : result.status === "BLOQUE"
            ? { providerRef: null, error: result.error?.slice(0, 300) ?? "Versement automatique indisponible" }
            : { providerRef: result.providerRef ?? "en-cours", error: null },
  });
  if (result.status === "VERSE") alertWithdrawalPaid(txId);
}

/**
 * Relance (tâches du matin et du soir, bouton admin) : renvoie les retraits en attente pas encore envoyés
 * (ex. demandés avant l'activation des versements) et relit l'état des versements Wave en cours.
 */
export async function retryPendingWithdrawals(max = 40) {
  const pending = await prisma.walletTransaction.findMany({ where: { kind: "RETRAIT", status: "EN_ATTENTE" }, orderBy: { createdAt: "asc" }, take: max });
  let envoyes = 0, verses = 0, enCours = 0;
  for (const t of pending) {
    if (!t.providerRef) {
      await sendWithdrawal(t.id);
      envoyes++;
    } else if (t.provider === "WAVE" && !["envoi", "en-cours"].includes(t.providerRef) && payoutProvidersConfig().WAVE) {
      const r = await refreshWave(t.providerRef);
      if (r.status === "VERSE" || r.status === "ECHEC") await applyWithdrawalResult(t.id, { ...r, providerRef: t.providerRef });
      if (r.status === "VERSE") verses++;
      else if (r.status === "EN_COURS") enCours++;
    } else if (t.providerRef === "envoi" && Date.now() - t.updatedAt.getTime() > 15 * 60_000) {
      // Envoi interrompu (coupure) : on le relance, Wave refuse un doublon de la même référence.
      await prisma.walletTransaction.updateMany({ where: { id: t.id, providerRef: "envoi" }, data: { providerRef: null } });
      await sendWithdrawal(t.id);
      envoyes++;
    }
  }
  const after = await prisma.walletTransaction.count({ where: { kind: "RETRAIT", status: "EN_ATTENTE" } });
  return { relances: envoyes, versesConfirmes: verses, enCours, toujoursEnAttente: after };
}

/** Admin : retrait versé à la main, ou refusé (le montant revient sur le wallet). */
export async function resolveWithdrawal(txId: string, paid: boolean, by: string | null, note?: string) {
  const res = await prisma.walletTransaction.updateMany({
    where: { id: txId, kind: "RETRAIT", status: "EN_ATTENTE" },
    data: paid ? { status: "VALIDE", createdBy: by, providerRef: note?.slice(0, 80) || "manuel" } : { status: "ANNULE", createdBy: by, error: note?.slice(0, 300) || "Refusé par JAMAAL" },
  });
  if (!res.count) throw new WalletError("Ce retrait n'est plus en attente.");
  if (paid) alertWithdrawalPaid(txId);
}

/** Admin : crédit ou débit manuel (dépôt en espèces, correction…). */
export async function adjustWallet(owner: Owner, amount: number, note: string, by: string | null) {
  if (!Number.isInteger(amount) || amount === 0) throw new WalletError("Montant invalide.");
  if (note.trim().length < 3) throw new WalletError("Indiquez le motif.");
  return prisma.walletTransaction.create({ data: { ownerType: owner.type, ownerId: owner.id, amount, kind: amount > 0 && /d[ée]p[ôo]t/i.test(note) ? "DEPOT" : "AJUSTEMENT", note: note.trim().slice(0, 200), createdBy: by } });
}

/** Dépôt en ligne : mouvement en attente, validé par le retour du prestataire de paiement. */
export const DEPOSIT_PREFIX = "wdep_";
export async function createDeposit(owner: Owner, amount: number, provider: WalletProvider, by: string | null) {
  if (!Number.isInteger(amount) || amount < 500 || amount > 2_000_000) throw new WalletError("Dépôt entre 500 F et 2 000 000 F.");
  return prisma.walletTransaction.create({ data: { ownerType: owner.type, ownerId: owner.id, amount, kind: "DEPOT", status: "EN_ATTENTE", provider, createdBy: by, note: `Dépôt ${WALLET_LABELS[provider]}` } });
}

/** Retour du prestataire : dépôt payé (idempotent, montant contrôlé). */
export async function markDepositPaid(txId: string, opts: { externalRef?: string; amount?: number }) {
  const t = await prisma.walletTransaction.findUnique({ where: { id: txId } });
  if (!t || t.kind !== "DEPOT") return false;
  if (t.status === "VALIDE") return true;
  if (opts.amount != null && opts.amount !== t.amount) {
    console.error("[wallet] montant de dépôt inattendu", txId, opts.amount, t.amount);
    return false;
  }
  await prisma.walletTransaction.updateMany({ where: { id: txId, status: "EN_ATTENTE" }, data: { status: "VALIDE", providerRef: opts.externalRef ?? null } });
  return true;
}

/** Paie une commande avec le wallet (dans la transaction de création de la commande). */
export async function debitForOrder(db: Tx, owner: Owner, orderId: string, amount: number, by: string | null) {
  await lockOwner(db, owner);
  const { balance } = await walletBalance(owner, db);
  if (amount > balance) throw new WalletError(`Solde du wallet insuffisant : ${balance.toLocaleString("fr-FR")} F disponibles pour ${amount.toLocaleString("fr-FR")} F.`);
  await db.walletTransaction.create({ data: { ownerType: owner.type, ownerId: owner.id, amount: -amount, kind: "PAIEMENT", orderId, sourceId: `pay:${orderId}`, createdBy: by, note: `Commande ${orderId.slice(-8).toUpperCase()}` } });
}

/**
 * Vente encaissée directement par le revendeur (espèces, Wave, Orange Money — conditions spéciales) : le montant
 * passe au débit de son wallet, qui peut devenir négatif jusqu'au plafond (argent à reverser à JAMAAL).
 */
export async function debitCollectedForOrder(db: Tx, owner: Owner, orderId: string, amount: number, method: CollectMethod, creditLimit: number, by: string | null) {
  await lockOwner(db, owner);
  const { balance } = await walletBalance(owner, db);
  const refusal = collectRefusal(balance, amount, creditLimit);
  if (refusal) throw new WalletError(refusal);
  await db.walletTransaction.create({ data: { ownerType: owner.type, ownerId: owner.id, amount: -amount, kind: "PAIEMENT", orderId, sourceId: `pay:${orderId}`, createdBy: by, note: `Encaissé (${COLLECT_LABELS[method]}) · commande ${orderId.slice(-8).toUpperCase()}` } });
}

/** Historique d'un wallet (plus récent d'abord). */
export function walletHistory(owner: Owner, take = 50) {
  return prisma.walletTransaction.findMany({ where: { ownerType: owner.type, ownerId: owner.id }, orderBy: { createdAt: "desc" }, take });
}
