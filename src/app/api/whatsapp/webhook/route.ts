import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { handleInboundWhatsApp, type InboundMessage } from "@/lib/whatsapp/inbound";

/** Le temps de répondre aux messages reçus (assistant de commande). */
export const maxDuration = 60;

/**
 * Webhook de l'API Cloud de Meta (statuts d'envoi et messages reçus).
 * URL à déclarer dans Meta : https://<votre-domaine>/api/whatsapp/webhook
 * - GET  : vérification (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
 * - POST : signature X-Hub-Signature-256 vérifiée avec WHATSAPP_APP_SECRET (refus si non configuré).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

const STATUS_MAP: Record<string, string> = { sent: "ENVOYE", delivered: "LIVRE", read: "LU", failed: "ECHEC" };

export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });

  const raw = await req.text();
  const sig = (req.headers.get("x-hub-signature-256") ?? "").replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "signature invalide" }, { status: 401 });

  type Change = {
    value?: {
      statuses?: { id: string; status: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] }[];
      messages?: {
        from: string;
        id: string;
        type: string;
        text?: { body?: string };
        location?: { latitude?: number; longitude?: number; name?: string; address?: string };
        button?: { text?: string };
        interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        audio?: { id?: string };
        voice?: { id?: string };
        image?: { id?: string; caption?: string };
        order?: { product_items?: { product_retailer_id?: string; quantity?: number | string }[] };
      }[];
      contacts?: { wa_id?: string; profile?: { name?: string } }[];
    };
  };
  let payload: { entry?: { changes?: Change[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "json invalide" }, { status: 400 });
  }

  const inbound: Omit<InboundMessage, "origin">[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (status) {
          await prisma.whatsAppMessage.updateMany({
            where: { providerId: s.id },
            data: { status, ...(status === "ECHEC" ? { error: s.errors?.[0] ? `${s.errors[0].code ?? ""} ${s.errors[0].title ?? ""}${s.errors[0].error_data?.details ? ` — ${s.errors[0].error_data.details}` : ""}`.trim().slice(0, 300) || "Échec de livraison" : "Échec de livraison" } : {}) },
          });
        }
      }
      for (const m of change.value?.messages ?? []) {
        const loc = m.type === "location" && m.location?.latitude != null && m.location?.longitude != null ? m.location : null;
        const text =
          m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) : null;
        const audioId = m.type === "audio" ? m.audio?.id : m.type === "voice" ? m.voice?.id : undefined;
        const media = audioId ? { id: audioId, kind: "audio" as const } : m.type === "image" && m.image?.id ? { id: m.image.id, kind: "image" as const, caption: m.image.caption ?? null } : null;
        const catalogOrder =
          m.type === "order"
            ? (m.order?.product_items ?? []).filter((i) => i.product_retailer_id).map((i) => ({ retailerId: String(i.product_retailer_id), quantity: Math.round(Number(i.quantity) || 1) }))
            : null;
        // Un même message peut être renvoyé par Meta : on ne le traite qu'une fois.
        if (await prisma.whatsAppMessage.findFirst({ where: { providerId: m.id, direction: "IN" }, select: { id: true } })) continue;
        const placeholder = media ? (media.kind === "audio" ? "[vocal]" : `[photo]${media.caption ? ` ${media.caption}` : ""}`) : catalogOrder ? "[panier]" : `[${m.type}]`;
        await prisma.whatsAppMessage.create({
          data: {
            direction: "IN",
            toNumber: m.from,
            kind: "inbound",
            body: (loc ? `[position] ${loc.latitude},${loc.longitude}${loc.address || loc.name ? ` ${loc.name ?? ""} ${loc.address ?? ""}`.trimEnd() : ""}` : text ?? placeholder).slice(0, 1500),
            status: "RECU",
            providerId: m.id,
          },
        });
        if (text || loc || media || catalogOrder?.length) {
          const profileName = change.value?.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
          inbound.push({ phone: m.from, text: text ?? null, location: loc ? { lat: loc.latitude!, lng: loc.longitude! } : null, profileName, providerId: m.id, media, catalogOrder });
        }
      }
    }
  }
  // Réponses (assistant de commande, STOP/START) après l'accusé de réception : Meta attend une réponse rapide.
  if (inbound.length) {
    const origin = await getSiteUrl();
    const replies = async () => {
      for (const msg of inbound) await handleInboundWhatsApp({ ...msg, origin }).catch((e) => console.error("[whatsapp] réponse", e));
    };
    try {
      after(replies);
    } catch {
      await replies(); // hors requête Next (tests) : tout de suite
    }
  }
  return NextResponse.json({ received: true });
}
