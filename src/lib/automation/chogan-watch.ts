/**
 * Veille des prix Chogan : chaque jour, vérifie les fiches les plus anciennement contrôlées
 * (autant que le temps le permet) et note tout changement du prix public. Les prix JAMAAL ne
 * changent pas tout seuls : l'administrateur décide (Admin > Stocks > Commande Chogan).
 */
import { prisma } from "@/lib/prisma";
import { fetchChoganDetail } from "@/lib/chogan/client";
import { eurToFcfa } from "@/lib/chogan/parse";
import { automationEnabled } from "@/lib/automation-settings";

export async function watchChoganPrices(budgetMs: number) {
  if (!(await automationEnabled("choganWatch"))) return "désactivé";
  const deadline = Date.now() + budgetMs;
  const products = await prisma.product.findMany({
    where: { number: { not: null }, isOfficial: true },
    orderBy: [{ choganCheckedAt: { sort: "asc", nulls: "first" } }],
    select: { id: true, name: true, number: true, publicPrice: true },
    take: 60,
  });
  let checked = 0;
  let changed = 0;
  let errors = 0;
  for (const p of products) {
    if (Date.now() > deadline - 2_500) break;
    try {
      const detail = await fetchChoganDetail(p.number!);
      if (detail?.publicPriceEur) {
        const fresh = eurToFcfa(detail.publicPriceEur);
        if (p.publicPrice != null && Math.abs(fresh - p.publicPrice) >= 50) {
          await prisma.choganPriceChange.create({ data: { productId: p.id, name: p.name, oldPublic: p.publicPrice, newPublic: fresh } });
          changed++;
        }
      }
      checked++;
    } catch {
      errors++;
    }
    await prisma.product.update({ where: { id: p.id }, data: { choganCheckedAt: new Date() } });
  }
  return { verifies: checked, changements: changed, erreurs: errors };
}
