import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { LiveTrackingToggle } from "@/components/admin/LiveTrackingToggle";
import { LivreurDeliveryCard } from "@/components/admin/LivreurDeliveryCard";
import { LivreurWalletForm } from "@/components/admin/LivreurWalletForm";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";
import { WALLET_LABELS } from "@/lib/payouts/providers";

export const dynamic = "force-dynamic";

export default async function MesLivraisonsPage() {
  const session = await auth();
  if (session?.user?.role !== "LIVREUR") redirect("/admin");

  const user = await prisma.user.findUnique({ where: { id: session.user!.id }, include: { livreur: true } });
  const livreur = user?.livreur;
  if (!livreur) return <p className="text-sm text-navy/75">Aucun profil livreur lié à ce compte.</p>;

  const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [orders, done, earnedMonth, pending, paid] = await Promise.all([
    prisma.order.findMany({
      where: {
        livreurId: livreur.id,
        status: { not: "ANNULEE" },
        deliveryMode: "LIVRAISON_JAMAAL",
        // Livraisons créées avant le module (sans étape) : traitées comme « attribuées ».
        OR: [{ deliveryStatus: { in: ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"] } }, { deliveryStatus: null, status: { in: ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE"] } }],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { livreurId: livreur.id, deliveryStatus: { in: ["LIVREE", "ECHEC"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, customerName: true, deliveryStatus: true, deliveredAt: true, updatedAt: true, livreurShare: true },
    }),
    prisma.livreurEarning.aggregate({ where: { livreurId: livreur.id, createdAt: { gte: month }, status: { not: "ANNULE" } }, _sum: { amount: true }, _count: true }),
    prisma.livreurEarning.aggregate({ where: { livreurId: livreur.id, status: { in: ["A_VERSER", "EN_COURS"] } }, _sum: { amount: true } }),
    prisma.livreurEarning.aggregate({ where: { livreurId: livreur.id, status: "VERSE", createdAt: { gte: month } }, _sum: { amount: true } }),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes livraisons</h1>
        <div className="flex flex-wrap items-center gap-2">
          <LiveRefresh seconds={20} />
          <LiveTrackingToggle />
        </div>
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Activez le suivi en direct pendant vos tournées : le client voit votre position et l&apos;heure d&apos;arrivée estimée.
        {livreur.lastSeenAt ? ` Dernière position : ${livreur.lastSeenAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.` : ""}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Livrées ce mois</p><p className="text-xl font-semibold text-ink">{earnedMonth._count}</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Gagné ce mois</p><p className="text-xl font-semibold text-ink">{formatPrice(earnedMonth._sum.amount ?? 0)}</p><p className="text-xs text-navy/75">dont {formatPrice(paid._sum.amount ?? 0)} versés</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">À recevoir</p><p className="text-xl font-semibold text-ink">{formatPrice(pending._sum.amount ?? 0)}</p></div>
      </div>

      <h2 className="mb-3 mt-6 text-lg font-semibold text-ink">À livrer ({orders.length})</h2>
      <ul className="flex flex-col gap-4">
        {orders.map((o) => (
          <LivreurDeliveryCard
            key={o.id}
            id={o.id}
            customerName={o.deliveryContactName ?? o.customerName}
            customerPhone={o.deliveryContactPhone ?? o.customerPhone}
            forCustomer={o.deliveryTarget === "VENDEUR" ? o.customerName : null}
            address={o.address}
            total={o.total}
            paid={o.paymentStatus === "PAYE"}
            status={(o.deliveryStatus ?? "ASSIGNEE") as DeliveryStatus}
            lat={o.deliveryLat}
            lng={o.deliveryLng}
            distanceKm={o.deliveryDistanceKm}
            share={o.livreurShare}
            approx={o.deliveryApprox}
            place={o.deliveryPlace}
            orderedBy={o.deliveryTarget !== "VENDEUR" && o.deliveryContactName && o.deliveryContactName !== o.customerName ? o.customerName : null}
          />
        ))}
        {orders.length === 0 && <p className="rounded-2xl border border-line bg-white p-5 text-[15px] text-navy/80">Aucune livraison en cours. Les nouvelles livraisons attribuées apparaissent ici automatiquement.</p>}
      </ul>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Mon wallet</h2>
        <p className="mt-1 text-sm text-navy/80">
          {livreur.walletNumber
            ? `Vos gains sont versés sur ${WALLET_LABELS[livreur.walletProvider as "WAVE"] ?? livreur.walletProvider} ${livreur.walletNumber}.`
            : "Indiquez votre numéro Wave ou Orange Money pour recevoir votre part de chaque livraison."}
        </p>
        <div className="mt-3"><LivreurWalletForm provider={livreur.walletProvider} number={livreur.walletNumber} /></div>
      </section>

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">Dernières livraisons</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {done.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                <span className="text-ink">{o.customerName}<span className="block text-sm text-navy/75">{(o.deliveredAt ?? o.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span></span>
                <span className={`text-sm font-semibold ${o.deliveryStatus === "LIVREE" ? "text-emerald-800" : "text-red-700"}`}>
                  {DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]}{o.deliveryStatus === "LIVREE" && o.livreurShare > 0 ? ` · +${formatPrice(o.livreurShare)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
