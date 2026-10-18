"use client";

import type { ReactNode } from "react";

/** Bouton d'envoi de formulaire qui demande confirmation avant une opération sensible (suspendre, supprimer…). */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
