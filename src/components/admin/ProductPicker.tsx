"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { inspirationLabel, type FindableProduct } from "@/lib/product-finder";
import { useCatalogSearch } from "./useCatalogSearch";

export type PickableProduct = FindableProduct & { slug: string; price?: number | null };

/**
 * Choix d'un ou plusieurs produits : recherche par nom, code, catégorie ou parfum d'inspiration,
 * produits choisis affichés en pastilles (retirables).
 */
export function ProductPicker<T extends PickableProduct>({
  products,
  selected,
  onChange,
  max = 10,
  placeholder = "Nom, code ou catégorie (ex. Sauvage, 021M, parfum femme)",
}: {
  products: T[];
  selected: T[];
  onChange: (next: T[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const { results, searching } = useCatalogSearch(products, q, 8);
  const chosen = new Set(selected.map((p) => p.slug));
  const full = selected.length >= max;

  function toggle(p: T) {
    if (chosen.has(p.slug)) onChange(selected.filter((s) => s.slug !== p.slug));
    else if (!full) onChange(max === 1 ? [p] : [...selected, p]);
    if (max === 1) setQ("");
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 focus-within:border-rose-dark">
        <Search size={16} className="shrink-0 text-navy/50" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un produit" placeholder={placeholder} className="min-w-0 flex-1 text-sm outline-none" />
        {searching && <Loader2 size={15} className="shrink-0 animate-spin text-navy/40" />}
      </label>

      {q.trim().length >= 2 && (
        results.length ? (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white text-sm">
            {results.map((p) => {
              const on = chosen.has(p.slug);
              return (
                <li key={p.slug}>
                  <button type="button" onClick={() => toggle(p)} disabled={!on && full && max > 1} aria-pressed={on} className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-cream disabled:opacity-50 ${on ? "bg-emerald-50" : ""}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-emerald-600 bg-emerald-600 text-white" : "border-line text-navy/60"}`}>{on ? <Check size={14} /> : <Plus size={14} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-navy">{p.name}</span>
                      <span className="block truncate text-xs text-navy/60">{[p.choganCode, p.categoryLabel, inspirationLabel(p)].filter(Boolean).join(" · ")}</span>
                    </span>
                    {p.price != null && <span className="shrink-0 text-xs text-navy/70">{p.price.toLocaleString("fr-FR")} F</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          !searching && <p className="text-sm text-navy/70">Aucun produit trouvé : essayez le code (ex. 021M), la catégorie ou un autre mot.</p>
        )
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {max > 1 && <span className="text-xs font-semibold text-navy/70">{selected.length} / {max} choisi{selected.length > 1 ? "s" : ""} :</span>}
          {selected.map((p) => (
            <span key={p.slug} className="inline-flex max-w-full items-center gap-1 rounded-full bg-navy/5 py-1 pl-3 pr-1 text-sm text-navy ring-1 ring-line">
              <span className="truncate">{p.name}</span>
              <button type="button" onClick={() => onChange(selected.filter((s) => s.slug !== p.slug))} aria-label={`Retirer ${p.name}`} className="rounded-full p-1 hover:bg-white"><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
