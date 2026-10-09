"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { depositAction, withdrawAction, type WalletActionState } from "@/lib/actions/wallet";

const field = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] outline-none focus:border-navy focus:ring-4 focus:ring-navy/10";
const initial: WalletActionState = { ok: false };

function Message({ s }: { s: WalletActionState }) {
  if (s.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{s.error}</p>;
  if (s.message) return <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">{s.message}</p>;
  return null;
}

/** Retirer vers Wave / Orange Money, ou recharger le wallet. */
export function WalletActions({
  balance,
  min,
  account,
  depositNumbers,
  onlineDeposit,
}: {
  balance: number;
  min: number;
  /** Compte de versement enregistré (ex. « Wave +221 77… »), ou null. */
  account: string | null;
  depositNumbers: { WAVE: string; ORANGE_MONEY: string };
  onlineDeposit: { WAVE: boolean; ORANGE_MONEY: boolean };
}) {
  const [tab, setTab] = useState<"retirer" | "recharger">("retirer");
  const [w, withdraw, wPending] = useActionState(withdrawAction, initial);
  const [d, deposit, dPending] = useActionState(depositAction, initial);
  const [provider, setProvider] = useState<"WAVE" | "ORANGE_MONEY">("WAVE");
  const online = onlineDeposit[provider];
  const [mode, setMode] = useState<"online" | "declare">(online ? "online" : "declare");
  const effectiveMode = online ? mode : "declare";

  useEffect(() => {
    const fromHash = () => setTab(window.location.hash === "#recharger" ? "recharger" : "retirer");
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  useEffect(() => {
    if (d.redirectUrl) window.location.assign(d.redirectUrl);
  }, [d.redirectUrl]);

  const tabBtn = (t: typeof tab, label: string, Icon: typeof ArrowUpFromLine) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === t ? "bg-navy text-white" : "text-navy/80 hover:bg-white"}`}>
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div id={tab} className="rounded-2xl border border-line bg-white p-4 sm:p-6">
      <div role="tablist" className="flex gap-1 rounded-2xl bg-cream p-1">
        {tabBtn("retirer", "Retirer", ArrowUpFromLine)}
        {tabBtn("recharger", "Recharger", ArrowDownToLine)}
      </div>

      {tab === "retirer" ? (
        <form action={withdraw} className="mt-5 space-y-4">
          {account ? (
            <p className="text-sm text-navy/80">Vers votre compte <strong>{account}</strong> · <a href="#compte" className="font-semibold text-rose-dark hover:underline">modifier</a></p>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-950">Renseignez d&apos;abord votre compte Wave ou Orange Money <a href="#compte" className="font-semibold underline">plus bas</a>.</p>
          )}
          <label className="block text-sm font-medium text-ink">
            Montant à retirer (FCFA)
            <input name="amount" type="number" inputMode="numeric" min={min} max={Math.max(min, balance)} step={1} required placeholder={`${min} minimum`} className={field} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={wPending || !account || balance < min} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{wPending ? "Envoi…" : "Retirer"}</button>
            <span className="text-xs text-navy/65">Disponible : {balance.toLocaleString("fr-FR")} F · minimum {min.toLocaleString("fr-FR")} F</span>
          </div>
          <Message s={w} />
        </form>
      ) : (
        <form action={deposit} className="mt-5 space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-ink">Moyen de paiement</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["WAVE", "ORANGE_MONEY"] as const).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[15px] font-medium has-[:checked]:border-navy has-[:checked]:bg-navy/5">
                  <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="accent-[#182845]" /> {p === "WAVE" ? "Wave" : "Orange Money"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium text-ink">
            Montant (FCFA)
            <input name="amount" type="number" inputMode="numeric" min={500} max={2000000} step={1} required placeholder="ex. 10000" className={field} />
          </label>
          {online && (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="mode" value="online" checked={mode === "online"} onChange={() => setMode("online")} /> Payer maintenant en ligne</label>
              <label className="flex items-center gap-2"><input type="radio" name="mode" value="declare" checked={mode === "declare"} onChange={() => setMode("declare")} /> J&apos;ai déjà envoyé l&apos;argent</label>
            </div>
          )}
          {effectiveMode === "declare" && (
            <>
              <input type="hidden" name="mode" value="declare" />
              <p className="rounded-xl bg-cream px-4 py-3 text-sm text-navy/85">
                Envoyez le montant par {provider === "WAVE" ? "Wave" : "Orange Money"} au numéro JAMAAL{" "}
                <strong>{depositNumbers[provider] || "communiqué par l'équipe JAMAAL"}</strong>, puis indiquez ci-dessous la référence de la transaction reçue par SMS.
                Votre solde est crédité dès vérification.
              </p>
              <label className="block text-sm font-medium text-ink">
                Référence de la transaction
                <input name="reference" required minLength={4} maxLength={60} placeholder="ex. TX2610A8F3" className={field} />
              </label>
            </>
          )}
          <button disabled={dPending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
            {dPending ? "Envoi…" : effectiveMode === "online" ? "Payer et recharger" : "Déclarer mon dépôt"}
          </button>
          <Message s={d} />
        </form>
      )}
    </div>
  );
}
