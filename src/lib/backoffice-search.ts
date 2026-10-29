/**
 * Recherche du back-office (administrateur, revendeur, livreur) : le même moteur que la recherche du site
 * (fautes de frappe, codes Chogan, grands parfums, notes, expansion IA des phrases sur la page de résultats),
 * plus les données de l'espace : commandes, clients, conseillers, livreurs, codes promo.
 * Chacun ne trouve que ce qu'il a le droit de voir (searchScope + profil de l'administrateur).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchCatalog } from "@/lib/search-index";
import { allows, type Permissions } from "@/lib/permissions";
import { searchScope } from "@/lib/search-scope";

export type BoProduct = {
  id: string; slug: string; name: string; code: string | null; number: number | null; inspiredBy: string | null; inspiredBrand: string | null;
  category: string; categorySlug: string; price: number | null; photo: string | null; colorFrom: string; colorTo: string; stock: number | null; href: string;
};
export type BoItem = { id: string; title: string; subtitle: string; href: string; badge?: string };
export type BoResult = {
  query: string;
  corrected: string | null;
  total: number;
  products: BoProduct[];
  brands: { brand: string; count: number }[];
  categories: { slug: string; label: string; count: number }[];
  orders: BoItem[];
  customers: BoItem[];
  consultants: BoItem[];
  livreurs: BoItem[];
  coupons: BoItem[];
};

const STATUS: Record<string, string> = { EN_ATTENTE: "En attente", CONFIRMEE: "Confirmée", EXPEDIEE: "Expédiée", LIVREE: "Livrée", ANNULEE: "Annulée" };
const F = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const digits = (q: string) => q.replace(/\D/g, "");

export type Viewer = { role: string; perms: Permissions | null; consultantId: string | null; livreurId: string | null };

/** `full` : page de résultats (plus de résultats, expansion IA autorisée par `allowAi`). */
export async function backofficeSearch(viewer: Viewer, query: string, opts: { full?: boolean; allowAi?: () => Promise<boolean> } = {}): Promise<BoResult> {
  const q = query.trim().slice(0, 80);
  const empty: BoResult = { query: q, corrected: null, total: 0, products: [], brands: [], categories: [], orders: [], customers: [], consultants: [], livreurs: [], coupons: [] };
  if (q.length < 2) return empty;
  const full = !!opts.full;
  const scope = searchScope(viewer);
  const isAdmin = viewer.role === "ADMIN";
  const can = (m: Parameters<typeof allows>[1]) => isAdmin && allows(viewer.perms, m, "read");
  const d = digits(q);
  const take = full ? 25 : 5;

  // Commandes : n° (8 derniers caractères), nom ou téléphone du client, produit commandé, montant exact.
  const orderOr: Prisma.OrderWhereInput[] = [
    { customerName: { contains: q, mode: "insensitive" } },
    { id: { endsWith: q.replace(/^#/, "").toLowerCase(), mode: "insensitive" } },
    { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
  ];
  if (d.length >= 4) orderOr.push({ customerPhone: { contains: d.slice(-9) } });
  if (/^\d{3,8}$/.test(q)) orderOr.push({ total: Number(q) });

  const [catalog, orders, customers, consultants, livreurs, coupons] = await Promise.all([
    scope.products ? searchCatalog(q, full ? 120 : 40, { allowAi: full ? opts.allowAi : undefined }).catch(() => null) : Promise.resolve(null),
    scope.orders
      ? prisma.order.findMany({
          where: { AND: [scope.orders, { OR: orderOr }] },
          orderBy: { createdAt: "desc" },
          take,
          select: { id: true, customerName: true, customerPhone: true, total: true, status: true, paymentStatus: true, createdAt: true },
        })
      : Promise.resolve([]),
    scope.customers === "none"
      ? Promise.resolve([])
      : scope.customers === "all"
        ? prisma.customer
            .findMany({
              where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, ...(d.length >= 4 ? [{ phone: { contains: d.slice(-9) } }] : [])] },
              take,
              select: { id: true, name: true, phone: true, loyaltyPoints: true },
            })
            .then((rows) => rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, detail: c.loyaltyPoints ? `${c.loyaltyPoints} points` : "" })))
        : prisma.order
            .findMany({
              where: { consultantId: viewer.consultantId!, OR: [{ customerName: { contains: q, mode: "insensitive" } }, ...(d.length >= 4 ? [{ customerPhone: { contains: d.slice(-9) } }] : [])] },
              orderBy: { createdAt: "desc" },
              distinct: ["customerPhone"],
              take,
              select: { id: true, customerName: true, customerPhone: true },
            })
            .then((rows) => rows.map((r) => ({ id: r.id, name: r.customerName, phone: r.customerPhone ?? "", detail: "" }))),
    scope.consultants
      ? prisma.consultant.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }, { email: { contains: q, mode: "insensitive" } }, ...(d.length >= 4 ? [{ whatsapp: { contains: d.slice(-9) } }] : [])] },
          take,
          select: { id: true, name: true, city: true, active: true, rank: true },
        })
      : Promise.resolve([]),
    can("livraison")
      ? prisma.livreur.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(d.length >= 4 ? [{ phone: { contains: d.slice(-9) } }] : [])] }, take, select: { id: true, name: true, phone: true } })
      : Promise.resolve([]),
    can("marketing")
      ? prisma.coupon.findMany({ where: { OR: [{ code: { contains: q, mode: "insensitive" } }, { targetName: { contains: q, mode: "insensitive" } }] }, take, select: { id: true, code: true, type: true, value: true, active: true, targetName: true } })
      : Promise.resolve([]),
  ]);

  // Produits : stock affiché à l'équipe (somme des formats).
  const hits = catalog?.hits.slice(0, full ? 120 : 7) ?? [];
  const stockRows = hits.length
    ? await prisma.product.findMany({ where: { id: { in: hits.map((h) => h.doc.id) } }, select: { id: true, stock: true, variants: { select: { stock: true } } } })
    : [];
  const stockOf = new Map(stockRows.map((r) => [r.id, r.variants.length ? r.variants.reduce((s, v) => s + v.stock, 0) : r.stock]));
  const productHref = (slug: string, id: string) => (isAdmin ? `/admin/produits/${id}/modifier` : viewer.role === "CONSULTANT" ? `/admin/catalogue/${slug}` : `/produits/${slug}`);
  const orderHref = (id: string) => (isAdmin ? `/admin/commandes/${id}` : viewer.role === "CONSULTANT" ? `/admin/mes-commandes/${id}` : "/admin/mes-livraisons");

  return {
    query: catalog?.query ?? q,
    corrected: catalog?.corrected ?? null,
    total: catalog?.total ?? 0,
    products: hits.map(({ doc }) => ({
      id: doc.id, slug: doc.slug, name: doc.name, code: doc.choganCode, number: doc.number, inspiredBy: doc.inspiredBy, inspiredBrand: doc.inspiredBrand,
      category: doc.categoryLabel, categorySlug: doc.category, price: doc.price, photo: doc.photo, colorFrom: doc.colorFrom, colorTo: doc.colorTo,
      stock: stockOf.get(doc.id) ?? null, href: productHref(doc.slug, doc.id),
    })),
    brands: (catalog?.brands ?? []).slice(0, full ? 12 : 6),
    categories: (catalog?.categories ?? []).slice(0, full ? 8 : 4),
    orders: orders.map((o) => ({
      id: o.id,
      title: `${o.customerName} · n° ${o.id.slice(-8).toUpperCase()}`,
      subtitle: `${F(o.total)} · ${o.createdAt.toLocaleDateString("fr-FR")}${o.customerPhone ? ` · ${o.customerPhone}` : ""}`,
      href: orderHref(o.id),
      badge: `${STATUS[o.status] ?? o.status}${o.paymentStatus === "PAYE" ? " · payée" : ""}`,
    })),
    customers: customers.map((c) => ({ id: c.id, title: c.name, subtitle: [c.phone, c.detail].filter(Boolean).join(" · "), href: isAdmin ? `/admin/clients/${c.id}` : "/admin/mes-clients" })),
    consultants: consultants.map((c) => ({ id: c.id, title: c.name, subtitle: `${c.city}${c.active ? "" : " · inactif"}`, href: `/admin/consultants/${c.id}`, badge: c.rank ?? undefined })),
    livreurs: livreurs.map((l) => ({ id: l.id, title: l.name, subtitle: l.phone, href: "/admin/livreurs" })),
    coupons: coupons.map((c) => ({ id: c.id, title: c.code, subtitle: `${c.type === "POURCENTAGE" ? `${c.value} %` : F(c.value)}${c.targetName ? ` · ${c.targetName}` : ""}${c.active ? "" : " · inactif"}`, href: `/admin/coupons/${c.id}/modifier` })),
  };
}
