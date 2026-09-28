import { prisma } from "./prisma";
import { getSponsorCommissionRate } from "./settings";
import { formatPrice } from "./currency";

/**
 * Notifie le parrain :
 * - à la première vente du filleul (message spécial)
 * - à chaque vente suivante (avec montant + commission estimée)
 *
 * À appeler juste après la création d'une commande rattachée à un consultant.
 */
export async function notifySponsorOnSale(
  consultantId: string,
  orderTotal: number
) {
  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    include: {
      sponsor: { include: { user: true } },
      _count: { select: { orders: true } },
    },
  });

  if (!consultant?.sponsor?.user) return;

  const sponsorUserId = consultant.sponsor.user.id;
  const isFirstSale = consultant._count.orders === 1;
  const sponsorRate = await getSponsorCommissionRate();
  const estimated = Math.round((orderTotal * sponsorRate) / 100);

  if (isFirstSale) {
    await prisma.notification.create({
      data: {
        userId: sponsorUserId,
        title: "Premier filleul actif 🎉",
        message: `${consultant.name} vient de réaliser sa première vente (${formatPrice(orderTotal)}). Commission parrainage estimée : ${formatPrice(estimated)}.`,
      },
    });
    return;
  }

  await prisma.notification.create({
    data: {
      userId: sponsorUserId,
      title: "Vente d'un filleul",
      message: `${consultant.name} a généré une vente de ${formatPrice(orderTotal)}. Votre commission parrainage estimée : ${formatPrice(estimated)} (${sponsorRate}%).`,
    },
  });
}

/** @deprecated Utiliser notifySponsorOnSale — conservé pour compatibilité */
export async function notifySponsorOnFirstSale(consultantId: string) {
  await notifySponsorOnSale(consultantId, 0);
}
