import { NextRequest, NextResponse } from "next/server";
import { markOrderPaid } from "@/lib/actions/payment";

/**
 * Webhook / notification Orange Money Web Payment
 * URL à configurer : ORANGE_MONEY_NOTIF_URL
 *   https://votre-domaine/api/payment/orange/webhook
 *
 * Le format exact dépend du contrat Sonatel / Max It.
 * Ce handler accepte les formes les plus courantes :
 *   - JSON { order_id, status: "SUCCESS" | "SUCCESSFUL" | "FAILED" }
 *   - form-urlencoded order_id + status
 *
 * En production : valider la signature / token selon la doc fournie.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let orderId: string | undefined;
  let status: string | undefined;

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      orderId = String(
        body.order_id || body.orderId || body.client_reference || body.order_id_merchant || ""
      );
      status = String(body.status || body.payment_status || body.txnstatus || "").toUpperCase();
    } else {
      const form = await req.formData();
      orderId = String(form.get("order_id") || form.get("orderId") || "");
      status = String(form.get("status") || form.get("payment_status") || "").toUpperCase();
    }
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: "missing order_id" }, { status: 400 });
  }

  if (["SUCCESS", "SUCCESSFUL", "PAID", "0", "SUCCESSFULL"].includes(status || "")) {
    await markOrderPaid(orderId);
  }

  return NextResponse.json({ received: true });
}

/** Certaines configs OM appellent en GET sur return_url — on ne traite pas ici. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
