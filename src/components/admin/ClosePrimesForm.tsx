"use client";

import { useActionState, useState } from "react";
import { closeTeamPrimesAction, type TeamActionResult } from "@/lib/actions/team";
import { formatPrice } from "@/lib/currency";

/** Clôture d'un mois : enregistre et verse les primes d'équipe (confirmation en deux temps). */
export function ClosePrimesForm({ month, label, total }: { month: string; label: string; total: number }) {
  const [state, action, pending] = useActionState(closeTeamPrimesAction, { ok: false } as TeamActionResult);
  const [confirm, setConfirm] = useState(false);
  if (state.ok) return <p role="status" className="max-w-sm text-sm text-emerald-800">{state.message}</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="month" value={month} />
      {confirm ? (
        <>
          <span className="text-sm text-navy/80">Verser {formatPrice(total)} de primes pour {label} ?</span>
          <button disabled={pending} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{pending ? "Clôture…" : "Confirmer"}</button>
          <button type="button" onClick={() => setConfirm(false)} className="px-2 text-sm text-navy/70">Annuler</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">Clôturer le mois et verser</button>
      )}
      {state.error && <p role="alert" className="w-full text-sm text-rose-dark">{state.error}</p>}
    </form>
  );
}
