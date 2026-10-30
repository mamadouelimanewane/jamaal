import { NextResponse } from "next/server";

/**
 * Fail closed until the Kwingo 2 contract has been implemented. A shared query-string token
 * and a caller-provided "SUCCESS" status do not prove that Orange received the order amount.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Orange Money n’est pas encore activé. Notification non traitée." },
    { status: 503 }
  );
}

/** Sonde informative uniquement ; aucun paiement Orange n’est actif via ce endpoint. */
export async function GET() {
  return NextResponse.json({ active: false, provider: "orange_money" }, { status: 503 });
}
