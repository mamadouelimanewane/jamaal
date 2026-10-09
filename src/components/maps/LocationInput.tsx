"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Link2, Loader2, MessageCircle } from "lucide-react";
import { locateFromText } from "@/lib/actions/delivery-quote";

export type Located = { lat: number; lng: number; approx: boolean; label: string };

/**
 * Champ « Coller la localisation » : lien Google Maps ou WhatsApp, coordonnées, Plus Code,
 * ou simple adresse (« Sacré-Cœur 3 près de la pharmacie ») localisée approximativement.
 */
export function LocationInput({ onLocated, recipientPhone, className = "" }: { onLocated: (l: Located) => void; recipientPhone?: string | null; className?: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function locate() {
    setError(null);
    start(async () => {
      const r = await locateFromText(text);
      if (!r.ok) setError(r.error);
      else onLocated({ lat: r.lat, lng: r.lng, approx: r.approx, label: r.label });
    });
  }

  const digits = (recipientPhone ?? "").replace(/\D/g, "");
  const phone = digits.length === 9 ? `221${digits}` : digits;
  const ask = encodeURIComponent("Bonjour, c'est pour votre livraison JAMAAL. Pouvez-vous m'envoyer votre position ? Sur WhatsApp : trombone 📎 › Position › Envoyer votre position actuelle. Merci !");

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/45" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (text.trim()) locate();
              }
            }}
            placeholder="Coller un lien Maps / WhatsApp, ou écrire l'adresse"
            aria-label="Localisation de livraison"
            className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
          />
        </div>
        <button type="button" onClick={locate} disabled={pending || !text.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy px-3 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white disabled:opacity-40">
          {pending ? <Loader2 size={15} className="animate-spin" /> : null} Placer
        </button>
      </div>
      {error && <p role="alert" className="flex items-start gap-1.5 text-xs text-rose-dark"><CircleAlert size={14} className="mt-0.5 shrink-0" />{error}</p>}
      {phone.length >= 8 && (
      <a href={`https://wa.me/${phone}?text=${ask}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C4B] hover:underline">
        <MessageCircle size={14} /> Demander sa position au destinataire par WhatsApp
      </a>
      )}
    </div>
  );
}

/** Bandeau affiché quand la position vient d'une adresse approximative. */
export function ApproxNotice({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <strong>Position approximative</strong> ({label}). Déplacez le repère si vous connaissez l&apos;endroit exact ; sinon le livreur appellera le destinataire pour confirmer.
    </p>
  );
}
