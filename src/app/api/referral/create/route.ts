import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

const inputSchema = z.object({
  referrerId: z.string().min(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
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
    where: { id: parsed.data.referrerId },
    select: { id: true },
  });
  if (!consultant) {
    return NextResponse.json({ success: false, error: "Consultant introuvable" }, { status: 404 });
  }

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;
  const referral = await prisma.referral.create({
    data: {
      code: randomBytes(5).toString("hex").toUpperCase(),
      referrerId: consultant.id,
      expiresAt,
      rewardPoints: 2_000,
    },
  });

  return NextResponse.json({ success: true, referral }, { status: 201 });
}
