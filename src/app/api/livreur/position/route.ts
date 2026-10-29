import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseFix } from "@/lib/geo-track";
import { recordPosition } from "@/lib/livreur-tracking";

export const dynamic = "force-dynamic";

/** Position GPS envoyée par l'application Livreur pendant les tournées (livreur connecté uniquement). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "LIVREUR" || !session.user.id) return Response.json({ error: "auth" }, { status: 401 });
  const fix = parseFix(await req.json().catch(() => null));
  if (!fix) return Response.json({ error: "position" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true, livreurId: true } });
  if (!user?.active || !user.livreurId) return Response.json({ error: "auth" }, { status: 403 });
  const r = await recordPosition(user.livreurId, fix);
  return Response.json({ ok: true, ...r }, { headers: { "Cache-Control": "no-store" } });
}
