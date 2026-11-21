import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildWhatsAppManualPdf } from "@/lib/whatsapp/manual-pdf";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const pdfBytes = await buildWhatsAppManualPdf();
  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Manuel-Messagerie-WhatsApp-JAMAAL-Luxury.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
