"use client";

import { useActionState } from "react";
import { updateLivreurWallet, type LivreurWalletState } from "@/lib/actions/delivery";

const initial: LivreurWalletState = { ok: false };

export function LivreurWalletForm({ provider, number }: { provider: string | null; number: string | null }) {
  const [state, action, pending] = useActionState(updateLivreurWallet, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-ink">
        Wallet
        <select name="walletProvider" defaultValue={provider ?? "WAVE"} className="mt-1.5 block rounded-xl border border-line px-3 py-2.5 text-[15px]">
          <option value="WAVE">Wave</option>
          <option value="ORANGE_MONEY">Orange Money</option>
        </select>
      </label>
      <label className="min-w-0 flex-1 text-sm font-medium text-ink">
        Numéro
        <input name="walletNumber" defaultValue={number ?? ""} inputMode="tel" placeholder="77 123 45 67" className="mt-1.5 block w-full rounded-xl border border-line px-3 py-2.5 text-[15px]" />
      </label>
      <button disabled={pending} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">{pending ? "…" : "Enregistrer"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="w-full text-sm text-emerald-800">Wallet enregistré.</p>}
    </form>
  );
}
