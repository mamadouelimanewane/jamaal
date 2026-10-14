"use client";

import { useEffect } from "react";

/** Ouvre la fenêtre d'impression quand la page est chargée avec ?print=true (sans script en ligne, compatible CSP). */
export function AutoPrint() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") === "true") window.print();
  }, []);
  return null;
}
