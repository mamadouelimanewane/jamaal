"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function ResponsiveSidebar({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Le menu mobile est lié à la page où il a été ouvert : il se referme tout seul en changeant de page.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean) => setOpenedOn(value ? pathname : null);

  return (
    <div className="min-h-screen bg-cream lg:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-navy px-4 py-3 lg:hidden shadow-sm">
        <p className="font-serif-display text-lg font-semibold tracking-wide text-white">JAMAAL</p>
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="rounded-lg p-2 text-white hover:bg-white/10 transition-colors"
        >
          <Menu size={22} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col overflow-y-auto bg-navy px-4 py-6 shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:w-64 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden transition-colors"
        >
          <X size={20} />
        </button>
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 overflow-x-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
