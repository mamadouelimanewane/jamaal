"use client";

import { useState, useTransition } from "react";
import { resolveDeliveryReschedule, setGroupDealAdminStatus } from "@/lib/actions/admin-operations";

export function GroupDealAdminActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  function run(action: "SUSPENDRE" | "REPRENDRE" | "CLOTURER") { start(async () => { const r = await setGroupDealAdminStatus(id, action); setMessage(r.ok ? "État mis à jour." : r.error ?? "Action impossible."); }); }
  return <div className="flex flex-wrap items-center gap-2">{status === "OPEN" && <button disabled={pending} onClick={() => run("SUSPENDRE")} className="rounded-lg border px-3 py-1.5 text-xs">Suspendre</button>}{status === "SUSPENDUE" && <button disabled={pending} onClick={() => run("REPRENDRE")} className="rounded-lg border px-3 py-1.5 text-xs">Réactiver</button>}{["OPEN", "SUSPENDUE"].includes(status) && <button disabled={pending} onClick={() => run("CLOTURER")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-800">Clôturer</button>}{message && <span role="status" className="text-xs text-slate-600">{message}</span>}</div>;
}

export function DeliveryRequestActions({ eventId }: { eventId: string }) {
  const [note, setNote] = useState(""); const [message, setMessage] = useState(""); const [pending, start] = useTransition();
  function run(decision: "CONFIRMER" | "REFUSER") { start(async () => { const r = await resolveDeliveryReschedule(eventId, decision, note); setMessage(r.ok ? (decision === "CONFIRMER" ? "Créneau confirmé." : "Demande refusée.") : r.error ?? "Action impossible."); }); }
  return <div className="mt-3 space-y-2"><label className="block text-xs font-medium">Message au client<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="Précision ou motif (obligatoire pour refuser)" className="mt-1 w-full rounded-lg border p-2" /></label><div className="flex gap-2"><button disabled={pending} onClick={() => run("CONFIRMER")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Confirmer</button><button disabled={pending || note.trim().length < 3} onClick={() => run("REFUSER")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">Refuser</button></div>{message && <p role="status" className="text-xs text-slate-600">{message}</p>}</div>;
}

export function ReconciliationCsv({ rows }: { rows: { date: string; consultant: string; orderId: string; level: string; amount: number; status: string; payout: string }[] }) {
  function download() {
    const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const csv = [["Date", "Bénéficiaire", "Commande", "Type", "Montant FCFA", "Statut", "Payout"], ...rows.map((r) => [r.date, r.consultant, r.orderId, r.level, r.amount, r.status, r.payout])].map((line) => line.map(escape).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "jamaal-rapprochement-commissions.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <button onClick={download} className="rounded-lg border border-navy/20 px-4 py-2 text-sm font-semibold text-navy">Exporter les lignes affichées en CSV</button>;
}
