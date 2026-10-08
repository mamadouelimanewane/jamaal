import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question sur un produit, une commande ou notre réseau de consultant·es ? Écrivez-nous ou contactez-nous sur WhatsApp.",
};

export default function ContactPage() {
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

      <ContactForm />
    </div>
  );
}
