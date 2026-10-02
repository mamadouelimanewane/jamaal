"use client";

import { useActionState } from "react";
import { submitApplication, type ApplicationState } from "@/lib/actions/applications";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

const initial: ApplicationState = { ok: false };

const input =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:ring-4 focus:ring-rose/10";
const label = "text-xs font-semibold uppercase tracking-wide text-navy/60";

export function ApplicationForm({ sponsorCode = "" }: { sponsorCode?: string }) {
  const [state, action, pending] = useActionState(submitApplication, initial);

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="font-serif-display text-2xl text-navy">Merci pour votre candidature !</p>
        <p className="mt-3 text-sm leading-relaxed text-navy/70">
          Notre équipe étudie votre demande et vous contacte sur WhatsApp ou par e-mail très
          prochainement. Si elle est acceptée, vous recevrez un lien pour activer votre espace revendeur.
        </p>
        {state.applicant && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-semibold text-navy">Gagnez du temps : prévenez l&apos;équipe sur WhatsApp</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {WHATSAPP_CONTACTS.map((c) => (
                <a
                  key={c.number}
                  href={whatsappLink(
                    c.number,
                    `Bonjour JAMAAL, je viens de postuler pour devenir revendeur·se. Nom : ${state.applicant!.name} — Ville : ${state.applicant!.city} — Téléphone : ${state.applicant!.phone}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  WhatsApp {c.display}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      {/* Honeypot anti-robots : invisible pour les humains */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="name" className={label}>Nom complet *</label>
        <input id="name" name="name" required maxLength={100} autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="email" className={label}>E-mail *</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="phone" className={label}>Numéro WhatsApp *</label>
        <input id="phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+221 77 000 00 00" className={input} />
      </div>
      <div>
        <label htmlFor="city" className={label}>Ville *</label>
        <input id="city" name="city" required maxLength={80} autoComplete="address-level2" className={input} />
      </div>
      <div>
        <label htmlFor="country" className={label}>Pays</label>
        <input id="country" name="country" defaultValue="Sénégal" maxLength={60} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="experience" className={label}>Expérience en vente (facultatif)</label>
        <textarea id="experience" name="experience" rows={2} maxLength={500} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="motivation" className={label}>Pourquoi souhaitez-vous devenir revendeur·se ? (facultatif)</label>
        <textarea id="motivation" name="motivation" rows={3} maxLength={1000} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="sponsorCode" className={label}>Code de parrainage (facultatif)</label>
        <input id="sponsorCode" name="sponsorCode" defaultValue={sponsorCode} maxLength={48} placeholder="ex. aminata" className={input} />
      </div>

      <label className="flex items-start gap-3 text-sm text-navy/75 sm:col-span-2">
        <input type="checkbox" name="acceptTerms" required className="mt-1 h-4 w-4 accent-[#1d2f4f]" />
        J&apos;accepte d&apos;être recontacté·e par l&apos;équipe JAMAAL au sujet de ma candidature.
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark sm:col-span-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Envoi…" : "Envoyer ma candidature"}
      </button>
    </form>
  );
}
