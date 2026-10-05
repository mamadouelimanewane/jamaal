import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

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
      statuses?: { id: string; status: string; errors?: { title?: string }[] }[];
      messages?: { from: string; id: string; type: string; text?: { body?: string } }[];
    };
  };
  let payload: { entry?: { changes?: Change[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "json invalide" }, { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (status) {
          await prisma.whatsAppMessage.updateMany({
            where: { providerId: s.id },
            data: { status, ...(status === "ECHEC" ? { error: s.errors?.[0]?.title?.slice(0, 300) ?? "Échec de livraison" } : {}) },
          });
        }
      }
      for (const m of change.value?.messages ?? []) {
        await prisma.whatsAppMessage.create({
          data: {
            direction: "IN",
            toNumber: m.from,
            kind: "inbound",
            body: (m.type === "text" ? m.text?.body : `[${m.type}]`)?.slice(0, 1500) ?? "",
            status: "RECU",
            providerId: m.id,
          },
        });
      }
    }
  }
  return NextResponse.json({ received: true });
}
