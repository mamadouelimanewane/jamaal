import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { adminSubscriptionAction, saveSubscriptionDiscount } from "@/lib/actions/subscriptions";
import { adminGiftCardAction } from "@/lib/actions/gifts";
import { subscriptionDiscountPct } from "@/lib/subscriptions/run";
import { addDays, intervalLabel, itemsLabel, parseSubItems } from "@/lib/subscriptions/plan";
import { occasionOf } from "@/lib/gift/gift";
import { RowAction } from "@/components/admin/RowAction";

export const dynamic = "force-dynamic";
export const metadata = { title: "Abonnements et cartes cadeaux" };

const SUB_STATUS: Record<string, string> = { ACTIVE: "Actif", PAUSE: "En pause", ANNULE: "Arrêté" };
const GIFT_STATUS: Record<string, string> = { EN_ATTENTE: "Non payée", ACTIVE: "Active", EPUISEE: "Utilisée", ANNULEE: "Annulée" };
const daysAgo = (n: number) => addDays(new Date(), -n);
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;
const date = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—");

export default async function AbonnementsAdminPage() {
  await requireAdmin("commandes", "read");
  const [subs, cards, pct, giftOrders] = await Promise.all([
    prisma.subscription.findMany({ orderBy: [{ status: "asc" }, { nextRunAt: "asc" }], take: 300 }),
    prisma.giftCard.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    subscriptionDiscountPct(),
    prisma.order.count({ where: { giftWrap: true, createdAt: { gte: daysAgo(30) } } }),
  ]);
  const active = subs.filter((s) => s.status === "ACTIVE");
  const sold = cards.filter((c) => c.status !== "EN_ATTENTE" && c.status !== "ANNULEE");
  const kpi = [
    ["Abonnements actifs", String(active.length)],
    ["Commandes d'abonnement", String(subs.reduce((n, s) => n + s.ordersCount, 0))],
    ["Cartes cadeaux vendues", `${sold.length} · ${fcfa(sold.reduce((n, c) => n + c.amount, 0))}`],
    ["Commandes cadeaux (30 j)", String(giftOrders)],
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Abonnements et cartes cadeaux</h1>
        <p className="mt-1 text-sm text-navy/70">Réassort automatique (commande créée à l&apos;échéance, rappel 3 jours avant) et cartes cadeaux envoyées sur WhatsApp.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {kpi.map(([l, v]) => <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="mt-1 text-xl font-semibold text-navy">{v}</p></div>)}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Abonnements de réassort</h2>
          <form action={saveSubscriptionDiscount} className="flex items-end gap-2 text-sm">
            <label className="text-xs text-navy/70">Remise abonné (nouveaux abonnements)<input name="pct" type="number" min={0} max={30} defaultValue={pct} className="mt-1 block w-24 rounded-lg border border-line px-3 py-1.5" /></label>
            <button className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white">Enregistrer</button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Client</th><th className="px-3 py-2">Produits</th><th className="px-3 py-2">Rythme</th><th className="px-3 py-2">Prochaine</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {subs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-navy/60">Aucun abonnement pour le moment : il est proposé sur la page de chaque commande.</td></tr>}
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="px-3 py-2"><p className="font-semibold text-navy">{s.customerName}</p><p className="text-xs text-navy/60">{s.customerPhone}</p></td>
                  <td className="px-3 py-2 text-navy/85">{itemsLabel(parseSubItems(s.items))}</td>
                  <td className="px-3 py-2 text-navy/85">{intervalLabel(s.intervalDays)} · −{s.discountPct} %<br /><span className="text-xs text-navy/60">{s.ordersCount} commande(s)</span></td>
                  <td className="px-3 py-2 text-navy/85">{s.status === "ACTIVE" ? date(s.nextRunAt) : "—"}{s.lastOrderId && <><br /><Link href={`/admin/commandes/${s.lastOrderId}`} className="text-xs font-semibold underline">dernière</Link></>}</td>
                  <td className="px-3 py-2">{SUB_STATUS[s.status] ?? s.status}</td>
                  <td className="space-x-1 space-y-1 px-3 py-2 text-right">
                    {s.status === "ACTIVE" && <RowAction label="Commander maintenant" run={adminSubscriptionAction.bind(null, s.id, "now")} confirm="Créer la commande maintenant ?" />}
                    {s.status === "ACTIVE" && <RowAction label="Pause" run={adminSubscriptionAction.bind(null, s.id, "pause")} />}
                    {s.status === "PAUSE" && <RowAction label="Reprendre" run={adminSubscriptionAction.bind(null, s.id, "resume")} />}
                    {s.status !== "ANNULE" && <RowAction label="Arrêter" danger run={adminSubscriptionAction.bind(null, s.id, "cancel")} confirm="Arrêter cet abonnement ?" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Cartes cadeaux</h2>
        <p className="mt-1 text-xs text-navy/60">Page d&apos;achat publique : <Link href="/carte-cadeau" className="font-semibold underline">/carte-cadeau</Link>. Une carte payée hors ligne (Wave envoyé à la main) peut être activée avec « Marquer payée ».</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">De → Pour</th><th className="px-3 py-2">Montant</th><th className="px-3 py-2">Solde</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {cards.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-navy/60">Aucune carte cadeau pour le moment.</td></tr>}
              {cards.map((c) => (
                <tr key={c.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 text-navy/85">{date(c.createdAt)}</td>
                  <td className="px-3 py-2"><p className="text-navy">{c.buyerName} → <strong>{c.recipientName}</strong></p><p className="text-xs text-navy/60">{c.recipientPhone}{c.occasion ? ` · ${occasionOf(c.occasion)?.label ?? c.occasion}` : ""}{c.voiceUrl ? " · 🎙️" : ""}</p></td>
                  <td className="px-3 py-2 text-navy/85">{fcfa(c.amount)}<br /><span className="text-xs text-navy/60">{c.paymentMethod ?? ""}</span></td>
                  <td className="px-3 py-2 text-navy/85">{c.status === "EN_ATTENTE" ? "—" : fcfa(c.balance)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2">{GIFT_STATUS[c.status] ?? c.status}{c.sentAt && <><br /><span className="text-xs text-navy/60">envoyée {date(c.sentAt)}</span></>}</td>
                  <td className="space-x-1 space-y-1 px-3 py-2 text-right">
                    {c.status === "EN_ATTENTE" && <RowAction label="Marquer payée" run={adminGiftCardAction.bind(null, c.id, "markPaid")} confirm={`Vous avez bien reçu ${fcfa(c.amount)} ?`} />}
                    {c.status === "ACTIVE" && <RowAction label="Renvoyer" run={adminGiftCardAction.bind(null, c.id, "resend")} />}
                    {(c.status === "EN_ATTENTE" || c.status === "ACTIVE") && <RowAction label="Annuler" danger run={adminGiftCardAction.bind(null, c.id, "cancel")} confirm="Annuler cette carte ?" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
