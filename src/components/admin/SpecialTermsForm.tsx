"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSpecialTerms, type SpecialTermsState } from "@/lib/actions/special-terms";
import { COLLECT_LABELS, COLLECT_METHODS } from "@/lib/special-terms";

type Member = { id: string; name: string; city: string; termsName: string | null };
export type SpecialTermsInitial = {
  id?: string;
  name: string;
  active: boolean;
  note: string;
  collectMethods: string[];
  creditLimit: number;
  sellerPct: number | null;
  level1Pct: number | null;
  level2Pct: number | null;
  zonesText: string;
  members: string[];
};

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-navy outline-none focus:border-navy";
const label = "block text-xs font-medium text-navy/85";

/** Formulaire des conditions spéciales : encaissement direct, commissions propres, zones, revendeurs concernés. */
export function SpecialTermsForm({ initial, consultants, normalRates }: { initial: SpecialTermsInitial; consultants: Member[]; normalRates: { seller: string; level1: string; level2: string } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: SpecialTermsState, fd: FormData) => {
    const r = await saveSpecialTerms(prev, fd);
    if (r.ok && !initial.id && r.id) router.replace(`/admin/conditions-speciales/${r.id}?cree=1`);
    return r;
  }, { ok: false } as SpecialTermsState);
  const [members, setMembers] = useState<Set<string>>(new Set(initial.members));
  const [q, setQ] = useState("");
  const [onlyChosen, setOnlyChosen] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return consultants.filter((c) => (!onlyChosen || members.has(c.id)) && (!s || `${c.name} ${c.city}`.toLowerCase().includes(s)));
  }, [consultants, q, onlyChosen, members]);
  const toggle = (id: string) => setMembers((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {[...members].map((id) => <input key={id} type="hidden" name="members" value={id} />)}

      <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        <label className={label}>Nom<input name="name" required defaultValue={initial.name} placeholder="ex. Revendeurs de Thiès" className={field} /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-navy"><input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4" /> Conditions actives</label>
        <label className={`${label} sm:col-span-2`}>Note interne (facultatif)<textarea name="note" rows={2} defaultValue={initial.note} placeholder="Pourquoi ces conditions, jusqu'à quand…" className={field} /></label>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">1. Encaissement direct du client</h2>
        <p className="mt-1 text-sm text-navy/70">Le revendeur peut enregistrer une vente déjà payée par son client. La vente est payée tout de suite (commissions créditées), et le montant passe au débit de son wallet : c&apos;est l&apos;argent qu&apos;il doit reverser à JAMAAL.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {COLLECT_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-navy"><input type="checkbox" name="collect" value={m} defaultChecked={initial.collectMethods.includes(m)} className="h-4 w-4" /> {COLLECT_LABELS[m]}</label>
          ))}
        </div>
        <label className={`${label} mt-4 max-w-xs`}>Plafond d&apos;argent à reverser (F)<input name="creditLimit" inputMode="numeric" defaultValue={initial.creditLimit || ""} placeholder="ex. 150000" className={field} /></label>
        <p className="mt-1 text-xs text-navy/60">Au-delà, le revendeur doit d&apos;abord reverser l&apos;argent encaissé (dépôt sur son wallet, ou dépôt en espèces enregistré dans Admin › Wallets).</p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">2. Commission spéciale</h2>
        <p className="mt-1 text-sm text-navy/70">Sur les ventes de ces revendeurs. Laissez vide pour garder le taux normal du modèle économique.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className={label}>Commission du vendeur (%)<input name="sellerPct" inputMode="decimal" defaultValue={initial.sellerPct ?? ""} placeholder={`normal : ${normalRates.seller}`} className={field} /></label>
          <label className={label}>Part du parrain direct (%)<input name="level1Pct" inputMode="decimal" defaultValue={initial.level1Pct ?? ""} placeholder={`normal : ${normalRates.level1}`} className={field} /></label>
          <label className={label}>Part du grand-parrain (%)<input name="level2Pct" inputMode="decimal" defaultValue={initial.level2Pct ?? ""} placeholder={`normal : ${normalRates.level2}`} className={field} /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">3. Zones de livraison spéciales</h2>
        <p className="mt-1 text-sm text-navy/70">Une zone par ligne : <code className="rounded bg-cream px-1">Nom de la zone ; frais en F</code>. Le revendeur choisit la zone dans sa commande : ses frais remplacent le tarif au kilomètre, sans limite de distance.</p>
        <textarea name="zones" rows={4} defaultValue={initial.zonesText} placeholder={"Thiès centre ; 1500\nMbour ; 2500\nTouba ; 3000"} className={`${field} font-mono`} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy">4. Revendeurs concernés ({members.size})</h2>
            <p className="mt-1 text-sm text-navy/70">Un revendeur n&apos;a qu&apos;un seul ensemble de conditions : le cocher ici le retire de l&apos;autre.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-navy/80"><input type="checkbox" checked={onlyChosen} onChange={(e) => setOnlyChosen(e.target.checked)} /> Seulement les cochés</label>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un revendeur (nom, ville)" className={`${field} mt-3`} />
        <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {list.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-cream/60">
                <input type="checkbox" checked={members.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" aria-label={c.name} />
                <span className="min-w-0 flex-1 truncate text-navy">{c.name} <span className="text-navy/55">· {c.city}</span></span>
                {c.termsName && c.termsName !== initial.name && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">déjà : {c.termsName}</span>}
              </label>
            </li>
          ))}
          {!list.length && <li className="px-3 py-4 text-center text-sm text-navy/60">Aucun revendeur.</li>}
        </ul>
      </section>

      {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">{state.message}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}
