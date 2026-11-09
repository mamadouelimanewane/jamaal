"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useT } from "@/components/i18n/LocaleProvider";

/** Texte comparable : minuscules, sans accents, chiffres du téléphone gardés. */
export function searchKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Chaque mot cherché doit apparaître (dans n'importe quel ordre) ; un numéro se cherche sans espaces. */
export function matchesSearch(haystack: string, query: string): boolean {
  const h = searchKey(haystack);
  const digits = h.replace(/\D/g, "");
  return searchKey(query)
    .split(" ")
    .filter(Boolean)
    .every((w) => h.includes(w) || (/^\+?\d[\d\s]*$/.test(w) && w.replace(/\D/g, "").length >= 2 && digits.includes(w.replace(/\D/g, ""))));
}

/**
 * Barre de recherche instantanée sur une liste déjà affichée : filtre les éléments
 * `[data-search]` du conteneur `target` (nom, ville, téléphone, parrain…), sans recharger la page.
 */
export function ListSearch({ target, placeholder, total, label }: { target: string; placeholder: string; total: number; label?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(total);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.getElementById(target);
    if (!root) return;
    let n = 0;
    root.querySelectorAll<HTMLElement>("[data-search]").forEach((el) => {
      const ok = !q.trim() || matchesSearch(el.dataset.search ?? "", q);
      el.hidden = !ok;
      if (ok) n++;
    });
    const empty = root.querySelector<HTMLElement>("[data-search-empty]");
    if (empty) empty.hidden = n > 0;
    const id = setTimeout(() => setShown(n), 0);
    return () => clearTimeout(id);
  }, [q, target]);

  // « / » ou Ctrl+K : aller dans la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if ((e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:max-w-md">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy/50" />
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={label ?? placeholder}
          enterKeyHint="search"
          className="w-full rounded-full border border-line bg-white py-2.5 pl-10 pr-10 text-sm text-navy shadow-sm outline-none focus:border-navy"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); input.current?.focus(); }} aria-label={t("Effacer la recherche")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-navy/50 hover:bg-cream">
            <X size={15} />
          </button>
        )}
      </div>
      {q.trim() && <p className="text-xs text-navy/65" aria-live="polite">{t("{n} sur {total}", { n: shown, total })}</p>}
    </div>
  );
}
