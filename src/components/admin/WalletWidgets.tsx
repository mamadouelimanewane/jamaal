import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;

/** Pastille « Mon wallet » : barre du haut sur téléphone et menu latéral. */
export function WalletPill({ balance, tone = "dark" }: { balance: number; tone?: "dark" | "light" }) {
  return (
    <Link
      href="/admin/mon-wallet"
      aria-label={`Mon wallet : ${fcfa(balance)}`}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${tone === "dark" ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/40 hover:bg-emerald-500/25" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"}`}
    >
      <Wallet size={16} /> {fcfa(balance)}
    </Link>
  );
}

/** Grande carte du wallet, en tête du tableau de bord. */
export function WalletHero({ balance, pendingOut, pendingIn, earned, compact = false }: { balance: number; pendingOut: number; pendingIn: number; earned: number; compact?: boolean }) {
  return (
    <section aria-label="Mon wallet JAMAAL" className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#123c2e] via-[#17513d] to-[#1f6b50] p-5 text-white shadow-lg sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-100/90"><Wallet size={16} /> Mon wallet JAMAAL</p>
          <p className="mt-2 font-serif-display text-4xl font-semibold tracking-tight sm:text-5xl">{fcfa(balance)}</p>
          <p className="mt-1 text-sm text-emerald-100/85">disponible · commissions, primes et gains crédités automatiquement</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link href="/admin/mon-wallet#retirer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#123c2e] hover:bg-emerald-50 sm:flex-none">
            <ArrowUpFromLine size={16} /> Retirer
          </Link>
          <Link href="/admin/mon-wallet#recharger" className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/50 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 sm:flex-none">
            <ArrowDownToLine size={16} /> Recharger
          </Link>
        </div>
      </div>
      {!compact && (
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-sm">
          <div><dt className="text-emerald-100/80">Gagné au total</dt><dd className="font-semibold">{fcfa(earned)}</dd></div>
          <div><dt className="text-emerald-100/80">Retrait en cours</dt><dd className="font-semibold">{fcfa(pendingOut)}</dd></div>
          <div><dt className="text-emerald-100/80">Dépôt en attente</dt><dd className="font-semibold">{fcfa(pendingIn)}</dd></div>
        </dl>
      )}
    </section>
  );
}
