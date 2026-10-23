"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Repeat } from "lucide-react";
import { subscribeFromOrder } from "@/lib/actions/subscriptions";
import { INTERVALS, intervalLabel } from "@/lib/subscriptions/plan";

/** « Ne tombez plus jamais à court » : réassort automatique depuis la page de commande. */
export function SubscribeOffer({ orderId, discountPct, existingToken }: { orderId: string; discountPct: number; existingToken: string | null }) {
  const [days, setDays] = useState(45);
  const [res, setRes] = useState<{ ok: boolean; message?: string; error?: string; token?: string } | null>(existingToken ? { ok: true, token: existingToken } : null);
  const [pending, start] = useTransition();
  if (res?.ok)
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold"><Repeat size={16} /> Réassort automatique activé</p>
        {res.message && <p className="mt-1">{res.message}</p>}
        {res.token && <Link href={`/abonnement/${res.token}`} className="mt-1 inline-block font-semibold underline">Gérer mon abonnement</Link>}
      </div>
    );
  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/60 p-4 text-left text-sm">
      <p className="flex items-center gap-2 font-semibold text-navy"><Repeat size={16} /> Ne tombez plus jamais à court</p>
      <p className="mt-1 text-navy/75">Recevez ces produits automatiquement, avec <strong>{discountPct} % de remise</strong> à chaque fois. Rappel 3 jours avant, paiement en un clic, pause ou arrêt quand vous voulez.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Fréquence">
        {INTERVALS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1.5 text-xs ${days === d ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}>{intervalLabel(d)}</button>
        ))}
      </div>
      {res?.error && <p role="alert" className="mt-2 text-rose-dark">{res.error}</p>}
      <button type="button" disabled={pending} onClick={() => start(async () => setRes(await subscribeFromOrder(orderId, days)))} className="mt-3 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
        {pending && <Loader2 size={14} className="animate-spin" />} Activer le réassort
      </button>
    </div>
  );
}
