"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePrice, useT } from "@/components/i18n/LocaleProvider";
import { cancelMyReservation } from "@/lib/actions/order-change";

/**
 * Annuler sa réservation : la somme payée est rendue tout de suite dans l'avoir JAMAAL du client ; gratuit pendant le
 * délai annoncé, ensuite la pénalité est retenue. Les montants sont affichés avant de confirmer.
 */
export function CancelReservation({ orderId, paid, penalty, freeUntil, penaltyPercent }: { orderId: string; paid: number; penalty: number; freeUntil: string; penaltyPercent: number }) {
  const t = useT();
  const formatPrice = usePrice();
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const until = new Date(freeUntil);
  const refund = paid - penalty;

  const terms =
    paid <= 0
      ? t("Rien n'a encore été payé : l'annulation est sans frais.")
      : penalty > 0
        ? t("Si vous annulez maintenant, {v0} ({v1} % de la somme payée) sont retenus et {v2} vous sont rendus tout de suite dans votre avoir JAMAAL.", { v0: formatPrice(penalty), v1: penaltyPercent, v2: formatPrice(refund) })
        : t("Annulation gratuite jusqu'au {v0} : les {v1} payés vous sont rendus tout de suite dans votre avoir JAMAAL.", { v0: until.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }), v1: formatPrice(paid) });

  return (
    <div className="mt-6 rounded-xl border border-line bg-white px-4 py-3 text-left text-sm">
      <p className="font-semibold text-navy">{t("Annuler ma réservation")}</p>
      <p className="mt-1 text-xs text-navy/75">{terms}</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-xs ${msg.ok ? "text-emerald-800" : "text-rose-dark"}`}>{msg.text}</p>}
      {!msg?.ok &&
        (ask ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelMyReservation(orderId);
                  setMsg(r.ok ? { ok: true, text: t("Réservation annulée. Vous recevez un message WhatsApp avec votre avoir.") } : { ok: false, text: t(r.error) });
                  if (r.ok) router.refresh();
                })
              }
              className="rounded-full bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? t("Annulation…") : t("Oui, annuler")}
            </button>
            <button type="button" onClick={() => setAsk(false)} className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-navy">
              {t("Non, garder ma réservation")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAsk(true)} className="mt-2 text-xs font-semibold text-red-700 underline-offset-2 hover:underline">
            {t("Annuler ma réservation")}
          </button>
        ))}
    </div>
  );
}
