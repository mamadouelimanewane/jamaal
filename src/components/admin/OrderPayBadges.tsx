import { isPayLinkOrder } from "@/lib/pay-link";

/** Pastilles d'une ligne de commande : paiement en plusieurs fois, lien de paiement en attente. */
export function OrderPayBadges({ o }: { o: { installmentCount: number; installmentsPaid: number; paymentStatus: string; paymentMethod: string; channel: string; status: string } }) {
  const parts = o.installmentCount >= 2;
  const waiting = o.paymentStatus !== "PAYE" && o.status !== "ANNULEE";
  return (
    <>
      {parts && (
        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
          En {o.installmentCount} fois{waiting ? ` · ${o.installmentsPaid}/${o.installmentCount}` : ""}
        </span>
      )}
      {!parts && waiting && isPayLinkOrder(o) && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Lien de paiement envoyé</span>}
    </>
  );
}
