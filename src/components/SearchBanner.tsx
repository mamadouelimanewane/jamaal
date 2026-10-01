"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

export function SearchBanner() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid items-center gap-6 border-y border-[#eadfda] bg-transparent px-0 py-7 sm:py-9 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-taupe">Un parfum en tête ?</p>
          <h2 className="mt-2 font-serif-display text-xl font-semibold text-ink sm:text-2xl">
            Retrouvez votre JAMAAL
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Recherchez par nom, numéro ou famille olfactive.
          </p>
        </div>
        <form onSubmit={handleSubmit} role="search" className="flex items-center gap-2 border-b border-[#c9a99e] bg-transparent py-1 pl-1 focus-within:border-wine">
          <Search size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            aria-label="Rechercher un parfum"
            placeholder="Nom, numéro, notes…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink/40"
          />
          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="flex h-10 w-10 shrink-0 items-center justify-center bg-wine text-white transition hover:bg-[#14213b] sm:w-auto sm:px-5"
          >
            <span className="hidden sm:inline">Rechercher</span>
            <ArrowRight size={16} className="sm:ml-2" />
          </button>
        </form>
      </div>
    </section>
  );
}
