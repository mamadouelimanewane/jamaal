"use client";

import { useState, useTransition } from "react";
import { adminSetDeliveryStatus, assignLivreurAction } from "@/lib/actions/delivery";

export type LivreurChoice = { id: string; name: string; phone: string; load: number; live: boolean; km: number | null; ready: boolean };

const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Attribuer une commande à un livreur : bouton « Assigner », puis liste des livreurs avec recherche
 * (nom ou numéro). En ligne, distance et courses en cours affichées ; le plus proche est proposé d'abord.
 */
export function AssignLivreurForm({ orderId, livreurs, suggestedId, label = "Assigner", reassign = false }: { orderId: string; livreurs: LivreurChoice[]; suggestedId: string | null; label?: string; reassign?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const list = [...livreurs]
    .filter((l) => !q.trim() || key(`${l.name} ${l.phone}`).includes(key(q.trim())) || l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§"))
    .sort((a, b) => Number(b.id === suggestedId) - Number(a.id === suggestedId) || Number(b.ready) - Number(a.ready) || Number(b.live) - Number(a.live) || (a.km ?? 999) - (b.km ?? 999) || a.load - b.load);

  function assign(l: LivreurChoice) {
    setMsg(null);
    start(async () => {
      const res = await assignLivreurAction(orderId, l.id);
      setMsg(res.ok ? { ok: true, text: `Attribuée à ${l.name} : il est prévenu dans son application et sur WhatsApp.` } : { ok: false, text: res.error ?? "Erreur" });
      if (res.ok) setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`rounded-xl px-4 py-2 text-sm font-semibold ${reassign ? "border border-navy/30 bg-white text-navy hover:bg-cream" : "bg-navy text-white hover:bg-navy-light"}`}>
        {pending ? "…" : label}
      </button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 max-w-xs text-xs ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>{msg.text}</p>}
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] rounded-2xl border border-line bg-white p-2 shadow-xl">
          <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un livreur : nom ou numéro…" aria-label="Chercher un livreur" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy" />
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {list.length === 0 && <li className="px-2 py-3 text-sm text-navy/60">Aucun livreur trouvé.</li>}
            {list.map((l) => (
              <li key={l.id}>
                <button type="button" disabled={pending || !l.ready} onClick={() => assign(l)} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${l.live ? "bg-emerald-500" : "bg-navy/25"}`} aria-hidden="true" />
                      <span className="truncate">{l.name}</span>
                      {l.id === suggestedId && <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-800">proposé</span>}
                    </span>
                    <span className="block text-[11px] text-navy/60">
                      {l.phone} · {l.live ? "en ligne" : "hors ligne"}{l.km != null ? ` · ${l.km.toLocaleString("fr-FR")} km` : ""} · {l.load} course{l.load > 1 ? "s" : ""}{l.ready ? "" : " · pièce d'identité manquante"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-rose-dark">{l.ready ? "Choisir" : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
