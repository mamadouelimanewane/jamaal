import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { viewerWallet } from "@/lib/wallet-owner";
import { KIND_LABELS, minWithdrawal, STATUS_LABELS, walletBalance, walletHistory } from "@/lib/wallet";
import { getDepositNumbers } from "@/lib/wallet-settings";
import { getBusinessModel } from "@/lib/business-model-store";
import { getAvailablePaymentProviders } from "@/lib/payment";
import { WALLET_LABELS } from "@/lib/payouts/providers";
import { WalletHero } from "@/components/admin/WalletWidgets";
import { WalletActions } from "@/components/admin/WalletActions";
import { WalletForm } from "@/components/admin/WalletForm";
import { LivreurWalletForm } from "@/components/admin/LivreurWalletForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon wallet" };

export default async function MyWalletPage({ searchParams }: { searchParams: Promise<{ depot?: string }> }) {
  const w = await viewerWallet();
  if (!w) redirect("/admin");
  const { depot } = await searchParams;
  const [bal, history, min, numbers, model] = await Promise.all([walletBalance(w.owner), walletHistory(w.owner, 100), minWithdrawal(), getDepositNumbers(), getBusinessModel()]);
  const acct =
    w.owner.type === "CONSULTANT"
      ? await prisma.consultant.findUnique({ where: { id: w.owner.id }, select: { walletProvider: true, walletNumber: true, walletHolderName: true } })
      : await prisma.livreur.findUnique({ where: { id: w.owner.id }, select: { walletProvider: true, walletNumber: true } });
  const account = acct?.walletProvider && acct.walletNumber ? `${WALLET_LABELS[acct.walletProvider as "WAVE"] ?? acct.walletProvider} ${acct.walletNumber}` : null;
  const online = getAvailablePaymentProviders(model).map((p) => p.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon wallet</h1>
      {depot === "ok" && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Paiement reçu par le prestataire : votre solde est crédité dans quelques instants.</p>}
      {depot === "annule" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Dépôt annulé : rien n&apos;a été prélevé.</p>}
      <WalletHero {...bal} />
      {w.viewAs ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-sm text-navy/80">Mode consultation : seul le membre peut retirer ou recharger son wallet.</p>
      ) : (
        <WalletActions balance={bal.balance} min={min} account={account} depositNumbers={numbers} onlineDeposit={{ WAVE: online.includes("wave"), ORANGE_MONEY: online.includes("orange_money") }} />
      )}

      <section aria-labelledby="historique" className="rounded-2xl border border-line bg-white">
        <h2 id="historique" className="border-b border-line px-4 py-3 font-semibold text-navy sm:px-6">Historique</h2>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-navy/70 sm:px-6">Aucun mouvement pour l&apos;instant. Vos commissions et gains s&apos;afficheront ici dès qu&apos;une vente est encaissée.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{KIND_LABELS[t.kind] ?? t.kind}</p>
                  <p className="truncate text-xs text-navy/70">{t.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" })}{t.note ? ` · ${t.note}` : ""}</p>
                  {t.status !== "VALIDE" && <p className={`text-xs font-semibold ${t.status === "EN_ATTENTE" ? "text-amber-800" : "text-red-700"}`}>{STATUS_LABELS[t.status] ?? t.status}{t.error ? ` · ${t.error}` : ""}</p>}
                </div>
                <p className={`shrink-0 font-semibold tabular-nums ${t.status === "ANNULE" || t.status === "ECHEC" ? "text-navy/40 line-through" : t.amount >= 0 ? "text-emerald-700" : "text-ink"}`}>
                  {t.amount >= 0 ? "+" : "−"} {Math.abs(t.amount).toLocaleString("fr-FR")} F
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="compte" aria-labelledby="compte-titre" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
        <h2 id="compte-titre" className="font-semibold text-navy">Mon compte Wave / Orange Money</h2>
        <p className="mt-1 text-sm text-navy/75">Vos retraits sont envoyés sur ce compte, qui doit être à votre nom.</p>
        <div className="mt-4">
          {w.owner.type === "CONSULTANT" ? (
            <WalletForm provider={acct?.walletProvider ?? null} number={acct?.walletNumber ?? null} holder={(acct as { walletHolderName?: string | null } | null)?.walletHolderName ?? null} />
          ) : (
            <LivreurWalletForm provider={acct?.walletProvider ?? null} number={acct?.walletNumber ?? null} />
          )}
        </div>
      </section>
    </div>
  );
}
