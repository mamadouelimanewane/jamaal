"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copie dans le presse-papiers, avec repli pour les navigateurs intégrés (WhatsApp, anciens Android). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Bouton « Copier » générique (lien, code promo, message). Fond blanc plein : lisible sur toutes les
 * cartes, y compris les cartes foncées (Skin Advisor).
 */
export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text).then((ok) => {
          setState(ok ? "done" : "fail");
          setTimeout(() => setState("idle"), 2500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm transition hover:bg-cream"
    >
      {state === "done" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {state === "done" ? "Copié" : state === "fail" ? "Copie impossible : appuyez longuement sur le lien" : label}
    </button>
  );
}
