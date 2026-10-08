"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "./auth-guard";

export interface GlobalSearchResult {
  type: "order" | "customer" | "product" | "consultant";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function globalAdminSearch(query: string): Promise<GlobalSearchResult[]> {
  await requireStaff();
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const [orders, customers, products, consultants] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [
          { customerName: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, customerName: true, total: true, status: true },
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, phone: true },
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, category: true, slug: true },
    }),
    prisma.consultant.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, name: true, city: true },
    }),
  ]);

  const results: GlobalSearchResult[] = [];

  for (const o of orders) {
    results.push({
      type: "order",
      id: o.id,
      title: `Commande — ${o.customerName}`,
      subtitle: `${o.total.toLocaleString("fr-FR")} FCFA · Statut: ${o.status}`,
      href: `/admin/commandes/${o.id}`,
    });
  }

  for (const c of customers) {
    results.push({
      type: "customer",
      id: c.id,
      title: `Client — ${c.name}`,
      subtitle: `Tél: ${c.phone}`,
      href: `/admin/clients/${c.id}`,
    });
  }

  for (const p of products) {
    results.push({
      type: "product",
      id: p.id,
      title: `Produit — ${p.name}`,
      subtitle: `Catégorie: ${p.category}`,
      href: `/admin/produits/${p.id}`,
    });
  }

  for (const cons of consultants) {
    results.push({
      type: "consultant",
      id: cons.id,
      title: `Consultant — ${cons.name}`,
      subtitle: `Ville: ${cons.city}`,
      href: `/admin/consultants/${cons.id}`,
    });
  }

  return results;
}
