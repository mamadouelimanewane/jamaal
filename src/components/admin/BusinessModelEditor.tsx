"use client";

import { useActionState, useState } from "react";
import { Banknote, Calculator, CircleCheck, CircleAlert, CreditCard, Percent, Plus, Tag, Trash2, Trophy, Truck } from "lucide-react";
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
  "mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-base font-medium text-ink outline-none transition focus:border-navy focus:ring-4 focus:ring-navy/10";
const card = "rounded-2xl border border-line bg-white p-5 sm:p-6";
const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;
const pct = (n: number) => `${(n * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const pts = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Couleurs de la barre de répartition (distinctes et lisibles sur blanc). */
const SEGMENTS = {
  purchase: { label: "Achat chez Chogan", color: "#8a93ad" },
  seller: { label: "Vendeur", color: "#2f6f9f" },
  sponsors: { label: "Réseau (Leader, Consultant)", color: "#86b1d1" },
  costs: { label: "Expédition et frais", color: "#d4a93c" },
  net: { label: "Marge JAMAAL", color: "#9b5c4d" },
} as const;

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
  | "topSellerBonus"
  | "maxDirectRecruits"
  | "minPayout";

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
    <label className="block text-sm font-medium text-ink">
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
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 pt-0.5 text-sm font-semibold text-navy/70">{suffix}</span>}
      </div>
      {hint && <span className="mt-1.5 block text-xs font-normal text-navy/75">{hint}</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, title, text, tone }: { icon: typeof Tag; title: string; text: string; tone: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: tone }}>
        <Icon size={19} />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-navy/75">{text}</p>
      </div>
    </div>
  );
}

/** Barre « où va le prix de vente » : la pièce maîtresse de la page. */
function PriceSplit({ margin, publicPrice }: { margin: ReturnType<typeof productMargin>; publicPrice: number }) {
  const [sale, purchase, , seller, sponsors, , costs, net] = margin.lines.map((l) => Math.abs(l.amount));
  const parts = [
    { ...SEGMENTS.purchase, value: purchase },
    { ...SEGMENTS.seller, value: seller },
    { ...SEGMENTS.sponsors, value: sponsors },
    { ...SEGMENTS.costs, value: costs },
    ...(margin.net > 0 ? [{ ...SEGMENTS.net, value: net }] : []),
  ];
  const total = Math.max(sale, parts.reduce((s, p) => s + p.value, 0));
  const negative = margin.net < 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-sm text-navy/75">Pour un produit à {fcfa(publicPrice)} chez Chogan, le client paie</p>
          <p className="font-serif-display text-4xl font-semibold text-ink">{fcfa(sale)}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-navy/75">JAMAAL garde</p>
          <p className={`text-3xl font-semibold ${negative ? "text-red-700" : "text-rose-dark"}`}>
            {fcfa(margin.net)} <span className="text-lg font-medium">({pct(margin.netRateOfSale)})</span>
          </p>
        </div>
      </div>

      <div className="mt-5 flex h-12 overflow-hidden rounded-xl ring-1 ring-line" role="img" aria-label="Répartition du prix de vente">
        {parts.map((p) => {
          const width = total > 0 ? (p.value / total) * 100 : 0;
          return (
            <div key={p.label} className="flex items-center justify-center overflow-hidden text-sm font-semibold text-white" style={{ width: `${width}%`, background: p.color }} title={`${p.label} : ${fcfa(p.value)}`}>
              {width > 9 && <span className="truncate px-1">{Math.round((p.value / sale) * 100)} %</span>}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-y-2 text-sm sm:flex sm:flex-wrap sm:gap-x-7">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 sm:whitespace-nowrap">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="text-navy/85">{p.label}</span>
            <span className="ml-auto font-semibold text-ink sm:ml-0">{fcfa(p.value)}</span>
          </li>
        ))}
      </ul>
      {negative && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <CircleAlert size={18} /> Avec ces réglages, JAMAAL perd {fcfa(-margin.net)} sur chaque vente.
        </p>
      )}
    </div>
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
  const [scenario, setScenario] = useState<"A" | "B">("A");
  const [state, saveAction, saving] = useActionState(saveBusinessModelAction, initial);
  const [priceState, priceAction, pricing] = useActionState(applyCatalogPricingAction, initial);

  const set = (key: NumKey, v: number) => setModel((m) => ({ ...m, [key]: v }));
  const valid = Object.values(model).every((v) => typeof v !== "number" || Number.isFinite(v));
  const live = { ...model, primeTiers: tiers };

  const a = valid ? productMargin(examplePrice, live) : null;
  const b = valid ? productMargin(examplePrice, live, { costPct: scenarioCost }) : null;
  const shown = scenario === "A" ? a : b;
  const dirty = JSON.stringify(live) !== JSON.stringify(saved);

  return (
    <div className="flex flex-col gap-6">
      {/* Répartition du prix : réagit à chaque saisie */}
      <section className={card}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <SectionTitle icon={Calculator} title="Où va l'argent d'une vente" text="Se met à jour pendant que vous modifiez les réglages, avant même d'enregistrer." tone="#182845" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-40 text-sm font-medium text-ink">
              Prix public Chogan
              <input type="number" min={0} step={100} value={examplePrice} onChange={(e) => setExamplePrice(Number(e.target.value) || 0)} className={input} />
            </label>
            <div className="flex rounded-xl border border-line bg-cream p-1 text-sm font-semibold" role="group" aria-label="Scénario de coûts">
              {(["A", "B"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScenario(s)} aria-pressed={scenario === s} className={`rounded-lg px-3.5 py-2 transition ${scenario === s ? "bg-navy text-white" : "text-navy/80 hover:bg-white"}`}>
                  {s === "A" ? `Frais annoncés (${pts(model.shippingPct + model.miscPct)} %)` : `Frais réels (${pts(scenarioCost)} %)`}
                </button>
              ))}
            </div>
            {scenario === "B" && (
              <label className="block w-36 text-sm font-medium text-ink">
                Frais réels
                <div className="relative">
                  <input type="number" min={0} step={0.5} value={scenarioCost} onChange={(e) => setScenarioCost(Number(e.target.value) || 0)} className={`${input} pr-10`} />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 pt-0.5 text-sm font-semibold text-navy/70">%</span>
                </div>
              </label>
            )}
          </div>
        </div>
        {shown ? <PriceSplit margin={shown} publicPrice={examplePrice} /> : <p className="text-base text-red-700">Complétez tous les réglages pour voir la répartition.</p>}

        {a && b && (
          <details className="group mt-6 rounded-xl border border-line">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink hover:bg-cream">Voir le détail ligne par ligne</summary>
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[560px] text-[15px]">
                <thead className="bg-cream text-left text-sm text-navy/85">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Poste</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Points (base 100)</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Frais annoncés</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Frais réels</th>
                  </tr>
                </thead>
                <tbody>
                  {a.lines.map((line, i) => (
                    <tr key={line.label} className={`border-t border-line ${line.total ? "bg-cream/60 font-semibold text-ink" : "text-navy/90"}`}>
                      <td className="px-4 py-2.5">{line.label}</td>
                      <td className="px-4 py-2.5 text-right">{pts(line.points)}</td>
                      <td className="px-4 py-2.5 text-right">{fcfa(line.amount)}</td>
                      <td className="px-4 py-2.5 text-right">{fcfa(b.lines[i].amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line text-sm text-navy/85">
                    <td className="px-4 py-2.5">Part de la marge brute prise par les commissions</td>
                    <td />
                    <td className="px-4 py-2.5 text-right">{pct(a.commissionShareOfGross)}</td>
                    <td className="px-4 py-2.5 text-right">{pct(b.commissionShareOfGross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-3 text-xs text-navy/75">Les frais Wave et Orange Money ne sont pas encore inclus.</p>
          </details>
        )}
      </section>

      <form action={saveAction} className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <section className={card}>
            <SectionTitle icon={Tag} title="Prix" text="En % du prix public Chogan." tone="#8a93ad" />
            <div className="mt-5 flex flex-col gap-4">
              <NumberField label="Prix d'achat JAMAAL" name="purchasePct" value={model.purchasePct} onChange={set} suffix="%" hint="Chogan cède à prix public − 35 %, soit 65 %." />
              <NumberField label="Prix de vente JAMAAL" name="salePct" value={model.salePct} onChange={set} suffix="%" hint="Prix public + 25 %, soit 125 %." />
              <NumberField label="Arrondi des prix" name="priceRounding" value={model.priceRounding} onChange={set} suffix="F" step="1" />
            </div>
          </section>

          <section className={card}>
            <SectionTitle icon={Percent} title="Commissions" text="En % du prix de vente, hors livraison, sur les ventes encaissées." tone="#2f6f9f" />
            <div className="mt-5 flex flex-col gap-4">
              <NumberField label="Vendeur (sur ses propres ventes)" name="sellerPct" value={model.sellerPct} onChange={set} suffix="%" />
              <NumberField label="Consultant, sur les ventes de ses Leaders" name="sponsorAlonePct" value={model.sponsorAlonePct} onChange={set} suffix="%" hint="Le parrain direct du vendeur touche toute l'enveloppe quand personne n'est au-dessus de lui." />
              <p className="-mb-1 text-sm font-medium text-ink">Sur les ventes d&apos;un Parrain, l&apos;enveloppe est partagée :</p>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Leader" name="sponsorSharedPct" value={model.sponsorSharedPct} onChange={set} suffix="%" />
                <NumberField label="Consultant" name="grandSponsorPct" value={model.grandSponsorPct} onChange={set} suffix="%" />
              </div>
            </div>
          </section>

          <section className={card}>
            <SectionTitle icon={Truck} title="Coûts" text="En % du prix public. Servent au calcul de marge." tone="#b8902a" />
            <div className="mt-5 flex flex-col gap-4">
              <NumberField label="Expédition Italie → Dakar" name="shippingPct" value={model.shippingPct} onChange={set} suffix="%" />
              <NumberField label="Frais divers" name="miscPct" value={model.miscPct} onChange={set} suffix="%" />
            </div>
          </section>
        </div>

        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle icon={Trophy} title="Primes mensuelles" text="Sur les ventes personnelles encaissées du mois. Désactivées, elles n'apparaissent pas chez les consultants." tone="#9b5c4d" />
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${model.primesEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line bg-cream text-navy/85"}`}>
              <input type="checkbox" name="primesEnabled" checked={model.primesEnabled} onChange={(e) => setModel((m) => ({ ...m, primesEnabled: e.target.checked }))} className="h-5 w-5 accent-emerald-700" />
              {model.primesEnabled ? "Primes activées" : "Primes désactivées"}
            </label>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[15px]">
              <thead className="text-left text-sm text-navy/85">
                <tr>
                  <th className="pb-2 font-semibold">Ventes du mois</th>
                  <th className="pb-2 font-semibold">Prime</th>
                  <th className="pb-2 font-semibold">Avantage en plus</th>
                  <th className="pb-2 font-semibold">Financée par la marge ?</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const margin = shown ? t.threshold * shown.netRateOfSale : 0;
                  const covered = margin >= t.amount;
                  const update = (patch: Partial<PrimeTier>) => setTiers((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={i} className="border-t border-line align-middle">
                      <td className="py-2.5 pr-3"><input name="tierThreshold" type="number" min={1} step={1000} value={t.threshold} onChange={(e) => update({ threshold: Number(e.target.value) })} className={input} aria-label="Ventes du mois" /></td>
                      <td className="py-2.5 pr-3"><input name="tierAmount" type="number" min={0} step={500} value={t.amount} onChange={(e) => update({ amount: Number(e.target.value) })} className={input} aria-label="Prime" /></td>
                      <td className="py-2.5 pr-3"><input name="tierExtra" value={t.extra ?? ""} onChange={(e) => update({ extra: e.target.value })} placeholder="Aucun" className={input} aria-label="Avantage en plus" /></td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${covered ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                          {covered ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
                          {covered ? "Oui" : "Non"} · marge {fcfa(margin)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button type="button" onClick={() => setTiers((all) => all.filter((_, j) => j !== i))} aria-label="Supprimer ce palier" className="rounded-lg p-2.5 text-navy/70 hover:bg-red-50 hover:text-red-700"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <button type="button" onClick={() => setTiers((all) => [...all, { threshold: (all.at(-1)?.threshold ?? 0) + 100_000, amount: 0 }])} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-cream">
              <Plus size={16} /> Ajouter un palier
            </button>
            <div className="w-60">
              <NumberField label="Bonus du 1er du classement" name="topSellerBonus" value={model.topSellerBonus} onChange={set} suffix="F" step="1000" />
            </div>
          </div>
          <p className="mt-4 text-sm text-navy/75">« Financée par la marge » compare la prime à ce que JAMAAL gagne réellement sur les ventes du palier, avec le scénario choisi en haut de page.</p>
        </section>

        <section className={card}>
          <SectionTitle icon={CreditCard} title="Réseau, paiements et versements" text="Règles d'inscription, moyens de paiement acceptés au panier et versement des commissions." tone="#1f7a55" />
          <div className="mt-5 grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-4">
              <NumberField label="Filleuls directs maximum par membre" name="maxDirectRecruits" value={model.maxDirectRecruits} onChange={set} step="1" hint="0 = illimité. Au-delà, le candidat doit utiliser le code d'un membre de l'équipe." />
              <p className="text-sm text-navy/80">Le code de parrainage est obligatoire pour toute candidature.</p>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Moyens de paiement acceptés</legend>
              <p className="mt-1 text-xs text-navy/75">Proposés au panier seulement s&apos;ils sont aussi configurés (clés Vercel).</p>
              <div className="mt-3 flex flex-col gap-2">
                {([
                  ["acceptWave", "Wave"],
                  ["acceptOrangeMoney", "Orange Money"],
                  ["acceptCard", "Carte bancaire (Stripe)"],
                  ["acceptCashOnDelivery", "Paiement à la livraison (espèces)"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-ink">
                    <input type="checkbox" name={key} checked={model[key]} onChange={(e) => setModel((m) => ({ ...m, [key]: e.target.checked }))} className="h-5 w-5 accent-[#182845]" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[15px] font-medium text-ink">
                <input type="checkbox" name="payoutsEnabled" checked={model.payoutsEnabled} onChange={(e) => setModel((m) => ({ ...m, payoutsEnabled: e.target.checked }))} className="h-5 w-5 accent-[#182845]" />
                Verser automatiquement les commissions sur les wallets
              </label>
              <label className="block text-sm font-medium text-ink">
                Moment du versement
                <select name="payoutTrigger" value={model.payoutTrigger} onChange={(e) => setModel((m) => ({ ...m, payoutTrigger: e.target.value === "DELIVERED" ? "DELIVERED" : "PAID" }))} className={input}>
                  <option value="PAID">Dès que le client a payé</option>
                  <option value="DELIVERED">À la livraison de la commande</option>
                </select>
                <span className="mt-1.5 block text-xs font-normal text-navy/75">À la livraison, une commande retournée avant livraison ne coûte aucune commission.</span>
              </label>
              <NumberField label="Versement minimal" name="minPayout" value={model.minPayout} onChange={set} suffix="F" step="100" hint="En dessous, la commission attend la suivante. 0 = tout est versé." />
            </div>
          </div>
        </section>

        {/* Barre d'enregistrement : reste visible tant qu'il y a des modifications */}
        <div className={`flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4 ${dirty ? "sticky bottom-4 z-10 border-amber-300 bg-amber-50 shadow-lg" : "border-line bg-white"}`}>
          <button type="submit" disabled={saving || !valid} className="rounded-xl bg-navy px-6 py-3 text-base font-semibold text-white transition hover:bg-navy-light disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer le modèle"}
          </button>
          {dirty && !saving && <span className="text-sm font-semibold text-amber-900">Modifications non enregistrées</span>}
          {state.error && <span role="alert" className="text-sm font-medium text-red-700">{state.error}</span>}
          {state.ok && !dirty && <span role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CircleCheck size={18} /> {state.message}</span>}
        </div>
      </form>

      <section className={card}>
        <SectionTitle icon={Banknote} title="Appliquer les prix au catalogue" text="Recalcule le prix de vente de chaque produit à partir de son prix public Chogan." tone="#1f7a55" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-cream px-4 py-3">
            <p className="text-sm text-navy/80">Formule enregistrée</p>
            <p className="text-lg font-semibold text-ink">Prix public × {pts(saved.salePct)} %</p>
            <p className="text-sm text-navy/80">arrondi à {saved.priceRounding.toLocaleString("fr-FR")} F</p>
          </div>
          <div className="rounded-xl bg-cream px-4 py-3">
            <p className="text-sm text-navy/80">Exemple</p>
            <p className="text-lg font-semibold text-ink">{fcfa(23_000)} → {fcfa(salePriceFromPublic(23_000, saved))}</p>
          </div>
          <div className="rounded-xl bg-cream px-4 py-3">
            <p className="text-sm text-navy/80">Catalogue</p>
            <p className="text-lg font-semibold text-ink">{productsToReprice} prix à changer</p>
            <p className="text-sm text-navy/80">sur {productsWithPublicPrice} produits avec prix public</p>
          </div>
        </div>
        <form action={priceAction} className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pricing || dirty || productsToReprice === 0}
            onClick={(e) => {
              if (!confirm(`Mettre à jour ${productsToReprice} prix sur le site ?`)) e.preventDefault();
            }}
            className="rounded-xl bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {pricing ? "Mise à jour…" : "Mettre à jour les prix"}
          </button>
          {dirty && <span className="text-sm font-medium text-amber-900">Enregistrez d&apos;abord le modèle.</span>}
          {priceState.error && <span role="alert" className="text-sm font-medium text-red-700">{priceState.error}</span>}
          {priceState.ok && <span role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CircleCheck size={18} /> {priceState.message}</span>}
        </form>
      </section>
    </div>
  );
}
