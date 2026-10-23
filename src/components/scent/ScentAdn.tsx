"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Dna, Loader2, MessageCircle, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { discoverScentAdn, type AdnResult } from "@/lib/actions/scent-adn";
import { FAMILY_LABELS, type Family } from "@/lib/scent/adn";
import { formatPrice } from "@/lib/currency";

const FAMILIES = Object.entries(FAMILY_LABELS) as [Family, string][];
const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm transition ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40"}`;

type Props = { suggestions: string[]; refSlug: string | null; advisor: { name: string; whatsapp: string } };

/** Parcours « Parfum ADN » : parfums portés + 4 questions → 3 parfums Chogan avec % de correspondance. */
export function ScentAdn({ suggestions, refSlug, advisor }: Props) {
  const [worn, setWorn] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [gender, setGender] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [intensity, setIntensity] = useState("");
  const [moment, setMoment] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<AdnResult | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const add = (v: string) => {
    const t = v.trim();
    if (t.length >= 2 && worn.length < 5 && !worn.some((w) => w.toLowerCase() === t.toLowerCase())) setWorn([...worn, t]);
    setDraft("");
  };
  const toggleFam = (f: Family) => setFamilies(families.includes(f) ? families.filter((x) => x !== f) : families.length < 3 ? [...families, f] : families);
  const q = draft.trim().toLowerCase();
  const hints = q.length >= 2 ? suggestions.filter((s) => s.toLowerCase().includes(q) && !worn.includes(s)).slice(0, 6) : [];
  const canSubmit = worn.length > 0 || draft.trim().length >= 2 || families.length > 0;

  function submit() {
    const all = draft.trim().length >= 2 ? [...worn, draft.trim()] : worn;
    start(async () => {
      const r = await discoverScentAdn({ worn: all, gender, families, intensity, moment, phone, name });
      setResult(r);
      requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }

  if (result?.ok) {
    const ref = refSlug ? `?ref=${refSlug}` : "";
    const msg = `Bonjour ${advisor.name}, mon Parfum ADN JAMAAL (${result.summary}) me propose : ${result.matches.map((m) => `${m.name} (${m.percent} %)`).join(", ")}. Pouvez-vous me conseiller ?`;
    return (
      <div ref={top} className="scroll-mt-24 space-y-6">
        <section className="rounded-3xl bg-navy p-6 text-white sm:p-8">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Dna size={16} /> Votre Parfum ADN</p>
          <p className="mt-2 font-serif-display text-2xl leading-snug sm:text-3xl">{result.summary ? result.summary.charAt(0).toUpperCase() + result.summary.slice(1) : "Profil établi"}</p>
          {result.profile.worn.length > result.profile.recognised.length && (
            <p className="mt-3 text-sm text-white/75">Nous n&apos;avons pas reconnu {result.profile.worn.filter((w) => !result.profile.recognised.includes(w)).join(", ")} : vos autres réponses ont guidé le choix.</p>
          )}
          {result.saved && <p className="mt-3 text-sm text-white/80">Profil enregistré : votre conseiller·e s&apos;en servira pour vos prochains conseils.</p>}
        </section>
        {result.matches.length === 0 ? (
          <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-navy">Aucun parfum ne correspond encore dans le catalogue. Écrivez-nous sur WhatsApp : nous vous conseillons.</p>
        ) : (
          <ol className="grid gap-4 sm:grid-cols-3">
            {result.matches.map((m, i) => (
              <li key={m.id} className="flex flex-col rounded-3xl border border-line bg-white p-4">
                <div className="relative">
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photos du catalogue
                    <img src={m.photo} alt={m.name} className="aspect-square w-full rounded-2xl bg-cream object-contain" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-cream text-navy/30"><Sparkles size={36} /></div>
                  )}
                  <span className={`absolute left-2 top-2 rounded-full px-3 py-1 text-sm font-bold ${i === 0 ? "bg-rose-dark text-white" : "bg-white text-navy shadow"}`}>{m.percent} %</span>
                </div>
                <Link href={`/produits/${m.slug}${ref}`} className="mt-3 font-serif-display text-lg font-semibold text-navy hover:underline">{m.name}</Link>
                {m.inspiredBy && <p className="text-xs text-navy/60">Inspiré de {m.inspiredBy}</p>}
                <p className="mt-2 flex-1 text-sm text-navy/75">{m.reason.charAt(0).toUpperCase() + m.reason.slice(1)}.</p>
                {m.price ? <p className="mt-2 font-semibold text-navy">à partir de {formatPrice(m.price)}</p> : null}
                <Link href={`/produits/${m.slug}${ref}`} className="mt-3 rounded-full bg-navy px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-navy-light">Voir et commander</Link>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a href={`https://wa.me/${advisor.whatsapp}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 font-semibold text-white hover:bg-[#1ebe5b]">
            <MessageCircle size={18} /> En parler à {advisor.name} sur WhatsApp
          </a>
          <Link href="/coffrets-decouverte" className="inline-flex items-center justify-center rounded-full border border-line px-6 py-3.5 font-semibold text-navy hover:bg-cream">Essayer avec un coffret découverte</Link>
          <button type="button" onClick={() => setResult(null)} className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-navy/70 hover:text-navy"><RotateCcw size={16} /> Recommencer</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={top} className="scroll-mt-24 space-y-6">
      {result && !result.ok && <p role="alert" className="rounded-2xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">{result.error}</p>}

      <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
        <h2 className="font-serif-display text-xl text-navy">1. Les parfums que vous portez ou adorez</h2>
        <p className="mt-1 text-sm text-navy/70">Par exemple Sauvage, J&apos;adore, La Vie est Belle, Baccarat Rouge… (jusqu&apos;à 5).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {worn.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-sm text-white">
              {w}
              <button type="button" aria-label={`Retirer ${w}`} onClick={() => setWorn(worn.filter((x) => x !== w))}><X size={14} /></button>
            </span>
          ))}
        </div>
        <div className="relative mt-3 flex gap-2">
          <label htmlFor="adn-worn" className="sr-only">Nom d&apos;un parfum</label>
          <input id="adn-worn" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); } }} placeholder="Nom du parfum" maxLength={60} autoComplete="off" className="w-full rounded-full border border-line px-4 py-3 text-sm" disabled={worn.length >= 5} />
          <button type="button" onClick={() => add(draft)} disabled={draft.trim().length < 2 || worn.length >= 5} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-4 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-50"><Plus size={16} /> Ajouter</button>
          {hints.length > 0 && (
            <ul className="absolute left-0 right-24 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
              {hints.map((h) => <li key={h}><button type="button" onClick={() => add(h)} className="block w-full px-4 py-2 text-left text-sm text-navy hover:bg-cream">{h}</button></li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
        <h2 className="font-serif-display text-xl text-navy">2. Vos envies</h2>
        <p className="mt-3 text-sm font-semibold text-navy">Pour qui ?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[["femme", "Femme"], ["homme", "Homme"], ["unisexe", "Peu importe"]].map(([v, l]) => <button key={v} type="button" aria-pressed={gender === v} onClick={() => setGender(gender === v ? "" : v)} className={chip(gender === v)}>{l}</button>)}
        </div>
        <p className="mt-5 text-sm font-semibold text-navy">Les odeurs qui vous attirent <span className="font-normal text-navy/60">(jusqu&apos;à 3)</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FAMILIES.map(([f, l]) => <button key={f} type="button" aria-pressed={families.includes(f)} onClick={() => toggleFam(f)} className={chip(families.includes(f))}>{l}</button>)}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-navy">Sillage</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[["discret", "Discret"], ["modere", "Présent"], ["intense", "Intense, qui se remarque"]].map(([v, l]) => <button key={v} type="button" aria-pressed={intensity === v} onClick={() => setIntensity(intensity === v ? "" : v)} className={chip(intensity === v)}>{l}</button>)}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">Plutôt pour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[["jour", "La journée, le bureau"], ["soir", "Le soir, les cérémonies"], ["tous", "Tous les jours"]].map(([v, l]) => <button key={v} type="button" aria-pressed={moment === v} onClick={() => setMoment(moment === v ? "" : v)} className={chip(moment === v)}>{l}</button>)}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-cream/60 p-5 sm:p-7">
        <h2 className="font-serif-display text-lg text-navy">3. Garder mon profil <span className="text-sm font-sans text-navy/60">(facultatif)</span></h2>
        <p className="mt-1 text-sm text-navy/70">Votre conseiller·e retrouvera vos goûts pour vos prochains achats et vos cadeaux.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-navy">Prénom<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="given-name" className="mt-1 w-full rounded-full border border-line bg-white px-4 py-2.5" /></label>
          <label className="text-sm text-navy">Numéro WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="77 123 45 67" className="mt-1 w-full rounded-full border border-line bg-white px-4 py-2.5" /></label>
        </div>
      </section>

      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={submit} disabled={!canSubmit || pending} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-dark px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 sm:w-auto">
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Dna size={18} />} {pending ? "Analyse de vos goûts…" : "Découvrir mon Parfum ADN"}
        </button>
        {!canSubmit && <p className="text-xs text-navy/60">Citez un parfum ou choisissez au moins une famille d&apos;odeurs.</p>}
      </div>
    </div>
  );
}
