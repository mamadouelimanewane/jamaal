"use client";

import { useActionState, useRef } from "react";
import { replyToThread, type InboxState } from "@/lib/actions/whatsapp-inbox";

const initial: InboxState = { ok: false };

/** Réponse d'un conseiller dans la boîte de réception WhatsApp. */
export function WhatsAppReplyForm({ phone, windowOpen }: { phone: string; windowOpen: boolean }) {
  const [state, action, pending] = useActionState(replyToThread, initial);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={async (fd) => {
        await action(fd);
        form.current?.reset();
      }}
      className="border-t border-line p-3"
    >
      <input type="hidden" name="phone" value={phone} />
      <div className="flex gap-2">
        <textarea
          name="text"
          required
          rows={2}
          maxLength={1500}
          placeholder="Votre réponse…"
          className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ia focus:ring-4 focus:ring-ia/10"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.current?.requestSubmit();
          }}
        />
        <button type="submit" disabled={pending} className="self-end rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5b] disabled:opacity-60">
          {pending ? "…" : "Envoyer"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-navy/55">
        {windowOpen ? "Le client a écrit il y a moins de 24 h : message libre." : "Plus de 24 h depuis le dernier message du client : envoi par le modèle validé."} Ctrl + Entrée pour envoyer. L&apos;assistant se met en pause 2 h.
      </p>
      {state.message && <p role="status" className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose/10 text-rose-dark"}`}>{state.message}</p>}
    </form>
  );
}
