import Link from "next/link";
import { OrderPayBadges } from "@/components/admin/OrderPayBadges";
import { repairConsultantLink } from "@/lib/account-link";
import { NotReseller } from "@/components/admin/NotReseller";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { OrderDetailCell } from "@/components/admin/OrderDetailCell";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function MesCommandesPage() {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") redirect("/admin");

  await repairConsultantLink(session.user!.id);
  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    include: {
      consultant: {
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      choganCode: true,
                      name: true,
                      inspiredBy: true,
                      inspiredBrand: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user?.consultant) return <NotReseller />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes commandes</h1>
        <Link
          href="/admin/mes-commandes/nouvelle"
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
        >
          + Nouvelle commande
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Détail commande</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Livraison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {user.consultant.orders.map((o) => (
              <tr key={o.id} className="border-t border-line hover:bg-cream/20 transition-colors">
                <td className="px-4 py-3 align-top font-medium text-navy">
                  <p>{o.customerName}<OrderPayBadges o={o} /></p>
                  <p className="text-xs text-navy/60">{o.customerPhone ?? o.customerEmail ?? ""}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <OrderDetailCell items={o.items} />
                </td>
                <td className="px-4 py-3 align-top font-semibold text-navy">{formatPrice(o.total)}</td>
                <td className="px-4 py-3 align-top text-navy/85">
                  {o.deliveryMode === "LIVRAISON_JAMAAL" ? "JAMAAL" : "Moi-même"}
                </td>
                <td className="px-4 py-3 align-top text-navy/85">{statusLabels[o.status] ?? o.status}</td>
                <td className="px-4 py-3 align-top text-right">
                  <Link href={`/admin/mes-commandes/${o.id}`} className="text-xs font-semibold text-navy hover:underline">
                    Voir / partager
                  </Link>
                </td>
              </tr>
            ))}
            {user.consultant.orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy/70">
                  Aucune commande pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
