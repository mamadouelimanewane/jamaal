import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getAccess } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { getReseller } from "@/lib/reseller";
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import { phoneTail } from "@/lib/phone-match";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";
import {
  assignThreadToConsultant,
  connectKwingoAccount,
  disconnectKwingoAccount,
  fetchKwingoMetaTemplates,
  getKwingoConnection,
  routeInboundClientMessage,
  sendViaKwingoConnection,
  syncLiveFromKwingo,
} from "@/lib/whatsapp/kwingo-bridge";
import { QUICK_REPLIES } from "@/data/whatsapp-business";
import { WA_MESSAGES } from "@/lib/whatsapp/message-templates-data";

export const dynamic = "force-dynamic";

const PAUSE_MS = 2 * 3_600_000;

type ViewerScope =
  | { mode: "SUPERVISOR"; userId: string; canWrite: boolean }
  | { mode: "CONSULTANT"; userId: string; consultantId: string; consultantName: string };

async function resolveViewerScope(): Promise<ViewerScope | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const access = await getAccess(session.user.id);
  if (!access || !access.active || access.role !== session.user.role) return null;

  const reseller = await getReseller();
  if (reseller) {
    return {
      mode: "CONSULTANT",
      userId: session.user.id,
      consultantId: reseller.id,
      consultantName: reseller.name,
    };
  }

  if (session.user.role === "ADMIN" && allows(access.perms, "whatsapp", "read")) {
    return {
      mode: "SUPERVISOR",
      userId: session.user.id,
      canWrite: allows(access.perms, "whatsapp", "write"),
    };
  }

  return null;
}

type ThreadRow = {
  phone: string;
  name: string | null;
  lastMessageAt: Date;
  lastReadAt: Date | null;
  botPausedUntil: Date | null;
  consultantId: string | null;
  consultantName: string | null;
  assignedAt: Date | null;
  assignedSource: string | null;
  customAttributes: Record<string, unknown> | null;
  body: string | null;
  direction: string | null;
  lastInboundAt: Date | null;
  unread: bigint;
};

/**
 * GET /api/whatsapp/inbox?managerId=all|unassigned|<consultantId>&q=...&phone=...&sync=1
 */
export async function GET(req: NextRequest) {
  const viewer = await resolveViewerScope();
  if (!viewer) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const search = (sp.get("q") ?? "").trim();
  const like = `%${search.replace(/[%_]/g, "")}%`;
  const requestedManager = (sp.get("managerId") ?? "all").trim();
  const selectedPhoneParam = sp.get("phone") ? canonicalizePhone(sp.get("phone")!) : "";
  const forceSync = sp.get("sync") === "1";

  const kwingoConn = await getKwingoConnection();
  if (kwingoConn.connected && forceSync) {
    await syncLiveFromKwingo(selectedPhoneParam || undefined, true).catch(() => {});
  } else if (kwingoConn.connected) {
    // Synchronisation légère non bloquante en arrière-plan (throttlée côté serveur)
    void syncLiveFromKwingo(selectedPhoneParam || undefined, false).catch(() => {});
  }

  // Rattache automatiquement les conversations entrantes non assignées dont le numéro correspond à un client d'un parrain/consultant actif
  await prisma.$executeRaw`
    UPDATE "WhatsAppThread" t
    SET
      "consultantId" = matched.id,
      "assignedAt" = COALESCE(t."assignedAt", CURRENT_TIMESTAMP),
      "assignedSource" = COALESCE(t."assignedSource", 'ROUTAGE_CLIENT'),
      "customAttributes" = COALESCE(t."customAttributes", '{}'::jsonb) || jsonb_build_object(
        'assigned_to', matched.id,
        'consultant_id', matched.id,
        'consultant_name', matched.name,
        'routing_source', 'ROUTAGE_CLIENT'
      )
    FROM (
      SELECT DISTINCT ON (t2.phone)
        t2.phone,
        cons.id,
        cons.name
      FROM "WhatsAppThread" t2
      JOIN "Order" o
        ON right(regexp_replace(coalesce(o."customerPhone", ''), '[^0-9]', '', 'g'), 9) = right(regexp_replace(t2.phone, '[^0-9]', '', 'g'), 9)
       AND length(right(regexp_replace(t2.phone, '[^0-9]', '', 'g'), 9)) = 9
       AND o.status <> 'ANNULEE'
       AND o."consultantId" IS NOT NULL
      JOIN "Consultant" cons ON cons.id = o."consultantId" AND cons.active = true
      WHERE t2."consultantId" IS NULL
      ORDER BY t2.phone, o."createdAt" DESC
    ) matched
    WHERE t.phone = matched.phone
      AND t."consultantId" IS NULL
  `.catch(() => { });

  let filterSql: Prisma.Sql = Prisma.sql`true`;
  if (viewer.mode === "CONSULTANT") {
    filterSql = Prisma.sql`(t."consultantId" = ${viewer.consultantId} OR (t."customAttributes"->>'assigned_to') = ${viewer.consultantId})`;
  } else if (requestedManager === "unassigned") {
    filterSql = Prisma.sql`t."consultantId" IS NULL`;
  } else if (requestedManager && requestedManager !== "all") {
    filterSql = Prisma.sql`t."consultantId" = ${requestedManager}`;
  }

  const searchSql: Prisma.Sql = search
    ? Prisma.sql`(t.phone LIKE ${like} OR coalesce(t.name, '') ILIKE ${like} OR coalesce(cons.name, '') ILIKE ${like})`
    : Prisma.sql`true`;

  const threads = await prisma.$queryRaw<ThreadRow[]>`
    SELECT
      t.phone,
      t.name,
      t."lastMessageAt",
      t."lastReadAt",
      t."botPausedUntil",
      t."consultantId",
      cons.name AS "consultantName",
      t."assignedAt",
      t."assignedSource",
      t."customAttributes",
      m.body,
      m.direction,
      last_in."createdAt" AS "lastInboundAt",
      (
        SELECT count(*)
        FROM "WhatsAppMessage" u
        WHERE u."toNumber" = t.phone
          AND u.direction = 'IN'
          AND u."createdAt" > coalesce(t."lastReadAt", 'epoch'::timestamp)
      ) AS unread
    FROM "WhatsAppThread" t
    LEFT JOIN "Consultant" cons ON cons.id = t."consultantId"
    LEFT JOIN LATERAL (
      SELECT body, direction, "createdAt"
      FROM "WhatsAppMessage" w
      WHERE w."toNumber" = t.phone
      ORDER BY w."createdAt" DESC, w.id DESC
      LIMIT 1
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT "createdAt"
      FROM "WhatsAppMessage" wi
      WHERE wi."toNumber" = t.phone
        AND wi.direction = 'IN'
      ORDER BY wi."createdAt" DESC
      LIMIT 1
    ) last_in ON true
    WHERE ${filterSql}
      AND ${searchSql}
      AND right(regexp_replace(t.phone, '[^0-9]', '', 'g'), 9) <> '711800909'
    ORDER BY COALESCE(m."createdAt", t."lastMessageAt") DESC, t.phone ASC
    LIMIT 100
  `;

  let consultants: { id: string; name: string; city: string; email: string | null; whatsapp: string; assignedCount: number }[] = [];
  let counts = { all: threads.length, unassigned: 0 };

  if (viewer.mode === "SUPERVISOR") {
    const [allConsultants, groupCounts] = await Promise.all([
      prisma.consultant.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true, email: true, whatsapp: true },
      }),
      prisma.$queryRaw<{ consultantId: string | null; n: bigint }[]>`
        SELECT "consultantId", count(*)::bigint AS n
        FROM "WhatsAppThread"
        WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) <> '711800909'
        GROUP BY "consultantId"
      `,
    ]);

    const countMap = new Map<string | null, number>();
    let totalAll = 0;
    for (const g of groupCounts) {
      const c = Number(g.n);
      countMap.set(g.consultantId, c);
      totalAll += c;
    }
    counts = {
      all: totalAll,
      unassigned: countMap.get(null) ?? 0,
    };
    consultants = allConsultants.map((c) => ({
      ...c,
      assignedCount: countMap.get(c.id) ?? 0,
    }));
  }

  const activePhone =
    selectedPhoneParam && threads.some((t) => t.phone === selectedPhoneParam)
      ? selectedPhoneParam
      : selectedPhoneParam && viewer.mode === "SUPERVISOR"
        ? selectedPhoneParam
        : threads[0]?.phone ?? "";

  let activeMessages: {
    id: string;
    direction: string;
    kind: string;
    body: string;
    status: string;
    error: string | null;
    createdAt: Date;
  }[] = [];
  let activeOrders: {
    id: string;
    createdAt: Date;
    status: string;
    paymentStatus: string;
    total: number;
    channel: string;
  }[] = [];
  let activeCustomer: { id: string; name: string; whatsappOptOut: boolean; consultantId: string | null } | null = null;
  const activeThreadDetail: ThreadRow | null = threads.find((t) => t.phone === activePhone) ?? null;

  if (activePhone) {
    if (viewer.mode === "CONSULTANT" && !activeThreadDetail) {
      return NextResponse.json({ error: "Cette conversation ne vous est pas assignée." }, { status: 403 });
    }

    const [msgs] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where: { toNumber: activePhone },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 150,
        select: { id: true, direction: true, kind: true, body: true, status: true, error: true, createdAt: true },
      }),
      prisma.whatsAppThread
        .update({ where: { phone: activePhone }, data: { lastReadAt: new Date() } })
        .catch(() => { }),
    ]);
    // Ordre antéchronologique : les messages les plus récents en haut
    activeMessages = msgs;

    const tail = phoneTail(activePhone);
    if (tail) {
      const [ordRows, custRows] = await Promise.all([
        prisma.$queryRaw<
          { id: string; createdAt: Date; status: string; paymentStatus: string; total: number; channel: string }[]
        >`
          SELECT id, "createdAt", status::text AS status, "paymentStatus"::text AS "paymentStatus", total, channel
          FROM "Order"
          WHERE right(regexp_replace(coalesce("customerPhone", ''), '[^0-9]', '', 'g'), 9) = ${tail}
            AND (${viewer.mode === "SUPERVISOR"} OR "consultantId" = ${viewer.mode === "CONSULTANT" ? viewer.consultantId : ""})
          ORDER BY "createdAt" DESC
          LIMIT 8
        `,
        prisma.$queryRaw<{ id: string; name: string; whatsappOptOut: boolean; consultantId: string | null }[]>`
          SELECT id, name, "whatsappOptOut", "consultantId"
          FROM "Customer"
          WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail}
          LIMIT 1
        `,
      ]);
      activeOrders = ordRows;
      activeCustomer = custRows[0] ?? null;
    }
  }

  const [waCfg, metaTemplates] = await Promise.all([
    Promise.resolve(whatsappConfig()),
    fetchKwingoMetaTemplates({ forceRefresh: forceSync }).catch(() => []),
  ]);

  return NextResponse.json({
    viewer: {
      mode: viewer.mode,
      consultantId: viewer.mode === "CONSULTANT" ? viewer.consultantId : null,
      consultantName: viewer.mode === "CONSULTANT" ? viewer.consultantName : null,
      canWrite: viewer.mode === "SUPERVISOR" ? viewer.canWrite : true,
    },
    config: {
      whatsappActive: waCfg.active || kwingoConn.connected,
      provider: kwingoConn.connected ? "kwingochat" : waCfg.provider,
      templateName: waCfg.template,
      bridgeRemoteEnabled: kwingoConn.connected,
      embedUrl: kwingoConn.embedUrl,
      kwingoConnection: {
        connected: kwingoConn.connected,
        email: kwingoConn.email,
        companyName: kwingoConn.companyName,
        embedUrl: kwingoConn.embedUrl,
      },
    },
    counts,
    consultants,
    templates: [
      ...metaTemplates,
      ...QUICK_REPLIES.map((r) => ({
        id: r.shortcut,
        title: `${r.shortcut} · ${r.label}`,
        category: "Réponse rapide",
        text: r.text,
        isMetaApproved: false,
      })),
      ...Object.entries(WA_MESSAGES)
        .slice(0, 6)
        .map(([key, def]) => ({
          id: key,
          title: def.label,
          category: def.group,
          text: def.text,
          isMetaApproved: false,
        })),
    ],
    threads: threads.map((t) => {
      const attrs = (t.customAttributes ?? {}) as Record<string, unknown>;
      const lastInMs = t.lastInboundAt ? new Date(t.lastInboundAt).getTime() : 0;
      const windowOpen = lastInMs > 0 && Date.now() - lastInMs < 86_400_000;
      const botPausedUntil = t.botPausedUntil && new Date(t.botPausedUntil) > new Date() ? t.botPausedUntil : null;
      return {
        phone: t.phone,
        name: t.name || `+${t.phone}`,
        lastMessage: t.body ?? "",
        lastMessageDirection: t.direction,
        lastMessageAt: t.lastMessageAt,
        lastInboundAt: t.lastInboundAt,
        windowOpen,
        unreadCount: Number(t.unread),
        botPausedUntil,
        assigned_to: t.consultantId ?? (typeof attrs.assigned_to === "string" ? attrs.assigned_to : null),
        consultantName: t.consultantName ?? (typeof attrs.consultant_name === "string" ? attrs.consultant_name : null),
        assignedAt: t.assignedAt,
        assignedSource: t.assignedSource ?? (typeof attrs.routing_source === "string" ? attrs.routing_source : null),
        customAttributes: attrs,
      };
    }),
    activePhone,
    activeThread: activeThreadDetail
      ? {
        phone: activeThreadDetail.phone,
        name: activeThreadDetail.name || activeCustomer?.name || `+${activeThreadDetail.phone}`,
        assigned_to: activeThreadDetail.consultantId,
        consultantName: activeThreadDetail.consultantName,
        assignedSource: activeThreadDetail.assignedSource,
        customAttributes: activeThreadDetail.customAttributes ?? {},
        windowOpen:
          Boolean(activeThreadDetail.lastInboundAt) &&
          Date.now() - new Date(activeThreadDetail.lastInboundAt!).getTime() < 86_400_000,
        botPausedUntil:
          activeThreadDetail.botPausedUntil && new Date(activeThreadDetail.botPausedUntil) > new Date()
            ? activeThreadDetail.botPausedUntil
            : null,
      }
      : null,
    messages: activeMessages,
    orders: activeOrders,
    customer: activeCustomer,
  });
}

/**
 * POST /api/whatsapp/inbox
 * Actions :
 * - { action: "connect_kwingo", apiUrl, supabaseUrl, supabaseAnonKey, email, password, accessToken, companyId, embedUrl }
 * - { action: "disconnect_kwingo" }
 * - { action: "sync_kwingo", phone? }
 * - { action: "send", phone, text, useTemplate?: boolean }
 * - { action: "assign", phone, consultantId: string | null }
 * - { action: "bot_pause", phone, hours: number }
 * - { action: "reroute", phone }
 */
export async function POST(req: NextRequest) {
  const viewer = await resolveViewerScope();
  if (!viewer) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }
  if (viewer.mode === "SUPERVISOR" && !viewer.canWrite) {
    return NextResponse.json({ error: "Votre profil est en lecture seule sur WhatsApp." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const action = String(body.action ?? "send");

  if (action === "connect_kwingo") {
    if (viewer.mode !== "SUPERVISOR") {
      return NextResponse.json({ error: "Seul un administrateur peut configurer la connexion KwingoChat." }, { status: 403 });
    }
    const res = await connectKwingoAccount({
      apiUrl: typeof body.apiUrl === "string" ? body.apiUrl : undefined,
      supabaseUrl: typeof body.supabaseUrl === "string" ? body.supabaseUrl : undefined,
      supabaseAnonKey: typeof body.supabaseAnonKey === "string" ? body.supabaseAnonKey : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
      companyId: typeof body.companyId === "string" ? body.companyId : undefined,
      embedUrl: typeof body.embedUrl === "string" ? body.embedUrl : undefined,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    await syncLiveFromKwingo().catch(() => { });
    return NextResponse.json({
      ok: true,
      companyName: res.companyName,
      companyId: res.companyId,
      message: `Connecté au compte KwingoChat (${res.companyName ?? "Jamaal Luxury"}) et conversations synchronisées !`,
    });
  }

  if (action === "disconnect_kwingo") {
    if (viewer.mode !== "SUPERVISOR") {
      return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
    }
    await disconnectKwingoAccount();
    return NextResponse.json({ ok: true, message: "Connexion KwingoChat débranchée." });
  }

  if (action === "sync_kwingo") {
    const targetPhone = body.phone ? canonicalizePhone(String(body.phone)) : undefined;
    const synced = await syncLiveFromKwingo(targetPhone, true);
    return NextResponse.json({
      ok: synced,
      message: synced
        ? "Conversations et messages synchronisés depuis KwingoChat (Jamaal Luxury)."
        : "Impossible de synchroniser : vérifiez la connexion au compte KwingoChat.",
    });
  }

  const phone = canonicalizePhone(String(body.phone ?? ""));
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "Numéro invalide." }, { status: 400 });
  }

  if (viewer.mode === "CONSULTANT") {
    const thread = await prisma.whatsAppThread.findUnique({
      where: { phone },
      select: { consultantId: true },
    });
    if (!thread || thread.consultantId !== viewer.consultantId) {
      return NextResponse.json({ error: "Ce contact est assigné à un autre consultant ou non assigné." }, { status: 403 });
    }
  }

  if (action === "assign") {
    if (viewer.mode !== "SUPERVISOR") {
      return NextResponse.json({ error: "Seul un superviseur / administrateur peut réassigner une conversation." }, { status: 403 });
    }
    const rawConsultantId = body.consultantId;
    const consultantId = typeof rawConsultantId === "string" && rawConsultantId.trim() ? rawConsultantId.trim() : null;
    const res = await assignThreadToConsultant({
      phone,
      consultantId,
      assignedByUserId: viewer.userId,
    });
    return NextResponse.json({
      ok: true,
      assigned_to: res.consultant?.id ?? null,
      consultantName: res.consultant?.name ?? null,
      customAttributes: res.customAttributes,
    });
  }

  if (action === "reroute") {
    if (viewer.mode !== "SUPERVISOR") {
      return NextResponse.json({ error: "Réservé au superviseur." }, { status: 403 });
    }
    await prisma.whatsAppThread
      .update({ where: { phone }, data: { consultantId: null, assignedSource: null } })
      .catch(() => { });
    const routed = await routeInboundClientMessage({ phone });
    return NextResponse.json({
      ok: true,
      assigned_to: routed.consultant?.id ?? null,
      consultantName: routed.consultant?.name ?? null,
      routing_source: routed.routing,
      customAttributes: routed.customAttributes,
    });
  }

  if (action === "bot_pause") {
    const hours = Number(body.hours ?? 0);
    const until = hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 30) * 3_600_000) : null;
    await prisma.whatsAppThread.upsert({
      where: { phone },
      create: { phone, botPausedUntil: until },
      update: { botPausedUntil: until },
    });
    return NextResponse.json({ ok: true, botPausedUntil: until });
  }

  // Action par défaut : "send"
  const text = String(body.text ?? "").trim().slice(0, 1500);
  if (!text) {
    return NextResponse.json({ error: "Écrivez un message." }, { status: 400 });
  }

  const recentInbound = await prisma.whatsAppMessage.findFirst({
    where: {
      toNumber: phone,
      direction: "IN",
      createdAt: { gte: new Date(Date.now() - 86_400_000) },
    },
    select: { id: true },
  });

  // Hors fenêtre de 24 h : l'envoi par modèle Cloud est strictement réservé aux administrateurs
  if (!recentInbound && viewer.mode === "CONSULTANT") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "La fenêtre de 24 h de l'API Cloud est fermée (l'envoi par modèle Cloud est réservé aux administrateurs). Utilisez le bouton « Répondre avec mon WhatsApp personnel (Mobile / PC) ».",
      },
      { status: 403 },
    );
  }

  const selectedTemplateName =
    typeof body.templateName === "string" && body.templateName.trim() ? body.templateName.trim() : undefined;
  const selectedTemplateLanguage =
    typeof body.templateLanguage === "string" && body.templateLanguage.trim() ? body.templateLanguage.trim() : "fr";

  const forceTemplate = (body.useTemplate === true && viewer.mode === "SUPERVISOR") || Boolean(selectedTemplateName);
  const free = !forceTemplate && Boolean(recentInbound);

  const threadInfo = await prisma.whatsAppThread
    .findUnique({ where: { phone }, select: { name: true } })
    .catch(() => null);

  // 1. Si le compte KwingoChat / Jamaal Luxury est connecté, envoi direct via l'API KwingoChat
  const kwingoRes = await sendViaKwingoConnection({
    to: phone,
    text,
    free,
    windowOpen: Boolean(recentInbound),
    recipientName: threadInfo?.name ?? null,
    templateName: selectedTemplateName || (forceTemplate ? process.env.WHATSAPP_TEMPLATE_NAME || "test_jamaal" : undefined),
    templateLanguage: selectedTemplateLanguage,
  });

  let sendStatus: "ENVOYE" | "SIMULE" | "ECHEC" = "SIMULE";
  let sendError: string | undefined;

  if (kwingoRes) {
    if (!kwingoRes.ok) {
      sendStatus = "ECHEC";
      sendError = kwingoRes.error;
    } else if (kwingoRes.simulated) {
      sendStatus = "SIMULE";
    } else {
      sendStatus = "ENVOYE";
    }
    await prisma.whatsAppMessage
      .create({
        data: {
          direction: "OUT",
          toNumber: phone,
          kind: "conseiller",
          body: text,
          status: sendStatus,
          providerId: kwingoRes.providerId ?? null,
          error: sendError ?? null,
        },
      })
      .catch(() => { });
  } else {
    // 2. Sinon repli sur l'envoi Meta direct / simulation de JAMAAL
    const sendRes = await sendWhatsApp({
      to: phone,
      text,
      kind: "conseiller",
      free,
    });
    sendStatus = sendRes.status;
    sendError = sendRes.error;
  }

  await prisma.whatsAppThread.upsert({
    where: { phone },
    create: {
      phone,
      lastMessageAt: new Date(),
      botPausedUntil: new Date(Date.now() + PAUSE_MS),
      lastReadAt: new Date(),
    },
    update: {
      lastMessageAt: new Date(),
      botPausedUntil: new Date(Date.now() + PAUSE_MS),
      lastReadAt: new Date(),
    },
  });

  if (sendStatus === "ECHEC") {
    return NextResponse.json({ ok: false, error: sendError ?? "Échec d'envoi WhatsApp" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    status: sendStatus,
    message:
      sendStatus === "SIMULE"
        ? "Message enregistré (mode simulation : connectez votre compte KwingoChat / Jamaal Luxury en haut de la fenêtre)."
        : "Message envoyé via KwingoChat (Jamaal Luxury +221 71 180 09 09). L'assistant IA est en pause 2 h.",
  });
}
