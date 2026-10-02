"use client";

import { useState, useTransition } from "react";
import { approveApplication, rejectApplication, type ApproveResult } from "@/lib/actions/applications";

/**
 * Reste monté pour toutes les candidatures (même acceptées) : après « Accepter », Next.js
 * rafraîchit la liste et le statut passe à ACCEPTEE ; le lien d'activation (état local) doit
 * rester affiché jusqu'à ce que l'admin l'ait copié.
 */
export function ApplicationActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ApproveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (result?.ok && result.activationUrl) {
    return (
      <div className="max-w-xs text-xs">
        <p className="font-semibold text-emerald-700">
          Acceptée{result.emailed ? " — e-mail d'activation envoyé" : ""}.
        </p>
        <p className="mt-1 text-navy/60">Lien d&apos;activation (7 jours) à transmettre sur WhatsApp :</p>
        <input readOnly value={result.activationUrl} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-line bg-cream px-2 py-1.5" />
        <button
          type="button"
          className="mt-1 font-semibold text-rose-dark hover:underline"
          onClick={() => {
            void navigator.clipboard.writeText(result.activationUrl!).then(() => setCopied(true));
          }}
        >
          {copied ? "Copié ✓" : "Copier le lien"}
        </button>
      </div>
    );
  }

  if (status !== "NOUVELLE") return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const r = await approveApplication(id);
              if (r.ok) setResult(r);
              else setError(r.error ?? "Erreur");
            })
          }
        >
          Accepter
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream disabled:opacity-50"
          onClick={() => {
            if (!confirm("Refuser cette candidature ?")) return;
            start(async () => {
              const r = await rejectApplication(id);
              if (!r.ok) setError(r.error ?? "Erreur");
            });
          }}
        >
          Refuser
        </button>
      </div>
      {error && <p className="text-xs text-rose-dark">{error}</p>}
    </div>
  );
}
