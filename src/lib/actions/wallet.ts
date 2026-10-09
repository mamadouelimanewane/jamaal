"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getReseller } from "@/lib/reseller";
import { getBusinessModel } from "@/lib/business-model-store";
import { getAvailablePaymentProviders, getPaymentProvider } from "@/lib/payment";
import { getSiteUrl } from "@/lib/site-url";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { isWalletProvider, WALLET_LABELS } from "@/lib/payouts/providers";
import { adjustWallet, createDeposit, DEPOSIT_PREFIX, requestWithdrawal, resolveWithdrawal, sendWithdrawal, WalletError, type Owner } from "@/lib/wallet";
import { saveDepositNumbers } from "@/lib/wallet-settings";

export type WalletActionState = { ok: boolean; message?: string; error?: string; redirectUrl?: string };

/** Titulaire connecté : revendeur (consultant) ou livreur. L'admin en « vue consultant » ne peut pas déplacer d'argent. */
async function currentOwner(): Promise<{ owner: Owner; userId: string; name: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Session expirée : reconnectez-vous." };
  if (session.user.role === "LIVREUR") {
    const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { livreur: { select: { id: true, name: true } } } });
    return u?.livreur ? { owner: { type: "LIVREUR", id: u.livreur.id }, userId: session.user.id, name: u.livreur.name } : { error: "Aucun profil livreur." };
  }
  const me = await getReseller();
  if (!me) return { error: "Réservé aux revendeurs et aux livreurs." };
  if (me.viewAs) return { error: "Mode consultation : l'administrateur ne peut pas déplacer l'argent d'un membre." };
  return { owner: { type: "CONSULTANT", id: me.id }, userId: session.user.id, name: me.name };
}

const fail = (e: unknown): WalletActionState => ({ ok: false, error: e instanceof WalletError ? e.message : "Opération impossible, réessayez." });
const refresh = () => {
  for (const p of ["/admin", "/admin/mon-wallet", "/admin/mes-livraisons", "/admin/wallets", "/admin/mes-gains"]) revalidatePath(p);
};
const amountOf = (fd: FormData) => Math.round(Number(String(fd.get("amount") ?? "").replace(/[\s .]/g, "").replace(",", ".")));

/** Retirer de l'argent vers Wave / Orange Money. */
export async function withdrawAction(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const me = await currentOwner();
  if ("error" in me) return { ok: false, error: me.error };
  try {
    const t = await requestWithdrawal(me.owner, amountOf(fd), me.userId);
    refresh();
    if (t.status === "VALIDE") return { ok: true, message: `${(-t.amount).toLocaleString("fr-FR")} F envoyés sur votre compte ${WALLET_LABELS[t.provider as "WAVE"] ?? ""} ${t.phone}.` };
    if (t.status === "ECHEC") return { ok: false, error: `Le versement a échoué (${t.error ?? "prestataire"}) : le montant reste sur votre wallet. Réessayez plus tard.` };
    notifyTeamWhatsApp(`Demande de retrait wallet : ${me.name}, ${(-t.amount).toLocaleString("fr-FR")} F vers ${t.phone}. À verser dans Admin > Wallets.`);
    return { ok: true, message: `Demande de retrait de ${(-t.amount).toLocaleString("fr-FR")} F enregistrée : JAMAAL vous verse le montant sur ${t.phone} au plus vite. Il est bloqué sur votre wallet en attendant.` };
  } catch (e) {
    return fail(e);
  }
}

/** Mettre de l'argent sur son wallet : paiement en ligne si possible, sinon dépôt déclaré à valider par JAMAAL. */
export async function depositAction(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const me = await currentOwner();
  if ("error" in me) return { ok: false, error: me.error };
  const provider = fd.get("provider");
  if (!isWalletProvider(provider)) return { ok: false, error: "Choisissez Wave ou Orange Money." };
  const mode = fd.get("mode") === "declare" ? "declare" : "online";
  try {
    const t = await createDeposit(me.owner, amountOf(fd), provider, me.userId);
    if (mode === "declare") {
      const ref = String(fd.get("reference") ?? "").trim().slice(0, 60);
      if (ref.length < 4) {
        await prisma.walletTransaction.delete({ where: { id: t.id } });
        return { ok: false, error: "Indiquez la référence de la transaction (reçue par SMS)." };
      }
      await prisma.walletTransaction.update({ where: { id: t.id }, data: { providerRef: ref, note: `Dépôt ${WALLET_LABELS[provider]} déclaré (réf. ${ref})` } });
      notifyTeamWhatsApp(`Dépôt wallet déclaré : ${me.name}, ${t.amount.toLocaleString("fr-FR")} F par ${WALLET_LABELS[provider]} (réf. ${ref}). À valider dans Admin > Wallets.`);
      refresh();
      return { ok: true, message: "Dépôt déclaré : il sera ajouté à votre solde dès que JAMAAL l'aura vérifié." };
    }
    const id = provider === "WAVE" ? "wave" : "orange_money";
    const p = getPaymentProvider(id);
    const offered = getAvailablePaymentProviders(await getBusinessModel()).some((x) => x.id === id);
    if (!p || !p.available || !offered) {
      await prisma.walletTransaction.delete({ where: { id: t.id } });
      return { ok: false, error: `Le paiement ${WALLET_LABELS[provider]} en ligne n'est pas encore ouvert : utilisez « J'ai envoyé l'argent » avec la référence de la transaction.` };
    }
    const base = (await getSiteUrl()).replace(/\/$/, "");
    const w = await prisma.walletTransaction.findUniqueOrThrow({ where: { id: t.id } });
    const res = await p.createPayment({
      orderId: `${DEPOSIT_PREFIX}${w.id}`,
      amount: w.amount,
      customerName: me.name,
      successUrl: `${base}/admin/mon-wallet?depot=ok`,
      cancelUrl: `${base}/admin/mon-wallet?depot=annule`,
      description: "Dépôt sur le wallet JAMAAL",
    });
    if (res.externalRef) await prisma.walletTransaction.update({ where: { id: t.id }, data: { providerRef: res.externalRef } });
    refresh();
    return res.redirect && res.url ? { ok: true, redirectUrl: res.url } : { ok: false, error: "Le paiement n'a pas pu démarrer, réessayez." };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Admin ----------

export async function resolveWithdrawalAction(txId: string, paid: boolean, note?: string): Promise<WalletActionState> {
  const session = await requireAdmin();
  try {
    await resolveWithdrawal(txId, paid, session.user?.id ?? null, note);
    await logActivity(session, `Retrait wallet ${paid ? "marqué versé" : "refusé"}`, "WalletTransaction", txId);
    refresh();
    return { ok: true, message: paid ? "Retrait marqué comme versé." : "Retrait refusé : le montant revient sur le wallet." };
  } catch (e) {
    return fail(e);
  }
}

export async function retryWithdrawalAction(txId: string): Promise<WalletActionState> {
  await requireAdmin();
  await sendWithdrawal(txId);
  const t = await prisma.walletTransaction.findUnique({ where: { id: txId } });
  refresh();
  return t?.status === "VALIDE" ? { ok: true, message: "Versement envoyé." } : { ok: false, error: t?.error ?? "Versement automatique indisponible (clés Wave / Orange Money) : versez à la main puis « Marquer versé »." };
}

export async function resolveDepositAction(txId: string, ok: boolean): Promise<WalletActionState> {
  const session = await requireAdmin();
  const res = await prisma.walletTransaction.updateMany({ where: { id: txId, kind: "DEPOT", status: "EN_ATTENTE" }, data: { status: ok ? "VALIDE" : "ANNULE", createdBy: session.user?.id ?? null } });
  if (!res.count) return { ok: false, error: "Ce dépôt n'est plus en attente." };
  await logActivity(session, `Dépôt wallet ${ok ? "validé" : "refusé"}`, "WalletTransaction", txId);
  refresh();
  return { ok: true, message: ok ? "Dépôt validé : le solde est crédité." : "Dépôt refusé." };
}

export async function adjustWalletAction(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  const session = await requireAdmin();
  const [type, id] = String(fd.get("owner") ?? "").split(":");
  if ((type !== "CONSULTANT" && type !== "LIVREUR") || !id) return { ok: false, error: "Choisissez un membre." };
  const sign = fd.get("sign") === "debit" ? -1 : 1;
  try {
    await adjustWallet({ type, id }, sign * amountOf(fd), String(fd.get("note") ?? ""), session.user?.id ?? null);
    await logActivity(session, `Wallet ${type} ${id} : ${sign > 0 ? "crédit" : "débit"} ${amountOf(fd)} F`, "WalletTransaction");
    refresh();
    return { ok: true, message: "Mouvement enregistré." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveDepositNumbersAction(_prev: WalletActionState, fd: FormData): Promise<WalletActionState> {
  await requireAdmin();
  await saveDepositNumbers({ WAVE: String(fd.get("WAVE") ?? ""), ORANGE_MONEY: String(fd.get("ORANGE_MONEY") ?? "") });
  refresh();
  return { ok: true, message: "Numéros enregistrés." };
}
