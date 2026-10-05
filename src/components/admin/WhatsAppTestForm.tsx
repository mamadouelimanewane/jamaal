"use client";

import { useActionState } from "react";
import { sendTestWhatsApp, type TestState } from "@/lib/actions/whatsapp-admin";

const initial: TestState = { ok: false };
const field = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-dark focus:ring-4 focus:ring-rose/10";

export function WhatsAppTestForm() {
  const [state, action, pending] = useActionState(sendTestWhatsApp, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[14rem_1fr_auto]">
      <input name="to" required placeholder="221770000000" inputMode="numeric" className={field} aria-label="Numéro de test" />
      <input name="text" placeholder="Message (facultatif)" maxLength={500} className={field} aria-label="Message de test" />
      <button type="submit" disabled={pending} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
        {pending ? "Envoi…" : "Envoyer un test"}
      </button>
      {state.message && (
        <p role="status" className={`rounded-xl px-4 py-2 text-sm sm:col-span-3 ${state.ok ? "bg-emerald-50 text-emerald-800" : "border border-rose-dark/20 bg-rose/10 text-rose-dark"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
