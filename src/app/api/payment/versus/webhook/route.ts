import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { orderIdFromReference, versusCredentials } from "@/lib/payment/versus";
import { settleVersusPayment } from "@/lib/payment/settle-versus";
import { DEPOSIT_PREFIX } from "@/lib/wallet";
import { alertPaymentFailed } from "@/lib/whatsapp/alerts";

/**
 * Webhook Versus Business (TRANSACTION_STATUS).
 * À déclarer chez Versus : https://votre-domaine/api/payment/versus/webhook?token=<VERSUS_WEBHOOK_TOKEN>
 *
 * Versus ne signe pas ses webhooks : le corps reçu n'est donc jamais cru. On retrouve la
 * référence du paiement enregistrée à la création, on relit le paiement chez Versus et on ne
 * valide que s'il est COMPLETED, pour la même commande et le montant exact (voir settle-versus.ts,
 * aussi appelé par la page de commande : même sans webhook, un paiement n'est jamais oublié).
 */
export async function POST(req: NextRequest) {
  if (!versusCredentials()) return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });

  const expected = process.env.VERSUS_WEBHOOK_TOKEN;
  if (expected) {
    const given = req.nextUrl.searchParams.get("token") ?? "";
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { type?: string; external_reference?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Les instructions de paiement n'ont rien à traiter de notre côté.
  if (body.type !== "TRANSACTION_STATUS" || !body.external_reference) return NextResponse.json({ received: true });

  const id = orderIdFromReference(String(body.external_reference));
  const result = await settleVersusPayment(id);
  if (result === "failed" && !id.startsWith(DEPOSIT_PREFIX) && !id.startsWith("gift_")) alertPaymentFailed(id, "Versus");

  return NextResponse.json({ received: true });
}
