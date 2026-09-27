"use client";

import { useTransition } from "react";
import { livreurUpdateOrderStatus } from "@/lib/actions/orders";
import { formatPrice } from "@/lib/currency";
import type { OrderStatus } from "@prisma/client";

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  EN_ATTENTE: "CONFIRMEE",
  CONFIRMEE: "EXPEDIEE",
  EXPEDIEE: "LIVREE",
};

const nextLabel: Partial<Record<OrderStatus, string>> = {
  EN_ATTENTE: "Confirmer la prise en charge",
  CONFIRMEE: "Marquer comme expédiée",
  EXPEDIEE: "Marquer comme livrée",
};

export function LivreurOrderRow({
  id,
  customerName,
  customerPhone,
  address,
  total,
  status,
}: {
  id: string;
  customerName: string;
  customerPhone: string | null;
  address: string | null;
  total: number;
  status: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const next = nextStatus[status];

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-navy">{customerName}</p>
        <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-navy">{status}</span>
      </div>
      <p className="mt-1 text-xs text-navy/60">{address ?? "Adresse non renseignée"}</p>
      <p className="mt-1 text-sm font-semibold text-navy">{formatPrice(total)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {customerPhone && (
          <a
            href={`https://wa.me/${customerPhone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-emerald-700"
          >
            WhatsApp client
          </a>
        )}
        {next && (
          <button
            disabled={isPending}
            onClick={() => startTransition(() => livreurUpdateOrderStatus(id, next))}
            className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60"
          >
            {isPending ? "…" : nextLabel[status]}
          </button>
        )}
      </div>
    </li>
  );
}
