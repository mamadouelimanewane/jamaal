"use server";

import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { siteBaseUrl } from "@/lib/site-url";
import { alertManagers } from "@/lib/health/run";

/** Admin : alerter tout de suite les Leaders et parrains de leurs membres qui décrochent. */
export async function alertManagersNow(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const session = await requireAdmin("revendeurs");
  const r = await alertManagers(siteBaseUrl(), new Date(), { force: true });
  if (typeof r === "string") return { ok: false, error: "Les alertes WhatsApp sont désactivées (Admin › Automatisations)." };
  await logActivity(session, `Alerte santé du réseau : ${r.alertes} message(s)`, "Consultant", "sante");
  return { ok: true, message: `${r.alertes} Leader(s) et parrain(s) prévenu(s) pour ${r.decrocheurs} membre(s) qui décrochent.` };
}
