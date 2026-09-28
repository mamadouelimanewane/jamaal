import { NextRequest, NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/actions/payment";

/**
 * Webhook Stripe
 * stripe listen --forward-to localhost:3030/api/payment/stripe/webhook
 *
 * Env: STRIPE_WEBHOOK_SECRET=whsec_...
 * Dépendance: npm install stripe
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    return NextResponse.json({ error: "Stripe webhook non configuré" }, { status: 503 });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" as never });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret) as typeof event;
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      client_reference_id?: string;
      metadata?: { orderId?: string };
      id?: string;
      payment_status?: string;
    };
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (orderId && session.payment_status === "paid") {
      await markOrderPaid(orderId, session.id);
    }
  }

  return NextResponse.json({ received: true });
}
