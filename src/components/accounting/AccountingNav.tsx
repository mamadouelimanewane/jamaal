"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "", label: "Tableau de bord" },
  { href: "/journal", label: "Journal" },
  { href: "/grand-livre", label: "Grand livre" },
  { href: "/balance", label: "Balance" },
  { href: "/resultat", label: "Compte de résultat" },
  { href: "/bilan", label: "Bilan" },
  { href: "/tresorerie", label: "Trésorerie" },
  { href: "/depenses", label: "Dépenses" },
  { href: "/marges", label: "Marges" },
  { href: "/budgets", label: "Budgets" },
  { href: "/tva", label: "TVA" },
  { href: "/clotures", label: "Clôtures" },
  { href: "/reglages", label: "Réglages" },
];

/** Onglets de la comptabilité ; la période choisie suit d'un onglet à l'autre. */
export function AccountingNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["p", "du", "au"]) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const q = keep.size ? `?${keep}` : "";
  return (
    <nav aria-label="Comptabilité" className="print:hidden -mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5">
        {TABS.map((t) => {
          const href = `/admin/comptabilite${t.href}`;
          const active = t.href === "" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={t.href}>
              <Link href={`${href}${q}`} aria-current={active ? "page" : undefined} className={`block whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${active ? "bg-navy text-white" : "border border-line bg-white text-navy hover:bg-cream"}`}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
