"use server";

import { prisma } from "@/lib/prisma";
import { requireConsultantProfile } from "./auth-guard";
import type { OnboardingStepId } from "@/data/onboarding";

export async function getOnboardingAutoStatus(): Promise<
  Partial<Record<OnboardingStepId, boolean>>
> {
  const { consultant } = await requireConsultantProfile();

  const [orderCount, teamCount] = await Promise.all([
    prisma.order.count({
      where: { consultantId: consultant.id, status: { not: "ANNULEE" } },
    }),
    prisma.consultant.count({ where: { sponsorId: consultant.id, active: true } }),
  ]);

  const slug = (consultant as { slug?: string | null }).slug;
  const profilOk = !!(
    consultant.name &&
    consultant.city &&
    consultant.whatsapp &&
    slug
  );

  return {
    profil: profilOk,
    "premiere-commande": orderCount >= 1,
    filleul: teamCount >= 1,
  };
}
