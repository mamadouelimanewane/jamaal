"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarNavLink({
  href,
  label,
  icon,
  badge,
  match,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  /** Autres adresses qui allument ce lien (ex. l'ancienne page « Mon wallet » pour « Mes gains »). */
  match?: string[];
}) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : [href, ...(match ?? [])].some((h) => pathname.startsWith(h));

  return (
    <Link
      href={href}
      title={label}
      aria-label={badge ? `${label} (${badge})` : label}
      className={`side-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/15 text-white shadow-[inset_3px_0_0_var(--rose)]" : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-rose" : ""}`}>{icon}</span>
      <span className="side-label truncate">{label}</span>
      {!!badge && badge > 0 && (
        <span className="side-badge ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-xs font-semibold text-navy">
          {badge}
        </span>
      )}
    </Link>
  );
}
