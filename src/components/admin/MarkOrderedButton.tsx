"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markReservationsOrderedAction } from "@/lib/actions/reservation-orders";

/** « Commande passée chez Chogan » : remet le compteur à zéro après confirmation. */
export function MarkOrderedButton({ asOf, units }: { asOf: string; units: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="print:hidden">
      <button
        type="button"
        disabled={pending || units === 0}
        onClick={() => {
          if (!window.confirm(`Confirmer : la commande de ${units} article(s) a bien été passée chez Chogan ?\nLe compteur repartira à zéro.`)) return;
          start(async () => {
            const r = await markReservationsOrderedAction(asOf);
            setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Compteur remis à zéro." : r.error ?? "Impossible d'enregistrer." });
            router.refresh();
          });
        }}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Commande passée chez Chogan — remettre à zéro"}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-rose-dark"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
