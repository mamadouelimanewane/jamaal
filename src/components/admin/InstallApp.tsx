"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** État d'installation de l'application (Android / ordinateur : invite du navigateur ; iPhone : mode d'emploi). */
export function useInstall() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    queueMicrotask(() => {
      setInstalled(standalone);
      setIos(isIos);
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return { evt, ios, installed, clear: () => setEvt(null) };
}

/**
 * Bouton « Télécharger l'application » de la barre du haut. Toujours visible tant que l'application n'est pas
 * installée : installation directe quand le navigateur le permet, sinon le mode d'emploi (iPhone, autres navigateurs).
 */
export function InstallAppButton({ variant = "button", compact = false }: { variant?: "button" | "menu"; compact?: boolean }) {
  const { evt, ios, installed, clear } = useInstall();
  const [help, setHelp] = useState(false);
  if (installed) return null;

  const click = () => {
    if (evt) void evt.prompt().then(clear);
    else setHelp(true);
  };

  return (
    <>
      {variant === "menu" ? (
        <button type="button" onClick={click} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-cream">
          <Download size={16} /> Télécharger l&apos;application
        </button>
      ) : (
        <button
          type="button"
          onClick={click}
          title="Télécharger l'application"
          aria-label="Télécharger l'application"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 py-2 text-sm font-semibold text-navy transition hover:bg-cream"
        >
          <Download size={16} /> <span className={compact ? "hidden xl:inline" : ""}>Télécharger l&apos;application</span>
        </button>
      )}
      {help && (
        <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/50 p-4 sm:items-center" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-sm text-navy shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <p id="install-title" className="font-serif-display text-lg font-semibold">Installer JAMAAL</p>
              <button type="button" onClick={() => setHelp(false)} aria-label="Fermer" className="rounded-lg p-1 hover:bg-cream"><X size={18} /></button>
            </div>
            {ios ? (
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Ouvrez ce site dans <strong>Safari</strong>.</li>
                <li>Touchez <Share size={14} className="inline align-[-2px]" /> <strong>Partager</strong> en bas de l&apos;écran.</li>
                <li>Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.</li>
              </ol>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Ouvrez ce site dans <strong>Chrome</strong> (téléphone Android ou ordinateur).</li>
                <li>Touchez le menu <strong>⋮</strong> en haut à droite.</li>
                <li>Choisissez <strong>« Installer l&apos;application »</strong> ou <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.</li>
              </ol>
            )}
            <p className="mt-3 text-xs text-navy/70">JAMAAL s&apos;ouvre ensuite comme une application, avec son icône, sans passer par le navigateur.</p>
          </div>
        </div>
      )}
    </>
  );
}
