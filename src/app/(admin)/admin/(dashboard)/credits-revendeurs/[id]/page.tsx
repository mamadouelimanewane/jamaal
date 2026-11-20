import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { CREDIT_STATUS_LABELS, ENTRY_LABELS, parseItems } from "@/lib/goods-credit";
import { GoodsCreditActions } from "@/components/admin/GoodsCreditActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crédit revendeur" };

const dt = (d: Date) => d.toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Fiche d'un crédit de marchandises : lot confié, journal des défalcations, versement, annulation. */
export default async function GoodsCreditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("revendeurs");
  const { id } = await params;
  const c = await prisma.goodsCredit.findUnique({
    where: { id },
    include: { consultant: { select: { id: true, name: true, city: true, whatsapp: true } }, deductions: { orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();
  const items = parseItems(c.items);
  const pct = c.amount ? Math.min(100, Math.round((c.repaid / c.amount) * 100)) : 0;
  const others = await prisma.goodsCredit.aggregate({ where: { consultantId: c.consultantId, status: "EN_COURS" }, _sum: { balance: true } });

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/credits-revendeurs" className="text-sm text-navy/70 hover:underline">← Crédits revendeurs</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">{c.reference}</h1>
          <p className="text-sm text-navy/75">
            <Link href={`/admin/consultants/${c.consultant.id}`} className="font-semibold text-navy hover:underline">{c.consultant.name}</Link> · {c.consultant.city} · accordé le {dt(c.createdAt)}
            {c.dueDate ? ` · échéance ${c.dueDate.toLocaleDateString("fr-FR")}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-navy">{CREDIT_STATUS_LABELS[c.status]}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {([["Confié", c.amount], ["Remboursé", c.repaid], ["Reste dû", c.balance], ["Total dû (tous ses crédits)", others._sum.balance ?? 0]] as const).map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="mt-1 text-xl font-semibold text-navy">{formatPrice(v)}</p></div>
        ))}
      </div>
      <div><div className="h-3 rounded-full bg-cream"><div className="h-3 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></div><p className="mt-1 text-xs text-navy/65">{pct} % remboursé</p></div>

      {(items.length > 0 || c.notes) && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-navy">Lot de marchandises</h2>
          {c.notes && <p className="mt-1 text-sm text-navy/80">{c.notes}</p>}
          {items.length > 0 && (
            <>
              <p className="mt-1 text-xs text-navy/60">Seules les ventes de ces produits remboursent ce crédit.</p>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {items.map((i, k) => (
                    <tr key={k} className="border-t border-line"><td className="py-2">{i.name}</td><td className="py-2 text-right">{i.qty} × {formatPrice(i.unitPrice)}</td><td className="py-2 text-right font-semibold">{formatPrice(i.qty * i.unitPrice)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {c.status === "EN_COURS" && <GoodsCreditActions creditId={c.id} balance={c.balance} />}

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line p-5 font-semibold text-navy">Historique ({c.deductions.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-navy/60">
              <tr><th className="px-4 py-2">Date</th><th className="px-3 py-2">Opération</th><th className="px-3 py-2">Commande</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2 text-right">Reste dû après</th></tr>
            </thead>
            <tbody>
              {c.deductions.map((d) => (
                <tr key={d.id} className="border-t border-line">
                  <td className="px-4 py-2 text-navy/75">{dt(d.createdAt)}</td>
                  <td className="px-3 py-2">{ENTRY_LABELS[d.kind] ?? d.kind}{d.note && d.kind !== "VENTE" ? <span className="block text-xs text-navy/60">{d.note}</span> : null}</td>
                  <td className="px-3 py-2">{d.orderId ? <Link href={`/admin/commandes/${d.orderId}`} className="font-mono text-xs text-navy underline">{d.orderId.slice(-8).toUpperCase()}</Link> : "—"}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${d.amount < 0 ? "text-red-700" : "text-emerald-800"}`}>{d.amount < 0 ? "+" : "−"}{formatPrice(Math.abs(d.amount))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPrice(d.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!c.deductions.length && <p className="px-5 py-8 text-center text-sm text-navy/65">Aucune vente ni versement pour l&apos;instant.</p>}
        </div>
      </section>
    </div>
  );
}
