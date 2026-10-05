"use client";

import { useState, useTransition } from "react";
import { createResellerAccess, createResellerLoginLink, type AccessResult, type LoginLinkResult } from "@/lib/actions/reseller-access";
import { CopyButton } from "@/components/admin/CopyButton";

/**
 * Colonne « Compte portail » : crée l'accès d'un revendeur sans compte, ou renouvelle son lien
 * d'activation. Le résultat reste affiché (état local) pour que l'admin puisse copier le lien.
 */
export function ResellerAccess({ consultantId, userEmail, defaultEmail, whatsapp, name }: { consultantId: string; userEmail: string | null; defaultEmail: string; whatsapp: string; name: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [result, setResult] = useState<AccessResult | null>(null);
  const [login, setLogin] = useState<LoginLinkResult | null>(null);

  if (result?.ok && result.activationUrl) {
    return (
      <div className="max-w-[16rem] text-xs">
        <p className="font-semibold text-emerald-700">{result.created ? "Accès créé." : "Nouveau lien prêt."}</p>
        <p className="mt-1 text-navy/60">Lien d&apos;activation (7 jours), à envoyer sur WhatsApp :</p>
        <input readOnly value={result.activationUrl} className="mt-1 w-full rounded-lg border border-line bg-cream px-2 py-1.5" />
        <div className="mt-1.5"><CopyButton text={result.activationUrl} label="Copier le lien" /></div>
      </div>
    );
  }

  // wa.me attend le numéro en chiffres, sans « + » ni « 00 » (ex. 0039… → 39…)
  const phone = whatsapp.replace(/\D/g, "").replace(/^00/, "");
  const loginMsg = login?.loginUrl ? `Bonjour ${name}, voici votre lien pour ouvrir votre espace JAMAAL sans mot de passe (valable 24 h, usage unique) : ${login.loginUrl}` : "";

  const run = (withEmail?: string) =>
    start(async () => {
      setResult(await createResellerAccess(consultantId, withEmail));
    });

  return (
    <div className="max-w-[16rem] text-xs">
      {userEmail ? (
        <>
          <span className="font-semibold text-green-700">{userEmail}</span>
          <button type="button" disabled={pending} onClick={() => run()} className="mt-1 block font-semibold text-rose-dark hover:underline disabled:opacity-50">
            {pending ? "…" : "Nouveau lien d'activation"}
          </button>
          {login?.loginUrl ? (
            <div className="mt-2 rounded-lg border border-line bg-cream p-2">
              <p className="text-navy/60">Lien de connexion (24 h, usage unique) :</p>
              <input readOnly value={login.loginUrl} className="mt-1 w-full rounded border border-line bg-white px-2 py-1" />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <CopyButton text={login.loginUrl} label="Copier" />
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(loginMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[#25D366] px-3 py-1.5 font-semibold text-white hover:opacity-90"
                >
                  Envoyer sur WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => setLogin(await createResellerLoginLink(consultantId)))}
              className="mt-1 block font-semibold text-[#1f9d55] hover:underline disabled:opacity-50"
            >
              Lien de connexion WhatsApp
            </button>
          )}
          {login && !login.ok && <p className="mt-1 text-rose-dark">{login.error}</p>}
        </>
      ) : open ? (
        <div className="flex flex-col gap-1.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail du revendeur"
            className="w-full rounded-lg border border-line px-2 py-1.5"
          />
          <div className="flex gap-2">
            <button type="button" disabled={pending || !email} onClick={() => run(email)} className="rounded-full bg-navy px-3 py-1.5 font-semibold text-white hover:bg-navy-light disabled:opacity-50">
              {pending ? "…" : "Créer l'accès"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="font-semibold text-navy/60 hover:underline">Annuler</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-rose-dark hover:underline">Créer l&apos;accès</button>
      )}
      {result && !result.ok && <p className="mt-1 text-rose-dark">{result.error}</p>}
    </div>
  );
}
