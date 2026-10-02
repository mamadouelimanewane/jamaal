"use client";

import { useTransition } from "react";
import { deleteAnnouncement, togglePinAnnouncement } from "@/lib/actions/announcements";

export function AnnouncementRowActions({ id, pinned }: { id: string; pinned: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => start(() => togglePinAnnouncement(id))} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream disabled:opacity-50">
        {pinned ? "Désépingler" : "Épingler"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Supprimer cette annonce ?")) start(() => deleteAnnouncement(id));
        }}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-rose-dark hover:bg-cream disabled:opacity-50"
      >
        Supprimer
      </button>
    </div>
  );
}
