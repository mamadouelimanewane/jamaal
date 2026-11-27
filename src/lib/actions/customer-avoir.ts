"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { adjustWallet, requestWithdrawal, WalletError } from "@/lib/wallet";
import { customerOwner, ensureAvoirCode } from "@/lib/customer-wallet";

type Result = { ok: boolean; message?: string; error?: string };

/** Admin : ajoute (ou retire) de l'avoir à un client, avec un motif. */
export async function adjustAvoirAction(customerId: string, fd: FormData): Promise<Result> {
  try {
    const session = await requireAdmin("commandes");
    const amount = Math.round(Number(String(fd.get("amount") ?? "").replace(/\s/g, "")));
    const note = String(fd.get("note") ?? "").trim();
    await adjustWallet(customerOwner(customerId), amount, note, session.user?.id ?? null);
    await ensureAvoirCode(customerId);
    await logActivity(session, `Avoir client ${amount > 0 ? "crédité" : "débité"} de ${Math.abs(amount).toLocaleString("fr-FR")} F : ${note}`, "Customer", customerId);
    revalidatePath(`/admin/clients/${customerId}`);
    return { ok: true, message: "Avoir mis à jour." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible." };
  }
}

/** Admin : verse l'avoir du client sur son Wave (son numéro), à sa demande. */
export async function payoutAvoirAction(customerId: string, fd: FormData): Promise<Result> {
  try {
    const session = await requireAdmin("commandes");
    const amount = Math.round(Number(String(fd.get("amount") ?? "").replace(/\s/g, "")));
    const t = await requestWithdrawal(customerOwner(customerId), amount, session.user?.id ?? null);
    await logActivity(session, `Avoir client versé sur Wave : ${amount.toLocaleString("fr-FR")} F`, "Customer", customerId);
    revalidatePath(`/admin/clients/${customerId}`);
    return { ok: true, message: t.status === "VALIDE" ? "Versé sur Wave." : "Versement demandé : il part automatiquement, ou se fait depuis Admin › Wallets." };
  } catch (e) {
    return { ok: false, error: e instanceof WalletError || e instanceof Error ? e.message : "Versement impossible." };
  }
}
