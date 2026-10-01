import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { markOrderPaid } from "@/lib/payment/mark-paid";

/** Webhook Stripe vérifié à partir du corps brut et de la signature. */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    return NextResponse.json({ error: "Stripe webhook non configuré" }, { status: 503 });
  }

  const StripeClient = (await import("stripe")).default;
  const stripe = new StripeClient(stripeKey, { apiVersion: "2025-02-24.acacia" as never });
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "no signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.error("[stripe webhook]", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (orderId && session.payment_status === "paid") {
      await markOrderPaid(orderId, {
        method: "STRIPE",
        externalRef: session.id,
        amount: session.amount_total ?? undefined, // XOF = devise sans décimales
      });
    }
  }

  return NextResponse.json({ received: true });
}
