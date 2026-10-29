import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInstallmentSettings } from "@/lib/installments-store";
import { fcfa, nextInstallment, splitAmounts } from "@/lib/installments";
import { InstallmentSettingsForm } from "@/components/admin/InstallmentSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paiement en plusieurs fois" };

/** Paiement en 2 ou 3 fois : réglages et commandes en cours (échéances, retards). */
export default async function InstallmentsPage() {
  const [settings, orders, done] = await Promise.all([
    getInstallmentSettings(),
    prisma.order.findMany({
      where: { installmentCount: { gte: 2 }, paymentStatus: { not: "PAYE" }, status: { not: "ANNULEE" } },
      select: { id: true, customerName: true, customerPhone: true, total: true, createdAt: true, installmentCount: true, installmentsPaid: true, installmentIntervalDays: true, consultant: { select: { name: true } } },
      orderBy: { installmentNextDue: "asc" },
      take: 200,
    }),
    prisma.order.count({ where: { installmentCount: { gte: 2 }, paymentStatus: "PAYE" } }),
  ]);
  const now = new Date().getTime();
  const rows = orders.map((o) => ({ o, next: nextInstallment(o) }));
  const late = rows.filter((r) => r.next && r.next.dueAt.getTime() < now - 86_400_000);
  const remaining = rows.reduce((sum, r) => sum + r.o.total - splitAmounts(r.o.total, r.o.installmentCount).slice(0, r.o.installmentsPaid).reduce((a, b) => a + b, 0), 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Paiement en plusieurs fois</h1>
        <p className="mt-1 text-sm text-navy/75">Le client paie en 2 ou 3 échéances en ligne (Wave ou Orange Money), avec un rappel WhatsApp 2 jours avant et le jour de chaque échéance. La commande est préparée, livrée et commissionnée une fois entièrement payée. À 7 jours de retard, le revendeur et l&apos;équipe sont prévenus ; une commande déjà en partie payée n&apos;est jamais annulée automatiquement. Une commande dont rien n&apos;a été payé reçoit un rappel à 2 jours et est annulée à 7 jours (produits remis en stock).</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["En cours", String(orders.length)],
          ["En retard", String(late.length)],
          ["Reste à encaisser", fcfa(remaining)],
          ["Entièrement payées", String(done)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">{l}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-navy">{v}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-navy">Commandes en cours</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-navy/70">Aucune commande en plusieurs fois en cours.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-navy/60">
                <tr><th className="py-2 pr-3">Commande</th><th className="py-2 pr-3">Client</th><th className="py-2 pr-3">Revendeur</th><th className="py-2 pr-3">Réglées</th><th className="py-2 pr-3">Prochaine échéance</th><th className="py-2">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ o, next }) => {
                  const isLate = next && next.dueAt.getTime() < now - 86_400_000;
                  return (
                    <tr key={o.id}>
                      <td className="py-2.5 pr-3"><Link href={`/admin/commandes/${o.id}`} className="font-mono text-xs font-semibold text-navy underline">{o.id.slice(-8).toUpperCase()}</Link></td>
                      <td className="py-2.5 pr-3 text-navy">{o.customerName}</td>
                      <td className="py-2.5 pr-3 text-navy/80">{o.consultant?.name ?? "Site"}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-navy">{o.installmentsPaid}/{o.installmentCount}</td>
                      <td className="py-2.5 pr-3">
                        {next ? (
                          <span className={isLate ? "font-semibold text-red-800" : "text-navy"}>
                            {fcfa(next.amount)} · {next.dueAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })}{isLate ? " · en retard" : ""}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 tabular-nums text-navy">{fcfa(o.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-navy">Réglages</h2>
        <div className="mt-3"><InstallmentSettingsForm settings={settings} /></div>
      </section>
    </div>
  );
}

