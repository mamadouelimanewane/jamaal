"use client";

import { useActionState, useState, useTransition } from "react";
import { reservationArrivedAction, reservationCancelAction, reservationDepositReceivedAction, saveReservationSettingsAction, type ReservationActionResult } from "@/lib/actions/reservations";
import type { ReservationSettings } from "@/lib/reservation";

/** Boutons d'une réservation : acompte reçu, produit arrivé, annulation. */
export function ReservationActions({ orderId, status, canServe, notifyUrl }: { orderId: string; status: string; canServe: boolean; notifyUrl?: string | null }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ReservationActionResult | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const run = (fn: (id: string) => Promise<ReservationActionResult>) =>
    start(async () => {
      setRes(await fn(orderId));
      setConfirmCancel(false);
    });

  const btn = "rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "DISPONIBLE" && notifyUrl && (
          <a href={notifyUrl} target="_blank" rel="noopener noreferrer" className={`${btn} border border-[#128C4B] text-[#128C4B] hover:bg-[#128C4B] hover:text-white`}>Prévenir sur WhatsApp</a>
        )}
        {status === "ACOMPTE_ATTENDU" && (
          <button type="button" disabled={pending} onClick={() => run(reservationDepositReceivedAction)} className={`${btn} border border-navy text-navy hover:bg-navy hover:text-white`}>Acompte reçu</button>
        )}
        {status === "RESERVEE" && (
          <button type="button" disabled={pending || !canServe} title={canServe ? undefined : "Stock insuffisant : réceptionnez d'abord la marchandise"} onClick={() => run(reservationArrivedAction)} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>
            Produit arrivé : servir et prévenir
          </button>
        )}
        {["ACOMPTE_ATTENDU", "RESERVEE", "DISPONIBLE"].includes(status) &&
          (confirmCancel ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(reservationCancelAction)} className={`${btn} bg-red-700 text-white`}>Confirmer l&apos;annulation</button>
              <button type="button" onClick={() => setConfirmCancel(false)} className={`${btn} text-navy/70`}>Non</button>
            </>
          ) : (
            <button type="button" disabled={pending} onClick={() => setConfirmCancel(true)} className={`${btn} text-red-700 hover:underline`}>Annuler</button>
          ))}
      </div>
      {res && (
        <p role={res.ok ? "status" : "alert"} className={`max-w-sm text-right text-xs ${res.ok ? "text-emerald-800" : "text-rose-dark"}`}>
          {res.ok ? res.message : res.error}
          {res.whatsappUrl && (
            <>
              {" "}
              <a href={res.whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#128C4B] underline">Envoyer le message WhatsApp</a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Réglages : acompte, délai, remboursement, activation. */
export function ReservationSettingsForm({ settings }: { settings: ReservationSettings }) {
  const [state, action, pending] = useActionState(saveReservationSettingsAction, { ok: false } as ReservationActionResult);
  const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Proposer « Réserver » sur les formats en rupture
      </label>
      <label className="text-xs font-medium text-navy/85">Acompte (% du prix des produits)
        <input name="depositPercent" type="number" min={10} max={100} step={1} defaultValue={settings.depositPercent} required className={field} />
      </label>
      <label className="text-xs font-medium text-navy/85">Délai annoncé au client
        <input name="delayLabel" defaultValue={settings.delayLabel} maxLength={60} required placeholder="15 à 21 jours" className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
        <input type="checkbox" name="refundable" defaultChecked={settings.refundable} /> Acompte remboursé si le client annule avant l&apos;arrivée du produit
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer"}</button>
        {state.message && <span role="status" className="text-sm text-emerald-800">{state.message}</span>}
        {state.error && <span role="alert" className="text-sm text-rose-dark">{state.error}</span>}
      </div>
    </form>
  );
}
