import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { DELIVERY_LABELS, type DeliveryStatus } from "@/lib/delivery";
import { DeliveryAdminActions } from "./AssignLivreurForm";

/** Livraison d'une commande : étape, livreur, code, frais et historique géolocalisé. */
export async function OrderDeliveryPanel({ orderId }: { orderId: string }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      deliveryMode: true,
      deliveryStatus: true,
      deliveryCode: true,
      deliveryFee: true,
      deliveryDistanceKm: true,
      livreurShare: true,
      deliveredAt: true,
      deliveryTarget: true,
      deliveryContactName: true,
      deliveryContactPhone: true,
      livreur: { select: { name: true, phone: true } },
      deliveryEvents: { orderBy: { createdAt: "asc" }, include: { livreur: { select: { name: true } } } },
    },
  });
  if (!order || order.deliveryMode !== "LIVRAISON_JAMAAL" || !order.deliveryStatus) return null;
  const status = order.deliveryStatus as DeliveryStatus;
  const active = !["LIVREE", "A_PREPARER", "ECHEC"].includes(status);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Livraison</h2>
        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${status === "LIVREE" ? "bg-emerald-50 text-emerald-800" : status === "ECHEC" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>{DELIVERY_LABELS[status]}</span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2">
        <div className="flex justify-between"><dt className="text-navy/80">Livreur</dt><dd className="text-ink">{order.livreur ? `${order.livreur.name} (${order.livreur.phone})` : "À attribuer"}</dd></div>
        <div className="flex justify-between"><dt className="text-navy/80">Livrer à</dt><dd className="text-right text-ink">{order.deliveryTarget === "VENDEUR" ? "Consultant·e (achète pour son client)" : "Client"}{order.deliveryContactName ? ` · ${order.deliveryContactName}` : ""}{order.deliveryContactPhone ? ` (${order.deliveryContactPhone})` : ""}</dd></div>
        <div className="flex justify-between"><dt className="text-navy/80">Code de remise</dt><dd className="font-mono font-semibold text-ink">{order.deliveryCode ?? "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-navy/80">Distance</dt><dd className="text-ink">{order.deliveryDistanceKm != null ? `${order.deliveryDistanceKm} km` : "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-navy/80">Frais / part livreur</dt><dd className="text-ink">{formatPrice(order.deliveryFee)} / {formatPrice(order.livreurShare)}</dd></div>
      </dl>
      {(status === "A_PREPARER" || status === "ECHEC") && (
        <p className="mt-3 text-sm"><Link href="/admin/livraisons" className="font-semibold text-rose-dark hover:underline">Attribuer un livreur dans « Livraisons »</Link></p>
      )}
      {active && <div className="mt-3"><DeliveryAdminActions orderId={orderId} /></div>}
      <ol className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
        {order.deliveryEvents.map((e) => (
          <li key={e.id} className="flex flex-wrap justify-between gap-2">
            <span className="text-ink">
              {DELIVERY_LABELS[e.status as DeliveryStatus] ?? e.status}
              {e.livreur ? ` · ${e.livreur.name}` : ""}
              {e.note ? ` · ${e.note}` : ""}
            </span>
            <span className="text-navy/75">
              {e.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
              {e.lat != null && e.lng != null && (
                <> · <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-dark hover:underline">position</a></>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
