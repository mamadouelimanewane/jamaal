"use client";

import { useState } from "react";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

const Icon = () => (
  <svg viewBox="0 0 32 32" className="h-7 w-7 fill-white" aria-hidden="true">
    <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.697 4.61 1.902 6.478L4 29l7.723-1.874A11.94 11.94 0 0 0 16.001 27C22.63 27 28 21.627 28 15S22.63 3 16.001 3Zm0 21.818a9.77 9.77 0 0 1-4.98-1.363l-.357-.212-4.584 1.112 1.14-4.468-.233-.367A9.77 9.77 0 0 1 6.18 15c0-5.415 4.406-9.818 9.82-9.818 5.415 0 9.818 4.403 9.818 9.818 0 5.415-4.403 9.818-9.818 9.818Zm5.386-7.35c-.294-.147-1.741-.859-2.011-.957-.27-.098-.467-.147-.663.147-.196.294-.76.957-.932 1.153-.171.196-.343.221-.637.074-.294-.147-1.241-.457-2.363-1.458-.874-.78-1.464-1.744-1.636-2.038-.171-.294-.018-.453.129-.6.132-.132.294-.343.441-.514.147-.171.196-.294.294-.49.098-.196.049-.367-.024-.514-.074-.147-.663-1.598-.909-2.189-.24-.576-.484-.498-.663-.507l-.564-.01c-.196 0-.514.074-.784.367-.27.294-1.03 1.006-1.03 2.454 0 1.447 1.055 2.846 1.202 3.043.147.196 2.077 3.17 5.033 4.444.703.304 1.252.485 1.68.62.706.225 1.348.193 1.856.117.566-.085 1.741-.712 1.987-1.4.245-.688.245-1.277.171-1.4-.073-.123-.269-.196-.563-.343Z" />
  </svg>
);

/** Bouton WhatsApp flottant : un clic ouvre le choix entre les numéros de la boutique. */
export function WhatsAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div role="menu" className="w-64 rounded-2xl border border-line bg-white p-3 shadow-xl shadow-navy/10">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-navy/50">Écrire à JAMAAL sur WhatsApp</p>
          {WHATSAPP_CONTACTS.map((c) => (
            <a
              key={c.number}
              role="menuitem"
              href={whatsappLink(c.number)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-navy transition hover:bg-cream"
            >
              {c.display}
              <span className="text-xs font-normal text-[#25a05a]">Ouvrir ↗</span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label="Contacter JAMAAL sur WhatsApp"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
      >
        <Icon />
      </button>
    </div>
  );
}
