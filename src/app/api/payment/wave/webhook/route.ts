import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { markOrderPaid } from "@/lib/actions/payment";

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

  if (secret) {
    const sig = req.headers.get("wave-signature") || req.headers.get("Wave-Signature") || "";
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: {
    type?: string;
    data?: { id?: string; client_reference?: string; checkout_status?: string };
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
    await markOrderPaid(orderId, data.id);
  }

  return NextResponse.json({ received: true });
}
