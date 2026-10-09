"use client";

import { useActionState, useState, useTransition } from "react";
import { adjustWalletAction, resolveDepositAction, resolveWithdrawalAction, retryWithdrawalAction, saveDepositNumbersAction, type WalletActionState } from "@/lib/actions/wallet";

const btn = "rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

function useRowAction() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<WalletActionState | null>(null);
  return { pending, res, run: (fn: () => Promise<WalletActionState>) => start(async () => setRes(await fn())) };
}

export function WithdrawalRowActions({ id, auto }: { id: string; auto: boolean }) {
  const { pending, res, run } = useRowAction();
  const [ref, setRef] = useState("");
  if (res?.ok) return <p className="text-xs text-emerald-800">{res.message}</p>;
  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {auto && <button type="button" disabled={pending} onClick={() => run(() => retryWithdrawalAction(id))} className={`${btn} bg-navy text-white`}>Envoyer</button>}
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Réf. du transfert" aria-label="Référence du transfert" className="w-36 rounded-full border border-line px-3 py-1 text-xs" />
        <button type="button" disabled={pending} onClick={() => run(() => resolveWithdrawalAction(id, true, ref))} className={`${btn} bg-emerald-700 text-white`}>Marquer versé</button>
        <button type="button" disabled={pending} onClick={() => run(() => resolveWithdrawalAction(id, false))} className={`${btn} text-red-700 hover:underline`}>Refuser</button>
      </div>
      {res?.error && <p role="alert" className="text-xs text-rose-dark">{res.error}</p>}
    </div>
  );
}

export function DepositRowActions({ id }: { id: string }) {
  const { pending, res, run } = useRowAction();
  if (res?.ok) return <p className="text-xs text-emerald-800">{res.message}</p>;
  return (
    <div className="flex flex-wrap gap-1.5 sm:justify-end">
      <button type="button" disabled={pending} onClick={() => run(() => resolveDepositAction(id, true))} className={`${btn} bg-emerald-700 text-white`}>Valider</button>
      <button type="button" disabled={pending} onClick={() => run(() => resolveDepositAction(id, false))} className={`${btn} text-red-700 hover:underline`}>Refuser</button>
      {res?.error && <p role="alert" className="w-full text-xs text-rose-dark">{res.error}</p>}
    </div>
  );
}

export function AdjustForm({ members }: { members: { key: string; label: string }[] }) {
  const [state, action, pending] = useActionState(adjustWalletAction, { ok: false } as WalletActionState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-navy/85 sm:col-span-2">Membre
        <select name="owner" required className={field}>
          <option value="">Choisir…</option>
          {members.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-navy/85">Sens
        <select name="sign" className={field}><option value="credit">Crédit (+)</option><option value="debit">Débit (−)</option></select>
      </label>
      <label className="text-xs font-medium text-navy/85">Montant (F)
        <input name="amount" type="number" min={1} required className={field} />
      </label>
      <label className="text-xs font-medium text-navy/85 sm:col-span-2">Motif (ex. « Dépôt en espèces », « Correction »)
        <input name="note" required minLength={3} maxLength={200} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">Enregistrer</button>
        {state.message && <span role="status" className="text-sm text-emerald-800">{state.message}</span>}
        {state.error && <span role="alert" className="text-sm text-rose-dark">{state.error}</span>}
      </div>
    </form>
  );
}

export function DepositNumbersForm({ wave, orange }: { wave: string; orange: string }) {
  const [state, action, pending] = useActionState(saveDepositNumbersAction, { ok: false } as WalletActionState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-navy/85">Numéro Wave de JAMAAL<input name="WAVE" defaultValue={wave} inputMode="tel" placeholder="77 000 00 00" className={field} /></label>
      <label className="text-xs font-medium text-navy/85">Numéro Orange Money de JAMAAL<input name="ORANGE_MONEY" defaultValue={orange} inputMode="tel" placeholder="77 000 00 00" className={field} /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-full border border-navy px-5 py-2 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-60">Enregistrer les numéros</button>
        {state.message && <span role="status" className="text-sm text-emerald-800">{state.message}</span>}
      </div>
    </form>
  );
}
