"use client";

import { useActionState } from "react";
import { changeOwnPassword, type ChangePasswordState } from "@/lib/actions/account";

const initial: ChangePasswordState = { ok: false };
const field = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-dark focus:ring-4 focus:ring-rose/10";

/** Formulaire générique de changement de mot de passe, utilisable par n'importe quel compte connecté. */
export function ChangePasswordForm({ viaLink = false }: { viaLink?: boolean }) {
  const [state, action, pending] = useActionState(changeOwnPassword, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {viaLink ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 sm:col-span-2">Vous êtes connecté par votre lien WhatsApp : choisissez directement votre mot de passe, sans l&apos;ancien.</p>
      ) : (
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">
          Mot de passe actuel
          <input type="password" name="currentPassword" required autoComplete="current-password" className={field} />
        </label>
      )}
      <label className="text-xs font-semibold text-navy/85">
        Nouveau mot de passe
        <input type="password" name="newPassword" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      <label className="text-xs font-semibold text-navy/85">
        Confirmer le nouveau mot de passe
        <input type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-2 text-sm text-rose-dark sm:col-span-2">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 sm:col-span-2">Mot de passe modifié.</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
