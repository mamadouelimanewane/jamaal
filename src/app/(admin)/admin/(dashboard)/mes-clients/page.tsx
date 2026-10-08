import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

const digits = (s: string) => s.replace(/\D/g, "");
const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

export default async function MesClientsPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;

  const orders = await prisma.order.findMany({
    where: { consultantId: me.id, status: { not: "ANNULEE" } },
    orderBy: { createdAt: "desc" },
    select: { customerName: true, customerPhone: true, total: true, createdAt: true },
    take: 1000,
  });

  // Regroupe les commandes par client (téléphone, sinon nom).
  const byClient = new Map<string, { name: string; phone: string | null; orders: number; spent: number; last: Date }>();
  for (const o of orders) {
    const key = o.customerPhone ? digits(o.customerPhone) : `nom:${o.customerName.toLowerCase()}`;
    const c = byClient.get(key);
    if (c) {
      c.orders += 1;
      c.spent += o.total;
      if (o.createdAt > c.last) c.last = o.createdAt;
    } else {
      byClient.set(key, { name: o.customerName, phone: o.customerPhone, orders: 1, spent: o.total, last: o.createdAt });
    }
  }
  const clients = [...byClient.values()].sort((a, b) => b.spent - a.spent);
  const days = daysSince;

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes clients ({clients.length})</h1>
      <p className="mt-1 text-sm text-navy/75">
        Les personnes qui ont commandé grâce à vous. Relancez-les sur WhatsApp : un client fidèle commande plusieurs fois.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Commandes</th>
              <th className="px-4 py-3 text-right">Total dépensé</th>
              <th className="px-4 py-3">Dernière commande</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const inactive = days(c.last) > 45;
              const message = inactive
                ? `Bonjour ${c.name}, c'est ${me.name} de JAMAAL. Cela fait un moment ! J'ai de nouveaux produits Chogan qui pourraient vous plaire. Je vous en parle ?`
                : `Bonjour ${c.name}, c'est ${me.name} de JAMAAL. Merci pour votre confiance ! Tout s'est bien passé avec votre commande ?`;
              return (
                <tr key={`${c.name}-${c.phone}`} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{c.name}</p>
                    {c.phone && <p className="text-xs text-navy/70">{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3">{c.orders}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-navy">{formatPrice(c.spent)}</td>
                  <td className="px-4 py-3 text-xs text-navy/75">
                    {c.last.toLocaleDateString("fr-FR")}
                    {inactive && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">à relancer</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.phone && (
                      <a
                        href={`https://wa.me/${digits(c.phone)}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-navy/70">Aucun client pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
