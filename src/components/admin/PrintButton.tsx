"use client";

import { useEffect } from "react";

/** Bouton « Imprimer / PDF » ; avec ?print=true, la fenêtre d'impression s'ouvre seule. */
export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) window.print();
  }, [auto]);
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white shadow hover:bg-navy-light">
      🖨️ Imprimer / Enregistrer en PDF
    </button>
  );
}
