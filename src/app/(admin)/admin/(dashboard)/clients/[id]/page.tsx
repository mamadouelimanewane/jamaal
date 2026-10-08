import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { updateCustomerNotes } from "@/lib/actions/customers";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            select: {
              productName: true,
              quantity: true,
              product: { select: { family: true, topNotes: true, heartNotes: true, baseNotes: true } },
            },
          },
        },
      },
    },
  });
  if (!client) notFound();

  const loyalty = await prisma.loyaltyAccount.findUnique({
    where: { phone: client.phone.replace(/\s+/g, "").trim() },
    select: { points: true, lifetime: true },
  });
  const validOrders = client.orders.filter((order) => order.status !== "ANNULEE");
  const total = validOrders.reduce((sum, order) => sum + order.total, 0);
  const itemCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const noteCounts = new Map<string, number>();
  for (const order of validOrders) {
    for (const item of order.items) {
      itemCounts.set(item.productName, (itemCounts.get(item.productName) ?? 0) + item.quantity);
      if (!item.product) continue;
      if (item.product.family) familyCounts.set(item.product.family, (familyCounts.get(item.product.family) ?? 0) + item.quantity);
      for (const note of [...item.product.topNotes, ...item.product.heartNotes, ...item.product.baseNotes]) {
        noteCounts.set(note, (noteCounts.get(note) ?? 0) + item.quantity);
      }
    }
  }
  const top = (counts: Map<string, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label]) => label);
  const favoriteProducts = top(itemCounts);
  const preferredFamilies = top(familyCounts);
  const preferredNotes = top(noteCounts);
  const averageOrder = validOrders.length ? Math.round(total / validOrders.length) : 0;
  const lastOrder = validOrders[0];

  return <div className="max-w-5xl">
    <p className="mb-2 text-xs text-navy/70"><Link href="/admin/clients">Clients</Link> / {client.name}</p>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-serif-display text-2xl font-semibold text-navy">{client.name}</h1><p className="mt-1 text-sm text-navy/75">{client.phone}{client.email ? ` — ${client.email}` : ""}</p>{client.address && <p className="mt-1 text-sm text-navy/75">{client.address}</p>}</div><a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-navy hover:bg-cream">Contacter sur WhatsApp</a></div>
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-navy">{validOrders.length}</p><p className="text-xs text-navy/75">Commandes valides</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-navy">{formatPrice(total)}</p><p className="text-xs text-navy/75">Total dépensé</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-navy">{formatPrice(averageOrder)}</p><p className="text-xs text-navy/75">Panier moyen</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-semibold text-rose-dark">{loyalty?.points ?? 0} pts</p><p className="text-xs text-navy/75">Fidélité · {loyalty?.lifetime ?? 0} cumulés</p></div>
    </div>
    <section className="mt-6 rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-serif-display text-lg font-semibold text-navy">Profil olfactif observé</h2><p className="mt-1 text-xs text-navy/75">Estimé à partir des achats, à confirmer avec le client.</p></div><p className="text-xs text-navy/75">Dernier achat : {lastOrder ? lastOrder.createdAt.toLocaleDateString("fr-FR") : "Aucun"}</p></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-navy/70">Familles favorites</p><p className="mt-2 text-sm text-navy/85">{preferredFamilies.join(" · ") || "À découvrir"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-navy/70">Notes récurrentes</p><p className="mt-2 text-sm text-navy/85">{preferredNotes.join(" · ") || "À découvrir"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-navy/70">Parfums favoris</p><p className="mt-2 text-sm text-navy/85">{favoriteProducts.join(" · ") || "À découvrir"}</p></div></div></section>
    <section className="mt-6 rounded-2xl border border-line bg-white p-5"><h2 className="mb-3 text-sm font-semibold text-navy">Notes internes</h2><form action={updateCustomerNotes.bind(null, client.id)} className="flex flex-col gap-3"><textarea name="notes" rows={3} defaultValue={client.notes ?? ""} placeholder="Préférences confirmées, allergies, historique de contact…" className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy" /><button className="w-fit rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">Enregistrer</button></form></section>
    <div className="mt-6"><h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">Historique des commandes</h2><div className="overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-sm"><thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Articles</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Total</th><th className="px-4 py-3"></th></tr></thead><tbody>{client.orders.map((order) => <tr key={order.id} className="border-t border-line"><td className="whitespace-nowrap px-4 py-3 text-navy/85">{order.createdAt.toLocaleDateString("fr-FR")}</td><td className="px-4 py-3 text-navy/85">{order.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ") || "—"}</td><td className="px-4 py-3 text-navy/85">{statusLabels[order.status] ?? order.status}</td><td className="px-4 py-3 text-navy/85">{formatPrice(order.total)}</td><td className="px-4 py-3 text-right"><Link href={`/admin/commandes/${order.id}`} className="text-xs font-semibold text-navy hover:underline">Voir</Link></td></tr>)}</tbody></table></div></div>
  </div>;
}
