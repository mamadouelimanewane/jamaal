import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [productCount, orderCount, consultantCount, blogCount, pendingOrders, recentOrders] =
    await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.consultant.count(),
      prisma.blogPost.count(),
      prisma.order.count({ where: { status: "EN_ATTENTE" } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const cards = [
    { label: "Produits", value: productCount, href: "/admin/produits" },
    { label: "Commandes", value: orderCount, href: "/admin/commandes" },
    { label: "Commandes en attente", value: pendingOrders, href: "/admin/commandes" },
    { label: "Consultants", value: consultantCount, href: "/admin/consultants" },
    { label: "Articles de blog", value: blogCount, href: "/admin/blog" },
  ];

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Tableau de bord</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-2xl font-semibold text-navy">{c.value}</p>
            <p className="mt-1 text-xs text-navy/60">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-serif-display text-lg font-semibold text-navy">
          Commandes récentes
        </h2>
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
                    <td className="px-4 py-3">{o.status}</td>
                    <td className="px-4 py-3">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3 text-navy/60">
                      {o.createdAt.toLocaleDateString("fr-FR")}
                    </td>
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
