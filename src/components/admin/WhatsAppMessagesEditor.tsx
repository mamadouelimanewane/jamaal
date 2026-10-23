"use client";

import { useActionState, useRef, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { saveWhatsAppMessage, type MessageEditState } from "@/lib/actions/whatsapp-admin";
import { fillTemplate, type MessageDef, type MessageKey } from "@/lib/whatsapp/message-templates-data";

const SAMPLE: Record<string, string> = {
  prenom: "Awa",
  numero: "A1B2C3D4",
  montant: "25 000 FCFA",
  paiement: " Paiement bien reçu.",
  acompte: "10 000 FCFA",
  reste: "15 000 FCFA",
  delai: " Délai annoncé : 10 jours.",
  livraison: "et arrive bientôt",
  produit: "Aqua Soul",
  produits: "*Aqua Soul*",
  lien: "https://www.jamaal.sn/…",
  signature: "Fatou, votre conseiller·e JAMAAL",
  code: "ANNIV-4821",
  jours: "15",
  articles: "Aqua Soul (30 ml), Gel douche",
  compte: "Wave (+221 77 123 45 67)",
  expediteur: "Moussa (depuis Paris)",
  occasion: " pour la Tabaski",
  message: "« Bonne fête maman, je pense fort à toi. »",
  destinataire: "Awa",
  remise: "5 %",
};

function MessageRow({ id, def, custom }: { id: MessageKey; def: MessageDef; custom: string | null }) {
  const [state, action, pending] = useActionState<MessageEditState, FormData>(saveWhatsAppMessage, { ok: false });
  const [text, setText] = useState(custom ?? def.text);
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  function insert(v: string) {
    const el = area.current;
    const token = `{${v}}`;
    if (!el) return setText((t) => t + token);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <li className="rounded-xl border border-line bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block font-semibold text-navy">
            {def.label} {custom && <span className="ml-1 rounded-full bg-ia-light px-2 py-0.5 text-[11px] font-semibold text-ia-dark">modifié</span>}
          </span>
          <span className="block truncate text-xs text-navy/65">{def.when}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-navy/60 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <form action={action} className="grid gap-4 border-t border-line p-4 lg:grid-cols-2">
          <input type="hidden" name="key" value={id} />
          <div>
            <label htmlFor={`msg-${id}`} className="text-sm font-medium text-navy">Texte du message</label>
            <textarea ref={area} id={`msg-${id}`} name="text" value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={1000} className="mt-1.5 w-full rounded-xl border border-line px-3 py-2 text-sm" />
            <p className="mt-1.5 text-xs text-navy/70">Touchez une variable pour l&apos;insérer :</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {Object.entries(def.vars).map(([v, desc]) => (
                <button key={v} type="button" onClick={() => insert(v)} title={desc} className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-navy hover:bg-cream">{`{${v}}`}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-navy">Aperçu</p>
            <div className="mt-1.5 whitespace-pre-wrap rounded-xl bg-[#d9fdd3] px-4 py-3 text-sm text-navy shadow-sm">{fillTemplate(text, SAMPLE)}</div>
            {id.startsWith("relance") || id === "anniversaire" || id === "panier" || id === "avis" ? (
              <p className="mt-1.5 text-xs text-navy/60">La mention « Répondez STOP pour ne plus recevoir ces messages » est ajoutée automatiquement.</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={pending} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer"}</button>
              {custom && (
                <button name="reset" value="1" disabled={pending} onClick={() => setText(def.text)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">
                  <RotateCcw size={14} /> Rétablir le texte d&apos;origine
                </button>
              )}
            </div>
            {state.message && <p role={state.ok ? "status" : "alert"} className={`mt-2 text-sm ${state.ok ? "text-emerald-800" : "text-rose-dark"}`}>{state.message}</p>}
          </div>
        </form>
      )}
    </li>
  );
}

/** Messages automatiques modifiables, regroupés par sujet. */
export function WhatsAppMessagesEditor({ messages, custom }: { messages: [MessageKey, MessageDef][]; custom: Partial<Record<MessageKey, string>> }) {
  const groups = [...new Set(messages.map(([, d]) => d.group))];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy/60">{g}</h3>
          <ul className="space-y-2">
            {messages.filter(([, d]) => d.group === g).map(([id, d]) => (
              <MessageRow key={id} id={id} def={d} custom={custom[id] ?? null} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
