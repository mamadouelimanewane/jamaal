"use client";

import { useEffect } from "react";

/** Enregistre le service worker de l'application consultant (rend le site installable). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" }).catch(() => {});
    }
  }, []);
  return null;
}
