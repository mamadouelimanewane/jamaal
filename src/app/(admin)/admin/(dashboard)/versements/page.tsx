import Link from "next/link";
import { CircleAlert, CircleCheck, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getBusinessModel } from "@/lib/business-model-store";
import { payoutProvidersConfig, WALLET_LABELS } from "@/lib/payouts/providers";
import { refreshPayoutAction, retryPayoutAction } from "@/lib/actions/payouts";
import { formatPrice } from "@/lib/currency";
import { RunPayoutsButton } from "@/components/admin/RunPayoutsButton";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; className: string }> = {
  VERSE: { label: "Versé", className: "bg-emerald-50 text-emerald-800" },
  EN_COURS: { label: "En cours", className: "bg-amber-50 text-amber-900" },
  ECHEC: { label: "Échec", className: "bg-red-50 text-red-800" },
};

export default async function VersementsPage() {
  await requireAdminPage();
  const [model, pendingByMember, payouts, monthPaid] = await Promise.all([
    getBusinessModel(),
    prisma.commissionEntry.groupBy({ by: ["consultantId"], where: { status: "A_VERSER", payoutId: null }, _sum: { amount: true } }),
    prisma.payout.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { consultant: { select: { name: true } } } }),
    prisma.payout.aggregate({ where: { status: "VERSE", createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true } }),
  ]);
  const config = payoutProvidersConfig();
  const members = pendingByMember.length
    ? await prisma.consultant.findMany({ where: { id: { in: pendingByMember.map((p) => p.consultantId) } }, select: { id: true, name: true, walletProvider: true, walletNumber: true } })
    : [];
  const byId = new Map(members.map((m) => [m.id, m]));
  const pendingTotal = pendingByMember.reduce((s, p) => s + (p._sum.amount ?? 0), 0);
  const withoutWallet = pendingByMember.filter((p) => !byId.get(p.consultantId)?.walletNumber);
  const anyConfigured = config.WAVE || config.ORANGE_MONEY;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><Wallet size={20} /></div>
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Versements des commissions</h1>
          <p className="text-sm text-navy/75">
            Les commissions sont versées sur le wallet Wave ou Orange Money de chaque membre,{" "}
            {model.payoutTrigger === "PAID" ? "dès que le paiement du client est confirmé" : "à la livraison de la commande"}.{" "}
            <Link href="/admin/modele-economique" className="font-semibold text-rose-dark hover:underline">Réglages</Link>
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["WAVE", "ORANGE_MONEY"] as const).map((p) => (
          <div key={p} className={`rounded-2xl border p-5 ${config[p] ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-medium text-navy/85">{WALLET_LABELS[p]}</p>
            <p className={`mt-1 flex items-center gap-2 text-lg font-semibold ${config[p] ? "text-emerald-800" : "text-amber-900"}`}>
              {config[p] ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
              {config[p] ? "Connecté" : "Non configuré"}
            </p>
          </div>
        ))}
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm font-medium text-navy/85">À verser</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatPrice(pendingTotal)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm font-medium text-navy/85">Versé ce mois-ci</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatPrice(monthPaid._sum.amount ?? 0)}</p>
        </div>
      </div>

      {!model.payoutsEnabled && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Les versements automatiques sont désactivés dans le Modèle économique : les commissions s&apos;accumulent « à verser ».</p>
      )}
      {!anyConfigured && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Aucun compte de versement n&apos;est encore connecté : rien n&apos;est envoyé, les commissions restent « à verser ».</p>
          <p className="mt-1">Wave : variable <code>WAVE_PAYOUT_API_KEY</code> (clé « Payout » du compte Wave Business). Orange Money : <code>ORANGE_PAYOUT_URL</code> et <code>ORANGE_PAYOUT_TOKEN</code> (fournis par Sonatel ou l&apos;agrégateur). À ajouter dans Vercel, puis redéployer.</p>
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Commissions en attente</h2>
        {pendingByMember.length === 0 ? (
          <p className="mt-2 text-sm text-navy/75">Aucune commission en attente.</p>
        ) : (
          <>
            {withoutWallet.length > 0 && (
              <p className="mt-2 text-sm text-amber-900">{withoutWallet.length} membre(s) n&apos;ont pas encore indiqué leur wallet (Mon profil &gt; Mon wallet de commissions).</p>
            )}
            <ul className="mt-3 divide-y divide-line text-[15px]">
              {pendingByMember.map((p) => {
                const m = byId.get(p.consultantId);
                return (
                  <li key={p.consultantId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-ink">{m?.name ?? "—"}</span>
                    <span className="text-sm text-navy/80">{m?.walletNumber ? `${WALLET_LABELS[m.walletProvider as "WAVE"] ?? m.walletProvider} ${m.walletNumber}` : "Pas de wallet"}</span>
                    <span className="font-semibold text-ink">{formatPrice(p._sum.amount ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4"><RunPayoutsButton disabled={!anyConfigured || !model.payoutsEnabled} /></div>
          </>
        )}
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <h2 className="px-6 pt-5 text-lg font-semibold text-ink">Historique des versements</h2>
        <table className="mt-3 w-full min-w-[720px] text-[15px]">
          <thead className="bg-cream text-left text-sm text-navy/85">
            <tr>
              <th className="px-6 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 font-semibold">Membre</th>
              <th className="px-4 py-2.5 font-semibold">Wallet</th>
              <th className="px-4 py-2.5 text-right font-semibold">Montant</th>
              <th className="px-4 py-2.5 font-semibold">État</th>
              <th className="px-6 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="px-6 py-3 text-navy/85">{p.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-4 py-3 text-ink">{p.consultant.name}</td>
                <td className="px-4 py-3 text-navy/85">{WALLET_LABELS[p.provider as "WAVE"] ?? p.provider} {p.walletNumber}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{formatPrice(p.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${STATUS[p.status]?.className ?? ""}`}>{STATUS[p.status]?.label ?? p.status}</span>
                  {p.error && <p className="mt-1 max-w-xs text-sm text-red-800">{p.error}</p>}
                </td>
                <td className="px-6 py-3 text-right">
                  {p.status === "ECHEC" && (
                    <form action={retryPayoutAction.bind(null, p.id)}><button className="text-sm font-semibold text-rose-dark hover:underline">Réessayer</button></form>
                  )}
                  {p.status === "EN_COURS" && p.provider === "WAVE" && (
                    <form action={refreshPayoutAction.bind(null, p.id)}><button className="text-sm font-semibold text-rose-dark hover:underline">Vérifier</button></form>
                  )}
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-6 text-center text-navy/75">Aucun versement pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
