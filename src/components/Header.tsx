"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, ShoppingBag, Menu, X, User } from "lucide-react";
import type { Category } from "@/data/types";
import { useCartStore } from "@/lib/cart-store";

export function Header({ categories }: { categories: Category[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const count = useCartStore((s) => s.count());
  const openCart = useCartStore((s) => s.open);

  useEffect(() => setMounted(true), []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-white/70 backdrop-blur-lg shadow-sm transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          className="lg:hidden rounded-full p-2 transition-colors hover:bg-navy/5"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Ouvrir le menu"
        >
          {menuOpen ? <X size={24} className="text-navy" /> : <Menu size={24} className="text-navy" />}
        </button>

        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-[1.02]">
          <Image
            src="/logo/jamaal-logo.jpg"
            alt="JAMAAL Luxury Cosmetics"
            width={48}
            height={48}
            className="rounded-full object-cover shadow-sm ring-2 ring-white"
            priority
          />
          <span className="hidden font-serif-display text-2xl font-bold tracking-tight text-navy sm:block">
            JAMAAL
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex">
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="text-sm font-semibold tracking-wide text-navy/80 transition-all hover:-translate-y-0.5 hover:text-rose-dark"
            >
              {c.navLabel}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setSearchOpen((o) => !o)} aria-label="Rechercher" className="rounded-full p-2 transition-colors hover:bg-navy/5">
            <Search size={22} className="text-navy" />
          </button>
          <Link href="/compte" aria-label="Mon compte" className="hidden rounded-full p-2 transition-colors hover:bg-navy/5 sm:block">
            <User size={22} className="text-navy" />
          </Link>
          <button onClick={openCart} className="relative rounded-full p-2 transition-colors hover:bg-navy/5" aria-label="Panier">
            <ShoppingBag size={22} className="text-navy" />
            {mounted && count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-dark text-[11px] font-bold text-white shadow-md ring-2 ring-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="animate-fade-in border-t border-line bg-cream/90 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Rechercher un parfum JAMAAL (ex: N°001, Armani...)"
              className="w-full rounded-full border border-line bg-white/80 px-5 py-3 text-sm shadow-inner outline-none transition-all focus:border-rose focus:bg-white focus:ring-4 focus:ring-rose/10"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-navy px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-navy-light hover:shadow-lg"
            >
              Rechercher
            </button>
          </div>
        </form>
      )}

      {menuOpen && (
        <nav className="animate-fade-in flex flex-col gap-1 border-t border-line bg-white/95 px-4 py-4 backdrop-blur-md lg:hidden">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-navy transition-colors hover:bg-cream"
            >
              {c.navLabel}
            </Link>
          ))}
          <Link
            href="/devenir-consultant"
            onClick={() => setMenuOpen(false)}
            className="mt-2 rounded-xl bg-rose-dark/10 px-4 py-3 text-sm font-bold text-rose-dark transition-colors hover:bg-rose-dark/20"
          >
            Devenir consultant JAMAAL
          </Link>
        </nav>
      )}
    </header>
  );
}
