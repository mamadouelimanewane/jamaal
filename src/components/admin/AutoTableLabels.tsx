"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Recopie le libellé de chaque colonne (en-tête du tableau) dans ses cellules (data-label) :
 * sur téléphone, les tableaux du back-office s'affichent en cartes « libellé : valeur ».
 */
export function AutoTableLabels() {
  const pathname = usePathname();
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>(".admin-ui main table:not(.keep-table)").forEach((table) => {
        const heads = [...table.querySelectorAll("thead tr:last-child th")].map((th) => (th.textContent ?? "").trim());
        if (!heads.length) return;
        table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
          let col = 0;
          [...tr.cells].forEach((cell) => {
            const h = heads[col];
            if (h && !cell.hasAttribute("data-label")) cell.setAttribute("data-label", h);
            col += cell.colSpan || 1;
          });
        });
      });
    };
    label();
    const main = document.querySelector(".admin-ui main");
    if (!main) return;
    const obs = new MutationObserver(() => label());
    obs.observe(main, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [pathname]);
  return null;
}
