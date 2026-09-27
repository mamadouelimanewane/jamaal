import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { LiveDeliveryMap } from "@/components/LiveDeliveryMap";

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
        Commande passée le {order.createdAt.toLocaleDateString("fr-FR")}
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <DeliveryTimeline status={order.status} />
      </div>

      <div className="mt-6">
        <LiveDeliveryMap orderId={order.id} />
      </div>

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
