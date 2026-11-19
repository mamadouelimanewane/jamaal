"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { formatPrice } from "@/lib/currency";
import { nextReference, notifyResellerOfCredit, parseItems, resellerDebt } from "@/lib/goods-credit";

export type GoodsCreditState = { ok: boolean; error?: string; message?: string; id?: string };

const money = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[\s. ]/g, "").replace(",", ".")) || 0);
function refresh(id?: string) {
  revalidatePath("/admin/credits-revendeurs");
  if (id) revalidatePath(`/admin/credits-revendeurs/${id}`);
  revalidatePath("/admin/mes-credits");
}

/** Octroi d'un crédit de marchandises à un revendeur. */
export async function grantGoodsCredit(_prev: GoodsCreditState, fd: FormData): Promise<GoodsCreditState> {
  const session = await requireAdmin("revendeurs");
  const consultantId = String(fd.get("consultantId") ?? "");
  const consultant = consultantId ? await prisma.consultant.findUnique({ where: { id: consultantId }, select: { id: true, name: true } }) : null;
  if (!consultant) return { ok: false, error: "Choisissez le revendeur." };

  let items = [] as ReturnType<typeof parseItems>;
  try {
    items = parseItems(JSON.parse(String(fd.get("items") ?? "[]")));
  } catch {
    items = [];
  }
  const itemsTotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const amount = money(fd.get("amount")) || itemsTotal;
  if (amount < 100) return { ok: false, error: "Indiquez le montant des marchandises confiées (au moins 100 F), ou ajoutez les produits." };
  if (amount > 100_000_000) return { ok: false, error: "Montant trop élevé." };
  const dueRaw = String(fd.get("dueDate") ?? "");
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? new Date(`${dueRaw}T23:59:00`) : null;
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 500) || null;

  let created: { id: string; reference: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const reference = await nextReference(tx);
        return tx.goodsCredit.create({ data: { reference, consultantId, amount, balance: amount, items, dueDate, notes, createdById: session.user?.id ?? null }, select: { id: true, reference: true } });
      });
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }
  if (!created) return { ok: false, error: "Réessayez : la référence n'a pas pu être attribuée." };
  await logActivity(session, `Crédit marchandises ${created.reference} : ${formatPrice(amount)} à ${consultant.name}`, "GoodsCredit", created.id);
  const debt = await resellerDebt(consultantId);
  await notifyResellerOfCredit(
    consultantId,
    "Crédit marchandises accordé",
    `JAMAAL vous a confié ${formatPrice(amount)} de marchandises à crédit (${created.reference}). Vos ventes payées seront défalquées automatiquement. Total dû : ${formatPrice(debt)}.`,
  );
  refresh(created.id);
  return { ok: true, id: created.id, message: `${created.reference} accordé : ${formatPrice(amount)} à ${consultant.name}.` };
}

/** Versement direct du revendeur (espèces à l'agence, Wave…) sur un crédit. */
export async function repayGoodsCredit(_prev: GoodsCreditState, fd: FormData): Promise<GoodsCreditState> {
  const session = await requireAdmin("revendeurs");
  const id = String(fd.get("creditId") ?? "");
  const amount = money(fd.get("amount"));
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || null;
  if (amount <= 0) return { ok: false, error: "Indiquez le montant versé." };
  const r = await prisma.$transaction(async (tx) => {
    const c = await tx.goodsCredit.findUnique({ where: { id }, select: { balance: true, status: true, reference: true, consultantId: true } });
    if (!c) return { error: "Crédit introuvable." };
    if (c.status !== "EN_COURS") return { error: "Ce crédit n'est plus en cours." };
    if (amount > c.balance) return { error: `Le versement dépasse le reste dû (${formatPrice(c.balance)}).` };
    const after = c.balance - amount;
    await tx.goodsCreditDeduction.create({ data: { creditId: id, kind: "VERSEMENT", amount, balanceBefore: c.balance, balanceAfter: after, note, createdById: session.user?.id ?? null } });
    await tx.goodsCredit.update({ where: { id }, data: { balance: after, repaid: { increment: amount }, ...(after === 0 ? { status: "SOLDE", closedAt: new Date() } : {}) } });
    return { reference: c.reference, consultantId: c.consultantId, after };
  });
  if ("error" in r) return { ok: false, error: r.error };
  await logActivity(session, `Versement ${formatPrice(amount)} sur ${r.reference}`, "GoodsCredit", id);
  await notifyResellerOfCredit(r.consultantId, "Crédit marchandises : versement reçu", `Versement de ${formatPrice(amount)} enregistré sur ${r.reference}. Reste dû sur ce crédit : ${formatPrice(r.after)}.`);
  refresh(id);
  return { ok: true, message: `Versement enregistré. Reste dû : ${formatPrice(r.after)}.` };
}

/** Annulation d'un crédit (marchandises rendues, erreur de saisie). */
export async function cancelGoodsCredit(_prev: GoodsCreditState, fd: FormData): Promise<GoodsCreditState> {
  const session = await requireAdmin("revendeurs");
  const id = String(fd.get("creditId") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 200);
  if (note.length < 3) return { ok: false, error: "Indiquez le motif (ex. marchandises rendues)." };
  const r = await prisma.$transaction(async (tx) => {
    const c = await tx.goodsCredit.findUnique({ where: { id }, select: { balance: true, status: true, reference: true, consultantId: true } });
    if (!c) return { error: "Crédit introuvable." };
    if (c.status !== "EN_COURS") return { error: "Ce crédit n'est plus en cours." };
    await tx.goodsCreditDeduction.create({ data: { creditId: id, kind: "ANNULATION_CREDIT", amount: c.balance, balanceBefore: c.balance, balanceAfter: 0, note, createdById: session.user?.id ?? null } });
    await tx.goodsCredit.update({ where: { id }, data: { balance: 0, status: "ANNULE", closedAt: new Date() } });
    return { reference: c.reference, consultantId: c.consultantId };
  });
  if ("error" in r) return { ok: false, error: r.error };
  await logActivity(session, `Crédit ${r.reference} annulé : ${note}`, "GoodsCredit", id);
  await notifyResellerOfCredit(r.consultantId, "Crédit marchandises annulé", `Le crédit ${r.reference} a été annulé (${note}).`);
  refresh(id);
  return { ok: true, message: "Crédit annulé." };
}
