import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { LiveTracking } from "@/components/LiveTracking";

export const dynamic = "force-dynamic";

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, livreur: true, consultant: true },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Suivi de votre commande</h1>
      <p className="mt-1 text-sm text-navy/60">
        Commande {order.id.slice(-8).toUpperCase()} · passée le {order.createdAt.toLocaleDateString("fr-FR")}
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/55">Paiement</p>
          <p className={`mt-2 text-sm font-semibold ${order.paymentStatus === "PAYE" ? "text-emerald-700" : order.paymentStatus === "ECHOUE" ? "text-red-700" : "text-amber-800"}`}>
            {order.paymentStatus === "PAYE" ? "Paiement confirmé" : order.paymentStatus === "ECHOUE" ? "Paiement non confirmé" : order.paymentMethod === "A_LA_LIVRAISON" ? "À régler à la livraison" : "En attente de confirmation"}
          </p>
          <p className="mt-1 text-xs text-navy/60">{order.paymentMethod === "A_LA_LIVRAISON" ? "Vous paierez au moment de recevoir la commande." : `Mode : ${order.paymentMethod === "ORANGE_MONEY" ? "Orange Money" : order.paymentMethod === "WAVE" ? "Wave" : order.paymentMethod === "WALLET" ? "Wallet" : "Paiement en ligne"}`}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/55">Remise</p>
          <p className="mt-2 text-sm font-semibold text-navy">{order.deliveryMode === "LIVRAISON_JAMAAL" ? "Livraison JAMAAL" : "Retrait auprès du revendeur"}</p>
          <p className="mt-1 text-xs text-navy/60">{order.deliveryMode === "LIVRAISON_JAMAAL" ? "Les étapes de livraison apparaîtront ci-dessous." : order.consultant ? `Votre revendeur : ${order.consultant.name}.` : "Votre revendeur vous informera du retrait."}</p>
        </div>
      </section>

      {order.deliveryMode === "LIVRAISON_JAMAAL" && order.deliveryStatus ? (
        <>
          {order.deliveryCode && order.deliveryStatus !== "LIVREE" && order.status !== "ANNULEE" && (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-navy/30 bg-cream p-5 text-center">
              <p className="text-sm text-navy/80">Code de livraison à donner au livreur à la remise du colis</p>
              <p className="mt-1 font-serif-display text-4xl font-semibold tracking-[0.3em] text-navy">{order.deliveryCode}</p>
              <p className="mt-1 text-xs text-navy/70">Ne le communiquez qu&apos;au moment de recevoir votre commande.</p>
            </div>
          )}
          <div className="mt-6">
            <LiveTracking orderId={order.id} />
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <DeliveryTimeline status={order.status} />
        </div>
      )}

      {order.deliveryMode === "LIVRAISON_JAMAAL" && order.livreur && order.status !== "LIVREE" && (
        <p className="mt-4 text-center text-sm text-navy/60">
          Votre colis est livré directement par notre équipe JAMAAL.
        </p>
      )}
      {order.deliveryMode === "RETRAIT_CONSULTANT" && order.consultant && (
        <p className="mt-4 text-center text-sm text-navy/60">
          Votre colis est remis par votre consultant·e {order.consultant.name}.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Articles</h2>
        <ul className="flex flex-col gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-navy/80">
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
    </div>
  );
}
