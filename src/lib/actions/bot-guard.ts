"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { forgetVisitor } from "@/lib/bot-guard-store";

/** Débloque un visiteur banni par erreur (administrateur complet). */
export async function unbanVisitor(formData: FormData) {
  const session = await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!key) return;
  const row = await prisma.botBan.findUnique({ where: { key }, select: { ip: true } });
  await prisma.botBan.deleteMany({ where: { key } });
  forgetVisitor(key);
  await logActivity(session, `Visiteur débloqué (anti-aspiration) : ${row?.ip ?? key}`, "BotBan", key);
  revalidatePath("/admin/protection");
}
