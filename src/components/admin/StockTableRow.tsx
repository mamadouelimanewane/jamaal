"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Loader2, X } from "lucide-react";
import { adjustStockAction, updateThresholdAction, type StockActionState } from "@/lib/actions/stock";
import type { StockRow } from "@/lib/inventory-report";

const initial: StockActionState = { ok: false };
const fmt = (n: number) => n.toLocaleString("fr-FR");

const STATUS = {
  rupture: { label: "Rupture", cls: "bg-red-100 text-red-800" },
  bas: { label: "Stock bas", cls: "bg-amber-100 text-amber-900" },
  ok: { label: "En stock", cls: "bg-emerald-100 text-emerald-800" },
} as const;

const KINDS_IN = [
  { id: "RECEPTION", label: "Réception fournisseur" },
  { id: "RETOUR", label: "Retour client" },
  { id: "AJUSTEMENT", label: "Ajustement" },
];
const KINDS_OUT = [
  { id: "PERTE", label: "Casse / perte" },
  { id: "AJUSTEMENT", label: "Ajustement" },
];

const field = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/10";

export function StockTableRow({ row }: { row: StockRow }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "out" | "set">("in");
  const [state, action, pending] = useActionState(adjustStockAction, initial);
  const [tState, tAction, tPending] = useActionState(updateThresholdAction, initial);
  const status = STATUS[row.status];
  const kinds = mode === "out" ? KINDS_OUT : KINDS_IN;

  return (
    <>
      <tr className={`border-t border-line align-middle ${open ? "bg-cream/60" : "hover:bg-cream/40"}`}>
        <td className="px-4 py-3">
          <Link href={`/admin/produits/${row.productId}/modifier`} className="font-medium text-ink hover:underline">{row.name}</Link>
          <span className="block text-xs text-navy/65">{row.categoryLabel}</span>
          {/* Sur téléphone, la dernière colonne est hors de l'écran : bouton ici aussi. */}
          <button type="button" onClick={() => setOpen(true)} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white sm:hidden">
            <ArrowLeftRight size={13} /> Saisir un mouvement
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] text-navy">{row.code ?? "—"}</td>
        <td className="whitespace-nowrap px-3 py-3 text-navy/85">{row.format}</td>
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>
            <span className="text-sm">{fmt(row.stock)}</span> {status.label}
          </span>
        </td>
        <td className="px-3 py-3">
          <form action={tAction} className="flex items-center gap-1">
            <input type="hidden" name="productId" value={row.productId} />
            <input type="hidden" name="variantId" value={row.variantId ?? ""} />
            <input name="threshold" type="number" min={0} defaultValue={row.threshold} aria-label="Seuil d'alerte" onBlur={(e) => { if (Number(e.currentTarget.value) !== row.threshold) e.currentTarget.form?.requestSubmit(); }} className="w-16 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-navy hover:border-line focus:border-navy focus:bg-white focus:outline-none" />
            {tPending ? <Loader2 size={14} className="animate-spin text-navy/50" /> : tState.error ? <span className="text-xs text-red-700">!</span> : null}
          </form>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-navy/85">{row.sold30 ? fmt(row.sold30) : "—"}</td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-navy/85">{row.coverageDays === null ? "—" : `${row.coverageDays} j`}</td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-navy">{row.toOrder ? fmt(row.toOrder) : "—"}</td>
        <td className="px-3 py-3 text-right">
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy">
            <ArrowLeftRight size={14} /> Mouvement
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="p-0">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Mouvement de stock : ${row.name} ${row.format}`}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
              onClick={(e) => e.target === e.currentTarget && setOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            >
              <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{row.name}</p>
                    <p className="text-sm text-navy/75">{row.format}{row.code ? ` · ${row.code}` : ""} · stock actuel <strong>{fmt(row.stock)}</strong></p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-navy/70 hover:bg-cream"><X size={18} /></button>
                </div>
                <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="productId" value={row.productId} />
                  <input type="hidden" name="variantId" value={row.variantId ?? ""} />
                  <input type="hidden" name="mode" value={mode} />
                  <div role="group" aria-label="Type de mouvement" className="flex rounded-lg border border-line bg-cream p-0.5 text-sm font-semibold">
                    {([["in", "Entrée"], ["out", "Sortie"], ["set", "Stock compté"]] as const).map(([m, l]) => (
                      <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-navy text-white" : "text-navy/80 hover:bg-white"}`}>{l}</button>
                    ))}
                  </div>
                  <label className="text-xs font-medium text-navy/80">
                    {mode === "set" ? "Quantité comptée" : "Quantité"}
                    <input name="qty" type="number" inputMode="numeric" autoFocus min={mode === "set" ? 0 : 1} required className={`${field} mt-1 block w-28 text-base`} />
                  </label>
                  {mode !== "set" && (
                    <label className="text-xs font-medium text-navy/80">
                      Motif
                      <select key={mode} name="kind" defaultValue={kinds[0].id} className={`${field} mt-1 block`}>
                        {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="min-w-[180px] flex-1 text-xs font-medium text-navy/80">
                    Précision
                    <input name="reason" maxLength={180} placeholder={mode === "set" ? "Inventaire du…" : "ex. casse en livraison"} className={`${field} mt-1 block w-full`} />
                  </label>
                  <label className="text-xs font-medium text-navy/80">
                    Référence
                    <input name="reference" maxLength={80} placeholder="Bon n°…" className={`${field} mt-1 block w-32`} />
                  </label>
                  <button disabled={pending} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
                    {pending ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  {state.error && <p role="alert" className="w-full text-sm font-medium text-red-700">{state.error}</p>}
                  {state.ok && <p role="status" className="w-full text-sm font-medium text-emerald-800">Enregistré : {state.message}</p>}
                </form>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
