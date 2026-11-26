import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";

export const dynamic = "force-dynamic";

const CLEARED_AT_KEY = "whatsapp_inbox_cleared_at";

/**
 * GET /api/whatsapp/maintenance
 * Exporte une sauvegarde JSON complète des conversations et messages WhatsApp (sans toucher aux modèles).
 */
export async function GET() {
  try {
    await requireAdmin("whatsapp", "read");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Accès non autorisé." },
      { status: 403 },
    );
  }

  const [threads, messages, campaigns] = await Promise.all([
    prisma.whatsAppThread.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.whatsAppMessage.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.whatsAppCampaign.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const payload = {
    version: 1,
    exportedAt: now.toISOString(),
    counts: {
      threads: threads.length,
      messages: messages.length,
      campaigns: campaigns.length,
    },
    threads,
    messages,
    campaigns,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jamaal-whatsapp-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

type BackupThread = {
  phone: string;
  name?: string | null;
  lastMessageAt?: string;
  lastReadAt?: string | null;
  botPausedUntil?: string | null;
  consultantId?: string | null;
  assignedAt?: string | null;
  assignedSource?: string | null;
  customAttributes?: unknown;
  kwingoContactId?: string | null;
  createdAt?: string;
};

type BackupMessage = {
  id: string;
  direction: string;
  toNumber: string;
  kind: string;
  body: string;
  status: string;
  providerId?: string | null;
  error?: string | null;
  createdAt?: string;
  campaignId?: string | null;
};

function toDateOrNull(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * POST /api/whatsapp/maintenance
 * - { action: "clear" } : supprime tous les messages & fils (conserve les modèles et campagnes) + pose la date de coupure anti-réimport KwingoChat.
 * - { action: "restore", backup: { threads, messages } } : restaure les fils & messages depuis un fichier JSON de sauvegarde et lève la coupure.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin("whatsapp", "write");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Accès non autorisé." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Fichier ou requête JSON invalide." }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "clear") {
    const clearedAt = new Date().toISOString();
    const [delMsgs, delThreads] = await prisma.$transaction([
      prisma.whatsAppMessage.deleteMany({}),
      prisma.whatsAppThread.deleteMany({}),
      prisma.setting.upsert({
        where: { key: CLEARED_AT_KEY },
        create: { key: CLEARED_AT_KEY, value: clearedAt },
        update: { value: clearedAt },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      deletedMessages: delMsgs.count,
      deletedThreads: delThreads.count,
      clearedAt,
      message: `Messagerie vidée : ${delMsgs.count} message(s) et ${delThreads.count} conversation(s) supprimé(s). Les modèles sont conservés et la coupure KwingoChat est active.`,
    });
  }

  if (action === "restore") {
    const backup = body.backup as { threads?: unknown; messages?: unknown } | undefined;
    if (!backup || !Array.isArray(backup.threads) || !Array.isArray(backup.messages)) {
      return NextResponse.json(
        { ok: false, error: "Format de sauvegarde invalide : les tableaux 'threads' et 'messages' sont requis." },
        { status: 400 },
      );
    }

    // Vérifier les consultantId existants pour éviter une erreur de clé étrangère si un consultant a été supprimé depuis
    const existingConsultants = new Set(
      (await prisma.consultant.findMany({ select: { id: true } })).map((c) => c.id),
    );

    const validThreads = (backup.threads as BackupThread[])
      .filter((t) => t && typeof t.phone === "string" && t.phone.trim().length > 0)
      .map((t) => ({
        phone: t.phone.trim(),
        name: typeof t.name === "string" ? t.name : null,
        lastMessageAt: toDateOrNull(t.lastMessageAt) ?? new Date(),
        lastReadAt: toDateOrNull(t.lastReadAt),
        botPausedUntil: toDateOrNull(t.botPausedUntil),
        consultantId:
          typeof t.consultantId === "string" && existingConsultants.has(t.consultantId)
            ? t.consultantId
            : null,
        assignedAt: toDateOrNull(t.assignedAt),
        assignedSource: typeof t.assignedSource === "string" ? t.assignedSource : null,
        customAttributes: (t.customAttributes ?? {}) as Prisma.InputJsonValue,
        kwingoContactId: typeof t.kwingoContactId === "string" ? t.kwingoContactId : null,
        createdAt: toDateOrNull(t.createdAt) ?? new Date(),
      }));

    const validMessages = (backup.messages as BackupMessage[])
      .filter(
        (m) =>
          m &&
          typeof m.id === "string" &&
          typeof m.direction === "string" &&
          typeof m.toNumber === "string" &&
          typeof m.body === "string",
      )
      .map((m) => ({
        id: m.id,
        direction: m.direction,
        toNumber: m.toNumber,
        kind: typeof m.kind === "string" ? m.kind : "inbound",
        body: m.body,
        status: typeof m.status === "string" ? m.status : "RECU",
        providerId: typeof m.providerId === "string" ? m.providerId : null,
        error: typeof m.error === "string" ? m.error : null,
        createdAt: toDateOrNull(m.createdAt) ?? new Date(),
        campaignId: typeof m.campaignId === "string" ? m.campaignId : null,
      }));

    const [resThreads, resMessages] = await prisma.$transaction([
      prisma.whatsAppThread.createMany({ data: validThreads, skipDuplicates: true }),
      prisma.whatsAppMessage.createMany({ data: validMessages, skipDuplicates: true }),
      prisma.setting.deleteMany({ where: { key: CLEARED_AT_KEY } }),
    ]);

    return NextResponse.json({
      ok: true,
      restoredThreads: resThreads.count,
      restoredMessages: resMessages.count,
      message: `Sauvegarde restaurée : ${resThreads.count} conversation(s) et ${resMessages.count} message(s) réimporté(s).`,
    });
  }

  return NextResponse.json({ ok: false, error: "Action inconnue." }, { status: 400 });
}
