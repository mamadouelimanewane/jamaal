import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";

const range = (vals: number[]) => {
  const u = [...new Set(vals)].sort((a, b) => a - b);
  return u.length > 1 ? `${u[0]} à ${u[u.length - 1]} %` : `${u[0]} %`;
};

/** Taux normaux du modèle économique (pour les rappels du formulaire). */
export async function normalRates() {
  const m = await getBusinessModel();
  return {
    seller: range([m.sellerPct, m.sellerParrainPct, m.sellerLeaderPct, m.sellerConsultantDirectPct]),
    level1: range([m.sponsorAlonePct, m.sponsorSharedPct, m.leaderDirectPct]),
    level2: `${m.grandSponsorPct} %`,
  };
}

export async function consultantChoices() {
  const rows = await prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, city: true, specialTerms: { select: { name: true } } }, orderBy: { name: "asc" } });
  return rows.map((c) => ({ id: c.id, name: c.name, city: c.city, termsName: c.specialTerms?.name ?? null }));
}
