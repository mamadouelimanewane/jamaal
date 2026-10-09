"use client";

import { useActionState } from "react";
import { updateOwnWallet, type WalletState } from "@/lib/actions/reseller-profile";

const initial: WalletState = { ok: false };
const field = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] outline-none focus:border-navy focus:ring-4 focus:ring-navy/10";

/** Wallet de réception des commissions (Wave ou Orange Money). */
export function WalletForm({ provider, number, holder }: { provider: string | null; number: string | null; holder?: string | null }) {
  const [state, action, pending] = useActionState(updateOwnWallet, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-ink">Recevoir mes retraits sur</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {[
            { id: "WAVE", label: "Wave" },
            { id: "ORANGE_MONEY", label: "Orange Money" },
          ].map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[15px] font-medium text-ink has-[:checked]:border-navy has-[:checked]:bg-navy/5">
              <input type="radio" name="walletProvider" value={o.id} defaultChecked={provider === o.id} className="h-4 w-4 accent-[#182845]" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-medium text-ink">
        Numéro du wallet
        <input name="walletNumber" defaultValue={number ?? ""} inputMode="tel" placeholder="77 123 45 67" className={field} />
      </label>
      <label className="text-sm font-medium text-ink">
        Nom du titulaire du compte
        <input name="walletHolderName" defaultValue={holder ?? ""} maxLength={100} autoComplete="name" placeholder="Tel qu'enregistré chez Wave / Orange Money" className={field} />
        <span className="mt-1 block text-xs font-normal text-navy/65">Le compte doit être à votre nom : JAMAAL vérifie ce nom avant le premier versement.</span>
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 sm:col-span-2">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 sm:col-span-2">Compte enregistré : vos retraits y seront envoyés.</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Enregistrement…" : "Enregistrer mon compte"}
      </button>
    </form>
  );
}
