"use client";

import { useState, useTransition } from "react";
import { createAccessLink } from "@/lib/actions/user-admin";
import { CopyButton } from "@/components/admin/CopyButton";

/** Génère un lien d'accès à usage unique (7 jours) : la personne choisit elle-même son mot de passe. */
export function AccessLinkButton({ userId, phone, name }: { userId: string; phone?: string | null; name?: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await createAccessLink(userId)))}
        className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-60"
      >
        {pending ? "Génération…" : "Générer un lien d'accès (7 jours)"}
      </button>
      {result?.error && <p role="alert" className="mt-2 text-sm text-rose-dark">{result.error}</p>}
      {result?.url && (
        <div className="mt-3 rounded-xl border border-line bg-cream/50 p-3">
          <p className="break-all font-mono text-xs text-navy">{result.url}</p>
          <div className="mt-2 flex items-center gap-3">
            <CopyButton text={result.url} label="Copier le lien" />
            {phone && phone.replace(/\D/g, "").length >= 9 && (
              <a
                href={`https://wa.me/${(() => { const d = phone.replace(/\D/g, "").replace(/^00/, ""); return d.length === 9 ? `221${d}` : d; })()}?text=${encodeURIComponent(`Bonjour${name ? ` ${name.split(/\s+/)[0]}` : ""}, voici votre lien JAMAAL pour choisir votre mot de passe (valable 7 jours, à usage unique) : ${result.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebe5b]"
              >
                Envoyer par WhatsApp
              </a>
            )}
            <span className="text-xs text-navy/65">À usage unique. Transmettez-le à la personne : elle choisira son mot de passe.</span>
          </div>
        </div>
      )}
    </div>
  );
}
