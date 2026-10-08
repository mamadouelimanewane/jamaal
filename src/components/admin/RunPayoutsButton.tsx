"use client";

import { useActionState } from "react";
import { runPendingPayoutsAction, type PayoutActionState } from "@/lib/actions/payouts";

const initial: PayoutActionState = { ok: false };

export function RunPayoutsButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(runPendingPayoutsAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending || disabled} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50">
        {pending ? "Versement en cours…" : "Verser maintenant les commissions en attente"}
      </button>
      {state.message && <span role="status" className="text-sm font-medium text-emerald-800">{state.message}</span>}
      {state.error && <span role="alert" className="text-sm font-medium text-red-700">{state.error}</span>}
    </form>
  );
}
