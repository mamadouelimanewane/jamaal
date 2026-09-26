"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBanner() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl bg-cream px-6 py-10 text-center sm:px-10">
        <h2 className="font-serif-display text-2xl font-semibold text-navy sm:text-3xl">
          LES PARFUMS JAMAAL
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-navy/70 sm:text-base">
          Nous proposons une large sélection de parfums inspirés des plus grandes maisons de
          parfumerie. Pour trouver votre parfum JAMAAL facilement, tapez son nom ou son numéro
          dans la barre de recherche ci-dessous. Un doute ? Contactez-nous par WhatsApp, nous
          serons ravis de vous conseiller.
        </p>
        <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-md items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Rechercher mon parfum JAMAAL (ex : N°42)"
            className="w-full rounded-full border border-line bg-white px-4 py-3 text-sm outline-none focus:border-rose"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            <Search size={16} /> Rechercher
          </button>
        </form>
      </div>
    </section>
  );
}
