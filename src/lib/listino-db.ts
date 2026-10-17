import { prisma } from "@/lib/prisma";
import { LISTINO, planListino, type ListinoPlan } from "@/lib/listino";

/** Charge le catalogue (parfums) et calcule le plan : formats manquants, écarts de prix, références introuvables. */
export async function loadListinoPlan(): Promise<ListinoPlan> {
  const products = await prisma.product.findMany({
    where: { choganCode: { not: null }, category: { startsWith: "parfum-" } },
    select: { id: true, name: true, category: true, choganCode: true, volumes: true, _count: { select: { variants: true } } },
  });
  return planListino(products.map((p) => ({ id: p.id, name: p.name, category: p.category, choganCode: p.choganCode, volumes: p.volumes, variantCount: p._count.variants })), LISTINO);
}
