"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resendDeliveryCode } from "@/lib/actions/delivery";

const wa = (phone: string, text: string) => {
  const d = phone.replace(/\D/g, "").replace(/^00/, "");
  return `https://wa.me/${d.length === 9 ? `221${d}` : d}?text=${encodeURIComponent(text)}`;
};

/**
 * « Envoyer le code au client » : renvoie le code de livraison par WhatsApp. Si l'envoi automatique ne
 * passe pas, un bouton ouvre WhatsApp avec le message prêt, à envoyer soi-même.
 */
export function SendCodeButton({ orderId, compact = false }: { orderId: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; status?: string; phone?: string | null; text?: string; error?: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setRes(await resendDeliveryCode(orderId)))}
        className={`inline-flex items-center gap-1.5 font-semibold text-navy disabled:opacity-60 ${compact ? "hover:underline" : "rounded-xl border border-navy/25 bg-white px-3 py-2 hover:bg-cream"}`}
      >
        <KeyRound size={14} className="text-rose-dark" /> {pending ? "Envoi…" : "Envoyer le code au client"}
      </button>
      {res && !res.ok && <span role="alert" className="text-red-700">{res.error}</span>}
      {res?.ok && res.status === "ENVOYE" && <span role="status" className="text-emerald-800">Code envoyé sur WhatsApp ✓</span>}
      {res?.ok && res.status !== "ENVOYE" && (
        <span role="status" className="text-amber-900">
          WhatsApp automatique {res.status === "SIMULE" ? "non configuré" : "refusé"} :{" "}
          {res.phone && res.text ? (
            <a href={wa(res.phone, res.text)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#128C7E] underline">
              envoyez-le vous-même sur WhatsApp
            </a>
          ) : (
            "numéro du client manquant"
          )}
        </span>
      )}
    </div>
  );
}
