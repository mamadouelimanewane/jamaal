"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getConsultantLabelBySlug } from "@/lib/actions/public-data";
import { WHATSAPP_CONTACTS } from "@/lib/contact";

const readRef = () => document.cookie.split("; ").find((c) => c.startsWith("jamaal_ref="))?.split("=")[1] ?? "";
const subscribe = () => () => {};

/** Numéro WhatsApp Business de JAMAAL (celui de l'assistant de commande). */
export const ORDER_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || WHATSAPP_CONTACTS[0].number).replace(/\D/g, "");

/**
 * Message pré-rempli (pur, testé) : articles, puis le revendeur qui a partagé le lien. Avec son nom
 * (« Awa Diop (Dakar) »), le code reste affiché pour que l'assistant le reconnaisse sans ambiguïté.
 */
export function orderWhatsAppText(lines: string[], ref: string, sellerName?: string | null): string {
  const code = ref ? decodeURIComponent(ref) : "";
  const seller = !code ? "" : sellerName ? `Revendeur : ${sellerName} — code ${code}` : `Revendeur : ${code}`;
  return [`Bonjour JAMAAL, je souhaite commander :`, ...lines.map((l) => `• ${l}`), seller].filter(Boolean).join("\n");
}

/**
 * « Commander sur WhatsApp » : ouvre la conversation avec l'assistant JAMAAL, message pré-rempli.
 * Complète le panier du site (qui reste le parcours classique), sans le remplacer.
 */
export function OrderOnWhatsApp({ lines, label = "Commander sur WhatsApp", className = "" }: { lines: string[]; label?: string; className?: string }) {
  const ref = useSyncExternalStore(subscribe, readRef, () => "");
  const [sellerName, setSellerName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (ref) getConsultantLabelBySlug(decodeURIComponent(ref)).then((n) => alive && setSellerName(n)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [ref]);
  if (!lines.length) return null;
  return (
    <a
      href={`https://wa.me/${ORDER_NUMBER}?text=${encodeURIComponent(orderWhatsAppText(lines, ref, sellerName))}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5b] ${className}`}
    >
      <svg viewBox="0 0 32 32" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.697 4.61 1.902 6.478L4 29l7.723-1.874A11.94 11.94 0 0 0 16.001 27C22.63 27 28 21.627 28 15S22.63 3 16.001 3Z" />
      </svg>
      {label}
    </a>
  );
}
