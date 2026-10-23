"use client";

import { useState } from "react";
import { roundNice, simulateEarnings, type SimRates } from "@/lib/earnings-sim";

const fcfa = (n: number) => `${roundNice(n).toLocaleString("fr-FR")} F`;

function Slider({ id, label, value, min, max, step, onChange, display }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-navy">{label}</label>
        <span className="font-serif-display text-xl font-semibold text-navy">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[#b4536d]" />
    </div>
  );
}

/**
 * « Combien je peux gagner ? » : le candidat règle ses ventes et son équipe, et voit ses gains estimés selon le
 * barème en vigueur (Admin › Modèle économique).
 */
export function EarningsSimulator({ rates, defaultBasket, formAnchor = "#candidature" }: { rates: SimRates; defaultBasket: number; formAnchor?: string }) {
  const [sales, setSales] = useState(5);
  const [basket, setBasket] = useState(defaultBasket);
  const [filleuls, setFilleuls] = useState(0);
  const [filleulSales, setFilleulSales] = useState(3);
  const r = simulateEarnings({ salesPerWeek: sales, basket, filleuls, filleulSalesPerWeek: filleulSales }, rates);

  return (
    <div className="grid gap-6 rounded-3xl border border-line bg-white p-5 sm:p-7 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-6">
        <Slider id="sim-ventes" label="Mes ventes par semaine" value={sales} min={0} max={30} step={1} onChange={setSales} display={`${sales}`} />
        <Slider id="sim-panier" label="Panier moyen d'une vente" value={basket} min={5_000} max={60_000} step={1_000} onChange={setBasket} display={fcfa(basket)} />
        <Slider id="sim-filleuls" label="Mes filleuls (mon équipe)" value={filleuls} min={0} max={Math.min(20, rates.maxFilleuls)} step={1} onChange={setFilleuls} display={`${filleuls}`} />
        {filleuls > 0 && <Slider id="sim-ventes-filleuls" label="Ventes par filleul et par semaine" value={filleulSales} min={0} max={15} step={1} onChange={setFilleulSales} display={`${filleulSales}`} />}
      </div>

      <div className="flex flex-col rounded-2xl bg-navy p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Mes gains estimés</p>
        <p className="mt-2 font-serif-display text-4xl font-semibold sm:text-5xl" aria-live="polite">{fcfa(r.monthly)}</p>
        <p className="text-sm text-white/75">par mois · soit {fcfa(r.yearly)} par an</p>
        <dl className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-white/75">Mes ventes ({r.sellerRate} %)</dt><dd className="font-semibold">{fcfa(r.own)}</dd></div>
          {r.filleuls > 0 && <div className="flex justify-between gap-3"><dt className="text-white/75">Ventes de mon équipe ({rates.sponsorPct} %)</dt><dd className="font-semibold">{fcfa(r.team)}</dd></div>}
          {r.primes > 0 && <div className="flex justify-between gap-3"><dt className="text-white/75">Primes du mois</dt><dd className="font-semibold">{fcfa(r.primes)}</dd></div>}
          <div className="flex justify-between gap-3 text-white/60"><dt>Chiffre d&apos;affaires vendu</dt><dd>{fcfa(r.ownRevenue + r.teamRevenue)}</dd></div>
        </dl>
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
          Rang {r.title === "Parrain" ? "Parrain : vous touchez aussi une part des ventes de votre équipe." : "Consultant. Avec des filleuls, vous devenez Parrain et gagnez aussi sur leurs ventes."}
        </p>
        <a href={formAnchor} className="mt-5 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-navy hover:bg-cream">Je me lance →</a>
      </div>
      <p className="text-xs text-navy/55 lg:col-span-2">
        Estimation selon le barème JAMAAL en vigueur (commissions sur le prix de vente{rates.primesEnabled || rates.teamPrimesEnabled ? ", primes mensuelles" : ""}). Vos gains réels dépendent de votre activité : ce simulateur n&apos;est pas une promesse de revenu.
      </p>
    </div>
  );
}
