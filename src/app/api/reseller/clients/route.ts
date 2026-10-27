import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReseller } from "@/lib/reseller";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const me = await getReseller();
  let orders: { customerName: string; customerPhone: string | null; createdAt: Date }[] = [];

  if (me) {
    orders = await prisma.order.findMany({
      where: { consultantId: me.id, customerPhone: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { customerName: true, customerPhone: true, createdAt: true },
      take: 300,
    });
  } else if (session.user.role === "ADMIN") {
    orders = await prisma.order.findMany({
      where: { customerPhone: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { customerName: true, customerPhone: true, createdAt: true },
      take: 300,
    });
  }

  const map = new Map<string, { name: string; phone: string; lastOrder: string }>();
  for (const o of orders) {
    if (!o.customerPhone) continue;
    const cleanPhone = o.customerPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 7) continue;
    if (!map.has(cleanPhone)) {
      map.set(cleanPhone, {
        name: o.customerName || "Client",
        phone: o.customerPhone,
        lastOrder: o.createdAt.toISOString(),
      });
    }
  }

  return NextResponse.json({ clients: Array.from(map.values()) });
}
