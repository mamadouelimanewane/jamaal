import { prisma } from "./prisma";

/**
 * À appeler juste après la création d'une commande rattachée à un consultant.
 * Si c'est la toute première vente de ce consultant et qu'il a un parrain
 * disposant d'un compte portail, on notifie le parrain.
 */
export async function notifySponsorOnFirstSale(consultantId: string) {
  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    include: { sponsor: { include: { user: true } }, _count: { select: { orders: true } } },
  });
  if (!consultant?.sponsor?.user) return;
  if (consultant._count.orders !== 1) return; // pas sa première vente

  await prisma.notification.create({
    data: {
      userId: consultant.sponsor.user.id,
      title: "Premier filleul actif 🎉",
      message: `${consultant.name} vient de réaliser sa première vente grâce à votre parrainage !`,
    },
  });
}
