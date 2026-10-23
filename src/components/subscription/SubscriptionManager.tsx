"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { manageSubscription } from "@/lib/actions/subscriptions";
import { INTERVALS, intervalLabel } from "@/lib/subscriptions/plan";

const btn = "inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-50";

/** Actions du client sur son abonnement : fréquence, recevoir maintenant, sauter, pause, arrêt. */
export function SubscriptionManager({ token, status, intervalDays }: { token: string; status: string; intervalDays: number }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const run = (action: Parameters<typeof manageSubscription>[1], value?: number) => {
    setBusy(action);
    start(async () => {
      const r = await manageSubscription(token, action, value);
      setMsg({ ok: r.ok, text: r.message ?? r.error ?? "" });
      setBusy(null);
      router.refresh();
    });
  };
  const spin = (a: string) => pending && busy === a && <Loader2 size={14} className="animate-spin" />;
  if (status === "ANNULE") return <p className="text-sm text-navy/70">Cet abonnement est arrêté. Vous pouvez en créer un nouveau depuis votre prochaine commande.</p>;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy">Fréquence</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTERVALS.map((d) => (
            <button key={d} type="button" disabled={pending} aria-pressed={intervalDays === d} onClick={() => run("interval", d)} className={`rounded-full border px-4 py-2 text-sm ${intervalDays === d ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}>{intervalLabel(d)}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" && <button type="button" disabled={pending} onClick={() => run("now")} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{spin("now")} Recevoir maintenant</button>}
        {status === "ACTIVE" && <button type="button" disabled={pending} onClick={() => run("skip")} className={btn}>{spin("skip")} Sauter la prochaine</button>}
        {status === "ACTIVE" ? <button type="button" disabled={pending} onClick={() => run("pause")} className={btn}>{spin("pause")} Mettre en pause</button> : <button type="button" disabled={pending} onClick={() => run("resume")} className={btn}>{spin("resume")} Reprendre</button>}
        <button type="button" disabled={pending} onClick={() => { if (window.confirm("Arrêter définitivement ce réassort ?")) run("cancel"); }} className="rounded-full px-5 py-2.5 text-sm font-semibold text-rose-dark hover:bg-rose/10 disabled:opacity-50">Arrêter</button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-800" : "text-rose-dark"}`}>{msg.text}</p>}
    </div>
  );
}
