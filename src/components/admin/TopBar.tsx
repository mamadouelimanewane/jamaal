"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Eye, EyeOff, FileSignature, KeyRound, LogOut, Trophy, UserCircle, Wallet, Globe } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { InstallAppButton } from "./InstallApp";

const HIDE_KEY = "jamaal_solde_masque";

export type TopBarRank = { title: string; place: number | null; total: number };

/**
 * Barre du haut de l'espace JAMAAL : solde (masquable), rang et classement, notifications,
 * téléchargement de l'application et menu du profil. Le menu latéral ne garde que la navigation.
 */
export function TopBar({
  role,
  user,
  balance,
  walletHref,
  rank,
  unread,
  logout,
}: {
  role: "ADMIN" | "CONSULTANT" | "LIVREUR";
  user: { name: string; detail: string };
  balance: number | null;
  walletHref: string;
  rank: TopBarRank | null;
  unread: number;
  logout: () => Promise<void>;
}) {
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const pathname = usePathname();
  const menuOpen = menu === pathname;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(HIDE_KEY) === "1";
      queueMicrotask(() => setHidden(v));
    } catch {
      // stockage indisponible : solde affiché
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      // sans stockage, le choix vaut pour la page en cours
    }
  }

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "J";
  const amount = balance !== null ? `${balance.toLocaleString("fr-FR")} F` : "";
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-cream";
  const placeLabel = rank?.place ? `${rank.place}ᵉ${rank.total ? ` / ${rank.total}` : ""}` : null;

  return (
    <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2.5">
      <div className="mr-auto hidden min-w-0 max-w-sm flex-1 md:block">
        <GlobalSearch tone="light" />
      </div>

      {balance !== null && (
        <div className="flex shrink-0 items-center whitespace-nowrap rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          <Link href={walletHref} className="flex items-center gap-1.5 py-1.5 pl-3 pr-1 text-sm font-semibold text-emerald-900" aria-label={hidden ? "Mon solde (masqué)" : `Mon solde : ${amount}`}>
            <Wallet size={16} className="shrink-0" />
            <span className="tabular-nums">{hidden ? "•••••" : amount}</span>
          </Link>
          <button type="button" onClick={toggleHidden} aria-pressed={hidden} aria-label={hidden ? "Afficher le solde" : "Masquer le solde"} title={hidden ? "Afficher le solde" : "Masquer le solde"} className="rounded-full p-1.5 pr-2.5 text-emerald-800 hover:text-emerald-950">
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      )}

      {rank && (
        <Link href="/admin/mon-classement" title="Mon rang et mon classement du mois" className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 sm:inline-flex">
          <Trophy size={15} />
          <span>{rank.title}</span>
          {placeLabel && <span className="hidden font-normal text-amber-800 xl:inline">· {placeLabel}</span>}
        </Link>
      )}

      <Link href="/admin/notifications" aria-label={unread ? `Notifications (${unread} non lues)` : "Notifications"} title="Notifications" className="relative rounded-full p-2 text-navy hover:bg-cream">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-dark px-1 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>

      {role !== "ADMIN" && (
        <div className="hidden shrink-0 lg:block">
          <InstallAppButton compact />
        </div>
      )}

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setMenu(menuOpen ? null : pathname)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Mon profil"
          className="flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-cream sm:pr-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{initials}</span>
          <span className="hidden max-w-[10rem] text-left leading-tight 2xl:block">
            <span className="block truncate text-sm font-semibold text-navy">{user.name}</span>
            <span className="block truncate text-xs text-navy/65">{user.detail}</span>
          </span>
          <ChevronDown size={15} className="hidden text-navy/60 sm:block" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl">
            <div className="border-b border-line px-3 pb-2 pt-1">
              <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
              <p className="truncate text-xs text-navy/65">{user.detail}</p>
            </div>
            <div className="py-1">
              {role === "CONSULTANT" && (
                <>
                  <Link role="menuitem" href="/admin/mon-profil" className={item}><UserCircle size={16} /> Mon profil</Link>
                  <Link role="menuitem" href="/admin/mon-protocole" className={item}><FileSignature size={16} /> Mon contrat (protocole)</Link>
                  {rank && <Link role="menuitem" href="/admin/mon-classement" className={`${item} sm:hidden`}><Trophy size={16} /> {rank.title}{placeLabel ? ` · ${placeLabel}` : ""}</Link>}
                </>
              )}
              <Link role="menuitem" href="/admin/mot-de-passe" className={item}><KeyRound size={16} /> Changer mon mot de passe</Link>
              {role !== "ADMIN" && (
                <div className="lg:hidden">
                  <InstallAppButton variant="menu" />
                </div>
              )}
              <Link role="menuitem" href="/" className={item}><Globe size={16} /> Retour au site</Link>
            </div>
            <form action={logout} className="border-t border-line pt-1">
              <button role="menuitem" className={`${item} font-semibold text-rose-dark`}><LogOut size={16} /> Se déconnecter</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
