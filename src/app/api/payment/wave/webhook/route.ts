import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { markOrderPaid } from "@/lib/payment/mark-paid";

/**
 * Webhook Wave Checkout
 * Configurer l'URL dans le dashboard Wave :
 *   https://votre-domaine/api/payment/wave/webhook
 *
 * Signature : header Wave-Signature (HMAC-SHA256 du body avec WAVE_WEBHOOK_SECRET)
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WAVE_WEBHOOK_SECRET;

  // Fail closed : sans secret configuré, on refuse tout webhook.
  if (!secret) {
    return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });
  }
  const header = req.headers.get("wave-signature") || "";
  if (!verifyWaveSignature(raw, header, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    data?: {
      id?: string;
      client_reference?: string;
      checkout_status?: string;
      amount?: string | number;
      currency?: string;
    };
  };

  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = payload.type || "";
  const data = payload.data || {};
  const orderId = data.client_reference;
  const status = data.checkout_status || type;

  if (
    orderId &&
    (status === "complete" ||
      status === "checkout.session.completed" ||
      type === "checkout.session.completed")
  ) {
    if (data.currency && data.currency !== "XOF") {
      return NextResponse.json({ error: "currency mismatch" }, { status: 400 });
    }
    const amount = data.amount != null ? Number(data.amount) : undefined;
    await markOrderPaid(orderId, { method: "WAVE", externalRef: data.id, amount });
  }

  return NextResponse.json({ received: true });
}

/**
 * Accepte les deux formats usuels :
 *  - "t=<timestamp>,v1=<hex>" : HMAC-SHA256 de `${t}${corps}`
 *  - "<hex>" : HMAC-SHA256 du corps brut
 * (à confirmer avec la documentation Wave de votre compte).
 */
function verifyWaveSignature(raw: string, header: string, secret: string): boolean {
  if (!header) return false;
  const candidates: { sig: string; payload: string }[] = [];
  if (header.includes("v1=")) {
    const parts = Object.fromEntries(
      header.split(",").map((p) => p.trim().split("=") as [string, string])
    );
    if (parts.t && parts.v1) candidates.push({ sig: parts.v1, payload: `${parts.t}${raw}` });
  } else {
    candidates.push({ sig: header.trim(), payload: raw });
  }
  return candidates.some(({ sig, payload }) => {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
