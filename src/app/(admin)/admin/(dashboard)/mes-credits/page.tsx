import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";
import { CREDIT_STATUS_LABELS, ENTRY_LABELS, parseItems } from "@/lib/goods-credit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes crédits" };

const d = (x: Date) => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Espace revendeur : marchandises reçues à crédit, ce qu'il reste à rembourser et les ventes défalquées. */
export default async function MyCreditsPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const credits = await prisma.goodsCredit.findMany({ where: { consultantId: me.id, status: { not: "ANNULE" } }, orderBy: { createdAt: "desc" } });
  const journal = credits.length
    ? await prisma.goodsCreditDeduction.findMany({ where: { creditId: { in: credits.map((c) => c.id) } }, orderBy: { createdAt: "desc" }, take: 60, include: { credit: { select: { reference: true } } } })
    : [];
  const debt = credits.filter((c) => c.status === "EN_COURS").reduce((s, c) => s + c.balance, 0);
  const confided = credits.reduce((s, c) => s + c.amount, 0);
  const repaid = credits.reduce((s, c) => s + c.repaid, 0);
  const pct = confided ? Math.min(100, Math.round((repaid / confided) * 100)) : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes crédits de marchandises</h1>
        <p className="mt-1 text-sm text-navy/75">Les marchandises que JAMAAL vous a confiées à crédit. Chaque vente payée de votre boutique est défalquée automatiquement de ce que vous devez.</p>
      </div>

      <section className="rounded-3xl bg-navy p-6 text-white">
        <p className="text-sm text-white/75">Ce que vous devez à JAMAAL</p>
        <p className="mt-1 font-serif-display text-4xl font-semibold">{formatPrice(debt)}</p>
        <div className="mt-4 h-2.5 rounded-full bg-white/20"><div className="h-2.5 rounded-full bg-emerald-400" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-sm text-white/80">{pct} % remboursé · {formatPrice(repaid)} sur {formatPrice(confided)} de marchandises reçues</p>
      </section>

      {!credits.length && <p className="rounded-2xl border border-line bg-white p-6 text-sm text-navy/70">Vous n&apos;avez aucun crédit de marchandises pour le moment.</p>}

      {credits.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-navy">Mes lots</h2>
          {credits.map((c) => {
            const items = parseItems(c.items);
            const p = c.amount ? Math.min(100, Math.round((c.repaid / c.amount) * 100)) : 0;
            return (
              <div key={c.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{c.reference}</p>
                    <p className="text-xs text-navy/65">Reçu le {d(c.createdAt)}{c.dueDate ? ` · à rembourser avant le ${d(c.dueDate)}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === "SOLDE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{CREDIT_STATUS_LABELS[c.status]}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-navy/60">Montant</p><p className="font-semibold text-navy">{formatPrice(c.amount)}</p></div>
                  <div><p className="text-xs text-navy/60">Déjà payé</p><p className="font-semibold text-emerald-800">{formatPrice(c.repaid)}</p></div>
                  <div><p className="text-xs text-navy/60">Reste dû</p><p className="font-semibold text-navy">{formatPrice(c.balance)}</p></div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-cream"><div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${p}%` }} /></div>
                {c.notes && <p className="mt-2 text-sm text-navy/75">{c.notes}</p>}
                {items.length > 0 && (
                  <div className="mt-3 rounded-xl bg-cream/60 p-3">
                    <p className="text-xs font-semibold text-navy">Produits reçus à crédit</p>
                    <ul className="mt-1.5 divide-y divide-line/70 text-sm">
                      {items.map((i, k) => (
                        <li key={k} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-navy">{i.name} <span className="text-navy/60">× {i.qty}</span></span>
                          <span className="whitespace-nowrap text-right tabular-nums text-navy/80">{formatPrice(i.unitPrice)} <span className="text-navy/50">/u</span> · <strong className="text-navy">{formatPrice(i.unitPrice * i.qty)}</strong></span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-[11px] text-navy/60">Seules les ventes de ces produits remboursent ce lot.</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {journal.length > 0 && (
        <section className="rounded-2xl border border-line bg-white">
          <h2 className="border-b border-line p-4 font-semibold text-navy">Ventes et versements défalqués</h2>
          <ul className="divide-y divide-line">
            {journal.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy">{ENTRY_LABELS[j.kind] ?? j.kind}{j.orderId ? <> · <Link href={`/admin/mes-commandes/${j.orderId}`} className="underline">commande {j.orderId.slice(-8).toUpperCase()}</Link></> : null}</p>
                  <p className="text-xs text-navy/60">{d(j.createdAt)} · {j.credit.reference}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${j.amount < 0 ? "text-red-700" : "text-emerald-800"}`}>{j.amount < 0 ? "+" : "−"}{formatPrice(Math.abs(j.amount))}</p>
                  <p className="text-xs text-navy/60">reste {formatPrice(j.balanceAfter)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
