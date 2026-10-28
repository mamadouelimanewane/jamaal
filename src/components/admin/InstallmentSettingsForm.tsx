"use client";

import { useActionState } from "react";
import { saveInstallmentSettingsAction, type InstallmentActionResult } from "@/lib/actions/installments";
import type { InstallmentSettings } from "@/lib/installments";

/** Réglages du paiement en plusieurs fois : activation, montant minimal, nombre d'échéances, écart. */
export function InstallmentSettingsForm({ settings }: { settings: InstallmentSettings }) {
  const [state, action, pending] = useActionState(saveInstallmentSettingsAction, { ok: false } as InstallmentActionResult);
  const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <label className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-3">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Proposer le paiement en plusieurs fois (panier du site et lien de paiement des revendeurs)
      </label>
      <label className="text-xs font-medium text-navy/85">À partir de (F CFA, livraison comprise)
        <input name="minTotal" type="number" min={1000} step={500} defaultValue={settings.minTotal} required className={field} />
      </label>
      <label className="text-xs font-medium text-navy/85">Jusqu&apos;à
        <select name="maxParts" defaultValue={settings.maxParts} className={field}>
          <option value={2}>2 fois</option>
          <option value={3}>3 fois</option>
        </select>
      </label>
      <label className="text-xs font-medium text-navy/85">Une échéance tous les (jours)
        <input name="intervalDays" type="number" min={7} max={45} step={1} defaultValue={settings.intervalDays} required className={field} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button disabled={pending} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer"}</button>
        {state.message && <span role="status" className="text-sm text-emerald-800">{state.message}</span>}
        {state.error && <span role="alert" className="text-sm text-rose-dark">{state.error}</span>}
      </div>
    </form>
  );
}
