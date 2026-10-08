"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  productMargin,
  salePriceFromPublic,
  type BusinessModel,
  type PrimeTier,
} from "@/lib/business-model";
import {
  applyCatalogPricingAction,
  saveBusinessModelAction,
  type BusinessModelState,
} from "@/lib/actions/business-model";

const initial: BusinessModelState = { ok: false };
const input =
  "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy focus:ring-4 focus:ring-navy/5";
const card = "rounded-2xl border border-line bg-white p-5 shadow-sm";
const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;
const pct = (n: number) => `${(n * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const pts = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

type NumKey =
  | "purchasePct"
  | "salePct"
  | "priceRounding"
  | "sellerPct"
  | "sponsorAlonePct"
  | "sponsorSharedPct"
  | "grandSponsorPct"
  | "shippingPct"
  | "miscPct"
  | "topSellerBonus";

function NumberField({
  label,
  name,
  value,
  onChange,
  suffix,
  hint,
  step = "0.5",
}: {
  label: string;
  name: NumKey;
  value: number;
  onChange: (key: NumKey, v: number) => void;
  suffix?: string;
  hint?: string;
  step?: string;
}) {
  return (
    <label className="block text-xs font-semibold text-navy/70">
      {label}
      <div className="relative">
        <input
          type="number"
          name={name}
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={0}
          required
          onChange={(e) => onChange(name, e.target.value === "" ? NaN : Number(e.target.value))}
          className={`${input} ${suffix ? "pr-12" : ""}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 pt-0.5 text-xs text-navy/45">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-[11px] font-normal text-navy/50">{hint}</span>}
    </label>
  );
}

export function BusinessModelEditor({
  model: saved,
  productsWithPublicPrice,
  productsToReprice,
}: {
  model: BusinessModel;
  productsWithPublicPrice: number;
  productsToReprice: number;
}) {
  const [model, setModel] = useState<BusinessModel>(saved);
  const [tiers, setTiers] = useState<PrimeTier[]>(saved.primeTiers);
  const [examplePrice, setExamplePrice] = useState(23_000);
  const [scenarioCost, setScenarioCost] = useState(10);
  const [state, saveAction, saving] = useActionState(saveBusinessModelAction, initial);
  const [priceState, priceAction, pricing] = useActionState(applyCatalogPricingAction, initial);

  const set = (key: NumKey, v: number) => setModel((m) => ({ ...m, [key]: v }));
  const valid = Object.values(model).every((v) => typeof v !== "number" || Number.isFinite(v));
  const live = { ...model, primeTiers: tiers };

  const a = valid ? productMargin(examplePrice, live) : null;
  const b = valid ? productMargin(examplePrice, live, { costPct: scenarioCost }) : null;
  const dirty = JSON.stringify(live) !== JSON.stringify(saved);

  return (
    <div className="flex flex-col gap-6">
      <form action={saveAction} className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <section className={card}>
            <h2 className="font-semibold text-navy">Prix</h2>
            <p className="mt-1 text-xs text-navy/55">Base 100 = prix public Chogan en FCFA.</p>
            <div className="mt-4 flex flex-col gap-3">
              <NumberField label="Prix d'achat JAMAAL" name="purchasePct" value={model.purchasePct} onChange={set} suffix="%" hint="Chogan cède à prix public − 35 % → 65 %" />
              <NumberField label="Prix de vente JAMAAL" name="salePct" value={model.salePct} onChange={set} suffix="%" hint="Prix public + 25 % → 125 %" />
              <NumberField label="Arrondi des prix" name="priceRounding" value={model.priceRounding} onChange={set} suffix="F" step="1" />
            </div>
          </section>

          <section className={card}>
            <h2 className="font-semibold text-navy">Commissions</h2>
            <p className="mt-1 text-xs text-navy/55">En % du prix de vente, hors livraison, sur les ventes encaissées.</p>
            <div className="mt-4 flex flex-col gap-3">
              <NumberField label="Vendeur" name="sellerPct" value={model.sellerPct} onChange={set} suffix="%" />
              <NumberField label="Parrain direct, s'il est seul" name="sponsorAlonePct" value={model.sponsorAlonePct} onChange={set} suffix="%" hint="Le vendeur n'a pas de grand-parrain" />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Parrain direct (partagé)" name="sponsorSharedPct" value={model.sponsorSharedPct} onChange={set} suffix="%" />
                <NumberField label="Grand-parrain" name="grandSponsorPct" value={model.grandSponsorPct} onChange={set} suffix="%" />
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="font-semibold text-navy">Coûts</h2>
            <p className="mt-1 text-xs text-navy/55">En % du prix public. Servent au calcul de marge uniquement.</p>
            <div className="mt-4 flex flex-col gap-3">
              <NumberField label="Expédition Italie → Dakar" name="shippingPct" value={model.shippingPct} onChange={set} suffix="%" />
              <NumberField label="Frais divers" name="miscPct" value={model.miscPct} onChange={set} suffix="%" />
            </div>
          </section>
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-navy">Primes mensuelles</h2>
              <p className="mt-1 text-xs text-navy/55">Sur les ventes personnelles encaissées du mois. Désactivées, elles ne s&apos;affichent pas chez les revendeurs.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-navy">
              <input type="checkbox" name="primesEnabled" checked={model.primesEnabled} onChange={(e) => setModel((m) => ({ ...m, primesEnabled: e.target.checked }))} className="h-4 w-4 accent-navy" />
              Primes activées
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="pb-2">Ventes du mois (F)</th>
                  <th className="pb-2">Prime (F)</th>
                  <th className="pb-2">Avantage en plus</th>
                  <th className="pb-2 text-right">Marge JAMAAL (A / B)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const marginA = a ? t.threshold * a.netRateOfSale : 0;
                  const marginB = b ? t.threshold * b.netRateOfSale : 0;
                  const update = (patch: Partial<PrimeTier>) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 pr-2"><input name="tierThreshold" type="number" min={1} step={1000} value={t.threshold} onChange={(e) => update({ threshold: Number(e.target.value) })} className={input} /></td>
                      <td className="py-2 pr-2"><input name="tierAmount" type="number" min={0} step={500} value={t.amount} onChange={(e) => update({ amount: Number(e.target.value) })} className={input} /></td>
                      <td className="py-2 pr-2"><input name="tierExtra" value={t.extra ?? ""} onChange={(e) => update({ extra: e.target.value })} placeholder="—" className={input} /></td>
                      <td className="py-2 text-right text-xs">
                        <span className={marginA >= t.amount ? "text-emerald-700" : "text-rose-dark"}>{fcfa(marginA)}</span>
                        {" / "}
                        <span className={marginB >= t.amount ? "text-emerald-700" : "text-rose-dark"}>{fcfa(marginB)}</span>
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button type="button" onClick={() => setTiers((all) => all.filter((_, j) => j !== i))} aria-label="Supprimer ce palier" className="rounded-lg p-2 text-navy/40 hover:bg-rose/10 hover:text-rose-dark"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <button type="button" onClick={() => setTiers((all) => [...all, { threshold: (all.at(-1)?.threshold ?? 0) + 100_000, amount: 0 }])} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-navy hover:bg-cream">
              <Plus size={14} /> Ajouter un palier
            </button>
            <div className="w-56">
              <NumberField label="Bonus du 1er du classement" name="topSellerBonus" value={model.topSellerBonus} onChange={set} suffix="F" step="1000" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-navy/50">Marge JAMAAL = marge nette réalisée sur les ventes du palier (scénario A / scénario B). En rouge : la prime coûte plus que la marge.</p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || !valid} className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer le modèle"}
          </button>
          {dirty && !saving && <span className="text-xs font-semibold text-amber-700">Modifications non enregistrées</span>}
          {state.error && <span role="alert" className="text-sm text-rose-dark">{state.error}</span>}
          {state.ok && !dirty && <span role="status" className="text-sm text-emerald-700">{state.message}</span>}
        </div>
      </form>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-navy">Simulateur de marge par produit</h2>
            <p className="mt-1 text-xs text-navy/55">Se met à jour pendant la saisie, avant enregistrement.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="block w-44 text-xs font-semibold text-navy/70">
              Prix public Chogan
              <input type="number" min={0} step={100} value={examplePrice} onChange={(e) => setExamplePrice(Number(e.target.value) || 0)} className={input} />
            </label>
            <label className="block w-56 text-xs font-semibold text-navy/70">
              Scénario B : coûts réels (% public)
              <input type="number" min={0} step={0.5} value={scenarioCost} onChange={(e) => setScenarioCost(Number(e.target.value) || 0)} className={input} />
            </label>
          </div>
        </div>
        {a && b ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase text-navy/50">
                <tr>
                  <th className="pb-2">Poste</th>
                  <th className="pb-2 text-right">Points</th>
                  <th className="pb-2 text-right">Scénario A</th>
                  <th className="pb-2 text-right">Scénario B</th>
                </tr>
              </thead>
              <tbody>
                {a.lines.map((line, i) => (
                  <tr key={line.label} className={`border-t border-line ${line.total ? "bg-cream font-semibold text-navy" : "text-navy/80"}`}>
                    <td className="px-2 py-2">{line.label}</td>
                    <td className="px-2 py-2 text-right">{pts(line.points)}</td>
                    <td className="px-2 py-2 text-right">{fcfa(line.amount)}</td>
                    <td className="px-2 py-2 text-right">{fcfa(b.lines[i].amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line text-xs text-navy/60">
                  <td className="px-2 py-2">Marge nette en % du prix de vente</td>
                  <td />
                  <td className="px-2 py-2 text-right">{pct(a.netRateOfSale)}</td>
                  <td className="px-2 py-2 text-right">{pct(b.netRateOfSale)}</td>
                </tr>
                <tr className="text-xs text-navy/60">
                  <td className="px-2 py-2">Part de la marge brute prise par les commissions</td>
                  <td />
                  <td className="px-2 py-2 text-right">{pct(a.commissionShareOfGross)}</td>
                  <td className="px-2 py-2 text-right">{pct(b.commissionShareOfGross)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-navy/50">
              Scénario A : expédition + frais divers saisis ci-dessus ({pts(model.shippingPct + model.miscPct)} %). Frais Wave / Orange Money non inclus.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-rose-dark">Complétez tous les champs pour voir la simulation.</p>
        )}
      </section>

      <section className={card}>
        <h2 className="font-semibold text-navy">Appliquer les prix au catalogue</h2>
        <p className="mt-1 text-sm text-navy/65">
          Prix de vente = prix public Chogan × {pts(saved.salePct)} %, arrondi à {saved.priceRounding.toLocaleString("fr-FR")} F (valeurs enregistrées).
          Exemple : {fcfa(23_000)} → <strong>{fcfa(salePriceFromPublic(23_000, saved))}</strong>.
        </p>
        <p className="mt-2 text-xs text-navy/55">
          {productsWithPublicPrice} produits ont un prix public Chogan · {productsToReprice} prix à mettre à jour. Les produits sans prix public ne sont pas modifiés.
        </p>
        <form action={priceAction} className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pricing || dirty || productsToReprice === 0}
            onClick={(e) => {
              if (!confirm(`Mettre à jour ${productsToReprice} prix sur le site ?`)) e.preventDefault();
            }}
            className="rounded-xl bg-rose-dark px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pricing ? "Mise à jour…" : "Mettre à jour les prix"}
          </button>
          {dirty && <span className="text-xs text-amber-700">Enregistrez d&apos;abord le modèle.</span>}
          {priceState.error && <span role="alert" className="text-sm text-rose-dark">{priceState.error}</span>}
          {priceState.ok && <span role="status" className="text-sm text-emerald-700">{priceState.message}</span>}
        </form>
      </section>
    </div>
  );
}
