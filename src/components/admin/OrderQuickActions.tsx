"use client";

import { RowAction } from "@/components/admin/RowAction";
import { quickCancelOrder, quickConfirmOrder, quickMarkPaid } from "@/lib/actions/order-quick";

/** Actions rapides d'une ligne de la liste des commandes : confirmer, paiement reçu, annuler. */
export function OrderQuickActions({ o }: { o: { id: string; status: string; paymentStatus: string; installmentCount: number; isReservation: boolean } }) {
  const done = o.status === "ANNULEE" || o.status === "LIVREE";
  if (done && o.paymentStatus === "PAYE") return <span className="text-xs text-navy/50">—</span>;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {o.status === "EN_ATTENTE" && <RowAction label="Confirmer" run={quickConfirmOrder.bind(null, o.id)} />}
      {o.paymentStatus !== "PAYE" && o.status !== "ANNULEE" && o.installmentCount < 2 && !o.isReservation && (
        <RowAction label="Paiement reçu" run={quickMarkPaid.bind(null, o.id)} confirm={`Confirmer que le paiement de cette commande est bien arrivé sur les comptes JAMAAL ? Les articles sortiront du stock et les commissions seront créditées.`} />
      )}
      {!done && <RowAction label="Annuler" danger run={quickCancelOrder.bind(null, o.id)} confirm="Annuler cette commande ? Le client est prévenu et les commissions sont annulées." />}
    </div>
  );
}
