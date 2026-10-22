"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, User, Package, Users, Loader2 } from "lucide-react";
import { globalAdminSearch, type GlobalSearchResult } from "@/lib/actions/global-search";

export function GlobalSearch({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Sans requête, rien n'est affiché (voir le rendu) : inutile de toucher à l'état ici.
    if (!query.trim()) return;

    const timer = setTimeout(async () => {
      try {
        const res = await globalAdminSearch(query);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  function getIcon(type: GlobalSearchResult["type"]) {
    switch (type) {
      case "order":
        return <ShoppingCart size={15} className="text-blue-500" />;
      case "customer":
        return <User size={15} className="text-emerald-500" />;
      case "product":
        return <Package size={15} className="text-purple-500" />;
      case "consultant":
        return <Users size={15} className="text-amber-500" />;
    }
  }

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search size={16} className={`absolute left-3.5 ${light ? "text-navy/50" : "text-white/65"}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setLoading(e.target.value.trim().length > 0);
          }}
          placeholder={light ? "Rechercher un produit, une commande, un client…" : "Recherche globale (Cmd+K)..."}
          aria-label="Recherche"
          className={light
            ? "w-full rounded-full border border-line bg-cream/60 py-2 pl-9 pr-12 text-sm text-navy placeholder-navy/45 outline-none transition focus:border-rose-dark focus:bg-white"
            : "w-full rounded-full border border-white/10 bg-white/10 py-1.5 pl-9 pr-10 text-xs text-white placeholder-white/40 outline-none transition focus:bg-white/15 focus:ring-1 focus:ring-rose"}
        />
        <kbd className={`absolute right-3 hidden rounded border px-1.5 py-0.5 text-xs font-mono sm:inline-block ${light ? "border-line text-navy/50" : "border-white/20 bg-white/5 text-white/65"}`}>
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-xl animate-fade-in">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-xs text-navy/70">
                <Loader2 size={16} className="mr-2 animate-spin" /> Recherche en cours...
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-xs text-navy/70">
                Aucun résultat pour &quot;{query}&quot;.
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((r) => (
                  <button
                    key={r.type + r.id}
                    onClick={() => handleSelect(r.href)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-cream transition"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream">
                      {getIcon(r.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-navy">{r.title}</p>
                      <p className="truncate text-xs text-navy/70">{r.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
