"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarNavLink({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className={active ? "text-rose" : ""}>{icon}</span>
      {label}
      {!!badge && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-semibold text-navy">
          {badge}
        </span>
      )}
    </Link>
  );
}
