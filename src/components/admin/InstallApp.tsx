"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Invite à installer l'application sur l'écran d'accueil (Android : bouton ; iPhone : mode d'emploi). */
export function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;
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

  if (installed || (!evt && !ios)) return null;

  return (
    <div className="mx-1 rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-white/80">
      <p className="flex items-center gap-2 font-semibold text-white"><Download size={14} /> Installer l&apos;application</p>
      {evt ? (
        <>
          <p className="mt-1 text-white/75">Ajoutez JAMAAL à votre écran d&apos;accueil : il s&apos;ouvre comme une application.</p>
          <button
            type="button"
            onClick={() => {
              void evt.prompt().then(() => setEvt(null));
            }}
            className="mt-2 rounded-full bg-rose px-3 py-1.5 font-semibold text-navy hover:opacity-90"
          >
            Installer
          </button>
        </>
      ) : (
        <p className="mt-1 text-white/75">
          Sur iPhone : touchez <Share size={12} className="inline" /> puis « Sur l&apos;écran d&apos;accueil ».
        </p>
      )}
    </div>
  );
}
