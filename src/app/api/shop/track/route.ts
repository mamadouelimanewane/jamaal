import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { classifyAgent } from "@/lib/bot-guard";
import { isShopEventKind } from "@/lib/shop/shop-stats";

/**
 * Compteur de la boutique personnelle (/c/<slug>) : { slug, kind: "visite"|"whatsapp"|"produit", productId?, sid }.
 * Ignore les robots, le revendeur sur sa propre boutique, les visites répétées (30 min) et les rafales.
 * Répond toujours 204 : le navigateur n'attend rien.
 */
const done = () => new Response(null, { status: 204 });

export async function POST(req: NextRequest) {
  try {
    if (classifyAgent(req.headers.get("user-agent")) !== "human") return done();
    const body = await req.json().catch(() => null);
    const slug = String(body?.slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
    const kind = body?.kind;
    const sid = String(body?.sid ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || null;
    const productId = typeof body?.productId === "string" ? body.productId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || null : null;
    if (!slug || !isShopEventKind(kind)) return done();

    const c = await prisma.consultant.findFirst({ where: { slug, active: true }, select: { id: true, user: { select: { id: true } } } });
    if (!c) return done();

    const session = await auth().catch(() => null);
    if (session?.user?.id && session.user.id === c.user?.id) return done();

    if (sid) {
      const since = new Date(Date.now() - 24 * 3600_000);
      const [recentVisit, today] = await Promise.all([
        kind === "visite"
          ? prisma.shopEvent.findFirst({ where: { sid, consultantId: c.id, kind: "visite", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } }, select: { id: true } })
          : null,
        prisma.shopEvent.count({ where: { sid, createdAt: { gte: since } } }),
      ]);
      if (recentVisit || today >= 200) return done();
    }

    if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) return done();
    await prisma.shopEvent.create({ data: { consultantId: c.id, kind, sid, productId: kind === "produit" ? productId : null } });
  } catch {
    // Les statistiques ne doivent jamais gêner la visite.
  }
  return done();
}
