"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Download, MoreVertical, PlusSquare, Share } from "lucide-react";
import { useInstall } from "./InstallApp";
import { installEnv, type InstallEnv } from "@/lib/install-env";

/**
 * Installation de l'application JAMAAL (raccourci avec icône sur l'écran d'accueil) : bouton direct sur
 * Android, mode d'emploi illustré sur iPhone, et sortie du navigateur intégré de WhatsApp / Instagram.
 */
export function InstallGuide({ next = "/admin/login", compact = false }: { next?: string; compact?: boolean }) {
  const { evt, installed, clear } = useInstall();
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const e = installEnv(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    queueMicrotask(() => setEnv(e));
  }, []);

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice.catch(() => ({ outcome: "dismissed" }));
    if (choice.outcome === "accepted") setDone(true);
    clear();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const step = "flex items-start gap-3 rounded-2xl bg-cream/70 p-3 text-left text-sm text-navy";
  const num = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white";

  if (env === null) return <div className="h-24" aria-hidden="true" />;
  if (installed || done)
    return (
      <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-900">
        <CheckCircle2 className="mx-auto" size={28} />
        <p className="mt-2 font-semibold">L&apos;application JAMAAL est sur votre téléphone.</p>
        <p className="mt-1">Ouvrez-la avec l&apos;icône JAMAAL de votre écran d&apos;accueil.</p>
        {!compact && <Link href={next} className="mt-4 inline-block rounded-full bg-navy px-6 py-3 font-semibold text-white">Continuer</Link>}
      </div>
    );

  return (
    <div className="space-y-3">
      {evt ? (
        <button type="button" onClick={install} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-dark px-6 py-4 text-base font-semibold text-white shadow-lg hover:opacity-90">
          <Download size={20} /> Installer JAMAAL sur mon téléphone
        </button>
      ) : env === "in-app" ? (
        <div className="space-y-2">
          <p className="rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-900">Vous êtes dans WhatsApp (ou Instagram) : l&apos;installation n&apos;y est pas possible. Ouvrez cette page dans votre navigateur.</p>
          <div className={step}><span className={num}>1</span><span>Touchez <MoreVertical size={14} className="inline align-[-2px]" /> ou <strong>⋯</strong> en haut de l&apos;écran, puis <strong>« Ouvrir dans le navigateur »</strong> (Chrome ou Safari).</span></div>
          <div className={step}><span className={num}>2</span><span>Sinon, copiez le lien et collez-le dans Chrome (Android) ou Safari (iPhone).</span></div>
          <button type="button" onClick={copy} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-navy hover:bg-cream">
            <Copy size={16} /> {copied ? "Lien copié !" : "Copier le lien"}
          </button>
        </div>
      ) : env === "ios-safari" || env === "ios-other" ? (
        <div className="space-y-2">
          {env === "ios-other" && <p className="rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-900">Sur iPhone, l&apos;installation se fait depuis <strong>Safari</strong> : ouvrez ce lien dans Safari.</p>}
          <div className={step}><span className={num}>1</span><span>Touchez <Share size={15} className="inline align-[-3px]" /> <strong>Partager</strong> (en bas de l&apos;écran dans Safari).</span></div>
          <div className={step}><span className={num}>2</span><span>Faites défiler et choisissez <PlusSquare size={15} className="inline align-[-3px]" /> <strong>« Sur l&apos;écran d&apos;accueil »</strong>.</span></div>
          <div className={step}><span className={num}>3</span><span>Touchez <strong>Ajouter</strong> : l&apos;icône JAMAAL apparaît avec vos applications.</span></div>
          {env === "ios-other" && (
            <button type="button" onClick={copy} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-navy hover:bg-cream">
              <Copy size={16} /> {copied ? "Lien copié : collez-le dans Safari" : "Copier le lien pour Safari"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className={step}><span className={num}>1</span><span>Dans <strong>Chrome</strong>, touchez le menu <MoreVertical size={14} className="inline align-[-2px]" /> en haut à droite.</span></div>
          <div className={step}><span className={num}>2</span><span>Choisissez <strong>« Installer l&apos;application »</strong> ou <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.</span></div>
          <div className={step}><span className={num}>3</span><span>Confirmez : l&apos;icône JAMAAL apparaît sur votre écran d&apos;accueil.</span></div>
        </div>
      )}
      {!compact && (
        <Link href={next} className="block rounded-full border border-navy/20 px-6 py-3 text-center text-sm font-semibold text-navy hover:bg-cream">
          {next.startsWith("/admin/reset-password") ? "Activer mon espace (choisir mon mot de passe)" : "Ouvrir mon espace JAMAAL"}
        </Link>
      )}
    </div>
  );
}
