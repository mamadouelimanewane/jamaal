/**
 * Demande d'avis sur WhatsApp, environ 2 jours après la livraison : lien personnel pour noter
 * chaque produit et ajouter une photo. Une seule demande par commande.
 */
import { prisma } from "@/lib/prisma";
import { phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { reviewLink } from "@/lib/review-token";
import { messageText } from "@/lib/whatsapp/message-templates";

const DAY = 86_400_000;

export function reviewRequestText(o: { firstName: string; products: string[]; link: string }): string {
  return `Bonjour${o.firstName ? ` ${o.firstName}` : ""} 🌸\nVous avez reçu ${o.products.length > 1 ? "vos produits" : `*${o.products[0]}*`} il y a quelques jours : qu'en pensez-vous ?\nVotre avis (et une photo si vous voulez 📸) aide beaucoup les autres clients : ${o.link}\nMerci ! L'équipe JAMAAL\n\n(Répondez STOP pour ne plus recevoir ces messages.)`;
}

export async function requestReviews(origin: string, now = new Date()) {
  if (!(await automationEnabled("reviews"))) return "désactivé";
  if (!whatsappConfig().active) return "WhatsApp non configuré : aucune demande envoyée";
  const orders = await prisma.order.findMany({
    where: {
      status: "LIVREE",
      customerPhone: { not: null },
      OR: [
        { deliveredAt: { gte: new Date(now.getTime() - 3 * DAY), lt: new Date(now.getTime() - 2 * DAY) } },
        { deliveredAt: null, updatedAt: { gte: new Date(now.getTime() - 3 * DAY), lt: new Date(now.getTime() - 2 * DAY) } },
      ],
    },
    select: { id: true, customerName: true, customerPhone: true, items: { select: { productName: true } } },
    take: 60,
  });
  let sent = 0;
  for (const o of orders) {
    const phone = o.customerPhone!;
    if ((await phoneOptedOut(phone)) || (await prisma.review.count({ where: { orderId: o.id } }))) continue;
    if (!(await claimAutomation(`avis:${o.id}`))) continue;
    await sendWhatsApp({
      to: phone,
      kind: "avis",
      text: await (async () => {
        const firstName = (o.customerName ?? "").split(/\s+/)[0];
        const products = [...new Set(o.items.map((i) => i.productName))];
        const link = reviewLink(origin, o.id);
        const custom = await messageText("avis", { prenom: firstName, produits: products.length > 1 ? "vos produits" : `*${products[0]}*`, lien: link }, "");
        return custom ? `${custom}\n\n(Répondez STOP pour ne plus recevoir ces messages.)` : reviewRequestText({ firstName, products, link });
      })(),
    });
    sent++;
  }
  return sent;
}
