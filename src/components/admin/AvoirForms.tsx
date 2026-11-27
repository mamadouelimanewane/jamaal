"use client";

import { useState, useTransition } from "react";
import { adjustAvoirAction, payoutAvoirAction } from "@/lib/actions/customer-avoir";

/** Ajustement de l'avoir (motif obligatoire) et versement sur le Wave du client. */
export function AvoirForms({ customerId, balance, phone }: { customerId: string; balance: number; phone: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const field = "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";
  const run = (fn: typeof adjustAvoirAction, fd: FormData, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    start(async () => {
      const r = await fn(customerId, fd);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Fait." } : { ok: false, text: r.error ?? "Erreur." });
    });
  };
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <form action={(fd) => run(adjustAvoirAction, fd)} className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-navy/85">Ajouter (+) ou retirer (−)
          <input name="amount" type="number" step={100} required placeholder="5000 ou -2000" className={`mt-1 block w-32 ${field}`} />
        </label>
        <input name="note" required minLength={3} maxLength={200} placeholder="Motif" className={`${field} min-w-0 flex-1`} />
        <button disabled={pending} className="rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60">Enregistrer</button>
      </form>
      {balance > 0 && (
        <form action={(fd) => run(payoutAvoirAction, fd, `Verser sur le Wave du ${phone} ?`)} className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-navy/85">Verser sur Wave ({phone})
            <input name="amount" type="number" min={100} max={balance} step={1} defaultValue={balance} required className={`mt-1 block w-32 ${field}`} />
          </label>
          <button disabled={pending} className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">Verser</button>
        </form>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs sm:col-span-2 ${msg.ok ? "text-emerald-800" : "text-rose-dark"}`}>{msg.text}</p>}
    </div>
  );
}
