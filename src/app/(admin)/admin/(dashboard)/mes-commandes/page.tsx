import Link from "next/link";
import { repairConsultantLink } from "@/lib/account-link";
import { NotReseller } from "@/components/admin/NotReseller";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";

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
    include: { consultant: { include: { orders: { orderBy: { createdAt: "desc" } } } } },
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Livraison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {user.consultant.orders.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{o.customerName}</td>
                <td className="px-4 py-3 text-navy/85">{formatPrice(o.total)}</td>
                <td className="px-4 py-3 text-navy/85">
                  {o.deliveryMode === "LIVRAISON_JAMAAL" ? "JAMAAL" : "Moi-même"}
                </td>
                <td className="px-4 py-3 text-navy/85">{statusLabels[o.status] ?? o.status}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/mes-commandes/${o.id}`} className="text-xs font-semibold text-navy hover:underline">
                    Voir / partager
                  </Link>
                </td>
              </tr>
            ))}
            {user.consultant.orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy/70">
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
