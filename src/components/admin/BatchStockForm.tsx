"use client";

import { useActionState, useState } from "react";
import { CircleCheck, CircleAlert } from "lucide-react";
import { batchStockAction, type StockActionState } from "@/lib/actions/stock";

const initial: StockActionState = { ok: false };

export function BatchStockForm() {
  const [mode, setMode] = useState<"RECEPTION" | "INVENTAIRE">("RECEPTION");
  const [state, action, pending] = useActionState(batchStockAction, initial);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />
      <div role="group" aria-label="Type de saisie" className="grid gap-3 sm:grid-cols-2">
        {([
          ["RECEPTION", "Réception de marchandise", "Les quantités s'ajoutent au stock (livraison Chogan, transfert…)."],
          ["INVENTAIRE", "Inventaire", "Les quantités comptées remplacent le stock ; l'écart est enregistré."],
        ] as const).map(([m, title, text]) => (
          <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`rounded-2xl border p-4 text-left transition ${mode === m ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}>
            <span className="block text-base font-semibold">{title}</span>
            <span className={`mt-1 block text-sm ${mode === m ? "text-white/80" : "text-navy/70"}`}>{text}</span>
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium text-ink">
        Référence {mode === "RECEPTION" ? "du bon de livraison" : "de l'inventaire"} (facultatif)
        <input name="reference" maxLength={80} placeholder={mode === "RECEPTION" ? "ex. Chogan BL 2026-118" : "ex. Inventaire octobre 2026"} className="mt-1.5 block w-full max-w-md rounded-xl border border-line px-3.5 py-2.5 text-base outline-none focus:border-navy" />
      </label>
      <label className="block text-sm font-medium text-ink">
        Articles : une ligne par article, le code puis la quantité
        <textarea name="lines" required rows={12} spellCheck={false} placeholder={"001M 12\n301M 6\nT001M 10\nBSF094 24\n13311 4"} className="mt-1.5 block w-full rounded-xl border border-line px-3.5 py-3 font-mono text-[15px] leading-7 outline-none focus:border-navy" />
        <span className="mt-1.5 block text-xs font-normal text-navy/70">Codes acceptés : code du format (001M = 70 ml, 301M = 30 ml, T001M = 15 ml), code Chogan, ou numéro de fiche. Séparateur : espace, « ; », « , » ou « x ». Rien n&apos;est enregistré si une ligne est fausse.</span>
      </label>
      <button disabled={pending} className="rounded-xl bg-navy px-6 py-3 text-base font-semibold text-white hover:bg-navy-light disabled:opacity-50">
        {pending ? "Enregistrement…" : mode === "RECEPTION" ? "Enregistrer la réception" : "Enregistrer l'inventaire"}
      </button>
      {(state.error || state.ok) && (
        <div role={state.ok ? "status" : "alert"} className={`rounded-2xl border p-4 ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <p className="flex items-center gap-2 font-semibold">{state.ok ? <CircleCheck size={18} /> : <CircleAlert size={18} />}{state.ok ? state.message : state.error}</p>
          {state.lines?.length ? <ul className="mt-2 max-h-72 list-disc space-y-0.5 overflow-y-auto pl-6 text-sm">{state.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
        </div>
      )}
    </form>
  );
}
