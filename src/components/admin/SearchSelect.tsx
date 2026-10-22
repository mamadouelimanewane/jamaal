"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { normText } from "@/lib/product-finder";

export type SearchOption = { value: string; label: string; hint?: string };

/**
 * Liste déroulante avec recherche par nom (longues listes : revendeurs, catégories). La valeur choisie part
 * dans le formulaire sous `name`, comme un <select>. Utilisable au clavier (flèches, Entrée, Échap).
 */
export function SearchSelect({ name, options, defaultValue = "", emptyLabel, placeholder = "Rechercher par nom…", className = "" }: { name: string; options: SearchOption[]; defaultValue?: string; emptyLabel: string; placeholder?: string; className?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const n = normText(q);
    const list = n ? options.filter((o) => normText(`${o.label} ${o.hint ?? ""}`).includes(n)) : options;
    return [{ value: "", label: emptyLabel }, ...list].slice(0, 200);
  }, [q, options, emptyLabel]);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    setQ("");
  }

  return (
    <div className={`relative ${className}`} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <input type="hidden" name={name} value={value} />
      {open ? (
        <div className="flex items-center gap-2 rounded-xl border border-ia bg-white px-3 py-2 ring-4 ring-ia/10">
          <Search size={15} className="shrink-0 text-navy/50" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (shown[active]) choose(shown[active].value);
              } else if (e.key === "Escape") setOpen(false);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={`${listId}-${active}`}
            placeholder={placeholder}
            className="min-w-0 flex-1 text-sm outline-none"
          />
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2 text-left text-sm text-navy">
          <span className={`truncate ${selected ? "" : "text-navy/70"}`}>{selected?.label ?? emptyLabel}</span>
          <span className="flex shrink-0 items-center gap-1">
            {selected && (
              <span role="button" tabIndex={0} aria-label="Effacer" onClick={(e) => (e.stopPropagation(), choose(""))} onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), choose(""))} className="rounded p-0.5 hover:bg-cream">
                <X size={14} />
              </span>
            )}
            <ChevronDown size={15} className="text-navy/50" />
          </span>
        </button>
      )}
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-xl">
          {shown.map((o, i) => (
            <li
              key={o.value || "__vide"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              tabIndex={-1}
              onMouseDown={(e) => (e.preventDefault(), choose(o.value))}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-cream" : ""} ${o.value === value ? "font-semibold text-navy" : "text-navy/90"}`}
            >
              {o.label}
              {o.hint && <span className="ml-1.5 text-xs text-navy/55">{o.hint}</span>}
            </li>
          ))}
          {shown.length === 1 && q && <li className="px-3 py-2 text-sm text-navy/60">Aucun résultat pour « {q} ».</li>}
        </ul>
      )}
    </div>
  );
}
