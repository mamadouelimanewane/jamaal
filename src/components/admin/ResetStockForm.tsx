"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { resetAllStockAction, type StockActionState } from "@/lib/actions/stock";

/** Remise à zéro de tout le stock, avec confirmation tapée. */
export function ResetStockForm({ formats, units }: { formats: number; units: number }) {
  const [state, action, pending] = useActionState(resetAllStockAction, { ok: false } as StockActionState);
  const [confirm, setConfirm] = useState("");
  return (
    <form action={action} className="space-y-3">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 shrink-0 text-red-700" size={20} />
        <div>
          <h2 className="font-semibold text-navy">Remettre tout le stock à zéro</h2>
          <p className="mt-1 text-sm text-navy/80">
            Pour repartir d&apos;une base propre avant de saisir les produits réellement reçus. Actuellement : <strong>{formats.toLocaleString("fr-FR")} format(s)</strong> en stock, <strong>{units.toLocaleString("fr-FR")} unité(s)</strong>.
            Chaque format passe à 0 avec un mouvement « Inventaire » dans l&apos;historique. Les commandes déjà passées ne changent pas.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <label className="text-sm text-navy">Motif (facultatif)
          <input name="reference" placeholder="ex. Inventaire de départ octobre 2026" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="text-sm text-navy">Tapez ZERO
          <input name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-sm uppercase tracking-widest" />
        </label>
        <button disabled={pending || confirm.trim().toUpperCase() !== "ZERO"} className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
          {pending ? "Remise à zéro…" : "Tout remettre à 0"}
        </button>
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>}
    </form>
  );
}
