import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      deliveryMode: true,
      createdAt: true,
      updatedAt: true,
      livreur: { select: { name: true, lastLat: true, lastLng: true, lastSeenAt: true } },
    },
  });

  if (!order) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({
    status: order.status,
    deliveryMode: order.deliveryMode,
    updatedAt: order.updatedAt,
    livreur: order.livreur
      ? {
          name: order.livreur.name,
          lat: order.livreur.lastLat,
          lng: order.livreur.lastLng,
          lastSeenAt: order.livreur.lastSeenAt,
        }
      : null,
  });
}
