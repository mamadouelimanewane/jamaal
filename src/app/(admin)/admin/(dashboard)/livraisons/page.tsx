import Link from "next/link";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getBusinessModel } from "@/lib/business-model-store";
import { DELIVERY_LABELS, haversineKm, isValidPoint, type DeliveryStatus } from "@/lib/delivery";
import { formatPrice } from "@/lib/currency";
import { payoutProvidersConfig } from "@/lib/payouts/providers";
import { DeliveryMap, type MapPoint } from "@/components/maps/DeliveryMap";
import { AssignLivreurForm, DeliveryAdminActions } from "@/components/admin/AssignLivreurForm";
import { PayLivreursButton } from "@/components/admin/PayLivreursButton";
import { LiveRefresh } from "@/components/admin/LiveRefresh";

export const dynamic = "force-dynamic";

const ACTIVE: DeliveryStatus[] = ["A_PREPARER", "ASSIGNEE", "RECUPEREE", "EN_ROUTE", "ECHEC"];

/** Position partagée depuis moins de 30 minutes ? */
function fresh(d: Date | null) {
  return !!d && Date.now() - d.getTime() < 30 * 60_000;
}

function ago(d: Date | null) {
  if (!d) return "jamais";
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  return min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : `il y a ${Math.round(min / 60)} h`;
}

export default async function LivraisonsPage() {
  await requireAdminPage();
  const [model, orders, livreurs, toPay, deliveredToday] = await Promise.all([
    getBusinessModel(),
    prisma.order.findMany({
      where: { deliveryMode: "LIVRAISON_JAMAAL", status: { not: "ANNULEE" }, deliveryStatus: { in: ACTIVE } },
      orderBy: { createdAt: "asc" },
      include: { livreur: { select: { name: true } } },
    }),
    prisma.livreur.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { _count: { select: { orders: { where: { deliveryStatus: { in: ["ASSIGNEE", "RECUPEREE", "EN_ROUTE"] } } } } } } }),
    prisma.livreurEarning.aggregate({ where: { status: "A_VERSER" }, _sum: { amount: true }, _count: true }),
    prisma.order.count({ where: { deliveryStatus: "LIVREE", deliveredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  const toAssign = orders.filter((o) => o.deliveryStatus === "A_PREPARER" || o.deliveryStatus === "ECHEC");
  const inProgress = orders.filter((o) => !toAssign.includes(o));

  // Livreur suggéré : le plus proche de la destination (position récente), sinon le moins chargé.
  function suggest(dest: { lat: number; lng: number } | null) {
    if (!livreurs.length) return null;
    const located = livreurs.filter((l) => l.lastLat != null && l.lastLng != null && fresh(l.lastSeenAt));
    if (dest && located.length) {
      return located.reduce((best, l) => (haversineKm({ lat: l.lastLat!, lng: l.lastLng! }, dest) < haversineKm({ lat: best.lastLat!, lng: best.lastLng! }, dest) ? l : best)).id;
    }
    return livreurs.reduce((best, l) => (l._count.orders < best._count.orders ? l : best)).id;
  }

  const points: MapPoint[] = [{ id: "depot", kind: "depot", lat: model.depotLat, lng: model.depotLng, label: model.depotLabel }];
  for (const o of orders) {
    const p = { lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN };
    if (isValidPoint(p)) points.push({ id: o.id, kind: "destination", ...p, label: `${o.customerName} · ${DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]}` });
  }
  for (const l of livreurs) {
    if (l.lastLat != null && l.lastLng != null && fresh(l.lastSeenAt)) points.push({ id: `l-${l.id}`, kind: "livreur", lat: l.lastLat, lng: l.lastLng, label: `${l.name} · ${ago(l.lastSeenAt)}` });
  }
  const livreurOptions = livreurs.map((l) => ({ id: l.id, label: `${l.name} (${l._count.orders} en cours)` }));
  const anyPayout = payoutProvidersConfig().WAVE || payoutProvidersConfig().ORANGE_MONEY;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><Truck size={20} /></div>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">Livraisons</h1>
            <p className="text-sm text-navy/75">Départ : {model.depotLabel}. <Link href="/admin/modele-economique" className="font-semibold text-rose-dark hover:underline">Dépôt et tarifs</Link></p>
          </div>
        </div>
        <LiveRefresh seconds={20} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["À attribuer", toAssign.length],
          ["En cours", inProgress.length],
          ["Livrées aujourd'hui", deliveredToday],
          ["Livreurs en ligne", livreurs.filter((l) => fresh(l.lastSeenAt)).length + " / " + livreurs.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-white px-4 py-3">
            <p className="text-sm text-navy/80">{label}</p>
            <p className="text-2xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6"><DeliveryMap points={points} height={380} /></div>
      <p className="mt-2 text-sm text-navy/75">J = dépôt · repères rosés = adresses de livraison · 🛵 = livreurs ayant partagé leur position depuis moins de 30 min.</p>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">À attribuer ({toAssign.length})</h2>
        {toAssign.length === 0 ? <p className="mt-2 text-[15px] text-navy/80">Toutes les livraisons ont un livreur.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {toAssign.map((o) => {
              const dest = isValidPoint({ lat: o.deliveryLat ?? NaN, lng: o.deliveryLng ?? NaN }) ? { lat: o.deliveryLat!, lng: o.deliveryLng! } : null;
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/commandes/${o.id}`} className="text-[15px] font-semibold text-ink hover:underline">{o.customerName}</Link>
                    {o.deliveryTarget === "VENDEUR" && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">chez {o.deliveryContactName ?? "le consultant"}</span>}
                    {o.deliveryApprox && <span title={o.deliveryPlace ?? undefined} className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">position approximative</span>}
                    <p className="text-sm text-navy/80">{o.address ?? "Adresse non renseignée"}{o.deliveryDistanceKm != null ? ` · ${o.deliveryDistanceKm} km` : ""} · {o.paymentStatus === "PAYE" ? "payée" : "à encaisser"}{o.deliveryStatus === "ECHEC" ? " · échec précédent" : ""}</p>
                  </div>
                  {livreurOptions.length ? <AssignLivreurForm orderId={o.id} livreurs={livreurOptions} suggestedId={suggest(dest)} /> : <Link href="/admin/livreurs/nouveau" className="text-sm font-semibold text-rose-dark">Ajouter un livreur</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">En cours ({inProgress.length})</h2>
        {inProgress.length === 0 ? <p className="mt-2 text-[15px] text-navy/80">Aucune tournée en cours.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {inProgress.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/admin/commandes/${o.id}`} className="text-[15px] font-semibold text-ink hover:underline">{o.customerName}</Link>
                    {o.deliveryTarget === "VENDEUR" && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">chez {o.deliveryContactName ?? "le consultant"}</span>}
                    {o.deliveryApprox && <span title={o.deliveryPlace ?? undefined} className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">position approximative</span>}
                  <p className="text-sm text-navy/80">{o.livreur?.name ?? "—"} · {DELIVERY_LABELS[o.deliveryStatus as DeliveryStatus]} · mis à jour {ago(o.updatedAt)}</p>
                </div>
                <DeliveryAdminActions orderId={o.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Paiement des livreurs</h2>
        <p className="mt-1 text-[15px] text-navy/85">
          Part du livreur : {model.livreurSharePct} % des frais de livraison, versée sur son wallet à chaque livraison confirmée.
          En attente : <strong>{formatPrice(toPay._sum.amount ?? 0)}</strong> ({toPay._count} livraison(s)).
        </p>
        <div className="mt-3"><PayLivreursButton disabled={!anyPayout || !toPay._count} /></div>
        {!anyPayout && <p className="mt-2 text-sm text-amber-900">Versements non configurés (voir Admin &gt; Versements) : les parts s&apos;accumulent en attente.</p>}
      </section>
    </div>
  );
}
