import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pieceLabel } from "@/lib/protocol";
import { protocolPdf } from "@/lib/protocol-pdf";

/**
 * Protocole signé : PDF (par défaut) ou image de la signature (?format=png).
 * Accessible aux administrateurs et au membre qui l'a signé.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const sig = await prisma.protocolSignature.findUnique({ where: { id }, include: { application: { select: { processedAt: true, status: true } } } });
  if (!sig) return new Response("Introuvable", { status: 404 });
  if (session.user.role !== "ADMIN") {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { consultantId: true } });
    if (!me?.consultantId || me.consultantId !== sig.consultantId) return new Response("Forbidden", { status: 403 });
  }
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (new URL(req.url).searchParams.get("format") === "png") {
    return new Response(new Uint8Array(sig.image), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  const pdf = await protocolPdf({
    version: sig.version,
    text: sig.text,
    textHash: sig.textHash,
    signerName: sig.signerName,
    piece: pieceLabel(sig.idType, sig.idNumber),
    address: sig.address,
    phone: sig.phone,
    image: new Uint8Array(sig.image),
    ip: sig.ip,
    signedAt: sig.signedAt,
    approvedAt: sig.application?.status === "ACCEPTEE" ? sig.application.processedAt : sig.consultantId && !sig.applicationId ? sig.signedAt : null,
  });
  const name = `protocole-jamaal-${sig.signerName.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-v${sig.version}.pdf`;
  return new Response(new Uint8Array(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
}
