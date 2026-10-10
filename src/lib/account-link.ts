/**
 * Comptes revendeurs sans fiche consultant (compte créé à la main sans fiche, fiche supprimée…).
 * À la connexion, on retrouve la fiche par l'e-mail (fiche libre ou candidature acceptée) et on la
 * rattache ; sinon JAMAAL est prévenu une fois par jour. Fichier serveur.
 */
import { prisma } from "./prisma";

export async function repairConsultantLink(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, consultantId: true } });
  if (!user || user.role !== "CONSULTANT" || user.consultantId) return null;
  const email = user.email.trim();
  const byEmail = await prisma.consultant.findFirst({ where: { email: { equals: email, mode: "insensitive" }, user: null }, select: { id: true } });
  let consultantId = byEmail?.id ?? null;
  if (!consultantId) {
    const apps = await prisma.consultantApplication.findMany({
      where: { email: { equals: email, mode: "insensitive" }, status: "ACCEPTEE", consultantId: { not: null } },
      orderBy: { processedAt: "desc" },
      select: { consultantId: true },
    });
    for (const a of apps) {
      const c = await prisma.consultant.findFirst({ where: { id: a.consultantId!, user: null }, select: { id: true } });
      if (c) {
        consultantId = c.id;
        break;
      }
    }
  }
  if (consultantId) {
    const res = await prisma.user.updateMany({ where: { id: user.id, consultantId: null }, data: { consultantId } });
    if (res.count) return prisma.consultant.findUnique({ where: { id: consultantId } });
  }
  // Rien à rattacher : prévenir les administrateurs (au plus une fois par 24 h).
  const title = "Compte revendeur sans fiche";
  const recent = await prisma.notification.findFirst({ where: { title, message: { contains: user.email }, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { id: true } });
  if (!recent) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({ userId: a.id, title, message: `${user.name} (${user.email}) s'est connecté·e mais son compte n'est rattaché à aucune fiche revendeur. Rattachez-le dans Admin › Utilisateurs.` })),
      });
    }
  }
  return null;
}
