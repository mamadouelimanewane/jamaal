"use client";

import { ArrowRight, Search } from "lucide-react";
import { useSearchStore } from "@/lib/search-store";

const IDEAS = ["Sauvage", "Baccarat Rouge 540", "Black Opium", "Vanille", "001M"];

/** Grande barre de recherche de la page d'accueil : ouvre la recherche instantanée. */
export function SearchBanner() {
  const open = useSearchStore((s) => s.open);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="relative overflow-hidden rounded-[28px] bg-[#14213b] px-5 py-8 text-[#f5ece8] sm:px-12 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c9997a]/20 blur-3xl" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#ecc6a6]">Un parfum en tête ?</p>
        <h2 className="mt-2 font-serif-display text-2xl sm:text-4xl">Retrouvez votre fragrance</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#f5ece8]/75">Tapez le nom d&apos;un grand parfum, une marque, une note ou un code Chogan : les résultats s&apos;affichent pendant que vous écrivez.</p>
        <button
          type="button"
          onClick={() => open()}
          className="group mt-6 flex w-full items-center gap-3 rounded-2xl bg-[#fdfbfa] px-4 py-4 text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] transition hover:ring-2 hover:ring-[#c9997a] sm:px-6 sm:py-5"
        >
          <Search size={22} className="shrink-0 text-[#9c6254]" />
          <span className="flex-1 truncate font-serif-display text-lg text-navy/45 sm:text-2xl">Sauvage, Dior, vanille, 001M…</span>
          <span className="hidden items-center gap-2 rounded-xl bg-[#14213b] px-5 py-2.5 text-sm font-semibold text-white sm:flex">Rechercher <ArrowRight size={16} /></span>
        </button>
        <div className="mt-4 flex flex-wrap gap-2">
          {IDEAS.map((t) => (
            <button key={t} type="button" onClick={() => open(t)} className="rounded-full border border-[#f5ece8]/25 px-3.5 py-1.5 text-xs text-[#f5ece8]/85 transition hover:border-[#ecc6a6] hover:text-white">
              {t}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
