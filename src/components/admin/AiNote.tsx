"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";

/** Bouton « Analyse de l'IA » : affiche le texte renvoyé par l'action. */
export function AiNote({ run, label = "Analyse de l'IA" }: { run: () => Promise<{ ok: boolean; message?: string; error?: string }>; label?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await run(); setText(r.ok ? r.message ?? "" : null); setError(r.ok ? null : r.error ?? "Erreur"); })} className="inline-flex items-center gap-2 rounded-full bg-ia px-4 py-2 text-sm font-semibold text-white hover:bg-ia-dark disabled:opacity-60">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-dark">{error}</p>}
      {text && <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-ia-light/60 p-4 text-sm text-navy">{text}</div>}
    </div>
  );
}
