"use client";

import { useState } from "react";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">Contactez-nous</h1>
      <p className="mt-3 text-sm text-navy/70">
        Une question sur un produit, une commande ou notre réseau de consultant·es ? Écrivez-nous,
        nous vous répondons rapidement.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {WHATSAPP_CONTACTS.map((c) => (
          <a
            key={c.number}
            href={whatsappLink(c.number)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy transition hover:border-rose hover:text-rose-dark"
          >
            WhatsApp {c.display}
          </a>
        ))}
      </div>

      {sent ? (
        <p className="mt-8 rounded-2xl border border-line bg-white p-6 text-sm text-navy">
          Merci, votre message a bien été envoyé.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="mt-8 flex flex-col gap-4"
        >
          <input
            required
            placeholder="Votre nom"
            className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-rose"
          />
          <input
            required
            type="email"
            placeholder="Votre e-mail"
            className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-rose"
          />
          <textarea
            required
            rows={5}
            placeholder="Votre message"
            className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-rose"
          />
          <button
            type="submit"
            className="rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Envoyer
          </button>
        </form>
      )}
    </div>
  );
}
