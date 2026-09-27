import Link from "next/link";
import {
  Package,
  ShoppingCart,
  Users,
  Bike,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Contact,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { StatCard } from "@/components/admin/StatCard";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

async function AdminOverview() {
  const [
    productCount,
    lowStockCount,
    orderCount,
    pendingOrders,
    consultantCount,
    livreurCount,
    clientCount,
    revenueAgg,
    expenseAgg,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM "Product" WHERE "stock" <= "lowStockThreshold"`.then(
      (rows) => Number(rows[0]?.count ?? 0)
    ),
    prisma.order.count(),
    prisma.order.count({ where: { status: "EN_ATTENTE" } }),
    prisma.consultant.count({ where: { active: true } }),
    prisma.livreur.count({ where: { active: true } }),
    prisma.customer.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: "ANNULEE" } } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const revenue = revenueAgg._sum.total ?? 0;
  const expenses = expenseAgg._sum.amount ?? 0;

  const cards = [
    { label: "Produits au catalogue", value: productCount, icon: Package, color: "navy" as const, href: "/admin/produits" },
    { label: "Stock bas", value: lowStockCount, icon: AlertTriangle, color: "amber" as const, href: "/admin/produits" },
    { label: "Commandes totales", value: orderCount, icon: ShoppingCart, color: "blue" as const, href: "/admin/commandes" },
    { label: "Commandes en attente", value: pendingOrders, icon: ShoppingCart, color: "red" as const, href: "/admin/commandes" },
    { label: "Revendeurs actifs", value: consultantCount, icon: Users, color: "purple" as const, href: "/admin/consultants" },
    { label: "Livreurs actifs", value: livreurCount, icon: Bike, color: "emerald" as const, href: "/admin/livreurs" },
    { label: "Clients enregistrés", value: clientCount, icon: Contact, color: "navy" as const, href: "/admin/clients" },
    { label: "Chiffre d'affaires", value: formatPrice(revenue), icon: TrendingUp, color: "emerald" as const, href: "/admin/statistiques" },
    { label: "Dépenses totales", value: formatPrice(expenses), icon: Wallet, color: "red" as const, href: "/admin/comptabilite" },
  ];

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Tableau de bord</h1>
      <p className="mt-1 text-sm text-navy/60">Vue d&apos;ensemble de l&apos;activité JAMAAL.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-serif-display text-lg font-semibold text-navy">Commandes récentes</h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-navy/60">Aucune commande pour le moment.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/admin/commandes/${o.id}`} className="font-medium text-navy hover:underline">
                        {o.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{statusLabels[o.status] ?? o.status}</td>
                    <td className="px-4 py-3">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3 text-navy/60">{o.createdAt.toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

async function ConsultantOverview({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { consultant: true } });
  if (!user?.consultant) {
    return <p className="text-sm text-navy/60">Aucun profil revendeur lié à ce compte pour le moment.</p>;
  }
  const consultantId = user.consultant.id;

  const [orderCount, pending, delivered, unread] = await Promise.all([
    prisma.order.count({ where: { consultantId } }),
    prisma.order.count({ where: { consultantId, status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] } } }),
    prisma.order.count({ where: { consultantId, status: "LIVREE" } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Bonjour {user.consultant.name}
      </h1>
      <p className="mt-1 text-sm text-navy/60">Votre espace revendeur JAMAAL.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Mes commandes" value={orderCount} icon={ShoppingCart} color="navy" href="/admin/mes-commandes" />
        <StatCard label="En cours" value={pending} icon={Truck} color="amber" href="/admin/mes-commandes" />
        <StatCard label="Livrées" value={delivered} icon={CheckCircle2} color="emerald" href="/admin/mes-commandes" />
        <StatCard label="Notifications" value={unread} icon={Users} color="rose" href="/admin/notifications" />
      </div>
    </div>
  );
}

async function LivreurOverview({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { livreur: true } });
  if (!user?.livreur) {
    return <p className="text-sm text-navy/60">Aucun profil livreur lié à ce compte pour le moment.</p>;
  }
  const livreurId = user.livreur.id;

  const [assigned, pending, delivered] = await Promise.all([
    prisma.order.count({ where: { livreurId } }),
    prisma.order.count({ where: { livreurId, status: { in: ["CONFIRMEE", "EXPEDIEE"] } } }),
    prisma.order.count({ where: { livreurId, status: "LIVREE" } }),
  ]);

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Bonjour {user.livreur.name}
      </h1>
      <p className="mt-1 text-sm text-navy/60">Vos livraisons JAMAAL.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Livraisons assignées" value={assigned} icon={Truck} color="navy" href="/admin/mes-livraisons" />
        <StatCard label="À livrer" value={pending} icon={AlertTriangle} color="amber" href="/admin/mes-livraisons" />
        <StatCard label="Livrées" value={delivered} icon={CheckCircle2} color="emerald" href="/admin/mes-livraisons" />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "CONSULTANT" && session?.user?.id) return <ConsultantOverview userId={session.user.id} />;
  if (role === "LIVREUR" && session?.user?.id) return <LivreurOverview userId={session.user.id} />;
  return <AdminOverview />;
}
