/**
 * Code de parrainage saisi par un candidat → parrain. Deux sortes de codes :
 * - le code personnel d'un revendeur (son identifiant, ex. « aminata ») ;
 * - un code créé par l'administrateur (ex. « JAMAAL »), rattaché au parrain qu'il a choisi.
 */
import { prisma } from "@/lib/prisma";

export const normalizeSponsorCode = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, "");

export async function resolveSponsorCode(raw: string): Promise<{ id: string; name: string } | null> {
  const code = normalizeSponsorCode(raw);
  if (code.length < 2) return null;
  const own = await prisma.consultant.findFirst({ where: { slug: code, active: true }, select: { id: true, name: true } });
  if (own) return own;
  const admin = await prisma.sponsorCode.findUnique({ where: { code }, select: { active: true, consultantId: true } });
  if (!admin?.active) return null;
  return prisma.consultant.findFirst({ where: { id: admin.consultantId, active: true }, select: { id: true, name: true } });
}
