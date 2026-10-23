"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

/** Petit bouton d'action d'une ligne de tableau (server action), avec confirmation facultative. */
export function RowAction({ label, run, confirm, danger }: { label: string; run: () => Promise<{ ok: boolean; message?: string; error?: string }>; confirm?: string; danger?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await run();
            setMsg(r.ok ? r.message ?? "Fait" : r.error ?? r.message ?? "Erreur");
          });
        }}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${danger ? "border-rose-dark/30 text-rose-dark hover:bg-rose/10" : "border-line text-navy hover:bg-cream"}`}
      >
        {pending && <Loader2 size={12} className="animate-spin" />} {label}
      </button>
      {msg && <span className="mt-0.5 max-w-[12rem] text-[11px] text-navy/70">{msg}</span>}
    </span>
  );
}
