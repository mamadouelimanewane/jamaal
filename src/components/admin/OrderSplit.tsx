import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getBusinessModel } from "@/lib/business-model-store";
import { plannedCommissions } from "@/lib/payouts/engine";
import { WALLET_LABELS } from "@/lib/payouts/providers";

const LEVEL: Record<string, string> = { VENTE: "Vendeur", NIVEAU_1: "Parrain direct", NIVEAU_2: "Grand-parrain" };
const ENTRY_STATUS: Record<string, { label: string; cls: string }> = {
  A_VERSER: { label: "À verser", cls: "bg-amber-50 text-amber-900" },
  VERSE: { label: "Versé", cls: "bg-emerald-50 text-emerald-800" },
  ANNULE: { label: "Annulé", cls: "bg-navy/10 text-navy/80" },
};

/**
 * Répartition d'une vente : commissions du réseau (réelles si la vente est encaissée,
 * prévues sinon), état des versements sur wallet, et part estimée qui reste à JAMAAL.
 */
export async function OrderSplit({ orderId }: { orderId: string }) {
  const model = await getBusinessModel();
  const [plan, entries, items] = await Promise.all([
    plannedCommissions(orderId, model),
    prisma.commissionEntry.findMany({
      where: { orderId },
      include: { consultant: { select: { name: true } }, payout: { select: { status: true, provider: true, walletNumber: true } } },
    }),
    prisma.orderItem.findMany({ where: { orderId }, select: { quantity: true, product: { select: { publicPrice: true } } } }),
  ]);
  const [delivery, earning] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, select: { livreurShare: true } }),
    prisma.livreurEarning.findUnique({ where: { orderId }, select: { status: true, amount: true } }),
  ]);
  const livreurShare = earning?.amount ?? delivery?.livreurShare ?? 0;
  if (!plan) return null;

  const ORDER = ["VENTE", "NIVEAU_1", "NIVEAU_2"];
  entries.sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level));
  const recorded = entries.length > 0;
  const rows = recorded
    ? entries.map((e) => ({
        key: e.id,
        name: e.consultant.name,
        level: e.level,
        rate: e.rate,
        amount: e.amount,
        status: e.status,
        wallet: e.payout ? `${WALLET_LABELS[e.payout.provider as "WAVE"] ?? e.payout.provider} ${e.payout.walletNumber}` : null,
      }))
    : plan.rows.map((r) => ({ key: r.level, name: r.name, level: r.level, rate: r.rate, amount: r.amount, status: null as string | null, wallet: null }));

  const commissions = rows.filter((r) => r.status !== "ANNULE").reduce((s, r) => s + r.amount, 0);
  const publicTotal = items.reduce((s, i) => s + (i.product?.publicPrice ?? 0) * i.quantity, 0);
  const purchase = Math.round((publicTotal * model.purchasePct) / 100);
  const costs = Math.round((publicTotal * (model.shippingPct + model.miscPct)) / 100);
  const knownCost = publicTotal > 0;
  const jamaal = plan.base - commissions - (knownCost ? purchase + costs : 0);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Répartition de la vente</h2>
        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${recorded ? "bg-emerald-50 text-emerald-800" : "bg-cream text-navy/85"}`}>
          {recorded ? "Vente encaissée : commissions enregistrées" : plan.payable ? "Encaissée : répartition en cours" : "Prévue (vente pas encore encaissée)"}
        </span>
      </div>

      <dl className="mt-4 divide-y divide-line text-[15px]">
        <div className="flex justify-between py-2">
          <dt className="text-navy/85">Prix des produits (base des commissions)</dt>
          <dd className="font-semibold text-ink">{formatPrice(plan.base)}</dd>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <dt className="text-navy/85">
              {LEVEL[r.level] ?? r.level} · <span className="text-ink">{r.name}</span> <span className="text-sm">({r.rate} %)</span>
              {r.wallet && <span className="block text-sm text-navy/70">{r.wallet}</span>}
            </dt>
            <dd className="flex items-center gap-2">
              {r.status && <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${ENTRY_STATUS[r.status]?.cls ?? ""}`}>{ENTRY_STATUS[r.status]?.label ?? r.status}</span>}
              <span className="font-semibold text-ink">− {formatPrice(r.amount)}</span>
            </dd>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="py-2 text-navy/80">Vente sans consultant : aucune commission.</div>
        )}
        {knownCost && (
          <>
            <div className="flex justify-between py-2">
              <dt className="text-navy/85">Achat chez Chogan (estimé, {model.purchasePct} % du prix public)</dt>
              <dd className="font-semibold text-ink">− {formatPrice(purchase)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-navy/85">Expédition et frais (estimés, {model.shippingPct + model.miscPct} %)</dt>
              <dd className="font-semibold text-ink">− {formatPrice(costs)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between py-2.5">
          <dt className="font-semibold text-ink">{knownCost ? "Marge JAMAAL (estimée)" : "Reste à JAMAAL après commissions"}</dt>
          <dd className={`text-lg font-semibold ${jamaal < 0 ? "text-red-700" : "text-rose-dark"}`}>{formatPrice(jamaal)}</dd>
        </div>
        {(plan.order.deliveryFee > 0 || livreurShare > 0) && (
          <div className="py-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-navy/80">Frais de livraison facturés (hors commissions)</dt>
              <dd className="text-ink">{formatPrice(plan.order.deliveryFee)}</dd>
            </div>
            <div className="mt-1 flex justify-between">
              <dt className="text-navy/80">Part du livreur{earning ? ` (${earning.status === "VERSE" ? "versée" : "à verser"})` : ""}</dt>
              <dd className="text-ink">− {formatPrice(livreurShare)}</dd>
            </div>
          </div>
        )}
      </dl>
    </div>
  );
}
