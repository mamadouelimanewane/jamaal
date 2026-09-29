import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

const inputSchema = z.object({
  consultantId: z.string().min(1),
  discountPct: z.number().int().min(1).max(50).default(5),
  expiresInDays: z.number().int().min(1).max(365).default(30),
  usageLimit: z.number().int().min(0).max(100_000).default(0),
  description: z.string().trim().max(120).optional().default(""),
});

export async function POST(request: Request) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Requête JSON invalide" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Paramètres invalides" }, { status: 400 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: parsed.data.consultantId },
    select: { id: true },
  });
  if (!consultant) {
    return NextResponse.json({ success: false, error: "Consultant introuvable" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000);
  const promo = await prisma.promoCode.create({
    data: {
      code: randomBytes(5).toString("hex").toUpperCase(),
      consultantId: consultant.id,
      discountPct: parsed.data.discountPct,
      usageLimit: parsed.data.usageLimit,
      description: parsed.data.description || null,
      expiresAt,
    },
  });

  return NextResponse.json({ success: true, promo }, { status: 201 });
}
