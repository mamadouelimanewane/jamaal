"use client";

import { useState, useTransition } from "react";
import { adminSetDeliveryStatus, assignLivreurAction } from "@/lib/actions/delivery";

/** Attribution d'une livraison à un livreur (le plus proche est présélectionné). */
export function AssignLivreurForm({
  orderId,
  livreurs,
  suggestedId,
}: {
  orderId: string;
  livreurs: { id: string; label: string }[];
  suggestedId: string | null;
}) {
  const [livreurId, setLivreurId] = useState(suggestedId ?? livreurs[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={livreurId} onChange={(e) => setLivreurId(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm" aria-label="Livreur">
        {livreurs.map((l) => (
          <option key={l.id} value={l.id}>{l.label}{l.id === suggestedId ? " (le plus proche)" : ""}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !livreurId}
        onClick={() =>
          start(async () => {
            const res = await assignLivreurAction(orderId, livreurId);
            setError(res.ok ? null : res.error ?? "Erreur");
          })
        }
        className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60"
      >
        {pending ? "…" : "Attribuer"}
      </button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

/** Actions de secours de l'équipe sur une livraison en cours. */
export function DeliveryAdminActions({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (to: string, note?: string) =>
    start(async () => {
      const res = await adminSetDeliveryStatus(orderId, to, note);
      setError(res.ok ? null : res.error ?? "Erreur");
    });
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" disabled={pending} onClick={() => run("LIVREE", "Confirmée par l'équipe JAMAAL")} className="font-semibold text-emerald-800 hover:underline disabled:opacity-60">Marquer livrée</button>
      <button type="button" disabled={pending} onClick={() => run("ECHEC", "Signalé par l'équipe JAMAAL")} className="font-semibold text-red-700 hover:underline disabled:opacity-60">Échec</button>
      {error && <span role="alert" className="text-red-700">{error}</span>}
    </div>
  );
}
