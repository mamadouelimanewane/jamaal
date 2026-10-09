import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

/** Photo de la pièce d'identité d'un candidat (recto ou verso) : réservée aux administrateurs. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const { id } = await params;
  const face = new URL(req.url).searchParams.get("face") === "verso" ? "verso" : "recto";
  const app = await prisma.consultantApplication.findUnique({ where: { id }, select: { idFront: face === "recto", idBack: face === "verso", idMime: true } });
  const bytes = face === "recto" ? app?.idFront : app?.idBack;
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": app?.idMime ?? "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
