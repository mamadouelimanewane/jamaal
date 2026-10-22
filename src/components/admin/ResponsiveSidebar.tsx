"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-pref";


export function ResponsiveSidebar({
  sidebar,
  children,
  topbar,
  initialCollapsed = false,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Barre du haut (solde, rang, notifications, profil) : affichée sur toutes les pages. */
  topbar?: React.ReactNode;
  /** Menu replié à l'ouverture (préférence mémorisée dans un cookie, pour éviter tout clignotement). */
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  // Le menu mobile est lié à la page où il a été ouvert : il se referme tout seul en changeant de page.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean) => setOpenedOn(value ? pathname : null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "replie" : "ouvert"}; path=/admin; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="admin-ui min-h-screen bg-cream lg:flex">
      {open && <div className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        data-collapsed={collapsed ? "true" : "false"}
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col overflow-y-auto bg-navy px-4 py-6 shadow-xl transition-[transform,width] duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          collapsed ? "lg:w-[4.75rem] lg:px-2.5" : "lg:w-64"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/75 transition-colors hover:bg-white/10 lg:hidden"
        >
          <X size={20} />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          aria-expanded={!collapsed}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
          className={`absolute top-5 hidden rounded-lg border border-white/15 p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white lg:block ${collapsed ? "left-1/2 -translate-x-1/2" : "right-3"}`}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
        <div className={`flex min-h-0 flex-1 flex-col ${collapsed ? "lg:pt-9" : ""}`}>{sidebar}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-6 lg:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-navy transition-colors hover:bg-cream lg:hidden"
          >
            <Menu size={22} />
          </button>
          <p className="font-serif-display text-lg font-semibold tracking-wide text-navy lg:hidden">JAMAAL</p>
          {topbar}
        </header>
        <main className="min-w-0 flex-1 overflow-x-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
