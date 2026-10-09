import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getBusinessModel } from "@/lib/business-model-store";
import { payoutProvidersConfig, WALLET_LABELS } from "@/lib/payouts/providers";
import { getDepositNumbers } from "@/lib/wallet-settings";
import { KIND_LABELS } from "@/lib/wallet";
import { AdjustForm, DepositNumbersForm, DepositRowActions, WithdrawalRowActions } from "@/components/admin/WalletAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallets des membres" };

export default async function WalletsAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const [sums, pending, recent, consultants, livreurs, numbers, model] = await Promise.all([
    prisma.walletTransaction.groupBy({ by: ["ownerType", "ownerId"], where: { OR: [{ status: "VALIDE" }, { status: "EN_ATTENTE", kind: { in: ["RETRAIT", "PAIEMENT"] } }] }, _sum: { amount: true } }),
    prisma.walletTransaction.findMany({ where: { status: "EN_ATTENTE" }, orderBy: { createdAt: "asc" } }),
    prisma.walletTransaction.findMany({ where: { status: { not: "EN_ATTENTE" } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.consultant.findMany({ select: { id: true, name: true, walletProvider: true, walletNumber: true, walletHolderName: true }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ select: { id: true, name: true, walletProvider: true, walletNumber: true }, orderBy: { name: "asc" } }),
    getDepositNumbers(),
    getBusinessModel(),
  ]);
  const names = new Map<string, string>([...consultants.map((c) => [`CONSULTANT:${c.id}`, c.name] as const), ...livreurs.map((l) => [`LIVREUR:${l.id}`, l.name] as const)]);
  const label = (t: { ownerType: string; ownerId: string }) => `${names.get(`${t.ownerType}:${t.ownerId}`) ?? "?"} (${t.ownerType === "LIVREUR" ? "livreur" : "revendeur"})`;
  const balances = sums.map((s) => ({ key: `${s.ownerType}:${s.ownerId}`, label: label(s), amount: s._sum.amount ?? 0 })).filter((b) => b.amount !== 0).sort((a, b) => b.amount - a.amount);
  const owed = balances.reduce((t, b) => t + Math.max(0, b.amount), 0);
  const withdrawals = pending.filter((t) => t.kind === "RETRAIT");
  const deposits = pending.filter((t) => t.kind === "DEPOT");
  const cfg = payoutProvidersConfig();
  const autoOn = model.payoutsEnabled && (cfg.WAVE || cfg.ORANGE_MONEY);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Wallets des membres</h1>
        <p className="mt-1 text-sm text-navy/75">
          Commissions, primes et parts de livraison sont créditées automatiquement sur le wallet de chaque revendeur et livreur. Ils retirent vers Wave ou Orange Money
          quand ils le souhaitent{autoOn ? " (envoi automatique activé)" : " : sans clés de versement Wave / Orange Money, vous versez à la main puis cliquez « Marquer versé »"}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Total dû aux membres</p><p className="text-xl font-semibold text-ink">{formatPrice(owed)}</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Retraits à verser</p><p className="text-xl font-semibold text-ink">{withdrawals.length} · {formatPrice(-withdrawals.reduce((t, w) => t + w.amount, 0))}</p></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><p className="text-sm text-navy/80">Dépôts à vérifier</p><p className="text-xl font-semibold text-ink">{deposits.length} · {formatPrice(deposits.reduce((t, d) => t + d.amount, 0))}</p></div>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 font-semibold text-navy sm:px-5">Retraits à verser</h2>
        {withdrawals.length === 0 ? <p className="px-4 py-6 text-sm text-navy/70 sm:px-5">Aucun retrait en attente.</p> : (
          <ul className="divide-y divide-line">
            {withdrawals.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-semibold text-ink">{formatPrice(-t.amount)} · {label(t)}</p>
                  <p className="text-xs text-navy/70">{WALLET_LABELS[t.provider as "WAVE"] ?? t.provider} {t.phone} · demandé le {t.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" })}</p>
                </div>
                <WithdrawalRowActions id={t.id} auto={!!autoOn} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 font-semibold text-navy sm:px-5">Dépôts à vérifier</h2>
        {deposits.length === 0 ? <p className="px-4 py-6 text-sm text-navy/70 sm:px-5">Aucun dépôt en attente.</p> : (
          <ul className="divide-y divide-line">
            {deposits.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-semibold text-ink">+ {formatPrice(t.amount)} · {label(t)}</p>
                  <p className="text-xs text-navy/70">{t.note ?? KIND_LABELS.DEPOT} · {t.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" })}</p>
                </div>
                <DepositRowActions id={t.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 font-semibold text-navy sm:px-5">Soldes</h2>
        {balances.length === 0 ? <p className="px-4 py-6 text-sm text-navy/70 sm:px-5">Aucun solde pour l&apos;instant.</p> : (
          <ul className="divide-y divide-line">
            {balances.map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0 truncate text-ink">{b.label}</span>
                <span className={`shrink-0 font-semibold tabular-nums ${b.amount < 0 ? "text-red-700" : "text-ink"}`}>{formatPrice(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-navy">Crédit ou débit manuel</h2>
          <p className="mt-1 text-xs text-navy/70">Dépôt reçu en espèces, correction d&apos;erreur… Tout mouvement est tracé.</p>
          <div className="mt-3"><AdjustForm members={[...consultants.map((c) => ({ key: `CONSULTANT:${c.id}`, label: `${c.name} (revendeur)` })), ...livreurs.map((l) => ({ key: `LIVREUR:${l.id}`, label: `${l.name} (livreur)` }))]} /></div>
        </section>
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-navy">Numéros de réception des dépôts</h2>
          <p className="mt-1 text-xs text-navy/70">Affichés aux membres qui rechargent leur wallet sans paiement en ligne.</p>
          <div className="mt-3"><DepositNumbersForm wave={numbers.WAVE} orange={numbers.ORANGE_MONEY} /></div>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 font-semibold text-navy sm:px-5">Derniers mouvements</h2>
        <ul className="divide-y divide-line">
          {recent.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
              <div className="min-w-0">
                <p className="text-ink">{KIND_LABELS[t.kind] ?? t.kind} · {label(t)}</p>
                <p className="truncate text-xs text-navy/65">{t.updatedAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" })}{t.note ? ` · ${t.note}` : ""}{t.status !== "VALIDE" ? ` · ${t.status.toLowerCase()}` : ""}</p>
              </div>
              <span className={`shrink-0 font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-700" : "text-ink"}`}>{t.amount >= 0 ? "+" : "−"} {formatPrice(Math.abs(t.amount))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
