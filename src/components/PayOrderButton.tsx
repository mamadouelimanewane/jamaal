"use client";

import { useEffect, useState } from "react";
import { initiatePayment } from "@/lib/actions/payment";
import { listPaymentOptions } from "@/lib/actions/payment-options";
import type { PaymentProviderId } from "@/lib/payment/types";

/** Relance le paiement d'une commande non payée (Wave / Orange Money). */
export function PayOrderButton({ orderId, label = "Payer" }: { orderId: string; label?: string }) {
  const [options, setOptions] = useState<{ id: PaymentProviderId; label: string }[]>([]);
  const [busy, setBusy] = useState<PaymentProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPaymentOptions()
      .then((opts) => setOptions(opts.filter((o) => o.id !== "cod")))
      .catch(() => setOptions([]));
  }, []);

  if (!options.length) return null;

  async function pay(method: PaymentProviderId) {
    setBusy(method);
    setError(null);
    try {
      const res = await initiatePayment(orderId, method);
      if (res.error) {
        setError(res.error);
        setBusy(null);
      } else if (res.redirect && res.url) window.location.assign(res.url);
      else setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le paiement n'a pas pu démarrer.");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap justify-center gap-3">
        {options.map((o) => (
          <button key={o.id} type="button" disabled={!!busy} onClick={() => pay(o.id)} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60">
            {busy === o.id ? "Redirection…" : `${label} avec ${o.label}`}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-dark">{error}</p>}
    </div>
  );
}
