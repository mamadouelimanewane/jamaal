import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Nouvelles notifications de l'utilisateur connecté (pour la sonnerie du back-office) :
 * nombre de non lues et les 3 dernières arrivées après `after` (date ISO).
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ unread: 0, fresh: [] }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("after");
  const after = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : new Date();
  const [unread, fresh] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.findMany({ where: { userId, createdAt: { gt: after } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, message: true, createdAt: true } }),
  ]);
  return Response.json({ unread, fresh, now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
