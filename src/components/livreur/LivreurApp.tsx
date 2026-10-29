"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useInstall } from "@/components/admin/InstallApp";
import { InstallGuide } from "@/components/admin/InstallGuide";
import { installEnv, type InstallEnv } from "@/lib/install-env";
import { SignupWizard } from "./SignupWizard";
import { ListenButton } from "./Listen";

export { prettyPhone } from "./SignupWizard";

/**
 * Application JAMAAL Livreur, à l'adresse d'inscription des livreurs. Pensée pour être comprise sans lire
 * beaucoup : grandes images, couleurs, une seule chose à faire par écran, consignes lues à voix haute.
 * - Téléphone, dans le navigateur : 1. installer l'icône, 2. s'inscrire (numéro WhatsApp = identifiant), 3. validation.
 * - Ordinateur : code QR pour ouvrir la page sur le téléphone.
 * - Ouverte depuis l'icône : inscription ou connexion ; un livreur connecté part sur ses livraisons.
 */
export function LivreurApp({ loggedIn, initialTab, login }: { loggedIn: boolean; initialTab: "signup" | "login"; login: React.ReactNode }) {
  const { installed } = useInstall();
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [tab, setTab] = useState(initialTab);
  const [url, setUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    const e = installEnv(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    const t = setTimeout(() => {
      setEnv(e);
      setUrl(`${window.location.origin}/livreur`);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (env && installed && loggedIn) router.replace("/admin/mes-livraisons");
  }, [env, installed, loggedIn, router]);

  if (!env) return <div className="h-40" aria-hidden="true" />;
  const mobile = env !== "desktop";

  if (loggedIn && !installed)
    return (
      <div>
        <Hero title="Ouvrez l'application" line="Vos livraisons s'ouvrent seulement avec l'icône JAMAAL Livreur." say="Pour voir vos livraisons, mettez l'icône JAMAAL Livreur sur votre téléphone, puis ouvrez-la." />
        <div className="mt-4 text-left"><InstallGuide next="/admin/livreur" compact appName="JAMAAL Livreur" /></div>
      </div>
    );
  if (loggedIn) return <p className="py-10 text-lg font-bold text-navy">Ouverture de vos livraisons… 🛵</p>;

  return (
    <div>
      {!installed && (
        <>
          <Hero title="Devenez livreur JAMAAL" line="Gagnez de l'argent à chaque livraison, payé sur Wave ou Orange Money." say="Bienvenue. Devenez livreur JAMAAL. Étape un : mettez l'icône sur votre téléphone. Étape deux : inscrivez-vous avec votre numéro WhatsApp. Étape trois : JAMAAL valide votre compte." />
          <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-[13px] font-bold leading-4 text-navy" aria-label="Étapes">
            <li className="rounded-2xl bg-[#EDE9FE] p-2.5"><span className="block text-3xl" aria-hidden="true">📲</span>1. Installer</li>
            <li className="rounded-2xl bg-[#DCFCE7] p-2.5"><span className="block text-3xl" aria-hidden="true">✍️</span>2. S&apos;inscrire</li>
            <li className="rounded-2xl bg-[#FEF3C7] p-2.5"><span className="block text-3xl" aria-hidden="true">✅</span>3. Validation</li>
          </ol>
          {mobile ? (
            <section className="mt-4 rounded-3xl border-2 border-[#6D4AFF] bg-[#F5F3FF] p-4 text-left" aria-labelledby="lv-install-title">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/v2/livreur-192.png" alt="" width={60} height={60} className="rounded-2xl border border-line bg-white" />
                <div>
                  <h2 id="lv-install-title" className="text-lg font-extrabold text-[#4C1D95]">1. Mettez l&apos;icône sur votre téléphone</h2>
                  <p className="text-sm text-navy/75">Gratuit, sans Play Store.</p>
                </div>
              </div>
              <div className="mt-3"><InstallGuide next="/admin/livreur" compact appName="JAMAAL Livreur" /></div>
            </section>
          ) : (
            <section className="mt-4 flex flex-col items-center gap-3 rounded-3xl border-2 border-[#6D4AFF] bg-[#F5F3FF] p-4 sm:flex-row sm:text-left" aria-labelledby="lv-qr-title">
              {url && <QRCodeSVG value={url} size={132} level="M" className="shrink-0 rounded-xl bg-white p-2" aria-label="Code QR de l'inscription livreur" />}
              <div>
                <h2 id="lv-qr-title" className="text-lg font-extrabold text-[#4C1D95]">Ouvrez cette page sur votre téléphone</h2>
                <p className="mt-1 text-sm text-navy/75">Scannez le code avec l&apos;appareil photo : l&apos;application s&apos;installe sur le téléphone. Vous pouvez aussi vous inscrire ici.</p>
              </div>
            </section>
          )}
        </>
      )}
      {installed && <Hero title="JAMAAL Livreur" line="Inscrivez-vous ou connectez-vous." say="Bienvenue dans JAMAAL Livreur. Touchez Je m'inscris si vous êtes nouveau, ou J'ai un compte pour vous connecter." />}

      <div role="tablist" aria-label="Inscription ou connexion" className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" role="tab" aria-selected={tab === "signup"} onClick={() => setTab("signup")} className={`min-h-16 rounded-2xl px-2 text-lg font-extrabold ${tab === "signup" ? "bg-[#15803D] text-white shadow-md" : "bg-cream text-navy"}`}>✍️ {installed ? "Je m'inscris" : "2. Je m'inscris"}</button>
        <button type="button" role="tab" aria-selected={tab === "login"} onClick={() => setTab("login")} className={`min-h-16 rounded-2xl px-2 text-lg font-extrabold ${tab === "login" ? "bg-navy text-white shadow-md" : "bg-cream text-navy"}`}>🔑 J&apos;ai un compte</button>
      </div>
      {tab === "signup" ? <SignupWizard installed={installed} onLogin={() => setTab("login")} /> : <div className="mt-2 text-left">{login}</div>}
    </div>
  );
}

function Hero({ title, line, say }: { title: string; line: string; say: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d2f4f] via-[#6D4AFF] to-[#BE185D] p-5 text-left text-white">
      <span className="pointer-events-none absolute -right-3 -top-4 text-8xl opacity-25" aria-hidden="true">🛵</span>
      <h1 className="relative text-2xl font-extrabold leading-tight">{title}</h1>
      <p className="relative mt-1 text-base font-semibold text-white/90">{line}</p>
      <div className="relative mt-3"><ListenButton text={say} tone="dark" /></div>
    </div>
  );
}
