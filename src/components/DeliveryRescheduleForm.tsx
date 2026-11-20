"use client";

import { useState, useTransition } from "react";
import { requestDeliveryReschedule } from "@/lib/actions/delivery";

export function DeliveryRescheduleForm({ orderId }: { orderId: string }) {
  const [suffix, setSuffix] = useState("");
  const [slot, setSlot] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit() {
    if (suffix.length !== 4 || !slot) {
      setMessage("Indiquez les quatre derniers chiffres du téléphone de la commande et un créneau.");
      return;
    }
    const date = new Date(slot);
    if (!Number.isFinite(date.getTime())) {
      setMessage("Le créneau indiqué n’est pas valide.");
      return;
    }
    startTransition(async () => {
      const result = await requestDeliveryReschedule(orderId, suffix, date.toISOString());
      if (result.ok) {
        setSent(true);
        setMessage("Votre demande a été transmise à Jamaal. Le créneau reste à confirmer par l’équipe.");
      } else setMessage(result.error ?? "La demande n’a pas pu être envoyée.");
    });
  }
  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-semibold text-navy">Besoin d’un autre créneau ?</h2>
      <p className="mt-1 text-sm text-navy/70">Proposez une date et une heure. Jamaal vous confirmera le changement.</p>
      {!sent && <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <label className="text-xs font-semibold text-navy/75">4 derniers chiffres du téléphone
          <input value={suffix} onChange={(e) => setSuffix(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" maxLength={4} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Ex. 4625" />
        </label>
        <label className="text-xs font-semibold text-navy/75">Créneau souhaité (heure de votre appareil)
          <input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={submit} disabled={pending} className="rounded-full bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Envoi…" : "Demander ce créneau"}</button>
      </div>}
      {message && <p role="status" className={`mt-3 text-sm ${sent ? "text-emerald-800" : "text-navy/75"}`}>{message}</p>}
    </section>
  );
}
