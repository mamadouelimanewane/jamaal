import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { updateOrderStatus } from "@/lib/actions/orders";
import { OrderStatus } from "@prisma/client";

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
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();

  async function changeStatus(formData: FormData) {
    "use server";
    await updateOrderStatus(id, formData.get("status") as OrderStatus);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Commande de {order.customerName}
      </h1>
      <p className="mt-1 text-sm text-navy/60">
        Passée le {order.createdAt.toLocaleDateString("fr-FR")} à{" "}
        {order.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Coordonnées client</h2>
        <p className="text-sm text-navy/70">Téléphone : {order.customerPhone ?? "—"}</p>
        <p className="text-sm text-navy/70">E-mail : {order.customerEmail ?? "—"}</p>
        <p className="text-sm text-navy/70">Adresse : {order.address ?? "—"}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
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

      <form action={changeStatus} className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white p-5">
        <label className="text-sm font-medium text-navy/70">Statut</label>
        <select name="status" defaultValue={order.status} className="rounded-lg border border-line px-3 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <button className="ml-auto rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">
          Mettre à jour
        </button>
      </form>
    </div>
  );
}
