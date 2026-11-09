"use client";

import { useState, useTransition } from "react";
import { Hand, Loader2, Zap } from "lucide-react";
import { runAutoAssign, setDeliveryDispatch } from "@/lib/actions/delivery";

/**
 * Attribution des livraisons, au choix de l'administrateur :
 * - Manuelle : il choisit le livreur de chaque livraison ;
 * - Automatique : chaque livraison prête part au livreur en ligne le plus proche du dépôt et le moins chargé.
 */
export function DispatchModePanel({ mode, maxActive, waiting }: { mode: "MANUEL" | "AUTO"; maxActive: number; waiting: number }) {
  const [current, setCurrent] = useState(mode);
  const [max, setMax] = useState(maxActive);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(next: "MANUEL" | "AUTO") {
    setMsg(null);
    start(async () => {
      const r = await setDeliveryDispatch(next, max);
      if (!r.ok) return setMsg(r.error ?? "Échec.");
      setCurrent(next);
      setMsg(next === "AUTO" ? `Attribution automatique activée${r.assigned ? ` : ${r.assigned} livraison${r.assigned > 1 ? "s" : ""} attribuée${r.assigned > 1 ? "s" : ""}` : ""}.` : "Attribution manuelle : choisissez le livreur de chaque livraison.");
    });
  }

  function runNow() {
    setMsg(null);
    start(async () => {
      const r = await runAutoAssign();
      setMsg(r.ok ? (r.assigned ? `${r.assigned} livraison${r.assigned > 1 ? "s" : ""} attribuée${r.assigned > 1 ? "s" : ""}.` : "Aucune livraison attribuée : pas de livreur disponible (validé, avec pièce d'identité, sous le maximum de courses) ou livraisons en attente de paiement.") : (r.error ?? "Échec."));
    });
  }

  const card = (v: "MANUEL" | "AUTO", Icon: typeof Hand, title: string, hint: string) => (
    <button type="button" role="radio" aria-checked={current === v} onClick={() => current !== v && choose(v)} disabled={pending} className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition ${current === v ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40"}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className={`block text-xs ${current === v ? "text-white/80" : "text-navy/65"}`}>{hint}</span>
      </span>
    </button>
  );

  return (
    <section aria-labelledby="dispatch-title" className="mt-6 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dispatch-title" className="text-lg font-semibold text-ink">Attribution des livraisons</h2>
        {pending && <Loader2 size={16} className="animate-spin text-navy/60" />}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Mode d'attribution">
        {card("MANUEL", Hand, "Manuelle", "Je choisis le livreur de chaque livraison.")}
        {card("AUTO", Zap, "Automatique", "Le livreur en ligne le plus proche du dépôt et le moins chargé reçoit la course.")}
      </div>
      {current === "AUTO" && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-navy">
            Courses en cours au maximum par livreur
            <input type="number" min={1} max={50} value={max} onChange={(e) => setMax(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} onBlur={() => max !== maxActive && choose("AUTO")} className="mt-1 block w-24 rounded-lg border border-line bg-white px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={runNow} disabled={pending || waiting === 0} className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            <Zap size={14} /> Attribuer maintenant{waiting ? ` (${waiting})` : ""}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-navy/65">
        {current === "AUTO"
          ? "Seuls les livreurs validés, avec pièce d'identité, sont choisis ; les commandes à payer en ligne attendent leur paiement. Vous pouvez toujours réattribuer une livraison à la main."
          : "Le livreur suggéré (le plus proche) est présélectionné dans chaque livraison ci-dessous."}
      </p>
      {msg && <p role="status" className="mt-2 text-sm text-emerald-800">{msg}</p>}
    </section>
  );
}
