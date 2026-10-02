"use client";

import { useTransition } from "react";
import { deleteContactMessage, setContactMessageRead } from "@/lib/actions/contact-messages";

export function ContactMessageActions({ id, read }: { id: string; read: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setContactMessageRead(id, !read))}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream disabled:opacity-50"
      >
        {read ? "Marquer non lu" : "Marquer lu"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Supprimer ce message ?")) start(() => deleteContactMessage(id));
        }}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-rose-dark hover:bg-cream disabled:opacity-50"
      >
        Supprimer
      </button>
    </div>
  );
}
