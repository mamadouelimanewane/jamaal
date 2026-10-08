import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { ReceiptDownload } from "@/components/admin/ReceiptDownload";
import { CopyTrackingLink } from "@/components/admin/CopyTrackingLink";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function MesCommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") redirect("/admin");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    include: { consultant: true },
  });
  if (!user?.consultant) notFound();

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.consultantId !== user.consultant.id) notFound();

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const trackingUrl = `${protocol}://${host}/suivi/${order.id}`;

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Commande de {order.customerName}
      </h1>
      <p className="mt-1 text-sm text-navy/75">
        {order.createdAt.toLocaleDateString("fr-FR")} — {statusLabels[order.status] ?? order.status}
      </p>

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

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-navy">Lien de suivi client</p>
          <p className="text-xs text-navy/70">
            Votre client peut suivre sa commande en direct, sans compte, avec ce lien.
          </p>
        </div>
        <CopyTrackingLink url={trackingUrl} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">
          Envoyer le récapitulatif à mon client
        </h2>
        <ReceiptDownload
          clientWhatsapp={order.customerPhone}
          trackingUrl={trackingUrl}
          data={{
            orderId: order.id.slice(-8).toUpperCase(),
            customerName: order.customerName,
            date: order.createdAt.toLocaleDateString("fr-FR"),
            items: order.items.map((i) => ({
              productName: i.productName,
              volumeLabel: i.volumeLabel,
              quantity: i.quantity,
              price: i.price,
            })),
            total: order.total,
            consultantName: user.consultant.name,
            consultantWhatsapp: user.consultant.whatsapp,
            deliveryMode: order.deliveryMode,
            status: order.status,
          }}
        />
      </div>
    </div>
  );
}
