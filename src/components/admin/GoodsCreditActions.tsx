"use client";

import { useActionState, useState } from "react";
import { cancelGoodsCredit, repayGoodsCredit, type GoodsCreditState } from "@/lib/actions/goods-credit";

const field = "rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy";

/** Versement direct du revendeur et annulation d'un crédit en cours. */
export function GoodsCreditActions({ creditId, balance }: { creditId: string; balance: number }) {
  const [rState, repay, rPending] = useActionState(repayGoodsCredit, { ok: false } as GoodsCreditState);
  const [cState, cancel, cPending] = useActionState(cancelGoodsCredit, { ok: false } as GoodsCreditState);
  const [showCancel, setShowCancel] = useState(false);
  return (
    <div className="space-y-4">
      <form action={repay} className="rounded-2xl border border-line bg-white p-5">
        <input type="hidden" name="creditId" value={creditId} />
        <h2 className="font-semibold text-navy">Enregistrer un versement</h2>
        <p className="text-xs text-navy/65">Le revendeur verse directement (espèces à l&apos;agence, Wave, Orange Money…). Reste dû : {balance.toLocaleString("fr-FR")} F.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-navy/80">Montant (F)<input name="amount" inputMode="numeric" required className={`${field} mt-1 block w-40 text-base`} /></label>
          <label className="min-w-[200px] flex-1 text-xs font-medium text-navy/80">Précision<input name="note" maxLength={200} placeholder="ex. Wave du 19/11" className={`${field} mt-1 block w-full`} /></label>
          <button disabled={rPending} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{rPending ? "…" : "Enregistrer"}</button>
        </div>
        {rState.error && <p role="alert" className="mt-2 text-sm text-red-700">{rState.error}</p>}
        {rState.ok && <p role="status" className="mt-2 text-sm text-emerald-800">{rState.message}</p>}
      </form>
      <div className="rounded-2xl border border-line bg-white p-5">
        {!showCancel ? (
          <button type="button" onClick={() => setShowCancel(true)} className="text-sm font-semibold text-red-700 underline">Annuler ce crédit…</button>
        ) : (
          <form action={cancel}>
            <input type="hidden" name="creditId" value={creditId} />
            <p className="text-sm text-navy/80">Le reste dû passe à 0 et le crédit est fermé (marchandises rendues, erreur de saisie). L&apos;historique est conservé.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="min-w-[240px] flex-1 text-xs font-medium text-navy/80">Motif<input name="note" required minLength={3} maxLength={200} placeholder="ex. marchandises rendues le 19/11" className={`${field} mt-1 block w-full`} /></label>
              <button disabled={cPending} className="rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{cPending ? "…" : "Confirmer l'annulation"}</button>
              <button type="button" onClick={() => setShowCancel(false)} className="text-sm text-navy underline">Retour</button>
            </div>
            {cState.error && <p role="alert" className="mt-2 text-sm text-red-700">{cState.error}</p>}
            {cState.ok && <p role="status" className="mt-2 text-sm text-emerald-800">{cState.message}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
