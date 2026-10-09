"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export type FormatRow = { label: string; code: string; price: number | ""; publicPrice: number | ""; threshold: number | ""; stock?: number };

const input = "w-full rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-navy";

/**
 * Formats d'un produit (70 ml, 30 ml, 15 ml…) : prix de vente, prix public Chogan, code et seuil.
 * Le stock de chaque format se gère dans Stocks (entrées, sorties, inventaire tracés).
 */
export function FormatsEditor({ initial }: { initial: FormatRow[] }) {
  const [rows, setRows] = useState<FormatRow[]>(initial);
  const update = (i: number, patch: Partial<FormatRow>) => setRows((r) => r.map((row, k) => (k === i ? { ...row, ...patch } : row)));
  const num = (v: string) => (v === "" ? "" : Number(v));

  return (
    <div className="rounded-xl border border-line bg-cream/40 p-3">
      <input type="hidden" name="formats" value={JSON.stringify(rows.filter((r) => r.label.trim()))} />
      {rows.length === 0 && <p className="px-1 py-2 text-sm text-navy/70">Format unique : le stock se tient au niveau du produit.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-navy/70">
              <tr>
                <th className="px-1 pb-2 font-medium">Format</th>
                <th className="px-1 pb-2 font-medium">Code</th>
                <th className="px-1 pb-2 font-medium">Prix de vente (F)</th>
                <th className="px-1 pb-2 font-medium">Prix public Chogan (F)</th>
                <th className="px-1 pb-2 font-medium">Seuil d&apos;alerte</th>
                <th className="px-1 pb-2 font-medium">Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="p-1"><input value={r.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="70 ml" className={input} aria-label="Format" /></td>
                  <td className="p-1"><input value={r.code} onChange={(e) => update(i, { code: e.target.value.toUpperCase() })} placeholder="001M" className={input} aria-label="Code" /></td>
                  <td className="p-1"><input type="number" min={0} value={r.price} onChange={(e) => update(i, { price: num(e.target.value) })} className={input} aria-label="Prix de vente" /></td>
                  <td className="p-1"><input type="number" min={0} value={r.publicPrice} onChange={(e) => update(i, { publicPrice: num(e.target.value) })} className={input} aria-label="Prix public Chogan" /></td>
                  <td className="p-1"><input type="number" min={0} value={r.threshold} onChange={(e) => update(i, { threshold: num(e.target.value) })} className={input} aria-label="Seuil" /></td>
                  <td className="p-1 text-center text-navy/80">{r.stock ?? "—"}</td>
                  <td className="p-1 text-right">
                    <button type="button" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} disabled={!!r.stock} title={r.stock ? "Videz d'abord le stock de ce format dans Stocks" : "Retirer ce format"} className="rounded-lg p-2 text-rose-dark hover:bg-rose-50 disabled:opacity-30">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={() => setRows((r) => [...r, { label: "", code: "", price: "", publicPrice: "", threshold: 3 }])} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-navy hover:bg-white">
        <Plus size={15} /> Ajouter un format
      </button>
    </div>
  );
}
