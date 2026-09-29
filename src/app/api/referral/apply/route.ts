import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";

const inputSchema = z.object({
  code: z.string().trim().min(1).max(32),
  customerId: z.string().min(1),
});

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

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

  const code = parsed.data.code.toUpperCase();
  const outcome = await prisma.$transaction(async (tx) => {
    const [referral, customer] = await Promise.all([
      tx.referral.findUnique({ where: { code } }),
      tx.customer.findUnique({ where: { id: parsed.data.customerId } }),
    ]);

    if (!referral || !customer) return { error: "Code ou client introuvable", status: 404 as const };
    if (referral.usedAt) return { error: "Code déjà utilisé", status: 409 as const };
    if (referral.expiresAt && referral.expiresAt <= new Date()) {
      return { error: "Code expiré", status: 400 as const };
    }

    const consultant = referral.referrerId
      ? await tx.consultant.findUnique({
          where: { id: referral.referrerId },
          select: { id: true, name: true, whatsapp: true },
        })
      : null;
    if (consultant && normalizePhone(consultant.whatsapp) === normalizePhone(customer.phone)) {
      return { error: "Le parrain ne peut pas utiliser son propre code", status: 400 as const };
    }

    const claimed = await tx.referral.updateMany({
      where: { id: referral.id, usedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      data: { usedAt: new Date(), usedById: customer.id },
    });
    if (claimed.count !== 1) return { error: "Code déjà utilisé ou expiré", status: 409 as const };

    if (consultant) {
      const phone = normalizePhone(consultant.whatsapp);
      const account = await tx.loyaltyAccount.upsert({
        where: { phone },
        create: { phone, name: consultant.name, points: referral.rewardPoints, lifetime: referral.rewardPoints },
        update: {
          points: { increment: referral.rewardPoints },
          lifetime: { increment: referral.rewardPoints },
          name: consultant.name,
        },
      });
      await tx.loyaltyEvent.create({
        data: {
          accountId: account.id,
          type: "REFERRAL",
          points: referral.rewardPoints,
          note: `Parrainage ${code} utilisé par ${customer.name}`,
        },
      });
    }

    return { rewardPoints: referral.rewardPoints };
  });

  if ("error" in outcome) {
    return NextResponse.json(
      { success: false, error: outcome.error },
      { status: outcome.status },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Code de parrainage appliqué",
    rewardPoints: outcome.rewardPoints,
  });
}
