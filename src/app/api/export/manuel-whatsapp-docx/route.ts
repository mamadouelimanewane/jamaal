import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildWhatsAppManualDocx } from "@/lib/whatsapp/manual-docx";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const buffer = buildWhatsAppManualDocx();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="Manuel-Messagerie-WhatsApp-JAMAAL-Luxury.docx"',
      "Cache-Control": "no-store",
    },
  });
}
