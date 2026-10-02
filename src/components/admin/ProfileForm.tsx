"use client";

import { useActionState } from "react";
import { updateOwnProfile, type ProfileState } from "@/lib/actions/reseller-profile";

const initial: ProfileState = { ok: false };
const field = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-dark focus:ring-4 focus:ring-rose/10";

export function ProfileForm({ name, city, whatsapp }: { name: string; city: string; whatsapp: string }) {
  const [state, action, pending] = useActionState(updateOwnProfile, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-navy/70 sm:col-span-2">
        Nom affiché
        <input name="name" defaultValue={name} required maxLength={100} className={field} />
      </label>
      <label className="text-xs font-semibold text-navy/70">
        Ville
        <input name="city" defaultValue={city} required maxLength={80} className={field} />
      </label>
      <label className="text-xs font-semibold text-navy/70">
        Numéro WhatsApp
        <input name="whatsapp" defaultValue={whatsapp} required placeholder="+221 77 000 00 00" className={field} />
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-2 text-sm text-rose-dark sm:col-span-2">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 sm:col-span-2">Profil mis à jour.</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
