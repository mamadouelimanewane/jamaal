"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, MessageCircle, RefreshCw, ShieldCheck, Sparkles, Sun, Moon, CalendarDays } from "lucide-react";
import { analyzeSkin, type SkinResult } from "@/lib/actions/skin-advisor";
import { compressPhoto } from "@/lib/compress-photo";
import { LiveCamera } from "./LiveCamera";
import { CONCERNS, SCORE_LABELS, SKIN_TYPES, routineText, type Concern, type RoutineStep, type SkinType } from "@/lib/skin/advisor";

type Ok = Extract<SkinResult, { ok: true }>;
const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm transition ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40"}`;

function StepCard({ s, refSlug }: { s: RoutineStep; refSlug: string | null }) {
  const p = s.product;
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-white p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element -- photos du catalogue (CDN externe) */}
        {p?.photo ? <img src={p.photo} alt="" className="h-full w-full object-contain p-1" loading="lazy" /> : <div className="flex h-full items-center justify-center text-rose-dark"><Sparkles size={22} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-dark">{s.label}</p>
        {p ? (
          <Link href={`/produits/${p.slug}${refSlug ? `?ref=${refSlug}` : ""}`} className="mt-0.5 block font-semibold text-navy hover:underline">{p.name}</Link>
        ) : (
          <p className="mt-0.5 text-sm text-navy/70">Produit adapté bientôt disponible : demandez conseil.</p>
        )}
        {p?.price ? <p className="text-sm text-navy/80">{p.price.toLocaleString("fr-FR")} FCFA</p> : null}
        <p className="mt-1 text-xs leading-relaxed text-navy/70">{s.why}</p>
      </div>
    </li>
  );
}

export function SkinAdvisor({ origin, refSlug, advisor }: { origin: string; refSlug: string | null; advisor: { name: string; whatsapp: string } }) {
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [sun, setSun] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<SkinResult | null>(null);
  const [pending, start] = useTransition();
  const cam = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const gal = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!photo) return;
    const u = URL.createObjectURL(photo);
    queueMicrotask(() => setPreview(u));
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const toggle = (c: Concern) => setConcerns((l) => (l.includes(c) ? l.filter((x) => x !== c) : l.length >= 5 ? l : [...l, c]));
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (f) setPhoto(f);
    e.currentTarget.value = "";
  };

  function submit() {
    start(async () => {
      const fd = new FormData();
      if (skinType) fd.set("skinType", skinType);
      concerns.forEach((c) => fd.append("concerns", c));
      if (sun) fd.set("sun", sun);
      if (age) fd.set("age", age);
      if (photo && consent) fd.set("photo", await compressPhoto(photo), "selfie.jpg");
      let r: SkinResult;
      try {
        r = await analyzeSkin(fd);
      } catch {
        r = { ok: false, error: "Le serveur n'a pas répondu. Réessayez dans un instant." };
      }
      setResult(r);
      requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }

  const canSubmit = (!!photo && consent) || !!skinType;

  if (result?.ok) return <Results r={result} origin={origin} refSlug={refSlug} advisor={advisor} onRestart={() => setResult(null)} topRef={top} />;

  return (
    <div ref={top} className="scroll-mt-24 space-y-8">
      {result && !result.ok && <p role="alert" className="rounded-2xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">{result.error}</p>}

      <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
        <h2 className="font-serif-display text-xl text-navy">1. Votre selfie <span className="text-sm font-sans text-navy/60">(recommandé)</span></h2>
        <p className="mt-1 text-sm text-navy/70">De face, en lumière naturelle (près d&apos;une fenêtre), sans filtre ni maquillage épais, cheveux dégagés du visage.</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          {preview && photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local
            <img src={preview} alt="Votre selfie" className="h-40 w-32 rounded-2xl border border-line object-cover" />
          ) : (
            <div className="flex h-40 w-32 items-center justify-center rounded-2xl border border-dashed border-line bg-cream/60 text-navy/40"><Camera size={30} /></div>
          )}
          <div className="flex flex-1 flex-col gap-2 sm:max-w-xs">
            <button type="button" onClick={() => (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function" ? setLive(true) : cam.current?.click())} className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-light">
              <Camera size={16} /> {photo ? "Reprendre un selfie" : "Prendre un selfie"}
            </button>
            <button type="button" onClick={() => gal.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-navy hover:bg-cream">
              <ImagePlus size={16} /> Choisir une photo
            </button>
            <input ref={cam} type="file" accept="image/*" capture="user" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
            {live && <LiveCamera onPhoto={(f) => { setPhoto(f); setLive(false); }} onClose={() => setLive(false)} onFallback={() => { setLive(false); cam.current?.click(); }} />}
            <input ref={gal} type="file" accept="image/*" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
          </div>
        </div>
        {photo && (
          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-cream/70 p-3 text-sm text-navy">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1d2f4f]" />
            <span><ShieldCheck size={14} className="mr-1 inline text-emerald-700" />J&apos;accepte que ma photo soit analysée pour me conseiller. Elle n&apos;est <strong>ni enregistrée ni partagée</strong> : elle est effacée aussitôt l&apos;analyse faite.</span>
          </label>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
        <h2 className="font-serif-display text-xl text-navy">2. Votre peau au quotidien</h2>
        <p className="mt-3 text-sm font-semibold text-navy">En fin de journée, votre peau est plutôt…</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Type de peau">
          {SKIN_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={skinType === t.id} onClick={() => setSkinType(skinType === t.id ? null : t.id)} className={`rounded-2xl border px-4 py-3 text-left transition ${skinType === t.id ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40"}`}>
              <span className="block font-semibold">{t.label}</span>
              <span className={`block text-xs ${skinType === t.id ? "text-white/80" : "text-navy/65"}`}>{t.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm font-semibold text-navy">Ce que vous aimeriez améliorer <span className="font-normal text-navy/60">(jusqu&apos;à 5)</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONCERNS.map((c) => (
            <button key={c.id} type="button" aria-pressed={concerns.includes(c.id)} onClick={() => toggle(c.id)} className={chip(concerns.includes(c.id))}>{c.label}</button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-navy">Exposition au soleil</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[["souvent", "Souvent dehors"], ["parfois", "Parfois"], ["rarement", "Rarement"]].map(([v, l]) => <button key={v} type="button" aria-pressed={sun === v} onClick={() => setSun(sun === v ? "" : v)} className={chip(sun === v)}>{l}</button>)}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">Votre âge</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[["moins25", "Moins de 25 ans"], ["25-40", "25 à 40 ans"], ["40plus", "Plus de 40 ans"]].map(([v, l]) => <button key={v} type="button" aria-pressed={age === v} onClick={() => setAge(age === v ? "" : v)} className={chip(age === v)}>{l}</button>)}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={submit} disabled={!canSubmit || pending} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-dark px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 sm:w-auto">
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {pending ? (photo && consent ? "Analyse de votre peau…" : "Préparation de votre routine…") : "Découvrir ma routine"}
        </button>
        {!canSubmit && <p className="text-xs text-navy/60">Ajoutez un selfie (et cochez l&apos;accord) ou choisissez votre type de peau.</p>}
      </div>
    </div>
  );
}

function Results({ r, origin, refSlug, advisor, onRestart, topRef }: { r: Ok; origin: string; refSlug: string | null; advisor: { name: string; whatsapp: string }; onRestart: () => void; topRef: React.RefObject<HTMLDivElement | null> }) {
  const wa = `https://wa.me/${advisor.whatsapp}?text=${encodeURIComponent(routineText(r.routine, origin, refSlug))}`;
  const block = (title: string, icon: React.ReactNode, list: RoutineStep[]) =>
    list.length ? (
      <div>
        <h3 className="flex items-center gap-2 font-serif-display text-lg text-navy">{icon} {title}</h3>
        <ol className="mt-3 space-y-2">{list.map((s, i) => <StepCard key={`${s.step}-${i}`} s={s} refSlug={refSlug} />)}</ol>
      </div>
    ) : null;

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#3a2418] via-[#5a3524] to-[#8d5a3e] p-6 text-white shadow-lg sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80"><CheckCircle2 size={16} /> Votre diagnostic beauté</p>
        <p className="mt-3 font-serif-display text-2xl leading-snug sm:text-3xl">
          {r.analysis?.summary || "Voici une routine pensée pour votre peau, d'après vos réponses."}
        </p>
        {r.analysis?.skinType && <p className="mt-2 text-sm text-white/85">Type de peau observé : <strong>{SKIN_TYPES.find((t) => t.id === r.analysis!.skinType)?.label}</strong></p>}
        {r.note && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">{r.note}</p>}
      </section>

      {r.analysis && (
        <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
          <h2 className="font-serif-display text-xl text-navy">L&apos;analyse de votre peau</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map((k) => (
              <div key={k}>
                <div className="flex justify-between text-sm"><dt className="text-navy/80">{SCORE_LABELS[k]}</dt><dd className="font-semibold text-navy">{r.analysis!.scores[k]} / 100</dd></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-navy/10" aria-hidden="true"><div className="h-full rounded-full bg-gradient-to-r from-[#c9997a] to-[#5a3524]" style={{ width: `${r.analysis!.scores[k]}%` }} /></div>
              </div>
            ))}
          </dl>
          {r.analysis.concerns.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {r.analysis.concerns.map((c) => <li key={c.label} className="rounded-2xl bg-cream/70 p-3 text-sm"><strong className="block text-navy">{c.label}</strong><span className="text-navy/75">{c.detail}</span></li>)}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-line bg-cream/40 p-5 sm:p-7">
        <h2 className="font-serif-display text-xl text-navy">Votre routine personnalisée</h2>
        {r.emptyCatalog && <p className="mt-2 text-sm text-navy/70">Les soins du visage arrivent bientôt dans la boutique : votre conseiller·e vous indique les produits adaptés.</p>}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {block("Le matin", <Sun size={18} className="text-amber-600" />, r.routine.matin)}
          {block("Le soir", <Moon size={18} className="text-indigo-700" />, r.routine.soir)}
        </div>
        <div className="mt-6">{block("Chaque semaine", <CalendarDays size={18} className="text-rose-dark" />, r.routine.hebdo)}</div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
        <h2 className="font-serif-display text-xl text-navy">Nos conseils pour votre peau</h2>
        <ul className="mt-3 space-y-2 text-sm text-navy/85">{r.advice.map((a) => <li key={a} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" />{a}</li>)}</ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 font-semibold text-white hover:bg-[#1ebe5b]">
          <MessageCircle size={18} /> Recevoir ma routine avec {advisor.name}
        </a>
        <button type="button" onClick={onRestart} className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3.5 font-semibold text-navy hover:bg-white">
          <RefreshCw size={16} /> Refaire le test
        </button>
      </div>
      <p className="text-center text-xs text-navy/55">Conseils beauté, pas un avis médical. En cas d&apos;irritation, d&apos;acné sévère ou de tache qui change, consultez un dermatologue.</p>
    </div>
  );
}
