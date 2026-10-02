"use client";

import { useActionState } from "react";
import { createAnnouncement, type AnnouncementState } from "@/lib/actions/announcements";

const initial: AnnouncementState = { ok: false };
const field = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-dark focus:ring-4 focus:ring-rose/10";

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(createAnnouncement, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="text-xs font-semibold text-navy/70">
        Titre
        <input name="title" required maxLength={120} className={field} placeholder="Ex. Nouveauté : parfums Luxury Extrait 30 %" />
      </label>
      <label className="text-xs font-semibold text-navy/70">
        Message
        <textarea name="body" required rows={4} maxLength={3000} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm text-navy/70">
        <input type="checkbox" name="pinned" className="h-4 w-4 accent-[#1d2f4f]" /> Épingler en haut de la liste
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-2 text-sm text-rose-dark">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Annonce publiée : les revendeurs sont prévenus par notification.</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">
        {pending ? "Publication…" : "Publier l'annonce"}
      </button>
    </form>
  );
}
