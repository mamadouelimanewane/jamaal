"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

/**
 * Champ de recherche du back-office : les résultats se mettent à jour pendant la saisie
 * (après une courte pause), sans avoir à cliquer sur « Filtrer ». Raccourci « / » pour y aller.
 * Reste un champ de formulaire classique : Entrée fonctionne aussi sans JavaScript.
 */
export function LiveSearchInput({ initial, placeholder, className = "" }: { initial: string; placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSent = useRef(initial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q === lastSent.current.trim()) return;
    const timer = setTimeout(() => {
      lastSent.current = q;
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      const s = next.toString();
      startTransition(() => router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <span className={`relative block ${className}`}>
      {pending ? (
        <Loader2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-navy/45" />
      ) : (
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/45" />
      )}
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-line py-2 pl-9 pr-9 text-sm outline-none focus:border-navy [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-navy/45 hover:text-navy"
        >
          <X size={14} />
        </button>
      )}
    </span>
  );
}
