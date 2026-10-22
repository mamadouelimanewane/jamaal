"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchCatalog } from "@/lib/search-index";
import { getAccess } from "@/lib/access";
import { searchScope } from "@/lib/search-scope";
import { requireStaff } from "./auth-guard";

export interface GlobalSearchResult {
  type: "order" | "customer" | "product" | "consultant";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Recherche du menu. Chacun ne trouve que ce qu'il a le droit de voir :
 * - administrateur complet : tout ;
 * - administrateur restreint : seulement les modules de son profil ;
 * - revendeur : ses propres commandes et clients, et le catalogue ;
 * - livreur : ses livraisons et le catalogue.
 * Les données sont relues en base (rôle, profil, fiche rattachée), jamais prises de la session seule.
 */
export async function globalAdminSearch(query: string): Promise<GlobalSearchResult[]> {
  const session = await requireStaff();
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const userId = session.user?.id;
  if (!userId) return [];
  const [access, user] = await Promise.all([
    getAccess(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { consultantId: true, livreurId: true } }),
  ]);
  if (!access) return [];

  const scope = searchScope({ role: access.role, perms: access.perms, consultantId: user?.consultantId ?? null, livreurId: user?.livreurId ?? null });
  const isAdmin = access.role === "ADMIN";
  const role = access.role;
  const orderScope = scope.orders;
  const showCustomers = scope.customers !== "none";
  const showProducts = scope.products;
  const showConsultants = scope.consultants;

  const orderMatch: Prisma.OrderWhereInput = {
    OR: [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { id: { contains: q, mode: "insensitive" } },
    ],
  };

  const [orders, customers, products, consultants] = await Promise.all([
    orderScope
      ? prisma.order.findMany({
          where: { AND: [orderScope, orderMatch] },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, customerName: true, total: true, status: true },
        })
      : Promise.resolve([]),
    !showCustomers
      ? Promise.resolve([])
      : scope.customers === "all"
        ? prisma.customer.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
            take: 5,
            select: { id: true, name: true, phone: true },
          })
        : // Revendeur : uniquement les clients de ses propres commandes.
          prisma.order
            .findMany({
              where: {
                consultantId: user!.consultantId!,
                OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }],
              },
              orderBy: { createdAt: "desc" },
              distinct: ["customerPhone"],
              take: 5,
              select: { id: true, customerName: true, customerPhone: true },
            })
            .then((rows) => rows.map((r) => ({ id: r.id, name: r.customerName, phone: r.customerPhone })),
            ),
    showProducts
      ? // Même moteur que la recherche du site : nom, code, catégorie, parfum d'inspiration, fautes de frappe.
        searchCatalog(q, 6)
          .then((r) => r.hits.map((h) => ({ id: h.doc.id, name: h.doc.name, category: h.doc.categoryLabel ?? h.doc.category, slug: h.doc.slug, code: h.doc.choganCode })))
          .catch(() => [] as { id: string; name: string; category: string; slug: string; code: string | null }[])
      : Promise.resolve([]),
    showConsultants
      ? prisma.consultant.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, name: true, city: true },
        })
      : Promise.resolve([]),
  ]);

  const orderHref = (id: string) =>
    isAdmin ? `/admin/commandes/${id}` : role === "CONSULTANT" ? `/admin/mes-commandes/${id}` : "/admin/mes-livraisons";

  const results: GlobalSearchResult[] = [];

  for (const o of orders) {
    results.push({
      type: "order",
      id: o.id,
      title: `Commande — ${o.customerName}`,
      subtitle: `${o.total.toLocaleString("fr-FR")} FCFA · Statut: ${o.status}`,
      href: orderHref(o.id),
    });
  }

  for (const c of customers) {
    results.push({
      type: "customer",
      id: c.id,
      title: `Client — ${c.name}`,
      subtitle: `Tél: ${c.phone}`,
      href: isAdmin ? `/admin/clients/${c.id}` : "/admin/mes-clients",
    });
  }

  for (const p of products) {
    results.push({
      type: "product",
      id: p.id,
      title: `Produit — ${p.name}`,
      subtitle: [p.code && `Code ${p.code}`, p.category].filter(Boolean).join(" · "),
      // Revendeur : la fiche de son catalogue (visuels et partage) ; livreur : la page du site.
      href: isAdmin ? `/admin/produits/${p.id}/modifier` : role === "CONSULTANT" ? `/admin/catalogue/${p.slug}` : `/produits/${p.slug}`,
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
