"use client";

import { useState, useTransition } from "react";
import { payLivreursAction } from "@/lib/actions/delivery";

export function PayLivreursButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending || disabled} onClick={() => start(async () => { const r = await payLivreursAction(); setMsg(`${r.sent ?? 0} versement(s) envoyé(s).`); })} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
        {pending ? "Versement…" : "Verser les parts en attente"}
      </button>
      {msg && <span role="status" className="text-sm text-emerald-800">{msg}</span>}
    </div>
  );
}
