"use client";

import { useActionState, useState } from "react";
import { registerCustomer, loginCustomer, type RegisterState, type LoginState } from "@/lib/actions/customer-auth";

const field = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-dark focus:ring-4 focus:ring-rose/10";
const label = "text-xs font-semibold text-navy/85";
const registerInitial: RegisterState = { ok: false };
const loginInitial: LoginState = { ok: false };

/** Connexion ou inscription d'un compte client, par e-mail ou par numéro de téléphone au choix. */
export function CustomerAuthForms() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginState, loginAction, loginPending] = useActionState(loginCustomer, loginInitial);
  const [registerState, registerActionFn, registerPending] = useActionState(registerCustomer, registerInitial);

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="mb-4 flex gap-2 text-sm">
        <button type="button" onClick={() => setMode("login")} className={`rounded-full px-4 py-1.5 font-semibold ${mode === "login" ? "bg-navy text-white" : "text-navy/70 hover:bg-cream"}`}>
          Se connecter
        </button>
        <button type="button" onClick={() => setMode("register")} className={`rounded-full px-4 py-1.5 font-semibold ${mode === "register" ? "bg-navy text-white" : "text-navy/70 hover:bg-cream"}`}>
          Créer un compte
        </button>
      </div>

      {mode === "login" ? (
        <form action={loginAction} className="grid gap-4">
          <label className={label}>
            E-mail ou téléphone
            <input name="login" required className={field} />
          </label>
          <label className={label}>
            Mot de passe
            <input type="password" name="password" required className={field} />
          </label>
          {loginState.error && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-2 text-sm text-rose-dark">{loginState.error}</p>}
          <button type="submit" disabled={loginPending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60 sm:w-fit">
            {loginPending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      ) : (
        <form action={registerActionFn} className="grid gap-4">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <label className={label}>
            Nom
            <input name="name" required maxLength={100} className={field} />
          </label>
          <label className={label}>
            E-mail ou téléphone
            <input name="login" required placeholder="vous@exemple.com ou 77 000 00 00" className={field} />
          </label>
          <label className={label}>
            Mot de passe
            <input type="password" name="password" required minLength={8} className={field} />
          </label>
          <label className={label}>
            Confirmer le mot de passe
            <input type="password" name="confirmPassword" required minLength={8} className={field} />
          </label>
          {registerState.error && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-2 text-sm text-rose-dark">{registerState.error}</p>}
          <button type="submit" disabled={registerPending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60 sm:w-fit">
            {registerPending ? "Création…" : "Créer mon compte"}
          </button>
        </form>
      )}
    </div>
  );
}
