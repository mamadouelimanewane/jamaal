import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

/** Type d'image reconnu par les premiers octets (les deux faces peuvent avoir des formats différents). */
function sniffMime(b: Uint8Array): string {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return "image/webp";
  return "image/jpeg";
}

/** Photo de la pièce d'identité d'un consultant (recto ou verso) : réservée aux administrateurs. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdminForApi("revendeurs");
  if (forbidden) return forbidden;
  const { id } = await params;
  const face = new URL(req.url).searchParams.get("face") === "verso" ? "verso" : "recto";
  const piece = await prisma.consultantPiece.findUnique({ where: { consultantId: id }, select: { front: face === "recto", back: face === "verso" } });
  let bytes = face === "recto" ? piece?.front : piece?.back;
  // Pas de photo enregistrée sur la fiche : on reprend celle de la candidature acceptée.
  if (!bytes) {
    const app = await prisma.consultantApplication.findFirst({ where: { consultantId: id }, select: { idFront: face === "recto", idBack: face === "verso" } });
    bytes = face === "recto" ? app?.idFront : app?.idBack;
  }
  if (!bytes) return new Response("Introuvable", { status: 404 });
  const out = new Uint8Array(bytes);
  return new Response(out, {
    headers: { "Content-Type": sniffMime(out), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
