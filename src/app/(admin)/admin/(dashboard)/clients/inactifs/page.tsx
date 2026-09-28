import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { ArrowLeft, UserX, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InactiveClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const daysLimit = Number(params.days) || 60;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysLimit);

  const clients = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, total: true },
      },
    },
  });

  // Filtrer les clients dont la dernière commande est antérieure à cutoffDate
  const inactiveClients = clients.filter((c) => {
    if (c.orders.length === 0) return true; // jamais commandé ou aucune commande valide
    const lastOrderDate = new Date(c.orders[0].createdAt);
    return lastOrderDate < cutoffDate;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/clients"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Relance CRM — Clients inactifs ({inactiveClients.length})
            </h1>
            <p className="text-sm text-navy/60">
              Clients qui n&apos;ont pas passé de commande depuis plus de {daysLimit} jours.
            </p>
          </div>
        </div>

        {/* Filtre jours */}
        <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-navy">
          <span>Seuil d&apos;inactivité :</span>
          <Link
            href="/admin/clients/inactifs?days=30"
            className={`px-2 py-0.5 rounded-full ${daysLimit === 30 ? "bg-navy text-white" : "hover:bg-cream"}`}
          >
            30 jours
          </Link>
          <Link
            href="/admin/clients/inactifs?days=60"
            className={`px-2 py-0.5 rounded-full ${daysLimit === 60 ? "bg-navy text-white" : "hover:bg-cream"}`}
          >
            60 jours
          </Link>
          <Link
            href="/admin/clients/inactifs?days=90"
            className={`px-2 py-0.5 rounded-full ${daysLimit === 90 ? "bg-navy text-white" : "hover:bg-cream"}`}
          >
            90 jours
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Dernière commande</th>
              <th className="px-4 py-3">Points fidélité</th>
              <th className="px-4 py-3 text-right">Action Relance</th>
            </tr>
          </thead>
          <tbody>
            {inactiveClients.map((c) => {
              const lastOrder = c.orders[0];
              const phoneClean = c.phone.replace(/\D/g, "");
              const message = encodeURIComponent(
                `Bonjour ${c.name}, vous nous manquez chez JAMAAL Luxury Cosmetics 🌸 ! Découvrez nos dernières nouveautés et profitez de vos points de fidélité.`
              );
              const waUrl = phoneClean
                ? `https://wa.me/${phoneClean}?text=${message}`
                : `https://wa.me/?text=${message}`;

              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="font-medium text-navy hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{c.phone}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {lastOrder
                      ? new Date(lastOrder.createdAt).toLocaleDateString("fr-FR")
                      : "Aucune"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      ⭐ {c.loyaltyPoints} pts
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle size={14} />
                      Relancer sur WhatsApp
                    </a>
                  </td>
                </tr>
              );
            })}
            {inactiveClients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-navy/50">
                  <UserX className="mx-auto mb-2 text-navy/30" size={32} />
                  Aucun client inactif trouvé pour cette période. Bravo !
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
