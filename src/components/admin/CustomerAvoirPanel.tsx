import { walletBalance, walletHistory, KIND_LABELS, STATUS_LABELS } from "@/lib/wallet";
import { customerOwner } from "@/lib/customer-wallet";
import { formatPrice } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { AvoirForms } from "./AvoirForms";

/** Avoir du client (wallet client) : solde, code à saisir au panier, historique, ajustement et versement sur Wave. */
export async function CustomerAvoirPanel({ customerId }: { customerId: string }) {
  const owner = customerOwner(customerId);
  const [bal, history, c] = await Promise.all([walletBalance(owner), walletHistory(owner, 30), prisma.customer.findUnique({ where: { id: customerId }, select: { avoirCode: true, phone: true } })]);
  if (!history.length && !c?.avoirCode) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Avoir (wallet client)</h2>
        <p className="mt-1 text-xs text-navy/75">Aucun avoir pour l&apos;instant. Il se crée tout seul quand un produit est remplacé par un moins cher ou qu&apos;une réservation est annulée.</p>
        <AvoirForms customerId={customerId} balance={0} phone={c?.phone ?? ""} />
      </section>
    );
  }
  return (
    <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif-display text-lg font-semibold text-navy">Avoir (wallet client)</h2>
          <p className="mt-1 text-xs text-navy/75">Le client l&apos;utilise au panier avec son code{c?.avoirCode ? <> <strong className="font-mono">{c.avoirCode}</strong></> : ""} (champ « Code promo »), ou vous le lui versez sur Wave.</p>
        </div>
        <p className="text-2xl font-semibold text-emerald-800">{formatPrice(bal.available)}</p>
      </div>
      <AvoirForms customerId={customerId} balance={bal.available} phone={c?.phone ?? ""} />
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white text-xs">
        {history.map((t) => (
          <li key={t.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
            <span className="text-navy/80">
              {t.createdAt.toLocaleDateString("fr-FR")} · {KIND_LABELS[t.kind] ?? t.kind}
              {t.note ? ` · ${t.note}` : ""}
              {t.status !== "VALIDE" ? ` · ${STATUS_LABELS[t.status] ?? t.status}` : ""}
            </span>
            <span className={t.amount >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-navy"}>{t.amount >= 0 ? "+" : "−"}{formatPrice(Math.abs(t.amount))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
