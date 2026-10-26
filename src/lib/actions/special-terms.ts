"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { COLLECT_METHODS, parsePct, zonesFromText } from "@/lib/special-terms";

export type SpecialTermsState = { ok: boolean; error?: string; message?: string; id?: string };

function refresh() {
  revalidatePath("/admin/conditions-speciales");
  revalidatePath("/admin/consultants");
}

/** Création ou modification d'un ensemble de conditions spéciales, avec ses revendeurs. */
export async function saveSpecialTerms(_prev: SpecialTermsState, fd: FormData): Promise<SpecialTermsState> {
  const session = await requireAdmin("revendeurs");
  const id = String(fd.get("id") ?? "").trim() || null;
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Donnez un nom à ces conditions (ex. « Revendeurs de Thiès »)." };

  const pcts = { sellerPct: parsePct(fd.get("sellerPct")), level1Pct: parsePct(fd.get("level1Pct")), level2Pct: parsePct(fd.get("level2Pct")) };
  if (Object.values(pcts).includes("invalid")) return { ok: false, error: "Les taux de commission vont de 0 à 60 % (laissez vide pour garder le taux normal)." };
  const creditLimit = Math.round(Number(String(fd.get("creditLimit") ?? "0").replace(/[\s.]/g, "")) || 0);
  if (creditLimit < 0 || creditLimit > 50_000_000) return { ok: false, error: "Plafond d'argent à reverser invalide." };
  const collectMethods = COLLECT_METHODS.filter((m) => fd.getAll("collect").includes(m));
  const { zones, errors } = zonesFromText(String(fd.get("zones") ?? ""));
  if (errors.length) return { ok: false, error: `Zones de livraison : ${errors[0]}.` };
  const memberIds = [...new Set(fd.getAll("members").map(String).filter(Boolean))].slice(0, 500);

  const data = {
    name,
    active: fd.get("active") === "on",
    note: String(fd.get("note") ?? "").trim().slice(0, 500) || null,
    collectMethods,
    creditLimit,
    sellerPct: pcts.sellerPct as number | null,
    level1Pct: pcts.level1Pct as number | null,
    level2Pct: pcts.level2Pct as number | null,
    zones,
  };
  const saved = await prisma.$transaction(async (tx) => {
    const t = id ? await tx.specialTerms.update({ where: { id }, data }) : await tx.specialTerms.create({ data });
    // Un revendeur n'a qu'un seul ensemble de conditions : ceux cochés ici y sont rattachés (et quittent l'ancien).
    await tx.consultant.updateMany({ where: { specialTermsId: t.id, id: { notIn: memberIds } }, data: { specialTermsId: null } });
    if (memberIds.length) await tx.consultant.updateMany({ where: { id: { in: memberIds } }, data: { specialTermsId: t.id } });
    return t;
  });
  await logActivity(session, `${id ? "Conditions spéciales modifiées" : "Conditions spéciales créées"} : ${name} (${memberIds.length} revendeur(s))`, "SpecialTerms", saved.id);
  refresh();
  return { ok: true, id: saved.id, message: `Enregistré : ${memberIds.length} revendeur(s) bénéficient de « ${name} ».` };
}

export async function deleteSpecialTerms(id: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  const session = await requireAdmin("revendeurs");
  const t = await prisma.specialTerms.findUnique({ where: { id }, select: { name: true, _count: { select: { consultants: true } } } });
  if (!t) return { ok: false, error: "Conditions introuvables." };
  await prisma.specialTerms.delete({ where: { id } });
  await logActivity(session, `Conditions spéciales supprimées : ${t.name}`, "SpecialTerms", id);
  refresh();
  return { ok: true, message: `Supprimé : ${t._count.consultants} revendeur(s) repassent au régime normal.` };
}
