import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { livreurTour } from "@/lib/tour/tour";

export const dynamic = "force-dynamic";

/** Tournée du livreur connecté : arrêts dans l'ordre conseillé, itinéraire et trace. */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "LIVREUR" || !session.user.id) return Response.json({ error: "auth" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { livreurId: true } });
  if (!user?.livreurId) return Response.json({ error: "auth" }, { status: 403 });
  return Response.json(await livreurTour(user.livreurId), { headers: { "Cache-Control": "no-store" } });
}
