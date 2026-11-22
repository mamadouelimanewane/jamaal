"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import { sendWhatsApp } from "@/lib/whatsapp";
import { campaignRecipients, parseAudience, parseCampaignExcelBuffer, runCampaign, type CampaignRecipient } from "@/lib/whatsapp/campaigns";
import { assignThreadToConsultant } from "@/lib/whatsapp/kwingo-bridge";
import { getReseller } from "@/lib/reseller";
import { requireAdmin } from "./auth-guard";

export type InboxState = { ok: boolean; message?: string };

const PAUSE_MS = 2 * 3_600_000;

/** Réponse d'un conseiller ou d'un consultant depuis la boîte de réception : l'assistant se met en pause 2 h. */
export async function replyToThread(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const reseller = await getReseller();
  if (!reseller) await requireAdmin("whatsapp");

  const phone = canonicalizePhone(String(formData.get("phone") ?? ""));
  const text = String(formData.get("text") ?? "").trim().slice(0, 1500);
  if (phone.length < 8) return { ok: false, message: "Numéro invalide." };
  if (!text) return { ok: false, message: "Écrivez un message." };

  if (reseller) {
    const thread = await prisma.whatsAppThread.findUnique({ where: { phone }, select: { consultantId: true } });
    if (!thread || thread.consultantId !== reseller.id) {
      return { ok: false, message: "Ce contact ne vous est pas assigné." };
    }
  }

  // Texte libre uniquement si le client a écrit dans les 24 h ; sinon le modèle validé est utilisé.
  const recent = await prisma.whatsAppMessage.findFirst({ where: { toNumber: phone, direction: "IN", createdAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { id: true } });
  const r = await sendWhatsApp({ to: phone, text, kind: "conseiller", free: !!recent });
  await prisma.whatsAppThread.upsert({
    where: { phone },
    create: { phone, botPausedUntil: new Date(Date.now() + PAUSE_MS), lastReadAt: new Date() },
    update: { botPausedUntil: new Date(Date.now() + PAUSE_MS), lastReadAt: new Date() },
  });
  revalidatePath("/admin/whatsapp/conversations");
  revalidatePath("/admin/mon-inbox");
  if (r.status === "ECHEC") return { ok: false, message: `Échec : ${r.error ?? "erreur inconnue"}` };
  return { ok: true, message: r.status === "SIMULE" ? "Enregistré (mode simulation : WhatsApp non configuré)." : "Envoyé. L'assistant est en pause 2 h sur cette conversation." };
}

/** Met l'assistant en pause (heures > 0) ou le relance (0) sur une conversation. */
export async function setThreadBot(phone: string, hours: number) {
  const reseller = await getReseller();
  if (!reseller) await requireAdmin("whatsapp");
  const p = canonicalizePhone(phone);
  if (reseller) {
    const thread = await prisma.whatsAppThread.findUnique({ where: { phone: p }, select: { consultantId: true } });
    if (!thread || thread.consultantId !== reseller.id) throw new Error("Accès refusé à cette conversation.");
  }
  const until = hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 30) * 3_600_000) : null;
  await prisma.whatsAppThread.upsert({ where: { phone: p }, create: { phone: p, botPausedUntil: until }, update: { botPausedUntil: until } });
  revalidatePath("/admin/whatsapp/conversations");
  revalidatePath("/admin/mon-inbox");
}

/** Assigne manuellement une conversation à un consultant (ou null = unassigned). */
export async function assignThreadAction(formData: FormData) {
  const session = await requireAdmin("whatsapp");
  const phone = canonicalizePhone(String(formData.get("phone") ?? ""));
  const rawConsultantId = String(formData.get("consultantId") ?? "").trim();
  if (phone.length >= 8) {
    await assignThreadToConsultant({
      phone,
      consultantId: rawConsultantId || null,
      assignedByUserId: session.user?.id ?? null,
    });
  }
  revalidatePath("/admin/whatsapp/conversations");
  revalidatePath("/admin/mon-inbox");
}

export async function parseCampaignExcelAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  fileName?: string;
  recipients?: CampaignRecipient[];
  rawCount?: number;
  skippedInvalid?: number;
  excludedOptOut?: number;
}> {
  try {
    await requireAdmin("whatsapp", "read");
    const file = formData.get("file") as File | null;
    const consultantId = String(formData.get("consultantId") ?? "").trim() || undefined;
    if (!file || file.size === 0) {
      return { ok: false, error: "Veuillez sélectionner un fichier Excel (.xlsx) ou CSV (.csv)." };
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".csv") && !lower.endsWith(".txt")) {
      return { ok: false, error: "Format non supporté. Utilisez un fichier Excel (.xlsx) ou CSV (.csv)." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parseCampaignExcelBuffer(arrayBuffer, file.name, consultantId);
    if (parsed.recipients.length === 0) {
      return {
        ok: false,
        error: "Aucun numéro WhatsApp valide trouvé dans ce fichier (vérifiez qu'une colonne contient les numéros de téléphone).",
      };
    }

    return {
      ok: true,
      fileName: file.name,
      recipients: parsed.recipients,
      rawCount: parsed.rawCount,
      skippedInvalid: parsed.skippedInvalid,
      excludedOptOut: parsed.excludedOptOut,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible de lire le fichier Excel.",
    };
  }
}

export async function createCampaign(formData: FormData) {
  const session = await requireAdmin("whatsapp");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  const templateName = String(formData.get("templateName") ?? "").trim();
  const templateLanguage = String(formData.get("templateLanguage") ?? "fr").trim();
  const sourceMode = String(formData.get("sourceMode") ?? "FILTRES").trim();
  const excelFileName = String(formData.get("excelFileName") ?? "").trim();
  const rawExcelJson = String(formData.get("excelRecipientsJson") ?? "").trim();
  const rawVarBindingsJson = String(formData.get("templateVarBindingsJson") ?? "").trim();

  if (!title || body.length < 3) {
    redirect("/admin/whatsapp/campagnes?erreur=" + encodeURIComponent("Titre et message du modèle requis."));
  }
  if (!templateName) {
    redirect("/admin/whatsapp/campagnes?erreur=" + encodeURIComponent("Veuillez sélectionner un modèle approuvé par Meta."));
  }

  let templateVarBindings: unknown[] = [];
  if (rawVarBindingsJson) {
    try {
      const parsedVars = JSON.parse(rawVarBindingsJson);
      if (Array.isArray(parsedVars)) templateVarBindings = parsedVars;
    } catch {
      templateVarBindings = [];
    }
  }

  let excelRecipients: unknown[] = [];
  if (rawExcelJson) {
    try {
      const parsed = JSON.parse(rawExcelJson);
      if (Array.isArray(parsed)) excelRecipients = parsed;
    } catch {
      excelRecipients = [];
    }
  }

  const uploadedFile = formData.get("excelFile") as File | null;
  if (excelRecipients.length === 0 && uploadedFile && uploadedFile.size > 0) {
    const ab = await uploadedFile.arrayBuffer();
    const parsedFile = await parseCampaignExcelBuffer(
      ab,
      uploadedFile.name,
      String(formData.get("consultantId") ?? "").trim() || undefined,
    );
    excelRecipients = parsedFile.recipients;
  }

  const audience = parseAudience({
    target: formData.get("target"),
    inactiveDays: formData.get("inactiveDays"),
    consultantActivity: formData.get("consultantActivity"),
    category: formData.get("category"),
    consultantId: formData.get("consultantId"),
    cta: { label: formData.get("ctaLabel"), url: formData.get("ctaUrl") },
    templateName,
    templateLanguage,
    templateVarBindings,
    sourceMode:
      sourceMode === "EXCEL" || sourceMode === "FILTRES_ET_EXCEL"
        ? sourceMode
        : excelRecipients.length > 0
          ? "FILTRES_ET_EXCEL"
          : "FILTRES",
    excelRecipients,
    excelFileName: excelFileName || (uploadedFile && uploadedFile.size > 0 ? uploadedFile.name : undefined),
  });

  const recipients = await campaignRecipients(audience).catch(() => []);
  const draftId = String(formData.get("draftId") ?? "").trim();
  const sendMode = String(formData.get("send") ?? "0").trim();

  let c: { id: string };
  if (draftId && (sendMode === "update" || sendMode === "1")) {
    const existing = await prisma.whatsAppCampaign.findUnique({ where: { id: draftId }, select: { id: true, status: true } });
    if (existing && existing.status === "BROUILLON") {
      c = await prisma.whatsAppCampaign.update({
        where: { id: draftId },
        data: {
          title,
          body,
          audience: JSON.parse(JSON.stringify(audience)),
          total: recipients.length,
        },
      });
    } else {
      c = await prisma.whatsAppCampaign.create({
        data: {
          title,
          body,
          audience: JSON.parse(JSON.stringify(audience)),
          total: recipients.length,
          createdBy: session.user?.id ?? null,
        },
      });
    }
  } else {
    c = await prisma.whatsAppCampaign.create({
      data: {
        title,
        body,
        audience: JSON.parse(JSON.stringify(audience)),
        total: recipients.length,
        createdBy: session.user?.id ?? null,
      },
    });
  }

  if (sendMode === "1") await runCampaign(c.id);
  revalidatePath("/admin/whatsapp/campagnes");
  redirect(`/admin/whatsapp/campagnes?c=${c.id}`);
}

export async function continueCampaign(id: string) {
  await requireAdmin("whatsapp");
  await runCampaign(id);
  revalidatePath("/admin/whatsapp/campagnes");
}

/** Lance un brouillon ou reprend une campagne à la volée. */
export async function launchCampaignAction(formData: FormData) {
  await requireAdmin("whatsapp");
  const id = String(formData.get("id") ?? "").trim();
  if (id) {
    await runCampaign(id);
  }
  revalidatePath("/admin/whatsapp/campagnes");
}

/** Duplique un brouillon ou une campagne existante en nouveau brouillon prêt à modifier/lancer. */
export async function duplicateCampaignAction(formData: FormData) {
  const session = await requireAdmin("whatsapp");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const src = await prisma.whatsAppCampaign.findUnique({ where: { id } });
  if (!src) return;
  const aud = parseAudience(src.audience);
  const recipients = await campaignRecipients(aud).catch(() => []);
  await prisma.whatsAppCampaign.create({
    data: {
      title: `${src.title} (copie)`.slice(0, 120),
      body: src.body,
      audience: JSON.parse(JSON.stringify(src.audience)),
      status: "BROUILLON",
      total: recipients.length || src.total,
      sent: 0,
      failed: 0,
      createdBy: session.user?.id ?? null,
    },
  });
  revalidatePath("/admin/whatsapp/campagnes");
}

/** Supprime un brouillon ou une campagne à la volée. */
export async function deleteCampaignAction(formData: FormData) {
  await requireAdmin("whatsapp");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.whatsAppMessage
    .updateMany({ where: { campaignId: id }, data: { campaignId: null } })
    .catch(() => {});
  await prisma.whatsAppCampaign.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/whatsapp/campagnes");
}
