"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { getBusinessModel } from "@/lib/business-model-store";
import { getReseller } from "@/lib/reseller";
import { isRank } from "@/lib/network";
import { addToTeam, computeTeamPrimes, monthKey, monthRange, primeRef, removeFromTeam, setMemberRank, TeamError } from "@/lib/team";
import { creditCommissionEntries } from "@/lib/wallet";

export type TeamActionResult = { ok: boolean; message?: string; error?: string };

function refresh(id?: string) {
  for (const p of ["/admin/consultants", "/admin/mes-filleuls", "/admin/mes-gains", "/admin/primes-equipe"]) revalidatePath(p);
  if (id) revalidatePath(`/admin/consultants/${id}`);
}

const fail = (e: unknown): TeamActionResult => ({ ok: false, error: e instanceof TeamError ? e.message : "Opération impossible, réessayez." });

/** Admin : attribuer un rang (Promouvoir en Leader / Parrain, ou repasser Consultant). */
export async function setRankAction(_prev: TeamActionResult, formData: FormData): Promise<TeamActionResult> {
  const session = await requireAdmin();
  const id = String(formData.get("consultantId") ?? "");
  const rank = formData.get("rank");
  if (!isRank(rank)) return { ok: false, error: "Rang inconnu." };
  try {
    const r = await setMemberRank(id, rank, await getBusinessModel());
    await logActivity(session, `Rang ${rank} attribué`, "Consultant", id);
    refresh(id);
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e);
  }
}

/** Leader / Parrain : retirer un membre de son équipe (il devient libre). */
export async function removeTeamMemberAction(memberId: string): Promise<TeamActionResult> {
  const me = await getReseller();
  if (!me) return { ok: false, error: "Réservé aux membres du réseau." };
  try {
    const r = await removeFromTeam(me.id, memberId);
    await prisma.notification.createMany({
      data: (await prisma.user.findMany({ where: { OR: [{ role: "ADMIN" }, { consultantId: memberId }] }, select: { id: true } })).map((u) => ({
        userId: u.id,
        title: "Changement d'équipe",
        message: `${me.name} a retiré un membre de son équipe. Le membre est désormais libre et peut rejoindre une autre équipe.`,
      })),
    });
    refresh();
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e);
  }
}

/** Leader / Parrain : rattacher un membre libre avec son code. */
export async function addTeamMemberAction(_prev: TeamActionResult, formData: FormData): Promise<TeamActionResult> {
  const me = await getReseller();
  if (!me) return { ok: false, error: "Réservé aux membres du réseau." };
  try {
    const r = await addToTeam(me.id, String(formData.get("code") ?? ""), await getBusinessModel());
    refresh();
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e);
  }
}

/** Admin : clôture d'un mois écoulé, primes d'équipe enregistrées puis versées sur les wallets. */
export async function closeTeamPrimesAction(_prev: TeamActionResult, formData: FormData): Promise<TeamActionResult> {
  const session = await requireAdmin();
  const key = String(formData.get("month") ?? "");
  const range = monthRange(key);
  if (!range) return { ok: false, error: "Mois invalide." };
  if (key >= monthKey(new Date())) return { ok: false, error: "On ne clôture qu'un mois terminé." };
  const model = await getBusinessModel();
  if (!model.teamPrimesEnabled) return { ok: false, error: "Les primes d'équipe sont désactivées (Modèle économique)." };
  const rows = (await computeTeamPrimes(key, model)).filter((r) => r.amount > 0);
  if (!rows.length) return { ok: true, message: `Aucune prime d'équipe pour ${range.label}.` };
  const created = await prisma.commissionEntry.createMany({
    data: rows.map((r) => ({ consultantId: r.consultantId, orderId: primeRef(key), level: r.title === "Leader" ? "PRIME_LEADER" : "PRIME_PARRAIN", rate: 0, base: r.teamSales, amount: r.amount })),
    skipDuplicates: true,
  });
  if (created.count) await creditCommissionEntries({ orderId: primeRef(key) });
  await logActivity(session, `Primes d'équipe ${key} : ${created.count} prime(s)`, "Setting");
  refresh();
  return {
    ok: true,
    message: created.count
      ? `${created.count} prime(s) d'équipe enregistrée(s) pour ${range.label}, créditée(s) sur les wallets JAMAAL des membres.`
      : `Les primes de ${range.label} étaient déjà enregistrées.`,
  };
}
