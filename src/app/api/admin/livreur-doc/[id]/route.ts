import { requireAdmin } from "@/lib/actions/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Photo de pièce d'identité d'un livreur : administrateurs du module Livraison uniquement, jamais en cache. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("livraison", "read");
  } catch {
    return new Response("Accès refusé", { status: 403 });
  }
  const { id } = await params;
  const doc = await prisma.livreurDocument.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!doc) return new Response("Introuvable", { status: 404 });
  return new Response(Buffer.from(doc.data), {
    headers: {
      "Content-Type": doc.mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Robots-Tag": "noindex",
    },
  });
}
