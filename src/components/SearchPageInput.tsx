"use client";

import { Search } from "lucide-react";
import { useSearchStore } from "@/lib/search-store";

/** Champ de la page de résultats : ouvre la recherche instantanée avec le texte courant. */
export function SearchPageInput({ initial }: { initial: string }) {
  const open = useSearchStore((s) => s.open);
  return (
    <button
      type="button"
      onClick={() => open(initial)}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#eadfda] bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#c9997a] sm:py-5"
    >
      <Search size={22} className="shrink-0 text-[#9c6254]" />
      <span className={`flex-1 truncate font-serif-display text-xl sm:text-2xl ${initial ? "text-navy" : "text-navy/40"}`}>{initial || "Un parfum, une marque, un code…"}</span>
      <span className="hidden text-xs text-navy/50 sm:block">Modifier</span>
    </button>
  );
}
