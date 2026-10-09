import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { updateOrderStatus, assignOrderLogistics } from "@/lib/actions/orders";
import { OrderStatus } from "@prisma/client";
import { CopyTrackingLink } from "@/components/admin/CopyTrackingLink";
import { OrderSplit } from "@/components/admin/OrderSplit";
import { OrderDeliveryPanel } from "@/components/admin/OrderDeliveryPanel";
import { ReservationActions } from "@/components/admin/ReservationActions";
import { RESERVATION_LABELS, type ReservationStatus } from "@/lib/reservation";

const statuses: OrderStatus[] = ["EN_ATTENTE", "CONFIRMEE", "EXPEDIEE", "LIVREE", "ANNULEE"];
const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, consultants, livreurs] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!order) notFound();

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const trackingUrl = `${protocol}://${host}/suivi/${order.id}`;

  async function changeStatus(formData: FormData) {
    "use server";
    await updateOrderStatus(id, formData.get("status") as OrderStatus);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Commande de {order.customerName}
          </h1>
          <p className="mt-1 text-sm text-navy/75">
            Passée le {order.createdAt.toLocaleDateString("fr-FR")} à{" "}
            {order.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <a
          href={`/admin/commandes/${order.id}/facture?print=true`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          📄 Facture (PDF)
        </a>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Coordonnées client</h2>
        <p className="text-sm text-navy/85">Téléphone : {order.customerPhone ?? "—"}</p>
        <p className="text-sm text-navy/85">E-mail : {order.customerEmail ?? "—"}</p>
        <p className="text-sm text-navy/85">Adresse : {order.address ?? "—"}</p>
        {order.customerPhone && (
          <a
            href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
          >
            Contacter sur WhatsApp →
          </a>
        )}
        <div className="mt-3">
          <CopyTrackingLink url={trackingUrl} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Articles</h2>
        <ul className="flex flex-col gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-navy/90">
                {item.productName} — {item.volumeLabel} × {item.quantity}
              </span>
              <span className="font-medium text-navy">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-semibold text-navy">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>

      {order.giftWrap && <div className="mt-4 rounded-xl border border-rose/30 bg-rose/5 p-4"><p className="text-sm font-semibold text-navy">Préparation cadeau</p>{order.giftMessage && <p className="mt-1 text-sm text-navy/85">Message : {order.giftMessage}</p>}</div>}

      <form action={changeStatus} className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-5">
        <label className="text-sm font-medium text-navy/85">Statut</label>
        <select name="status" defaultValue={order.status} className="rounded-lg border border-line px-3 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <button className="w-full rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light sm:ml-auto sm:w-fit">
          Mettre à jour
        </button>
      </form>

      {order.isReservation && (
        <div className="mt-6 rounded-2xl border border-[#e3c9bf] bg-[#fbf4f1] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Réservation · {RESERVATION_LABELS[(order.reservationStatus ?? "ACOMPTE_ATTENDU") as ReservationStatus]}</h2>
              <p className="mt-1 text-sm text-navy/80">
                Acompte {formatPrice(order.depositAmount)} {order.depositPaidAt ? `payé le ${order.depositPaidAt.toLocaleDateString("fr-FR")}` : "non payé"} · solde {formatPrice(Math.max(0, order.total - order.depositAmount))}
                {order.reservationDelay ? ` · délai annoncé ${order.reservationDelay}` : ""}
              </p>
            </div>
            <ReservationActions orderId={order.id} status={order.reservationStatus ?? "ACOMPTE_ATTENDU"} canServe />
          </div>
          <p className="mt-2 text-xs text-navy/70">Vue d&apos;ensemble et quantités à commander : <a href="/admin/reservations" className="font-semibold text-rose-dark hover:underline">Réservations</a>.</p>
        </div>
      )}
      <OrderDeliveryPanel orderId={order.id} />
      <OrderSplit orderId={order.id} />

      {/* Historique horodaté des statuts */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Historique horodaté des statuts</h2>
        {order.statusHistory.length === 0 ? (
          <p className="text-xs text-navy/70">Aucun historique d&apos;étape enregistré pour l&apos;instant.</p>
        ) : (
          <div className="relative border-l-2 border-line pl-4 space-y-3">
            {order.statusHistory.map((h) => (
              <div key={h.id} className="relative text-xs">
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-navy" />
                <span className="font-semibold text-navy">
                  {statusLabels[h.status] ?? h.status}
                </span>
                <span className="ml-2 text-navy/70">
                  {h.createdAt.toLocaleDateString("fr-FR")} à {h.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form action={assignOrderLogistics.bind(null, id)} className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Logistique & consultant</h2>
        <div className="grid gap-3">
          <div>
            <label className="text-xs font-medium text-navy/85">Consultant à l&apos;origine de la vente</label>
            <select
              name="consultantId"
              defaultValue={order.consultantId ?? ""}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">— Aucun —</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-navy/85">Mode de livraison</label>
            <select
              name="deliveryMode"
              defaultValue={order.deliveryMode}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="RETRAIT_CONSULTANT">Retrait / livraison par le consultant</option>
              <option value="LIVRAISON_JAMAAL">Livraison directe par JAMAAL (le consultant sera notifié)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-navy/85">Livreur assigné</label>
            <select
              name="livreurId"
              defaultValue={order.livreurId ?? ""}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">— Aucun —</option>
              {livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-navy/85">Latitude livraison</label>
              <input
                name="deliveryLat"
                type="number"
                step="any"
                defaultValue={order.deliveryLat ?? undefined}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy/85">Longitude livraison</label>
              <input
                name="deliveryLng"
                type="number"
                step="any"
                defaultValue={order.deliveryLng ?? undefined}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>

          {order.deliveryLat && order.deliveryLng && (
            <a
              href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-navy hover:underline"
            >
              Voir l&apos;adresse sur la carte →
            </a>
          )}

          <button className="mt-1 w-fit rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            Enregistrer la logistique
          </button>
        </div>
      </form>
    </div>
  );
}
