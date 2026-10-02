"use client";

import { useActionState } from "react";
import { submitContactMessage, type ContactState } from "@/lib/actions/contact-messages";

const initial: ContactState = { ok: false };
const field = "rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:ring-4 focus:ring-rose/10";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactMessage, initial);

  if (state.ok) {
    return (
      <p role="status" className="mt-8 rounded-2xl border border-line bg-white p-6 text-sm text-navy">
        Merci, votre message a bien été envoyé. Nous vous répondons rapidement.
      </p>
    );
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {/* Honeypot anti-robots : invisible pour les humains */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input required name="name" maxLength={100} autoComplete="name" placeholder="Votre nom" aria-label="Votre nom" className={field} />
      <input required name="email" type="email" maxLength={254} autoComplete="email" placeholder="Votre e-mail" aria-label="Votre e-mail" className={field} />
      <textarea required name="message" rows={5} minLength={5} maxLength={2000} placeholder="Votre message" aria-label="Votre message" className={field} />
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
