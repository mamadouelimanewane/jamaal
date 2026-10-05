"use server";

import { revalidatePath } from "next/cache";
import { sendWhatsApp, normalizePhone } from "@/lib/whatsapp";
import { requireAdmin } from "./auth-guard";

export type TestState = { ok: boolean; message?: string };

/** Envoie un message de test au numéro indiqué (administrateur uniquement). */
export async function sendTestWhatsApp(_prev: TestState, formData: FormData): Promise<TestState> {
  await requireAdmin();
  const to = normalizePhone(String(formData.get("to") ?? ""));
  const text = String(formData.get("text") ?? "").trim() || "Test JAMAAL : ceci est un message de test envoyé depuis le back-office.";
  if (to.length < 9 || to.length > 15) return { ok: false, message: "Numéro invalide (format international, ex. 221770000000)." };

  const r = await sendWhatsApp({ to, text: text.slice(0, 500), kind: "test" });
  revalidatePath("/admin/journal-whatsapp");
  if (r.status === "ENVOYE") return { ok: true, message: "Message envoyé au prestataire. Vérifiez la réception sur le téléphone." };
  if (r.status === "SIMULE") return { ok: true, message: "Mode simulation : aucun prestataire configuré, le message est seulement enregistré dans le journal." };
  return { ok: false, message: `Échec : ${r.error ?? "erreur inconnue"}` };
}
