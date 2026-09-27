"use client";

import { useTransition } from "react";
import { updateReturnStatus } from "@/lib/actions/returns";
import type { ReturnStatus } from "@prisma/client";

const statusLabels: Record<ReturnStatus, string> = {
  EN_ATTENTE: "En attente",
  APPROUVE: "Approuvé",
  REMBOURSE: "Remboursé",
  REJETE: "Rejeté",
};

const statusColors: Record<ReturnStatus, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-700",
  APPROUVE: "bg-blue-100 text-blue-700",
  REMBOURSE: "bg-emerald-100 text-emerald-700",
  REJETE: "bg-red-100 text-red-700",
};

const statuses: ReturnStatus[] = ["EN_ATTENTE", "APPROUVE", "REMBOURSE", "REJETE"];

export function ReturnStatusSelect({ id, status }: { id: string; status: ReturnStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateReturnStatus(id, e.target.value as ReturnStatus))}
      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none ${statusColors[status]}`}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {statusLabels[s]}
        </option>
      ))}
    </select>
  );
}
