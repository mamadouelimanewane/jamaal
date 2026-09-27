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
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          className="lg:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Ouvrir le menu"
        >
          {menuOpen ? <X size={22} className="text-navy" /> : <Menu size={22} className="text-navy" />}
        </button>

        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo/jamaal-logo.jpg"
            alt="JAMAAL Luxury Cosmetics"
            width={44}
            height={44}
            className="rounded-full object-cover"
            priority
          />
          <span className="hidden font-serif-display text-xl font-semibold tracking-wide text-navy sm:block">
            JAMAAL
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="text-sm font-medium text-navy/80 transition hover:text-rose-dark"
            >
              {c.navLabel}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button onClick={() => setSearchOpen((o) => !o)} aria-label="Rechercher">
            <Search size={20} className="text-navy" />
          </button>
          <Link href="/compte" aria-label="Mon compte" className="hidden sm:block">
            <User size={20} className="text-navy" />
          </Link>
          <button onClick={openCart} className="relative" aria-label="Panier">
            <ShoppingBag size={20} className="text-navy" />
            {mounted && count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-dark text-[10px] font-semibold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="border-t border-line bg-cream px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Rechercher un parfum JAMAAL (nom ou numéro)"
              className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-rose"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white"
            >
              Rechercher
            </button>
          </div>
        </form>
      )}

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-line bg-white px-4 py-3 lg:hidden">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              onClick={() => setMenuOpen(false)}
              className="rounded px-2 py-2 text-sm font-medium text-navy hover:bg-cream"
            >
              {c.navLabel}
            </Link>
          ))}
          <Link
            href="/devenir-consultant"
            onClick={() => setMenuOpen(false)}
            className="rounded px-2 py-2 text-sm font-semibold text-rose-dark hover:bg-cream"
          >
            Devenir consultant JAMAAL
          </Link>
        </nav>
      )}
    </header>
  );
}
