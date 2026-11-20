import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import {
  assignCampaignRecipientAttributes,
  assignThreadToConsultant,
  buildContactCustomAttributes,
  kwingoBridgeConfig,
  resolveClientConsultant,
  routeInboundClientMessage,
} from "@/lib/whatsapp/kwingo-bridge";

export const dynamic = "force-dynamic";

function verifyBridgeAuth(req: NextRequest): boolean {
  const cfg = kwingoBridgeConfig();
  const expectedSecrets = [
    cfg.apiKey,
    process.env.KWINGOCHAT_BRIDGE_SECRET,
    process.env.WHATSAPP_APP_SECRET,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);

  if (expectedSecrets.length === 0) return false;

  const authHeader = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const bridgeHeader = (req.headers.get("x-bridge-secret") ?? req.headers.get("x-api-key") ?? "").trim();
  const candidate = bridgeHeader || authHeader;
  if (!candidate) return false;

  const candidateBuf = Buffer.from(candidate);
  return expectedSecrets.some((sec) => {
    const secBuf = Buffer.from(sec);
    return secBuf.length === candidateBuf.length && timingSafeEqual(secBuf, candidateBuf);
  });
}

/**
 * GET /api/whatsapp/kwingo-bridge?phone=22177...&text=...&name=...
 * Appelé automatiquement par KwingoChat lors d'un message spontané entrant pour résoudre
 * dynamiquement le consultant du client (ou laisser dans `unassigned` s'il n'en a pas).
 */
export async function GET(req: NextRequest) {
  if (!verifyBridgeAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const rawPhone = sp.get("phone") ?? "";
  const text = sp.get("text");
  const profileName = sp.get("name");
  const dryRun = sp.get("dryRun") === "1";

  const phone = canonicalizePhone(rawPhone);
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
  }

  if (dryRun) {
    const consultant = await resolveClientConsultant(phone, text);
    const customAttributes = buildContactCustomAttributes(consultant, {
      source: consultant ? consultant.source : "UNASSIGNED",
    });
    return NextResponse.json({
      success: true,
      phone,
      matched: Boolean(consultant),
      status: consultant ? "assigned" : "unassigned",
      assigned_to: consultant?.id ?? null,
      consultant,
      custom_attributes: customAttributes,
    });
  }

  const { consultant, customAttributes, routing } = await routeInboundClientMessage({
    phone,
    profileName,
    text,
  });

  return NextResponse.json({
    success: true,
    phone,
    matched: Boolean(consultant),
    status: consultant ? "assigned" : "unassigned",
    routing_source: routing,
    assigned_to: consultant?.id ?? null,
    consultant,
    custom_attributes: customAttributes,
  });
}

/**
 * POST /api/whatsapp/kwingo-bridge
 * Synchronisation temps réel KwingoChat <-> JAMAAL :
 * - action = "inbound_message" : message spontané ou retour de campagne reçu par KwingoChat
 * - action = "outbound_message" : message envoyé depuis KwingoChat (campagne ou conseiller)
 * - action = "assign_contact" : réassignation manuelle dans KwingoChat vers un consultant (ou unassigned)
 * - action = "campaign_assign" : pose des attributs de contact lors de l'envoi d'une campagne
 */
export async function POST(req: NextRequest) {
  if (!verifyBridgeAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const action = String(body.action ?? "inbound_message");
  const phone = canonicalizePhone(String(body.phone ?? body.wa_id ?? ""));
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
  }

  if (action === "assign_contact") {
    const rawConsultantId = body.consultantId ?? body.assigned_to ?? null;
    const consultantId = typeof rawConsultantId === "string" && rawConsultantId.trim() ? rawConsultantId.trim() : null;
    const { consultant, customAttributes } = await assignThreadToConsultant({
      phone,
      consultantId,
    });
    return NextResponse.json({
      success: true,
      phone,
      status: consultant ? "assigned" : "unassigned",
      assigned_to: consultant?.id ?? null,
      consultant,
      custom_attributes: customAttributes,
    });
  }

  if (action === "campaign_assign") {
    const campaignId = String(body.campaignId ?? body.campaign_id ?? "kwingo-campaign");
    const campaignTitle = typeof body.campaignTitle === "string" ? body.campaignTitle : null;
    const rawConsultantId = body.consultantId ?? body.consultant_id ?? body.assigned_to ?? null;
    const consultantId = typeof rawConsultantId === "string" && rawConsultantId.trim() ? rawConsultantId.trim() : null;
    const name = typeof body.name === "string" ? body.name : null;

    const { consultant, customAttributes } = await assignCampaignRecipientAttributes({
      phone,
      name,
      consultantId,
      campaignId,
      campaignTitle,
    });

    return NextResponse.json({
      success: true,
      phone,
      status: consultant ? "assigned" : "unassigned",
      assigned_to: consultant?.id ?? null,
      consultant,
      custom_attributes: customAttributes,
    });
  }

  if (action === "outbound_message") {
    const text = String(body.body ?? body.text ?? "").slice(0, 2000);
    const providerId = typeof body.providerId === "string" ? body.providerId : typeof body.meta_message_id === "string" ? body.meta_message_id : null;
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;

    if (text) {
      const exists = providerId
        ? await prisma.whatsAppMessage.findFirst({ where: { providerId, direction: "OUT" }, select: { id: true } })
        : null;
      if (!exists) {
        await prisma.whatsAppMessage.create({
          data: {
            direction: "OUT",
            toNumber: phone,
            kind: campaignId ? "campagne" : "conseiller",
            body: text,
            status: "ENVOYE",
            providerId,
            campaignId,
          },
        });
      }
    }

    if (campaignId) {
      const rawConsultantId = body.consultantId ?? body.consultant_id ?? body.assigned_to ?? null;
      await assignCampaignRecipientAttributes({
        phone,
        name: typeof body.name === "string" ? body.name : null,
        consultantId: typeof rawConsultantId === "string" && rawConsultantId ? rawConsultantId : null,
        campaignId,
        campaignTitle: typeof body.campaignTitle === "string" ? body.campaignTitle : null,
      });
    }

    return NextResponse.json({ success: true, phone });
  }

  // Par défaut : inbound_message (message entrant spontané ou retour de campagne)
  const text = typeof body.body === "string" ? body.body : typeof body.text === "string" ? body.text : null;
  const profileName = typeof body.profileName === "string" ? body.profileName : typeof body.name === "string" ? body.name : null;
  const providerId = typeof body.providerId === "string" ? body.providerId : typeof body.meta_message_id === "string" ? body.meta_message_id : null;

  if (text) {
    const exists = providerId
      ? await prisma.whatsAppMessage.findFirst({ where: { providerId, direction: "IN" }, select: { id: true } })
      : null;
    if (!exists) {
      await prisma.whatsAppMessage.create({
        data: {
          direction: "IN",
          toNumber: phone,
          kind: "inbound",
          body: text.slice(0, 1500),
          status: "RECU",
          providerId,
        },
      });
    }
  }

  const { consultant, customAttributes, routing } = await routeInboundClientMessage({
    phone,
    profileName,
    text,
  });

  return NextResponse.json({
    success: true,
    phone,
    matched: Boolean(consultant),
    status: consultant ? "assigned" : "unassigned",
    routing_source: routing,
    assigned_to: consultant?.id ?? null,
    consultant,
    custom_attributes: customAttributes,
  });
}
