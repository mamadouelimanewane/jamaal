import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LiveTrackingToggle } from "@/components/admin/LiveTrackingToggle";
import { LivreurOrderRow } from "@/components/admin/LivreurOrderRow";

export const dynamic = "force-dynamic";

export default async function MesLivraisonsPage() {
  const session = await auth();
  if (session?.user?.role !== "LIVREUR") redirect("/admin");

  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    include: {
      livreur: {
        include: { orders: { orderBy: { createdAt: "desc" } } },
      },
    },
  });

  if (!user?.livreur) {
    return <p className="text-sm text-navy/60">Aucun profil livreur lié à ce compte.</p>;
  }

  const orders = user.livreur.orders.filter((o) => o.status !== "ANNULEE");
  const active = orders.filter((o) => o.status !== "LIVREE");
  const done = orders.filter((o) => o.status === "LIVREE");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes livraisons</h1>
        <LiveTrackingToggle />
      </div>
      {user.livreur.lastSeenAt && (
        <p className="mt-1 text-xs text-navy/50">
          Dernière position partagée : {user.livreur.lastSeenAt.toLocaleString("fr-FR")}
        </p>
      )}

      <h2 className="mb-3 mt-6 font-serif-display text-lg font-semibold text-navy">
        À livrer ({active.length})
      </h2>
      <ul className="flex flex-col gap-3">
        {active.map((o) => (
          <LivreurOrderRow
            key={o.id}
            id={o.id}
            customerName={o.customerName}
            customerPhone={o.customerPhone}
            address={o.address}
            total={o.total}
            status={o.status}
          />
        ))}
        {active.length === 0 && <p className="text-sm text-navy/50">Aucune livraison en attente.</p>}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-serif-display text-lg font-semibold text-navy">
            Livrées ({done.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {done.map((o) => (
              <LivreurOrderRow
                key={o.id}
                id={o.id}
                customerName={o.customerName}
                customerPhone={o.customerPhone}
                address={o.address}
                total={o.total}
                status={o.status}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
