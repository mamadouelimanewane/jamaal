"use client";

import { useSyncExternalStore } from "react";

const readRef = () => document.cookie.split("; ").find((c) => c.startsWith("jamaal_ref="))?.split("=")[1] ?? "";
const subscribe = () => () => {};

/**
 * « Partager sur WhatsApp » : le lien partagé garde le code du consultant (cookie d'attribution),
 * pour que la commande d'un ami soit rattachée au bon consultant.
 */
export function ShareWhatsApp({ name, slug, price }: { name: string; slug: string; price?: number | null }) {
  const ref = useSyncExternalStore(subscribe, readRef, () => "");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/produits/${slug}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
  const text = `${name}${price ? ` — ${price.toLocaleString("fr-FR")} FCFA` : ""}\n${url}`;

  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#25D366] px-4 py-2 text-xs font-semibold text-[#1f9d55] transition hover:bg-[#25D366] hover:text-white"
    >
      <svg viewBox="0 0 32 32" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.697 4.61 1.902 6.478L4 29l7.723-1.874A11.94 11.94 0 0 0 16.001 27C22.63 27 28 21.627 28 15S22.63 3 16.001 3Zm5.386 14.468c-.294-.147-1.741-.859-2.011-.957-.27-.098-.467-.147-.663.147-.196.294-.76.957-.932 1.153-.171.196-.343.221-.637.074-.294-.147-1.241-.457-2.363-1.458-.874-.78-1.464-1.744-1.636-2.038-.171-.294-.018-.453.129-.6.132-.132.294-.343.441-.514.147-.171.196-.294.294-.49.098-.196.049-.367-.024-.514-.074-.147-.663-1.598-.909-2.189-.24-.576-.484-.498-.663-.507l-.564-.01c-.196 0-.514.074-.784.367-.27.294-1.03 1.006-1.03 2.454 0 1.447 1.055 2.846 1.202 3.043.147.196 2.077 3.17 5.033 4.444.703.304 1.252.485 1.68.62.706.225 1.348.193 1.856.117.566-.085 1.741-.712 1.987-1.4.245-.688.245-1.277.171-1.4-.073-.123-.269-.196-.563-.343Z" />
      </svg>
      Partager sur WhatsApp
    </a>
  );
}
