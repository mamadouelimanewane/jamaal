"use server";

import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { whatsappConfig } from "@/lib/whatsapp";
import { inviteMembersToInstall } from "@/lib/whatsapp/install-invite";

/** Admin : envoie le lien d'installation de l'application à tous les revendeurs et livreurs déjà inscrits. */
export async function sendInstallInvites(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const session = await requireAdmin("revendeurs");
  const n = await inviteMembersToInstall(true);
  await logActivity(session, `Lien d'installation envoyé à ${n} membre(s)`, "Consultant", "installer");
  if (!n) return { ok: true, message: "Tout le monde a déjà reçu le lien." };
  const live = whatsappConfig().active;
  return { ok: true, message: `Envoi en cours à ${n} revendeur(s) et livreur(s)${live ? "" : " (WhatsApp non configuré : messages simulés, voir le Journal WhatsApp)"}.` };
}
