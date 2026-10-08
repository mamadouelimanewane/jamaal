import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Tag } from "lucide-react";
import { PromoCodeManager } from "@/components/admin/PromoCodeManager";
import { ReferralCard } from "@/components/ReferralCard";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

async function getOrCreateReferral(consultantId: string) {
  const existing = await prisma.referral.findFirst({
    where: { referrerId: consultantId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  const code = randomBytes(4).toString("hex").toUpperCase();
  return prisma.referral.create({
    data: { code, referrerId: consultantId, rewardPoints: 2000 },
  });
}

export default async function ConsultantCodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!consultant) notFound();

  const [promoCodes, referral] = await Promise.all([
    prisma.promoCode.findMany({
      where: { consultantId: id },
      orderBy: { createdAt: "desc" },
    }),
    getOrCreateReferral(id),
  ]);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/admin/consultants/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-rose-dark" />
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Codes Promo — {consultant.name}
            </h1>
          </div>
          <p className="text-xs text-navy/50 mt-0.5">
            Générez des codes uniques à partager sur WhatsApp et les réseaux sociaux pour tracker vos ventes sans lien.
          </p>
        </div>
      </div>

      {/* Lien de parrainage */}
      <div className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Code ambassadeur (lien de parrainage)</h2>
        <ReferralCard
          code={referral.code}
          referrerId={id}
          usedAt={referral.usedAt}
          rewardPoints={referral.rewardPoints}
        />
      </div>

      {/* Codes promo personnalisés */}
      <PromoCodeManager consultantId={id} initialCodes={promoCodes} />
    </div>
  );
}
