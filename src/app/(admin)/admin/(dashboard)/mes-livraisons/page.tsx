import { balanceOf } from "@/lib/reservation";
import { walletBalance } from "@/lib/wallet";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { LivreurGps } from "@/components/livreur/LivreurGps";
import { TourMap } from "@/components/livreur/TourMap";
import { ListenButton } from "@/components/livreur/Listen";
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
    prisma.livreurEarning.aggregate({ where: { livreurId: livreur.id, status: { in: ["VERSE", "WALLET"] }, createdAt: { gte: month } }, _sum: { amount: true } }),
  ]);

  const wallet = await walletBalance({ type: "LIVREUR", id: livreur.id });

  const owed = Math.max(0, -wallet.balance);
  const first = (user?.name ?? livreur.name).split(/\s+/)[0];
  const sayHello = `Bonjour ${first}. ${orders.length ? `Vous avez ${orders.length} livraison${orders.length > 1 ? "s" : ""} à faire.` : "Pas de livraison pour le moment."} Ce mois, vous avez gagné ${earnedMonth._sum.amount ?? 0} francs.${owed ? ` Vous devez rendre ${owed} francs à JAMAAL.` : ""}`;

  return (
    <div className="max-w-3xl">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d2f4f] via-[#6D4AFF] to-[#BE185D] p-5 text-white">
        <span className="pointer-events-none absolute -right-2 -top-3 text-8xl opacity-20" aria-hidden="true">🛵</span>
        <div className="relative flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">Bonjour {first} 👋</h1>
            <p className="text-base font-semibold text-white/90">{orders.length ? `${orders.length} livraison${orders.length > 1 ? "s" : ""} à faire` : "Pas de livraison pour le moment"}</p>
          </div>
          <ListenButton text={sayHello} tone="dark" />
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/15 p-2.5"><span className="block text-2xl" aria-hidden="true">📦</span><span className="block text-2xl font-extrabold">{orders.length}</span><span className="text-xs font-bold">à livrer</span></div>
          <div className="rounded-2xl bg-white/15 p-2.5"><span className="block text-2xl" aria-hidden="true">✅</span><span className="block text-2xl font-extrabold">{earnedMonth._count}</span><span className="text-xs font-bold">livrées ce mois</span></div>
          <div className="rounded-2xl bg-white/15 p-2.5"><span className="block text-2xl" aria-hidden="true">🪙</span><span className="block text-lg font-extrabold leading-8">{formatPrice(earnedMonth._sum.amount ?? 0)}</span><span className="text-xs font-bold">gagnés ce mois</span></div>
        </div>
      </section>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <LivreurGps active={orders.length > 0} />
        <LiveRefresh seconds={20} />
      </div>
      {orders.length > 0 && <p className="mt-2 rounded-2xl bg-[#EFF6FF] px-4 py-2.5 text-sm font-semibold text-[#1E3A8A]">📍 Gardez l&apos;application ouverte pendant la tournée : le client voit où vous êtes.</p>}

      <a href="/admin/mon-wallet" className={`mt-3 flex items-center justify-between gap-3 rounded-3xl p-4 ${owed ? "bg-[#FEF3C7] text-[#78350F]" : "bg-[#CCFBF1] text-[#134E4A]"}`}>
        <span className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">{owed ? "💵" : "👛"}</span>
          <span>
            <span className="block text-sm font-bold">{owed ? "Argent à rendre à JAMAAL" : "Mon wallet"}</span>
            <span className="block text-2xl font-extrabold">{formatPrice(owed || wallet.available)}</span>
            {owed > 0 && <span className="block text-xs font-semibold">Argent encaissé chez les clients, moins vos gains. Remettez-le au dépôt.</span>}
          </span>
        </span>
        <span className="text-2xl" aria-hidden="true">›</span>
      </a>

      {orders.length > 0 && <div className="mt-4"><TourMap /></div>}

      <h2 className="mb-3 mt-6 text-xl font-extrabold text-ink">📦 Mes courses ({orders.length})</h2>
      <ul className="flex flex-col gap-4">
        {orders.map((o) => (
          <LivreurDeliveryCard
            key={o.id}
            id={o.id}
            customerName={o.deliveryContactName ?? o.customerName}
            customerPhone={o.deliveryContactPhone ?? o.customerPhone}
            forCustomer={o.deliveryTarget === "VENDEUR" ? o.customerName : null}
            address={o.address}
            total={balanceOf(o)}
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
        {orders.length === 0 && <p className="rounded-3xl bg-white p-6 text-center text-lg font-bold text-navy/80"><span className="block text-5xl" aria-hidden="true">😴</span>Pas de course pour le moment. Elles arrivent ici toutes seules.</p>}
      </ul>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-extrabold text-ink">💳 Où je reçois mon argent</h2>
        <p className="mt-1 text-sm text-navy/80">
          Votre part de chaque livraison est créditée sur votre wallet JAMAAL.{" "}
          {livreur.walletNumber
            ? `Vos retraits sont envoyés sur ${WALLET_LABELS[livreur.walletProvider as "WAVE"] ?? livreur.walletProvider} ${livreur.walletNumber}.`
            : "Indiquez votre numéro Wave ou Orange Money pour pouvoir retirer votre argent."}
        </p>
        <div className="mt-3"><LivreurWalletForm provider={livreur.walletProvider} number={livreur.walletNumber} /></div>
      </section>

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold text-ink">🕑 Mes dernières courses</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {done.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                <span className="text-ink">{o.customerName}<span className="block text-sm text-navy/75">{(o.deliveredAt ?? o.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span></span>
                <span className={`text-sm font-bold ${o.deliveryStatus === "LIVREE" ? "text-emerald-800" : "text-red-700"}`}>
                  {o.deliveryStatus === "LIVREE" ? "✅ " : "⚠️ "}{DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]}{o.deliveryStatus === "LIVREE" && o.livreurShare > 0 ? ` · +${formatPrice(o.livreurShare)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
