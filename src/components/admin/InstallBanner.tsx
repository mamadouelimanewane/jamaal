"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useInstall } from "./InstallApp";
import { InstallGuide } from "./InstallGuide";

const KEY = "jamaal_install_banner_until";

/**
 * Encart « Installez l'application » pour les revendeurs et livreurs déjà inscrits : affiché dans leur espace tant
 * que l'application n'est pas installée sur ce téléphone. « Plus tard » le masque 7 jours.
 */
export function InstallBanner() {
  const { installed } = useInstall();
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let until = 0;
    try {
      until = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      // stockage indisponible : l'encart s'affiche
    }
    const mobile = window.matchMedia("(max-width: 1024px)").matches || navigator.maxTouchPoints > 0;
    queueMicrotask(() => setHidden(!mobile || until > Date.now()));
  }, []);

  if (installed || hidden) return null;
  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + 7 * 86_400_000));
    } catch {
      // sans stockage : masqué pour cette page seulement
    }
    setHidden(true);
  };

  return (
    <div className="mb-5 rounded-2xl border border-rose/40 bg-gradient-to-r from-[#fdf3ef] to-white p-4">
      <div className="flex items-start gap-3">
        <Image src="/icons/v2/jamaal-192.png" alt="" width={48} height={48} className="shrink-0 rounded-xl shadow" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">Installez l&apos;application JAMAAL sur votre téléphone</p>
          <p className="mt-0.5 text-sm text-navy/70">Votre espace s&apos;ouvre d&apos;un geste avec l&apos;icône JAMAAL, comme une application.</p>
          {!open && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">Installer maintenant</button>
              <button type="button" onClick={later} className="rounded-full px-4 py-2 text-sm font-semibold text-navy/70 hover:text-navy">Plus tard</button>
            </div>
          )}
        </div>
        <button type="button" onClick={later} aria-label="Masquer" className="rounded-full p-1 text-navy/50 hover:bg-cream"><X size={18} /></button>
      </div>
      {open && <div className="mt-4"><InstallGuide compact /></div>}
    </div>
  );
}
