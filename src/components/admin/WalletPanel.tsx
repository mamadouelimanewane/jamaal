import { prisma } from "@/lib/prisma";
import { KIND_LABELS, minWithdrawal, STATUS_LABELS, walletBalance, walletHistory, type Owner } from "@/lib/wallet";
import { getDepositNumbers } from "@/lib/wallet-settings";
import { getBusinessModel } from "@/lib/business-model-store";
import { getAvailablePaymentProviders } from "@/lib/payment";
import { WALLET_LABELS } from "@/lib/payouts/providers";
import { payoutChannels } from "@/lib/business-model";
import { WalletHero, walletPath } from "@/components/admin/WalletWidgets";
import { WalletActions } from "@/components/admin/WalletActions";
import { WalletForm } from "@/components/admin/WalletForm";
import { LivreurWalletForm } from "@/components/admin/LivreurWalletForm";

/**
 * Wallet complet d'un membre : solde, retrait vers Wave / Orange Money, recharge, historique et compte de
 * versement. Affiché dans « Mes gains » (revendeur) et « Mon wallet » (livreur).
 */
export async function WalletPanel({ owner, viewAs, depot, historyLimit = 100 }: { owner: Owner; viewAs: boolean; depot?: string; historyLimit?: number }) {
  const [bal, history, min, numbers, model] = await Promise.all([walletBalance(owner), walletHistory(owner, historyLimit), minWithdrawal(), getDepositNumbers(), getBusinessModel()]);
  const acct =
    owner.type === "CONSULTANT"
      ? await prisma.consultant.findUnique({ where: { id: owner.id }, select: { walletProvider: true, walletNumber: true, walletHolderName: true } })
      : await prisma.livreur.findUnique({ where: { id: owner.id }, select: { walletProvider: true, walletNumber: true } });
  const account = acct?.walletProvider && acct.walletNumber ? `${WALLET_LABELS[acct.walletProvider as "WAVE"] ?? acct.walletProvider} ${acct.walletNumber}` : null;
  const online = getAvailablePaymentProviders(model).map((p) => p.id);
  const channels = payoutChannels(model);

  return (
    <div id="wallet" className="scroll-mt-24 space-y-6">
      {depot === "ok" && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Paiement reçu par le prestataire : votre solde est crédité dans quelques instants.</p>}
      {depot === "annule" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Dépôt annulé : rien n&apos;a été prélevé.</p>}
      <WalletHero {...bal} href={walletPath(owner.type)} />
      {viewAs ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-sm text-navy/80">Mode consultation : seul le membre peut retirer ou recharger son wallet.</p>
      ) : (
        <>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Vos commissions et primes sont créditées automatiquement dans ce wallet JAMAAL. Vous pouvez retirer tout ou partie du solde vers votre compte Wave ou Orange Money.</p>
          <WalletActions balance={bal.balance} min={min} account={account} depositNumbers={numbers} onlineDeposit={{ WAVE: online.includes("wave"), ORANGE_MONEY: online.includes("orange_money") }} />
        </>
      )}

      <section aria-labelledby="historique" className="rounded-2xl border border-line bg-white">
        <h2 id="historique" className="border-b border-line px-4 py-3 font-semibold text-navy sm:px-6">Mouvements du wallet</h2>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-navy/70 sm:px-6">Aucun mouvement pour l&apos;instant. Les commissions et primes apparaîtront ici dès qu&apos;elles seront créditées dans votre wallet JAMAAL.</p>
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

      <section id="compte" aria-labelledby="compte-titre" className="scroll-mt-24 rounded-2xl border border-line bg-white p-4 sm:p-6">
        <h2 id="compte-titre" className="font-semibold text-navy">Mon compte {channels.map((c) => WALLET_LABELS[c]).join(" / ")}</h2>
        <p className="mt-1 text-sm text-navy/75">Les retraits de votre wallet seront envoyés sur ce compte. Vérifiez qu&apos;il est exact et à votre nom.</p>
        <div className="mt-4">
          {owner.type === "CONSULTANT" ? (
            <WalletForm provider={acct?.walletProvider ?? null} number={acct?.walletNumber ?? null} holder={(acct as { walletHolderName?: string | null } | null)?.walletHolderName ?? null} channels={channels} />
          ) : (
            <LivreurWalletForm provider={acct?.walletProvider ?? null} number={acct?.walletNumber ?? null} channels={channels} />
          )}
        </div>
      </section>
    </div>
  );
}
